const { NodeSSH } = require('node-ssh');
const path = require('path');
const fs = require('fs');

const ssh = new NodeSSH();

async function main() {
    await ssh.connect({ host: '144.91.101.255', username: 'root', password: 'Veeridk1' });
    
    // Write the SQL to a file and pipe it into psql via docker exec
    const sqlCmd = `docker exec -i supabase-db psql -U postgres postgres <<'ENDSQL'
CREATE TABLE IF NOT EXISTS vps_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, ip TEXT NOT NULL, password TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS instances (
    project_name TEXT PRIMARY KEY, node_id UUID,
    domain TEXT NOT NULL, studio_domain TEXT NOT NULL, password TEXT NOT NULL,
    pg_password TEXT, status TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    auth_enabled BOOLEAN DEFAULT true,
    admin_pass TEXT DEFAULT 'admin123'
);
INSERT INTO config (id) VALUES (1) ON CONFLICT DO NOTHING;
ENDSQL`;

    const r = await ssh.execCommand(sqlCmd);
    console.log('stdout:', r.stdout);
    if (r.stderr) console.log('stderr:', r.stderr);
    ssh.dispose();
}

main().catch(console.error);
