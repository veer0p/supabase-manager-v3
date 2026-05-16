import { Client } from 'ssh2';

// The metrics agent Python script — embedded inline for auto-install
const AGENT_SCRIPT = `#!/usr/bin/env python3
import os, json, time, subprocess, threading
from http.server import HTTPServer, BaseHTTPRequestHandler

TOKEN = os.environ.get("METRICS_TOKEN") or open("/opt/vps-metrics/.token").read().strip()
PORT = int(os.environ.get("METRICS_PORT", 9100))

# --- Background cache for expensive commands ---
_cache = {
    "cpu": 0,
    "top_processes": [], "top_process_name": "", "top_process_ram_mb": 0,
    "docker_container_count": 0, "docker_containers": [],
}
_lock = threading.Lock()

def _bg_cpu():
    while True:
        try:
            def read():
                return list(map(int, open("/proc/stat").readline().split()[1:]))
            a = read()
            time.sleep(1)
            b = read()
            idle = b[3] - a[3]
            total = sum(b) - sum(a)
            val = round((1 - idle / total) * 100, 1) if total else 0
            with _lock:
                _cache["cpu"] = val
        except:
            pass
        time.sleep(1)

def _bg_processes():
    while True:
        try:
            out = subprocess.check_output(["ps", "aux", "--sort=-%mem"], text=True, timeout=10).splitlines()
            seen = {}
            for line in out[1:51]:
                f = line.split()
                if len(f) > 10:
                    name = os.path.basename(f[10])
                    mem = int(f[5]) // 1024 if len(f) > 5 else 0
                    cpu = float(f[2]) if len(f) > 2 else 0
                    if name in seen: seen[name]["ram_mb"] += mem; seen[name]["cpu"] += cpu; seen[name]["count"] += 1
                    else: seen[name] = {"name": name, "ram_mb": mem, "cpu": round(cpu, 1), "count": 1}
            procs = sorted(seen.values(), key=lambda x: x["ram_mb"], reverse=True)[:10]
            top = procs[0] if procs else {"name": "", "ram_mb": 0}
            with _lock:
                _cache["top_processes"] = procs
                _cache["top_process_name"] = top["name"]
                _cache["top_process_ram_mb"] = top["ram_mb"]
        except:
            pass
        time.sleep(3)

def _bg_docker():
    while True:
        try:
            out = subprocess.check_output(["docker", "stats", "--no-stream", "--format", "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}"], text=True, stderr=subprocess.DEVNULL, timeout=30).strip()
            containers = []
            for line in out.splitlines():
                if not line.strip(): continue
                parts = line.split("|")
                name = parts[0] if len(parts) > 0 else ""
                cpu_str = parts[1].replace("%","").strip() if len(parts) > 1 else "0"
                mem_usage = parts[2].strip() if len(parts) > 2 else ""
                mem_pct_str = parts[3].replace("%","").strip() if len(parts) > 3 else "0"
                try: cpu_val = float(cpu_str)
                except: cpu_val = 0
                try: mem_pct = float(mem_pct_str)
                except: mem_pct = 0
                mem_mb = 0
                if mem_usage:
                    used_part = mem_usage.split("/")[0].strip()
                    if "GiB" in used_part: mem_mb = int(float(used_part.replace("GiB","").strip()) * 1024)
                    elif "MiB" in used_part: mem_mb = int(float(used_part.replace("MiB","").strip()))
                    elif "KiB" in used_part: mem_mb = max(1, int(float(used_part.replace("KiB","").strip()) / 1024))
                containers.append({"name": name, "cpu": round(cpu_val, 1), "ram_mb": mem_mb, "mem_percent": round(mem_pct, 1)})
            containers.sort(key=lambda x: x["ram_mb"], reverse=True)
            with _lock:
                _cache["docker_container_count"] = len(containers)
                _cache["docker_containers"] = containers
        except:
            pass
        time.sleep(5)

# Start background collectors
for fn in [_bg_cpu, _bg_processes, _bg_docker]:
    t = threading.Thread(target=fn, daemon=True)
    t.start()

# --- Fast metric reads (no subprocess calls) ---

def ram_info():
    m = {}
    for line in open("/proc/meminfo"):
        parts = line.split()
        if len(parts) >= 2:
            m[parts[0].rstrip(":")] = int(parts[1])
    total = m.get("MemTotal", 0)
    avail = m.get("MemAvailable", m.get("MemFree", 0))
    used = total - avail
    return {"ram_used_mb": used // 1024, "ram_total_mb": total // 1024, "ram_percent": round(used * 100 / total, 1) if total else 0}

def disk_info():
    s = os.statvfs("/")
    total = s.f_blocks * s.f_frsize
    free = s.f_bavail * s.f_frsize
    used = total - free
    return {"disk_percent": round(used * 100 / total, 1) if total else 0, "disk_used_gb": round(used / 1073741824, 1), "disk_total_gb": round(total / 1073741824, 1)}

def load_info():
    parts = open("/proc/loadavg").read().split()[:3]
    return {"load_avg_1m": float(parts[0]), "load_avg_5m": float(parts[1]), "load_avg_15m": float(parts[2])}

def collect_metrics():
    ram = ram_info()
    disk = disk_info()
    load = load_info()
    uptime = int(float(open("/proc/uptime").read().split()[0]))
    cores = os.cpu_count() or 2
    with _lock:
        cached = dict(_cache)
    return {"cpu": cached["cpu"], **ram, **disk, **load, "uptime_seconds": uptime,
            "top_process_name": cached["top_process_name"], "top_process_ram_mb": cached["top_process_ram_mb"],
            "top_processes": cached["top_processes"],
            "docker_container_count": cached["docker_container_count"], "docker_containers": cached["docker_containers"],
            "cpu_cores": cores}

class MetricsHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/metrics":
            self.send_response(404); self.end_headers(); self.wfile.write(b'{"error":"Not found"}'); return
        auth = self.headers.get("Authorization", "")
        if auth != "Bearer " + TOKEN:
            self.send_response(401); self.end_headers(); self.wfile.write(b'{"error":"Unauthorized"}'); return
        try:
            data = collect_metrics()
            body = json.dumps(data).encode()
            self.send_response(200); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
        except Exception as e:
            self.send_response(500); self.end_headers(); self.wfile.write(json.dumps({"error": str(e)}).encode())
    def log_message(self, fmt, *args): pass

if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), MetricsHandler)
    print("VPS Metrics Agent running on port " + str(PORT))
    server.serve_forever()
`;

