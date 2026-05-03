const { NodeSSH } = require('node-ssh');
const { Pool } = require('pg');
require('dotenv').config();

const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:vcp2CWFk91DO@localhost:5435/postgres';
const pool = new Pool({ connectionString: DB_URL });

async function sync() {
    try {
        const instancesRes = await pool.query('SELECT project_name, node_id FROM instances');
        const nodesRes = await pool.query('SELECT * FROM vps_nodes');
        
        for (const inst of instancesRes.rows) {
            const node = nodesRes.rows.find(n => n.id === inst.node_id);
            if (!node) continue;
            
            console.log(`Syncing keys for ${inst.project_name} on ${node.ip}...`);
            const ssh = new NodeSSH();
            await ssh.connect({ host: node.ip, username: 'root', password: node.password });
            
            // Try multiple possible directory names
            const dirs = [
                inst.project_name === 'manager' ? 'manager-db' : `supabase-${inst.project_name}`,
                `supabase-${inst.project_name}`,
                inst.project_name
            ];
            
            let anon = '';
            let service = '';
            
            for (const dir of dirs) {
                const res = await ssh.execCommand(`cat /opt/${dir}/docker/.env | grep -E "^(ANON_KEY|SERVICE_ROLE_KEY)="`);
                if (res.stdout) {
                    res.stdout.split('\n').forEach(line => {
                        if (line.startsWith('ANON_KEY=')) anon = line.split('=')[1].trim();
                        if (line.startsWith('SERVICE_ROLE_KEY=')) service = line.split('=')[1].trim();
                    });
                    if (anon || service) break;
                }
            }
            
            if (anon || service) {
                await pool.query('UPDATE instances SET anon_key=$1, service_role_key=$2 WHERE project_name=$3', [anon, service, inst.project_name]);
                console.log(`✅ Updated ${inst.project_name}`);
            }
            ssh.dispose();
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

sync();
