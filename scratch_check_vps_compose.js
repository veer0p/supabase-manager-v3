const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function check() {
    try {
        await ssh.connect({
            host: '144.91.101.255',
            username: 'root',
            password: 'Veeridk1',
            readyTimeout: 10000
        });
        console.log('Running docker compose ps in /opt/supabase-test/docker...');
        const res = await ssh.execCommand('cd /opt/supabase-test/docker && docker compose ps');
        console.log('COMPOSE PS:', res.stdout);
        console.log('COMPOSE ERR:', res.stderr);
        
        ssh.dispose();
    } catch (e) {
        console.error('Error:', e);
    }
}

check();