const INSTALL_COMMANDS = `
set -e
INSTALL_DIR="/opt/vps-metrics"
SERVICE_NAME="vps-metrics"
PORT=9100

# Clean up any existing agent
systemctl stop "$SERVICE_NAME" 2>/dev/null || true
systemctl disable "$SERVICE_NAME" 2>/dev/null || true
rm -f /etc/systemd/system/\${SERVICE_NAME}.service
rm -rf "$INSTALL_DIR"
systemctl daemon-reload 2>/dev/null || true

# Fresh install
mkdir -p "$INSTALL_DIR"

# Write the agent script (base64 encoded to avoid shell escaping issues)
echo "__AGENT_B64__" | base64 -d > "$INSTALL_DIR/metrics_agent.py"
chmod +x "$INSTALL_DIR/metrics_agent.py"

# Generate fresh token
TOKEN=$(openssl rand -hex 32)
echo "$TOKEN" > "$INSTALL_DIR/.token"
chmod 600 "$INSTALL_DIR/.token"

# Create systemd service
cat > /etc/systemd/system/\${SERVICE_NAME}.service << SVCEOF
[Unit]
Description=VPS Metrics Agent
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 \${INSTALL_DIR}/metrics_agent.py
Environment=METRICS_TOKEN=\${TOKEN}
Environment=METRICS_PORT=\${PORT}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME" 2>/dev/null
systemctl restart "$SERVICE_NAME"

# Open firewall
if command -v ufw &> /dev/null; then
    ufw allow \${PORT}/tcp 2>/dev/null || true
fi

# Verify the deployed script has docker_info
if grep -q "docker_info" "$INSTALL_DIR/metrics_agent.py"; then
  echo "DEPLOY_CHECK=docker_info_found"
else
  echo "DEPLOY_CHECK=docker_info_MISSING"
fi

# Output the token for capture
echo "AGENT_TOKEN=\${TOKEN}"
`;

function sshExec(ip, password, command, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    const timer = setTimeout(() => {
      conn.end();
      reject(new Error('SSH connection timed out'));
    }, timeoutMs);

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) { clearTimeout(timer); conn.end(); return reject(err); }
        let stdout = '';
        let stderr = '';
        stream.on('data', (data) => { stdout += data.toString(); });
        stream.stderr.on('data', (data) => { stderr += data.toString(); });
        stream.on('close', (code) => {
          clearTimeout(timer);
          conn.end();
          if (code !== 0) {
            reject(new Error(`Command failed (exit ${code}): ${stderr.slice(0, 500)}`));
          } else {
            resolve({ stdout, stderr });
          }
        });
      });
    });

    conn.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    conn.connect({
      host: ip,
      port: 22,
      username: 'root',
      password: password,
      readyTimeout: 10000,
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { ip, password } = req.body || {};
  if (!ip || !password) {
    return res.status(400).json({ error: 'Missing ip or password' });
  }

  try {
    // Encode agent script as base64 to avoid heredoc/shell escaping issues
    const agentB64 = Buffer.from(AGENT_SCRIPT).toString('base64');
    const installCmd = INSTALL_COMMANDS.replace('__AGENT_B64__', agentB64);

    // Always do a fresh install (removes old agent first)
    const result = await sshExec(ip, password, installCmd, 60000);
    const tokenLine = result.stdout.split('\n').find(l => l.startsWith('AGENT_TOKEN='));
    if (!tokenLine) {
      return res.status(500).json({ error: 'Agent installed but could not retrieve token' });
    }
    const token = tokenLine.split('=')[1].trim();

    // Log deploy check
    const deployCheck = result.stdout.split('\n').find(l => l.startsWith('DEPLOY_CHECK='));
    console.log('[setup] Deploy check:', deployCheck || 'not found');
    console.log('[setup] stdout:', result.stdout.slice(-300));

    // Step 3: Verify agent responds (via HTTP, not SSH)
    let verified = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const verifyRes = await fetch(`http://${ip}:9100/metrics`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (verifyRes.ok) {
          const data = await verifyRes.json();
          if (data.cpu !== undefined) {
            verified = true;
            break;
          }
        }
      } catch {
        // Agent might be starting up, wait a moment
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    return res.status(200).json({
      success: true,
      token,
      verified,
      message: verified ? 'Agent is running and responding' : 'Agent installed, may need a moment to start'
    });

  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('Authentication failed') || msg.includes('All configured authentication methods failed')) {
      return res.status(401).json({ error: 'Invalid SSH password. Check your VPS credentials.' });
    }
    if (msg.includes('timed out') || msg.includes('ETIMEDOUT')) {
      return res.status(504).json({ error: 'Could not reach VPS. Check the IP address and ensure SSH (port 22) is accessible.' });
    }
    if (msg.includes('ECONNREFUSED')) {
      return res.status(502).json({ error: 'Connection refused. Is SSH running on the VPS?' });
    }
    return res.status(500).json({ error: `Setup failed: ${msg.slice(0, 200)}` });
  }
}
