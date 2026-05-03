const express = require('express');
const cors = require('cors');
const { NodeSSH } = require('node-ssh');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const app = express();
app.use(cors());
app.use(express.json());

// --- Database Setup ---
// When running on VPS, connects to manager-db on localhost:5435
// When running locally, the DB won't be available but falls back gracefully
const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:vcp2CWFk91DO@localhost:5435/postgres';
const pool = new Pool({ connectionString: DB_URL, connectionTimeoutMillis: 5000 });

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
                project_name TEXT PRIMARY KEY, node_id UUID REFERENCES vps_nodes(id) ON DELETE SET NULL,
                domain TEXT NOT NULL, studio_domain TEXT NOT NULL, password TEXT NOT NULL,
                pg_password TEXT, status TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS config (
                id INTEGER PRIMARY KEY DEFAULT 1, auth_enabled BOOLEAN DEFAULT true, admin_pass TEXT DEFAULT 'admin123'
            );
            INSERT INTO config (id) VALUES (1) ON CONFLICT DO NOTHING;
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
                password: r.password, pgPassword: r.pg_password, status: r.status
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
            INSERT INTO instances (project_name, node_id, domain, studio_domain, password, pg_password, status)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            ON CONFLICT (project_name) DO UPDATE SET 
                node_id=EXCLUDED.node_id, domain=EXCLUDED.domain, studio_domain=EXCLUDED.studio_domain,
                password=EXCLUDED.password, pg_password=EXCLUDED.pg_password, status=EXCLUDED.status
        `, [name, data.nodeId, data.domain, data.studio_domain, data.password, data.pgPassword, data.status]);
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
    }
};

// --- Auth Middleware ---
const authMiddleware = async (req, res, next) => {
    const config = await db.getConfig();
    if (!config.auth_enabled) return next();
    const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
    const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');
    if (login && password && login === 'admin' && password === config.admin_pass) return next();
    res.set('WWW-Authenticate', 'Basic realm="401"');
    res.status(401).send('Authentication required.');
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
    const result = await ssh.execCommand(script, {
        cwd: '/root',
        onStdout: (chunk) => { const o = chunk.toString(); console.log(o); if (logKey) global.deploymentLogs[logKey] += o; },
        onStderr: (chunk) => { const e = chunk.toString(); console.error(e); if (logKey) global.deploymentLogs[logKey] += e; },
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
sed -i "s/\\$\\{KONG_HTTP_PORT:-8000\\}:8000/$HTTP_PORT:8000/g" docker-compose.yml || true
sed -i "s/3000:3000/$STUDIO_PORT:3000/g" docker-compose.yml || true
sed -i "s/5432:5432/$PG_PORT:5432/g" docker-compose.yml || true
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
ufw allow 80/tcp || true && ufw allow 443/tcp || true && ufw allow 22/tcp || true && ufw allow 4000/tcp || true && ufw --force enable || true
`;
    try {
        await runSSH(nodeId, script, project_name);
        await db.updateInstanceStatus(project_name, 'active');
    } catch (e) {
        console.error('Deploy error:', e);
        await db.updateInstanceStatus(project_name, 'error');
    }
});

app.post('/api/delete', async (req, res) => {
    const { project_name } = req.body;
    if (project_name === 'manager-db') return res.status(403).json({ error: 'System instance cannot be deleted.' });
    const instances = await db.getInstances();
    if (!instances[project_name]) return res.status(404).json({ error: 'Instance not found' });
    const nodeId = instances[project_name].nodeId;
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

// --- LIVE STATS ---
app.get('/api/stats/:nodeId', async (req, res) => {
    try {
        const script = `echo "{\\"cpu\\": $(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk '{print 100 - $1}'), \\"mem\\": $(free -m | awk 'NR==2{printf "%.2f", $3*100/$2 }')}"`;
        const result = await runSSH(req.params.nodeId, script);
        res.json(JSON.parse(result.stdout));
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// --- FILE BROWSER ---
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
    console.log(`V3 API (Postgres backend) running on port ${PORT}`);
});
