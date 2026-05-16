/**
 * Mock VPS metrics server — reads REAL system metrics from your Windows PC.
 * Values will match Task Manager.
 *
 * Usage: node mock-vps.js
 */

import http from 'http';
import os from 'os';
import { exec } from 'child_process';

const TOKEN = 'mock-token-12345';
const PORT = 9100;

// CPU measurement: sample over 1 second using os.cpus()
let prevCpuTimes = null;

function getCpuTimes() {
  const cpus = os.cpus();
  let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;
  for (const cpu of cpus) {
    user += cpu.times.user;
    nice += cpu.times.nice;
    sys += cpu.times.sys;
    idle += cpu.times.idle;
    irq += cpu.times.irq;
  }
  return { user, nice, sys, idle, irq, total: user + nice + sys + idle + irq };
}

function getCpuPercent() {
  const curr = getCpuTimes();
  if (!prevCpuTimes) {
    prevCpuTimes = curr;
    return 0;
  }
  const totalDiff = curr.total - prevCpuTimes.total;
  const idleDiff = curr.idle - prevCpuTimes.idle;
  prevCpuTimes = curr;
  if (totalDiff === 0) return 0;
  return Math.round((1 - idleDiff / totalDiff) * 1000) / 10;
}

// --- Background metrics cache ---
// Expensive PowerShell calls run in background, results are cached
let cachedDisk = { disk_used_gb: 0, disk_total_gb: 0, disk_percent: 0 };
let cachedProcesses = { top_process_name: '', top_process_ram_mb: 0, top_processes: [] };
let cachedDockerCount = 0;

function refreshDiskInfo() {
  const psCmd = `powershell -NoProfile -Command "$d=Get-PSDrive C; $u=$d.Used; $f=$d.Free; $t=$u+$f; Write-Output ('{0}|{1}|{2}' -f $u,$f,$t)"`;
  exec(psCmd, { encoding: 'utf8', timeout: 8000 }, (err, stdout) => {
    if (err) return;
    const [usedBytes, , totalBytes] = stdout.trim().split('|').map(Number);
    if (totalBytes > 0) {
      cachedDisk = {
        disk_used_gb: Math.round(usedBytes / 1073741824 * 10) / 10,
        disk_total_gb: Math.round(totalBytes / 1073741824 * 10) / 10,
        disk_percent: Math.round(usedBytes / totalBytes * 1000) / 10,
      };
    }
  });
}

function refreshTopProcesses() {
  const psCmd = `powershell -NoProfile -Command "Get-Process | Group-Object ProcessName | ForEach-Object { $cpu = ($_.Group | Measure-Object CPU -Sum).Sum; $mem = ($_.Group | Measure-Object WorkingSet64 -Sum).Sum; [PSCustomObject]@{Name=$_.Name;Count=$_.Count;MemMB=[math]::Round($mem/1MB);CPU=[math]::Round($cpu,1)} } | Sort-Object MemMB -Descending | Select-Object -First 10 | ForEach-Object { Write-Output ('{0}|{1}|{2}|{3}' -f $_.Name,$_.Count,$_.MemMB,$_.CPU) }"`;
  exec(psCmd, { encoding: 'utf8', timeout: 10000 }, (err, stdout) => {
    if (err) return;
    const processes = stdout.trim().split('\n').filter(Boolean).map(line => {
      const [name, count, mem, cpu] = line.trim().split('|');
      return {
        name: name || '',
        count: parseInt(count) || 1,
        ram_mb: parseInt(mem) || 0,
        cpu: parseFloat(cpu) || 0,
      };
    });
    if (processes.length > 0) {
      cachedProcesses = {
        top_process_name: processes[0].name,
        top_process_ram_mb: processes[0].ram_mb,
        top_processes: processes,
      };
    }
  });
}

let cachedDockerContainers = [];

function refreshDockerCount() {
  exec('docker stats --no-stream --format "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}"', { encoding: 'utf8', timeout: 10000 }, (err, stdout) => {
    if (err) { cachedDockerCount = 0; cachedDockerContainers = []; return; }
    const lines = stdout.trim().split('\n').filter(l => l.trim());
    cachedDockerCount = lines.length;
    cachedDockerContainers = lines.map(line => {
      const [name, cpuStr, memUsage, memPctStr] = line.split('|');
      const cpu = parseFloat((cpuStr || '0').replace('%', '')) || 0;
      const memPct = parseFloat((memPctStr || '0').replace('%', '')) || 0;
      let ramMb = 0;
      if (memUsage) {
        const usedPart = memUsage.split('/')[0].trim();
        if (usedPart.includes('GiB')) ramMb = Math.round(parseFloat(usedPart) * 1024);
        else if (usedPart.includes('MiB')) ramMb = Math.round(parseFloat(usedPart));
        else if (usedPart.includes('KiB')) ramMb = Math.max(1, Math.round(parseFloat(usedPart) / 1024));
      }
      return { name: name || '', cpu: Math.round(cpu * 10) / 10, ram_mb: ramMb, mem_percent: Math.round(memPct * 10) / 10 };
    }).sort((a, b) => b.ram_mb - a.ram_mb);
  });
}

// Collect expensive metrics every 3 seconds in background (non-blocking)
refreshDiskInfo();
refreshTopProcesses();
refreshDockerCount();
setInterval(refreshDiskInfo, 5000);
setInterval(refreshTopProcesses, 3000);
setInterval(refreshDockerCount, 10000);

// Keep sampling CPU in the background so we always have a fresh delta
setInterval(getCpuPercent, 1000);
getCpuPercent();

function getMetrics() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const loadAvg = os.loadavg();

  const cpu = getCpuPercent();

  // Windows doesn't have real loadavg, approximate from CPU
  const load1 = loadAvg[0] || Math.round(cpu / 100 * os.cpus().length * 100) / 100;
  const load5 = loadAvg[1] || Math.round(load1 * 0.85 * 100) / 100;
  const load15 = loadAvg[2] || Math.round(load1 * 0.7 * 100) / 100;

  return {
    cpu,
    ram_used_mb: Math.round(usedMem / (1024 * 1024)),
    ram_total_mb: Math.round(totalMem / (1024 * 1024)),
    ram_percent: Math.round(usedMem / totalMem * 1000) / 10,
    ...cachedDisk,
    load_avg_1m: load1,
    load_avg_5m: load5,
    load_avg_15m: load15,
    uptime_seconds: Math.floor(os.uptime()),
    ...cachedProcesses,
    docker_container_count: cachedDockerCount,
    docker_containers: cachedDockerContainers,
    cpu_cores: os.cpus().length,
  };
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Connection', 'close');
  if (req.method === 'OPTIONS') { res.writeHead(200); return res.end(); }

  if (req.url !== '/metrics') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Not found' }));
  }

  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${TOKEN}`) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Unauthorized' }));
  }

  const data = getMetrics();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
});

server.keepAliveTimeout = 5000;
server.headersTimeout = 10000;

server.listen(PORT, () => {
  console.log(`Real Windows metrics agent on http://localhost:${PORT}/metrics`);
  console.log(`Auth token: ${TOKEN}`);
  console.log(`System: ${os.cpus().length} cores, ${Math.round(os.totalmem() / (1024*1024*1024))}GB RAM`);
  console.log('');
  console.log('Values will match your Task Manager.');
});
