/**
 * Mock VPS metrics server — reads REAL system metrics from your Windows PC.
 * Values will match Task Manager.
 *
 * Usage: node mock-vps.js
 */

import http from 'http';
import os from 'os';
import { execSync } from 'child_process';

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

// Keep sampling CPU in the background so we always have a fresh delta
setInterval(getCpuPercent, 1000);
// Prime the first reading
getCpuPercent();

function getDiskInfo() {
  try {
    // Use PowerShell to get C: drive info, output as JSON
    const psCmd = `powershell -NoProfile -Command "$d=Get-PSDrive C; $u=$d.Used; $f=$d.Free; $t=$u+$f; Write-Output ('{0}|{1}|{2}' -f $u,$f,$t)"`;
    const output = execSync(psCmd, { encoding: 'utf8', timeout: 5000 }).trim();
    const [usedBytes, , totalBytes] = output.split('|').map(Number);
    return {
      disk_used_gb: Math.round(usedBytes / 1073741824 * 10) / 10,
      disk_total_gb: Math.round(totalBytes / 1073741824 * 10) / 10,
      disk_percent: totalBytes > 0 ? Math.round(usedBytes / totalBytes * 1000) / 10 : 0,
    };
  } catch {
    return { disk_used_gb: 0, disk_total_gb: 0, disk_percent: 0 };
  }
}

function getTopProcesses() {
  try {
    const psCmd = `powershell -NoProfile -Command "Get-Process | Group-Object ProcessName | ForEach-Object { $cpu = ($_.Group | Measure-Object CPU -Sum).Sum; $mem = ($_.Group | Measure-Object WorkingSet64 -Sum).Sum; [PSCustomObject]@{Name=$_.Name;Count=$_.Count;MemMB=[math]::Round($mem/1MB);CPU=[math]::Round($cpu,1)} } | Sort-Object MemMB -Descending | Select-Object -First 10 | ForEach-Object { Write-Output ('{0}|{1}|{2}|{3}' -f $_.Name,$_.Count,$_.MemMB,$_.CPU) }"`;
    const output = execSync(psCmd, { encoding: 'utf8', timeout: 8000 }).trim();
    const processes = output.split('\n').filter(Boolean).map(line => {
      const [name, count, mem, cpu] = line.trim().split('|');
      return {
        name: name || '',
        count: parseInt(count) || 1,
        ram_mb: parseInt(mem) || 0,
        cpu: parseFloat(cpu) || 0,
      };
    });
    return {
      top_process_name: processes[0]?.name || '',
      top_process_ram_mb: processes[0]?.ram_mb || 0,
      top_processes: processes,
    };
  } catch {
    return { top_process_name: '', top_process_ram_mb: 0, top_processes: [] };
  }
}

function getDockerContainers() {
  try {
    const output = execSync(
      'docker stats --no-stream --format "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}|{{.Status}}"',
      { encoding: 'utf8', timeout: 10000 }
    );
    const containers = output.trim().split('\n').filter(Boolean).map(line => {
      const [name, cpuStr, memUsage, memPctStr, status] = line.split('|');
      return {
        name: name || '',
        cpu: parseFloat(cpuStr) || 0,
        mem_usage: memUsage?.trim() || '',
        mem_percent: parseFloat(memPctStr) || 0,
        status: status?.trim() || 'running',
      };
    });
    return { docker_container_count: containers.length, docker_containers: containers };
  } catch {
    // Fallback: just count
    try {
      const output = execSync('docker ps -q', { encoding: 'utf8', timeout: 3000 });
      const count = output.trim().split('\n').filter(l => l.trim()).length;
      return { docker_container_count: count, docker_containers: [] };
    } catch {
      return { docker_container_count: 0, docker_containers: [] };
    }
  }
}

function getMetrics() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const loadAvg = os.loadavg(); // On Windows this returns [0,0,0], we'll use CPU% as proxy

  const cpu = getCpuPercent();

  // Windows doesn't have real loadavg, approximate from CPU
  const load1 = loadAvg[0] || Math.round(cpu / 100 * os.cpus().length * 100) / 100;
  const load5 = loadAvg[1] || Math.round(load1 * 0.85 * 100) / 100;
  const load15 = loadAvg[2] || Math.round(load1 * 0.7 * 100) / 100;

  const disk = getDiskInfo();
  const top = getTopProcesses();

  return {
    cpu,
    ram_used_mb: Math.round(usedMem / (1024 * 1024)),
    ram_total_mb: Math.round(totalMem / (1024 * 1024)),
    ram_percent: Math.round(usedMem / totalMem * 1000) / 10,
    ...disk,
    load_avg_1m: load1,
    load_avg_5m: load5,
    load_avg_15m: load15,
    uptime_seconds: Math.floor(os.uptime()),
    ...top,
    ...getDockerContainers(),
    cpu_cores: os.cpus().length,
  };
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
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

server.listen(PORT, () => {
  console.log(`Real Windows metrics agent on http://localhost:${PORT}/metrics`);
  console.log(`Auth token: ${TOKEN}`);
  console.log(`System: ${os.cpus().length} cores, ${Math.round(os.totalmem() / (1024*1024*1024))}GB RAM`);
  console.log('');
  console.log('Values will match your Task Manager.');
});
