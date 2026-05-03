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
        console.log('Checking container_name in /opt/supabase-test/docker/docker-compose.yml...');
        const res = await ssh.execCommand('grep "container_name:" /opt/supabase-test/docker/docker-compose.yml | head -n 5');
        console.log('GREP:', res.stdout);
        
        ssh.dispose();
    } catch (e) {
        console.error('Error:', e);
    }
}

check();
