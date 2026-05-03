import time, os, subprocess

def cpu_pct():
    def read():
        return list(map(int, open("/proc/stat").readline().split()[1:]))
    a = read()
    time.sleep(1)
    b = read()
    idle = b[3] - a[3]
    total = sum(b) - sum(a)
    return round((1 - idle / total) * 100, 1) if total else 0

def ram():
    m = {}
    for line in open("/proc/meminfo"):
        parts = line.split()
        if len(parts) >= 2:
            m[parts[0].rstrip(":")] = int(parts[1])
    total = m.get("MemTotal", 0)
    avail = m.get("MemAvailable", m.get("MemFree", 0))
    used = total - avail
    used_mb = used // 1024
    total_mb = total // 1024
    pct = round(used * 100 / total, 1) if total else 0
    return used_mb, total_mb, pct

def disk():
    s = os.statvfs("/")
    total = s.f_blocks * s.f_frsize
    free = s.f_bavail * s.f_frsize
    used = total - free
    pct = round(used * 100 / total, 1) if total else 0
    return round(used / 1073741824, 1), round(total / 1073741824, 1), pct

la = open("/proc/loadavg").read().split()[:3]
up = int(float(open("/proc/uptime").read().split()[0]))

try:
    ps_out = subprocess.check_output(["ps", "aux", "--sort=-%mem"], text=True).splitlines()
    f = ps_out[1].split() if len(ps_out) > 1 else []
    tp = os.path.basename(f[10]) if len(f) > 10 else ""
    tr = int(f[5]) // 1024 if len(f) > 5 else 0
except Exception:
    tp, tr = "", 0

try:
    dc_out = subprocess.check_output(["docker", "ps", "-q"], text=True, stderr=subprocess.DEVNULL).strip()
    dc = len([l for l in dc_out.splitlines() if l.strip()])
except Exception:
    dc = 0

cpu = cpu_pct()
rm, rt, rp = ram()
du, dt, dp = disk()

print(f"{cpu}|{rm}|{rt}|{rp}|{dp}|{du}|{dt}|{la[0]}|{la[1]}|{la[2]}|{up}|{tp}|{tr}|{dc}")
