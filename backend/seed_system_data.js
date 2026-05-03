const { NodeSSH } = require('node-ssh');
const crypto = require('crypto');

const ssh = new NodeSSH();

async function main() {
    console.log("Connecting to VPS...");
    await ssh.connect({
        host: '144.91.101.255',
        username: 'root',
        password: 'Veeridk1'
    });
    console.log("Connected.");

    // 1. Get Node Info
    const nodeId = crypto.randomUUID();
    const nodeName = "Primary VPS";
    const nodeIp = "144.91.101.255";
    const nodePass = "Veeridk1";

    // 2. Master DB Info
    const projectName = "manager-db";
    const domain = "manager-db.veer-vps.duckdns.org";
    const studioDomain = "manager-db-studio.veer-vps.duckdns.org";
    const pgPassword = "vcp2CWFk91DO";
    const status = "active";

    const sql = `
        -- Add the VPS Node
        INSERT INTO vps_nodes (id, name, ip, password) 
        VALUES ('${nodeId}', '${nodeName}', '${nodeIp}', '${nodePass}')
        ON CONFLICT DO NOTHING;

        -- Add the Master Instance
        INSERT INTO instances (project_name, node_id, domain, studio_domain, password, pg_password, status)
        VALUES ('${projectName}', '${nodeId}', '${domain}', '${studioDomain}', 'ADMIN_CONTROLLED', '${pgPassword}', '${status}')
        ON CONFLICT (project_name) DO UPDATE SET status = 'active';
    `;

    console.log("Registering System Node and Master DB in the dashboard...");
    const r = await ssh.execCommand(`docker exec -i supabase-db psql -U postgres postgres <<EOF
${sql}
EOF
`);
    
    console.log(r.stdout);
    if(r.stderr) console.error(r.stderr);

    console.log("System registration complete.");
    ssh.dispose();
}

main().catch(console.error);
