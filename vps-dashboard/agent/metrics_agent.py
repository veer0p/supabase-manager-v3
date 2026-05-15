#!/usr/bin/env python3
"""Lightweight HTTP metrics agent for VPS monitoring. Runs on port 9100."""

import os
import json
import time
import subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler

TOKEN = os.environ.get("METRICS_TOKEN") or open("/opt/vps-metrics/.token").read().strip()
PORT = int(os.environ.get("METRICS_PORT", 9100))


def cpu_percent():
    def read():
        return list(map(int, open("/proc/stat").readline().split()[1:]))
    a = read()
    time.sleep(0.5)
    b = read()
    idle = b[3] - a[3]
    total = sum(b) - sum(a)
    return round((1 - idle / total) * 100, 1) if total else 0


def ram_info():
    m = {}
    for line in open("/proc/meminfo"):
        parts = line.split()
        if len(parts) >= 2:
            m[parts[0].rstrip(":")] = int(parts[1])
    total = m.get("MemTotal", 0)
    avail = m.get("MemAvailable", m.get("MemFree", 0))
    used = total - avail
    return {
        "ram_used_mb": used // 1024,
        "ram_total_mb": total // 1024,
        "ram_percent": round(used * 100 / total, 1) if total else 0,
    }


def disk_info():
    s = os.statvfs("/")
    total = s.f_blocks * s.f_frsize
    free = s.f_bavail * s.f_frsize
    used = total - free
    return {
        "disk_percent": round(used * 100 / total, 1) if total else 0,
        "disk_used_gb": round(used / 1073741824, 1),
        "disk_total_gb": round(total / 1073741824, 1),
    }


def load_info():
    parts = open("/proc/loadavg").read().split()[:3]
    return {
        "load_avg_1m": float(parts[0]),
        "load_avg_5m": float(parts[1]),
        "load_avg_15m": float(parts[2]),
    }


def top_processes():
    try:
        out = subprocess.check_output(["ps", "aux", "--sort=-%mem"], text=True).splitlines()
        procs = []
        seen = {}
        for line in out[1:51]:  # top 50 rows, then group
            f = line.split()
            if len(f) > 10:
                name = os.path.basename(f[10])
                mem = int(f[5]) // 1024 if len(f) > 5 else 0
                cpu = float(f[2]) if len(f) > 2 else 0
                if name in seen:
                    seen[name]["ram_mb"] += mem
                    seen[name]["cpu"] += cpu
                    seen[name]["count"] += 1
                else:
                    seen[name] = {"name": name, "ram_mb": mem, "cpu": round(cpu, 1), "count": 1}
        procs = sorted(seen.values(), key=lambda x: x["ram_mb"], reverse=True)[:10]
        top = procs[0] if procs else {"name": "", "ram_mb": 0}
        return {
            "top_process_name": top["name"],
            "top_process_ram_mb": top["ram_mb"],
            "top_processes": procs,
        }
    except Exception:
        return {"top_process_name": "", "top_process_ram_mb": 0, "top_processes": []}


def docker_info():
    try:
        out = subprocess.check_output(
            ["docker", "stats", "--no-stream", "--format", "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}"],
            text=True, stderr=subprocess.DEVNULL, timeout=10
        ).strip()
        containers = []
        for line in out.splitlines():
            if not line.strip():
                continue
            parts = line.split("|")
            containers.append({
                "name": parts[0] if len(parts) > 0 else "",
                "cpu": float(parts[1].replace("%", "")) if len(parts) > 1 else 0,
                "mem_usage": parts[2].strip() if len(parts) > 2 else "",
                "mem_percent": float(parts[3].replace("%", "")) if len(parts) > 3 else 0,
            })
        return {"docker_container_count": len(containers), "docker_containers": containers}
    except Exception:
        try:
            out = subprocess.check_output(["docker", "ps", "-q"], text=True, stderr=subprocess.DEVNULL).strip()
            count = len([l for l in out.splitlines() if l.strip()])
            return {"docker_container_count": count, "docker_containers": []}
        except Exception:
            return {"docker_container_count": 0, "docker_containers": []}


def collect_metrics():
    cpu = cpu_percent()
    ram = ram_info()
    disk = disk_info()
    load = load_info()
    top = top_processes()
    uptime = int(float(open("/proc/uptime").read().split()[0]))
    cores = os.cpu_count() or 2
    return {
        "cpu": cpu,
        **ram,
        **disk,
        **load,
        "uptime_seconds": uptime,
        **top,
        **docker_info(),
        "cpu_cores": cores,
    }


class MetricsHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/metrics":
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'{"error":"Not found"}')
            return

        auth = self.headers.get("Authorization", "")
        if auth != f"Bearer {TOKEN}":
            self.send_response(401)
            self.end_headers()
            self.wfile.write(b'{"error":"Unauthorized"}')
            return

        try:
            data = collect_metrics()
            body = json.dumps(data).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def log_message(self, fmt, *args):
        pass  # Suppress request logs


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), MetricsHandler)
    print(f"VPS Metrics Agent running on port {PORT}")
    server.serve_forever()
