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
        console.log('Reading ports from /opt/supabase-test-v3/docker/docker-compose.yml...');
        const res = await ssh.execCommand('grep -A 2 "ports:" /opt/supabase-test-v3/docker/docker-compose.yml');
        console.log('PORTS:', res.stdout);
        
        ssh.dispose();
    } catch (e) {
        console.error('Error:', e);
    }
}

check();
