const { NodeSSH } = require('node-ssh');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const ssh = new NodeSSH();

const VPS_IP = process.env.VPS_IP || "144.91.101.255";
const VPS_PASSWORD = process.env.VPS_PASSWORD || "Veeridk1";
const DB_URL = process.env.DATABASE_URL || "postgresql://postgres:vcp2CWFk91DO@localhost:5435/postgres";

async function deploy() {
    console.log("Connecting to VPS...");
    await ssh.connect({
        host: VPS_IP,
        username: 'root',
        password: VPS_PASSWORD,
    });
    console.log("Connected.");

    console.log("Installing Node.js and PM2 if missing...");
    await ssh.execCommand('curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs && npm install -g pm2');

    console.log("Creating directory /opt/supabase-manager...");
    await ssh.execCommand('mkdir -p /opt/supabase-manager/backend /opt/supabase-manager/frontend');

    console.log("Uploading backend files...");
    await ssh.putFiles([
        { local: path.join(__dirname, 'backend/server.js'), remote: '/opt/supabase-manager/backend/server.js' },
        { local: path.join(__dirname, 'backend/package.json'), remote: '/opt/supabase-manager/backend/package.json' }
    ]);

    console.log("Uploading frontend dist...");
    await ssh.putDirectory(path.join(__dirname, 'frontend/dist'), '/opt/supabase-manager/frontend/dist');

    console.log("Installing backend dependencies on VPS...");
    const installRes = await ssh.execCommand('npm install', { cwd: '/opt/supabase-manager/backend' });
    if(installRes.stderr) console.log("NPM warning/error:", installRes.stderr);

    console.log("Gracefully reloading server with PM2 (Zero-Downtime)...");
    // Use cluster mode with 2 instances for true zero-downtime during reload
    const pm2Res = await ssh.execCommand(`DATABASE_URL="${DB_URL}" pm2 reload supabase-manager || DATABASE_URL="${DB_URL}" pm2 start server.js --name "supabase-manager" -i 2`, { cwd: '/opt/supabase-manager/backend' });
    await ssh.execCommand('pm2 save');
    console.log(pm2Res.stdout);
    
    // Setup ufw firewall
    await ssh.execCommand('ufw allow 4000/tcp');
    
    console.log("===============================");
    console.log("Dashboard successfully deployed!");
    console.log(`Access it at: http://${VPS_IP}:4000`);
    console.log("Login credentials: admin / admin123");
    console.log("===============================");

    ssh.dispose();
}

deploy().catch(err => {
    console.error("Deployment failed:", err);
    process.exit(1);
});
