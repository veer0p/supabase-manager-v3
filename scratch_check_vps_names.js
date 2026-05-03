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
        console.log('Running docker ps to see all container names...');
        const res = await ssh.execCommand('docker ps --format "{{.Names}}"');
        console.log('NAMES:', res.stdout);
        
        ssh.dispose();
    } catch (e) {
        console.error('Error:', e);
    }
}

check();
