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
        console.log('Checking /opt/supabase-test/docker...');
        const res = await ssh.execCommand('ls -R /opt/supabase-test/docker');
        console.log('LS OUT:', res.stdout);
        
        const ps = await ssh.execCommand('docker ps -a --filter name=test');
        console.log('DOCKER PS -A:', ps.stdout);
        
        ssh.dispose();
    } catch (e) {
        console.error('Error:', e);
    }
}

check();
