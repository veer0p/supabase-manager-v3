const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function check() {
    try {
        console.log('Connecting to 144.91.101.255...');
        await ssh.connect({
            host: '144.91.101.255',
            username: 'root',
            password: 'Veeridk1',
            readyTimeout: 10000
        });
        console.log('Connected!');
        
        const res = await ssh.execCommand('ls -d /opt/supabase-test 2>/dev/null; docker ps --filter name=test');
        console.log('STDOUT:', res.stdout);
        console.log('STDERR:', res.stderr);
        
        ssh.dispose();
    } catch (e) {
        console.error('Error:', e);
    }
}

check();
