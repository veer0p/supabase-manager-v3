const express = require('express');
const cors = require('cors');
const { NodeSSH } = require('node-ssh');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();
app.use(cors());
app.use(express.json());

// --- Database Setup ---
const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:vcp2CWFk91DO@localhost:5435/postgres';
const pool = new Pool({ connectionString: DB_URL, connectionTimeoutMillis: 8000 });

const query = async (sql, params = []) => {
    const client = await pool.connect();
    try {
        const res = await client.query(sql, params);
        return res.rows;
    } finally {
        client.release();
    }
};

// --- DB Init ---
async function initDB() {
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS vps_nodes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name TEXT NOT NULL, ip TEXT NOT NULL, password TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS instances (
                project_name TEXT PRIMARY KEY, node_id UUID,
                domain TEXT NOT NULL, studio_domain TEXT NOT NULL, password TEXT NOT NULL,
                pg_password TEXT, anon_key TEXT, service_role_key TEXT,
                status TEXT NOT NULL, is_protected BOOLEAN DEFAULT false,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS config (
                id INTEGER PRIMARY KEY DEFAULT 1, auth_enabled BOOLEAN DEFAULT true, admin_pass TEXT DEFAULT 'admin123'
            );
            CREATE TABLE IF NOT EXISTS vps_metrics (
                id BIGSERIAL PRIMARY KEY,
                node_id UUID,
                recorded_at TIMESTAMPTZ DEFAULT NOW(),
                cpu_percent FLOAT DEFAULT 0,
                ram_percent FLOAT DEFAULT 0,
                ram_used_mb BIGINT DEFAULT 0,
                ram_total_mb BIGINT DEFAULT 0,
                disk_percent FLOAT DEFAULT 0,
                disk_used_gb FLOAT DEFAULT 0,
                disk_total_gb FLOAT DEFAULT 0,
                load_avg_1m FLOAT DEFAULT 0,
                load_avg_5m FLOAT DEFAULT 0,
                load_avg_15m FLOAT DEFAULT 0,
                uptime_seconds BIGINT DEFAULT 0,
                top_process_name TEXT DEFAULT '',
                top_process_ram_mb BIGINT DEFAULT 0,
                docker_container_count INT DEFAULT 0,
                cpu_cores INT DEFAULT 2
            );
            CREATE INDEX IF NOT EXISTS idx_vps_metrics_node_time ON vps_metrics(node_id, recorded_at DESC);
            INSERT INTO config (id) VALUES (1) ON CONFLICT DO NOTHING;
            ALTER TABLE vps_metrics ADD COLUMN IF NOT EXISTS cpu_cores INT DEFAULT 2;
        `);
        console.log('DB initialized');
    } catch (e) {
        console.error('DB init failed (running in JSON fallback mode):', e.message);
    }
}

// --- JSON Fallback Layer (for local dev without DB) ---
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
const INSTANCES_FILE = path.join(DATA_DIR, 'instances.json');
const NODES_FILE = path.join(DATA_DIR, 'nodes.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
if (!fs.existsSync(INSTANCES_FILE)) fs.writeFileSync(INSTANCES_FILE, JSON.stringify({}));
if (!fs.existsSync(NODES_FILE)) fs.writeFileSync(NODES_FILE, JSON.stringify([]));
if (!fs.existsSync(CONFIG_FILE)) fs.writeFileSync(CONFIG_FILE, JSON.stringify({ auth_enabled: true, admin_pass: 'admin123' }));
const getJSONDB = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const saveJSONDB = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

let useDB = false; // Will be set to true if DB is reachable

async function checkDB() {
    try {
        await query('SELECT 1');
        useDB = true;
        console.log('Database connected. Using Postgres storage.');
    } catch (e) {
        useDB = false;
        console.log('Database not reachable. Using JSON file fallback.');
    }
}

// --- Data Access Layer ---
const db = {
    getNodes: async () => {
        if (!useDB) return getJSONDB(NODES_FILE);
        return query('SELECT id, name, ip, password FROM vps_nodes ORDER BY created_at');
    },
    addNode: async ({ id, name, ip, password }) => {
        if (!useDB) {
            const nodes = getJSONDB(NODES_FILE);
            nodes.push({ id, name, ip, password });
            saveJSONDB(NODES_FILE, nodes);
            return;
        }
        await query('INSERT INTO vps_nodes (id, name, ip, password) VALUES ($1,$2,$3,$4)', [id, name, ip, password]);
    },
    deleteNode: async (id) => {
        if (!useDB) { saveJSONDB(NODES_FILE, getJSONDB(NODES_FILE).filter(n => n.id !== id)); return; }
        await query('DELETE FROM vps_nodes WHERE id = $1', [id]);
    },
    getInstances: async () => {
        if (!useDB) return getJSONDB(INSTANCES_FILE);
        const rows = await query('SELECT * FROM instances ORDER BY created_at');
        // Return in same shape as JSON version: { project_name: {...} }
        return rows.reduce((acc, r) => {
            acc[r.project_name] = {
                nodeId: r.node_id, domain: r.domain, studio_domain: r.studio_domain,
                password: r.password, pgPassword: r.pg_password, 
                anonKey: r.anon_key, serviceRoleKey: r.service_role_key,
                status: r.status, isProtected: r.is_protected
            };
            return acc;
        }, {});
    },
    upsertInstance: async (name, data) => {
        if (!useDB) {
            const instances = getJSONDB(INSTANCES_FILE);
            instances[name] = { ...instances[name], ...data };
            saveJSONDB(INSTANCES_FILE, instances);
            return;
        }
        await query(`
            INSERT INTO instances (project_name, node_id, domain, studio_domain, password, pg_password, anon_key, service_role_key, status)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            ON CONFLICT (project_name) DO UPDATE SET 
                node_id=EXCLUDED.node_id, domain=EXCLUDED.domain, studio_domain=EXCLUDED.studio_domain,
                password=EXCLUDED.password, pg_password=EXCLUDED.pg_password, 
                anon_key=EXCLUDED.anon_key, service_role_key=EXCLUDED.service_role_key,
                status=EXCLUDED.status
        `, [name, data.nodeId, data.domain, data.studio_domain, data.password, data.pgPassword, data.anonKey || '', data.serviceRoleKey || '', data.status]);
    },
    updateInstanceKeys: async (name, anonKey, serviceRoleKey) => {
        if (!useDB) {
            const instances = getJSONDB(INSTANCES_FILE);
            if(instances[name]) { 
                instances[name].anonKey = anonKey; 
                instances[name].serviceRoleKey = serviceRoleKey; 
                saveJSONDB(INSTANCES_FILE, instances); 
            }
            return;
        }
        await query('UPDATE instances SET anon_key=$1, service_role_key=$2 WHERE project_name=$3', [anonKey, serviceRoleKey, name]);
    },
    updateInstanceStatus: async (name, status) => {
        if (!useDB) {
            const instances = getJSONDB(INSTANCES_FILE);
            if(instances[name]) { instances[name].status = status; saveJSONDB(INSTANCES_FILE, instances); }
            return;
        }
        await query('UPDATE instances SET status=$1 WHERE project_name=$2', [status, name]);
    },
    updateInstancePassword: async (name, password) => {
        if (!useDB) {
            const instances = getJSONDB(INSTANCES_FILE);
            if(instances[name]) { instances[name].password = password; saveJSONDB(INSTANCES_FILE, instances); }
            return;
        }
        await query('UPDATE instances SET password=$1 WHERE project_name=$2', [password, name]);
    },
    deleteInstance: async (name) => {
        if (!useDB) {
            const instances = getJSONDB(INSTANCES_FILE);
            delete instances[name];
            saveJSONDB(INSTANCES_FILE, instances);
            return;
        }
        await query('DELETE FROM instances WHERE project_name=$1', [name]);
    },
    getConfig: async () => {
        if (!useDB) return getJSONDB(CONFIG_FILE);
        const rows = await query('SELECT * FROM config WHERE id=1');
        return rows[0] ? { auth_enabled: rows[0].auth_enabled, admin_pass: rows[0].admin_pass } : { auth_enabled: true, admin_pass: 'admin123' };
    },
    setConfig: async (config) => {
        if (!useDB) { saveJSONDB(CONFIG_FILE, { ...getJSONDB(CONFIG_FILE), ...config }); return; }
        await query('UPDATE config SET auth_enabled=$1, admin_pass=$2 WHERE id=1', [config.auth_enabled, config.admin_pass]);
    },
    clearStaleDeployments: async () => {
        if (!useDB) {
            const instances = getJSONDB(INSTANCES_FILE);
            let changed = false;
            Object.keys(instances).forEach(name => {
                if (instances[name].status === 'deploying' || instances[name].status === 'deleting') {
                    instances[name].status = 'error';
                    changed = true;
                }
            });
            if (changed) saveJSONDB(INSTANCES_FILE, instances);
            return;
        }
        await query("UPDATE instances SET status='error' WHERE status IN ('deploying', 'deleting')");
    }
};

// --- Supabase Auth Configuration ---
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://manager.veer-vps.duckdns.org';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Auth Middleware ---
const authMiddleware = async (req, res, next) => {
    const config = await db.getConfig();
    if (!config.auth_enabled) return next();

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        return res.status(401).json({ error: 'Invalid or expired session' });
    }

    req.user = user;
    next();
};

app.use('/api', authMiddleware);

const generatePassword = () => crypto.randomBytes(9).toString('base64').replace(/[\+\/]/g, 'a').slice(0, 12);

// Store deployment logs in memory
global.deploymentLogs = {};

async function runSSH(nodeId, script, logKey = null) {
    const nodes = await db.getNodes();
    const node = Array.isArray(nodes) ? nodes.find(n => n.id === nodeId) : null;
    if (!node) throw new Error("Node not found");
    if (logKey) global.deploymentLogs[logKey] = '';
    const ssh = new NodeSSH();
    await ssh.connect({ host: node.ip, username: 'root', password: node.password, readyTimeout: 20000 });
    
    // Set a 10-minute timeout for the entire command to prevent hanging
    const result = await ssh.execCommand(script, {
        cwd: '/root',
        onStdout: (chunk) => { 
            const o = chunk.toString(); 
            console.log(o); 
            if (logKey) {
                global.deploymentLogs[logKey] += o;
                // Cap logs at ~50KB to prevent memory issues
                if (global.deploymentLogs[logKey].length > 50000) {
                    global.deploymentLogs[logKey] = global.deploymentLogs[logKey].slice(-50000);
                }
            }
        },
        onStderr: (chunk) => { 
            const e = chunk.toString(); 
            console.error(e); 
            if (logKey) {
                global.deploymentLogs[logKey] += e;
                if (global.deploymentLogs[logKey].length > 50000) {
                    global.deploymentLogs[logKey] = global.deploymentLogs[logKey].slice(-50000);
                }
            }
        },
    });
    ssh.dispose();
    if (result.code !== 0) throw new Error(`SSH failed: ${result.stderr}`);
    return result;
}

// --- CONFIG ---
app.get('/api/config', async (req, res) => res.json(await db.getConfig()));
app.post('/api/config', async (req, res) => { await db.setConfig(req.body); res.json({ success: true }); });

// --- NODES ---
app.get('/api/nodes', async (req, res) => {
    const nodes = await db.getNodes();
    res.json((Array.isArray(nodes) ? nodes : []).map(n => ({ id: n.id, name: n.name, ip: n.ip })));
});
app.post('/api/nodes', async (req, res) => {
    const { name, ip, password } = req.body;
    if (!name || !ip || !password) return res.status(400).json({ error: 'Missing fields' });
    const id = crypto.randomUUID();
    await db.addNode({ id, name, ip, password });
    res.json({ success: true, id });
});
app.delete('/api/nodes/:id', async (req, res) => { await db.deleteNode(req.params.id); res.json({ success: true }); });

// --- INSTANCES ---
app.get('/api/instances', async (req, res) => res.json(await db.getInstances()));

app.post('/api/deploy', async (req, res) => {
    const { project_name, nodeId } = req.body;
    if (!project_name || !nodeId) return res.status(400).json({ error: 'project_name and nodeId required' });

    const nodes = await db.getNodes();
    const node = (Array.isArray(nodes) ? nodes : []).find(n => n.id === nodeId);
    if (!node) return res.status(404).json({ error: 'Node not found' });

    const domain = `${project_name}.veer-vps.duckdns.org`;
    const studio_domain = `${project_name}-studio.veer-vps.duckdns.org`;
    const password = generatePassword();
    const pgPassword = generatePassword();

    await db.upsertInstance(project_name, { nodeId, domain, studio_domain, password, pgPassword, status: 'deploying' });
    res.json({ success: true });

    const email = `admin@veer-vps.duckdns.org`;
    const script = `#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gnupg git ufw coreutils
if ! command -v docker &> /dev/null; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update -y && apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
if ! command -v caddy &> /dev/null; then
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -y && apt-get install caddy -y
fi
PROJ_DIR="/opt/supabase-${project_name}"
if [ ! -d "$PROJ_DIR" ]; then
    git clone --depth 1 https://github.com/supabase/supabase "$PROJ_DIR"
fi
cd "$PROJ_DIR/docker"
cp -n .env.example .env || true
    sed -i "s|^API_EXTERNAL_URL=.*|API_EXTERNAL_URL=https://${domain}|" .env
    sed -i "s|^DASHBOARD_PASSWORD=.*|DASHBOARD_PASSWORD=${password}|" .env
    sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${pgPassword}|" .env
    sed -i "s|^SITE_URL=.*|SITE_URL=https://${studio_domain}|" .env
    
    # Assign unique ports to avoid conflicts (using port offset based on hash)
    PORT_OFFSET=$(echo "${project_name}" | cksum | awk '{print $1 % 100}')
    HTTP_PORT=$((9000 + PORT_OFFSET * 2))
    STUDIO_PORT=$((9001 + PORT_OFFSET * 2))
    PG_PORT=$((5440 + PORT_OFFSET))
    POOL_PORT=$((6543 + PORT_OFFSET))
    
    {
      echo "COMPOSE_PROJECT_NAME=supabase_${project_name}"
      echo "POSTGRES_PORT=${PG_PORT}"
      echo "KONG_HTTP_PORT=${HTTP_PORT}"
      echo "KONG_HTTPS_PORT=${STUDIO_PORT}"
      echo "POOLER_PROXY_PORT_TRANSACTION=${POOL_PORT}"
    } >> .env

    # Remove hardcoded container names to allow multiple instances on one host
    sed -i "/container_name:/d" docker-compose.yml
grep -q "${domain}" /etc/caddy/Caddyfile || cat >> /etc/caddy/Caddyfile <<CADDYEOF

${domain} {
    tls ${email}
    reverse_proxy localhost:$HTTP_PORT
}
${studio_domain} {
    tls ${email}
    reverse_proxy localhost:$STUDIO_PORT
}
CADDYEOF
systemctl restart caddy
docker compose pull
docker compose up -d
echo "---SUPABASE_KEYS_START---"
grep "^ANON_KEY=" .env || true
grep "^SERVICE_ROLE_KEY=" .env || true
echo "---SUPABASE_KEYS_END---"
ufw allow 80/tcp || true && ufw allow 443/tcp || true && ufw allow 22/tcp || true && ufw allow 4000/tcp || true && ufw --force enable || true
`;
    try {
        const result = await runSSH(nodeId, script, project_name);
        
        // Extract keys from result.stdout
        let anonKey = '';
        let serviceRoleKey = '';
        const lines = result.stdout.split('\n');
        let inKeys = false;
        lines.forEach(line => {
            if (line.includes('---SUPABASE_KEYS_START---')) inKeys = true;
            else if (line.includes('---SUPABASE_KEYS_END---')) inKeys = false;
            else if (inKeys) {
                if (line.startsWith('ANON_KEY=')) anonKey = line.split('=')[1].trim();
                if (line.startsWith('SERVICE_ROLE_KEY=')) serviceRoleKey = line.split('=')[1].trim();
            }
        });

        await db.updateInstanceKeys(project_name, anonKey, serviceRoleKey);
        await db.updateInstanceStatus(project_name, 'active');
    } catch (e) {
        console.error('Deploy error:', e);
        await db.updateInstanceStatus(project_name, 'error');
    }
});

app.post('/api/delete', async (req, res) => {
    const { project_name } = req.body;
    const instances = await db.getInstances();
    const inst = instances[project_name];
    if (!inst) return res.status(404).json({ error: 'Instance not found' });
    if (inst.isProtected) return res.status(403).json({ error: 'This instance is protected and cannot be deleted.' });
    
    const nodeId = inst.nodeId;
    await db.updateInstanceStatus(project_name, 'deleting');
    res.json({ success: true });
    try {
        const script = `#!/bin/bash
PROJ_DIR="/opt/supabase-${project_name}"
if [ -d "$PROJ_DIR/docker" ]; then cd "$PROJ_DIR/docker" && docker compose down -v || true; fi
rm -rf "$PROJ_DIR"
sed -i "/${project_name}/,/^}/d" /etc/caddy/Caddyfile || true
systemctl restart caddy || true
`;
        await runSSH(nodeId, script, project_name);
        await db.deleteInstance(project_name);
    } catch (e) {
        console.error('Delete error:', e);
        await db.updateInstanceStatus(project_name, 'delete_error');
    }
});

app.post('/api/reset-password', async (req, res) => {
    const { project_name } = req.body;
    if (project_name === 'manager-db') return res.status(403).json({ error: 'System instance password is managed externally.' });
    const instances = await db.getInstances();
    if (!instances[project_name]) return res.status(404).json({ error: 'Not found' });
    const newPass = generatePassword();
    await db.updateInstancePassword(project_name, newPass);
    res.json({ success: true, newPass });
    try {
        const script = `sed -i "s|^DASHBOARD_PASSWORD=.*|DASHBOARD_PASSWORD=${newPass}|" /opt/supabase-${project_name}/docker/.env && cd /opt/supabase-${project_name}/docker && docker compose restart studio`;
        await runSSH(instances[project_name].nodeId, script);
    } catch(e) { console.error('Reset pwd error:', e); }
});

// --- LOGS ---
app.get('/api/logs/:id', (req, res) => res.json({ logs: global.deploymentLogs[req.params.id] || '' }));

// --- LIVE STATS: serve from DB cache (30s poller), SSH only as fallback ---
const statsCache = {}; // in-memory cache keyed by nodeId

function parseMetricsRow(row) {
    return {
        cpu:                parseFloat(row.cpu_percent)         || 0,
        ram_used_mb:        parseInt(row.ram_used_mb)           || 0,
        ram_total_mb:       parseInt(row.ram_total_mb)          || 0,
        ram_percent:        parseFloat(row.ram_percent)         || 0,
        disk_percent:       parseFloat(row.disk_percent)        || 0,
        disk_used_gb:       parseFloat(row.disk_used_gb)        || 0,
        disk_total_gb:      parseFloat(row.disk_total_gb)       || 0,
        load_avg_1m:        parseFloat(row.load_avg_1m)         || 0,
        load_avg_5m:        parseFloat(row.load_avg_5m)         || 0,
        load_avg_15m:       parseFloat(row.load_avg_15m)        || 0,
        uptime_seconds:     parseInt(row.uptime_seconds)        || 0,
        top_process_name:   row.top_process_name                || '',
        top_process_ram_mb: parseInt(row.top_process_ram_mb)   || 0,
        docker_container_count: parseInt(row.docker_container_count) || 0,
        cpu_cores:          parseInt(row.cpu_cores)             || 2,
        source: 'db',
    };
}

function parsePipeOutput(stdout) {
    const lines = stdout.trim().split('\n').filter(l => l.includes('|'));
    const p = (lines[lines.length - 1] || '').split('|');
    return {
        cpu:                parseFloat(p[0])  || 0,
        ram_used_mb:        parseInt(p[1])    || 0,
        ram_total_mb:       parseInt(p[2])    || 0,
        ram_percent:        parseFloat(p[3])  || 0,
        disk_percent:       parseFloat(p[4])  || 0,
        disk_used_gb:       parseFloat(p[5])  || 0,
        disk_total_gb:      parseFloat(p[6])  || 0,
        load_avg_1m:        parseFloat(p[7])  || 0,
        load_avg_5m:        parseFloat(p[8])  || 0,
        load_avg_15m:       parseFloat(p[9])  || 0,
        uptime_seconds:     parseInt(p[10])   || 0,
        top_process_name:   p[11]             || '',
        top_process_ram_mb: parseInt(p[12])   || 0,
        docker_container_count: parseInt(p[13]) || 0,
        cpu_cores:          parseInt(p[14])   || 2,
        source: 'ssh',
    };
}

app.get('/api/stats/:nodeId', async (req, res) => {
    const { nodeId } = req.params;
    try {
        // 1) Return in-memory cache if fresh (< 15s old)
        const cached = statsCache[nodeId];
        if (cached && (Date.now() - cached.ts) < 15000) {
            return res.json(cached.data);
        }

        // 2) Serve from DB (latest row from 30s poller, must be < 90s old)
        if (useDB) {
            const rows = await query(`
                SELECT * FROM vps_metrics
                WHERE node_id = $1 AND recorded_at > NOW() - INTERVAL '90 seconds'
                ORDER BY recorded_at DESC LIMIT 1
            `, [nodeId]);
            if (rows.length > 0) {
                const data = parseMetricsRow(rows[0]);
                statsCache[nodeId] = { ts: Date.now(), data };
                return res.json(data);
            }
        }

        // 3) Fallback: SSH (only if no DB or no recent row yet)
        const result = await runSSH(nodeId, 'python3 /opt/supabase-manager/metrics.py');
        const data = parsePipeOutput(result.stdout);
        statsCache[nodeId] = { ts: Date.now(), data };
        res.json(data);
    } catch(e) { res.status(500).json({ error: e.message }); }
});


// --- HISTORICAL METRICS ---
app.get('/api/metrics/:nodeId', async (req, res) => {
    if (!useDB) return res.json([]);
    const period = req.query.period || '1h';
    const intervals = { '1h': '1 hour', '6h': '6 hours', '24h': '24 hours', '7d': '7 days', '30d': '30 days' };
    const interval = intervals[period] || '1 hour';
    try {
        const rows = await query(`
            SELECT recorded_at, cpu_percent, ram_percent, disk_percent,
                   load_avg_1m, load_avg_5m, load_avg_15m,
                   ram_used_mb, ram_total_mb, docker_container_count, cpu_cores
            FROM vps_metrics
            WHERE node_id = $1 AND recorded_at > NOW() - INTERVAL '${interval}'
            ORDER BY recorded_at ASC
        `, [req.params.nodeId]);
        res.json(rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// --- METRICS SUMMARY (peaks, averages) ---
app.get('/api/metrics/summary/:nodeId', async (req, res) => {
    if (!useDB) return res.json({});
    try {
        const rows = await query(`
            SELECT
                AVG(cpu_percent) as avg_cpu, MAX(cpu_percent) as peak_cpu,
                AVG(ram_percent) as avg_ram, MAX(ram_percent) as peak_ram,
                MAX(disk_percent) as peak_disk,
                MIN(recorded_at) as since
            FROM vps_metrics
            WHERE node_id = $1 AND recorded_at > NOW() - INTERVAL '24 hours'
        `, [req.params.nodeId]);
        res.json(rows[0] || {});
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// --- ALERTS: threshold breaches across all nodes ---
app.get('/api/alerts', async (req, res) => {
    if (!useDB) return res.json([]);
    try {
        const rows = await query(`
            SELECT DISTINCT ON (m.node_id)
                n.name as node_name, n.ip,
                m.cpu_percent, m.ram_percent, m.disk_percent,
                m.top_process_name, m.top_process_ram_mb,
                m.load_avg_1m, m.recorded_at
            FROM vps_metrics m
            JOIN vps_nodes n ON n.id = m.node_id
            WHERE m.recorded_at > NOW() - INTERVAL '2 minutes'
            ORDER BY m.node_id, m.recorded_at DESC
        `);
        const alerts = [];
        for (const r of rows) {
            if (r.cpu_percent > 85) alerts.push({ node: r.node_name, type: 'cpu', value: r.cpu_percent, message: `CPU at ${r.cpu_percent.toFixed(1)}%` });
            if (r.ram_percent > 90) alerts.push({ node: r.node_name, type: 'ram', value: r.ram_percent, message: `RAM at ${r.ram_percent.toFixed(1)}%` });
            if (r.disk_percent > 90) alerts.push({ node: r.node_name, type: 'disk', value: r.disk_percent, message: `Disk at ${r.disk_percent.toFixed(1)}%` });
        }
        res.json(alerts);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// --- LOCAL PC FILE BROWSER ---
app.get('/api/local/files', async (req, res) => {
    const os = require('os');
    const dir = req.query.path || os.homedir();
    try {
        if (!fs.existsSync(dir)) {
            return res.status(404).json({ error: 'Directory not found' });
        }
        const items = fs.readdirSync(dir);
        const files = items.map(item => {
            try {
                const stat = fs.statSync(path.join(dir, item));
                return { name: item, size: stat.size, isDirectory: stat.isDirectory() };
            } catch (e) {
                return null;
            }
        }).filter(Boolean);
        res.json({ path: dir, files });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// --- VPS FILE BROWSER ---
app.get('/api/files/:nodeId', async (req, res) => {
    const dir = req.query.path || '/';
    try {
        const script = `ls -lA "${dir}" | tail -n +2 | awk '{print $1, $5, $9}' | grep -v "^$"`;
        const result = await runSSH(req.params.nodeId, script);
        const files = result.stdout.trim().split('\n').filter(Boolean).map(line => {
            const parts = line.split(' ');
            return { name: parts[2], size: parseInt(parts[1], 10) || 0, isDirectory: parts[0].startsWith('d') };
        }).filter(f => f.name);
        res.json({ path: dir, files });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

const upload = multer({ dest: 'uploads/' });
app.post('/api/files/upload/:nodeId', upload.single('file'), async (req, res) => {
    const destDir = req.body.path || '/root';
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const nodes = await db.getNodes();
    const node = (Array.isArray(nodes) ? nodes : []).find(n => n.id === req.params.nodeId);
    try {
        const ssh = new NodeSSH();
        await ssh.connect({ host: node.ip, username: 'root', password: node.password });
        await ssh.putFile(req.file.path, `${destDir}/${req.file.originalname}`);
        ssh.dispose();
        fs.unlinkSync(req.file.path);
        res.json({ success: true });
    } catch(e) { fs.unlinkSync(req.file.path); res.status(500).json({ error: e.message }); }
});

// --- HIGH SPEED TRANSFER TUNNEL ---
app.post('/api/tunnel/transfer', async (req, res) => {
    const { nodeId, direction, localPath, remotePath } = req.body;
    // direction: 'local_to_vps' or 'vps_to_local'
    if (!nodeId || !localPath || !remotePath) return res.status(400).json({ error: 'Missing paths or node' });

    const nodes = await db.getNodes();
    const node = (Array.isArray(nodes) ? nodes : []).find(n => n.id === nodeId);
    if (!node) return res.status(404).json({ error: 'Node not found' });

    try {
        const ssh = new NodeSSH();
        await ssh.connect({ host: node.ip, username: 'root', password: node.password });
        
        if (direction === 'local_to_vps') {
            await ssh.putFile(localPath, remotePath);
        } else if (direction === 'vps_to_local') {
            await ssh.getFile(localPath, remotePath);
        } else {
            ssh.dispose();
            return res.status(400).json({ error: 'Invalid direction' });
        }
        
        ssh.dispose();
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// --- METRICS POLLER (30-second background job) ---
const METRICS_SCRIPT = 'python3 /opt/supabase-manager/metrics.py';

async function collectNodeMetrics(node) {
    try {
        const ssh = new NodeSSH();
        await ssh.connect({ host: node.ip, username: 'root', password: node.password, readyTimeout: 10000 });
        const result = await ssh.execCommand(METRICS_SCRIPT, { cwd: '/root' });
        ssh.dispose();
        const lines = result.stdout.trim().split('\n').filter(l => l.includes('|'));
        const lastLine = lines[lines.length - 1] || '';
        const p = lastLine.split('|');
        if (p.length < 10) return;
        await query(`
            INSERT INTO vps_metrics 
            (node_id, cpu_percent, ram_used_mb, ram_total_mb, ram_percent,
             disk_percent, disk_used_gb, disk_total_gb,
             load_avg_1m, load_avg_5m, load_avg_15m, uptime_seconds,
             top_process_name, top_process_ram_mb, docker_container_count, cpu_cores)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        `, [
            node.id,
            parseFloat(p[0]) || 0,
            parseInt(p[1]) || 0, parseInt(p[2]) || 0, parseFloat(p[3]) || 0,
            parseFloat(p[4]) || 0, parseFloat(p[5]) || 0, parseFloat(p[6]) || 0,
            parseFloat(p[7]) || 0, parseFloat(p[8]) || 0, parseFloat(p[9]) || 0,
            parseInt(p[10]) || 0, p[11] || '', parseInt(p[12]) || 0, parseInt(p[13]) || 0,
            parseInt(p[14]) || 2
        ]);
    } catch(e) {
        // Silently fail — node may be temporarily unreachable
        console.warn(`[Metrics] Could not collect from ${node.name} (${node.ip}): ${e.message}`);
    }
}

async function collectAllNodeMetrics() {
    if (!useDB) return;
    try {
        const nodes = await db.getNodes();
        if (!Array.isArray(nodes) || nodes.length === 0) return;
        await Promise.all(nodes.map(collectNodeMetrics));
        // Cleanup: delete metrics older than 30 days
        await query(`DELETE FROM vps_metrics WHERE recorded_at < NOW() - INTERVAL '30 days'`);
    } catch(e) {
        console.warn('[Metrics] Poller error:', e.message);
    }
}

// --- SERVE FRONTEND ---
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.use((req, res) => {
    const p = path.join(__dirname, '../frontend/dist/index.html');
    if (fs.existsSync(p)) res.sendFile(p);
    else res.send("API running on port 4000. Frontend not built yet.");
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, async () => {
    await checkDB();
    await initDB();
    
    // Clear any statuses stuck from a previous crash
    console.log('🧹 Cleaning up stale deployment statuses...');
    await db.clearStaleDeployments();

    // Start background metrics poller
    if (useDB) {
        console.log('📊 Starting VPS metrics poller (every 30s)...');
        collectAllNodeMetrics(); // Run immediately on startup
        setInterval(collectAllNodeMetrics, 30_000);
    }
    console.log(`V4 API (Real-Time Intelligence) running on port ${PORT}`);
});

