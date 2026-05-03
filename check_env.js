
const { NodeSSH } = require('./node_modules/node-ssh');
const ssh = new NodeSSH();

async function test() {
    try {
        await ssh.connect({
            host: '144.91.101.255',
            username: 'root',
            password: 'Veeridk1'
        });
        const result = await ssh.execCommand('du -sh /opt/supabase-testcrud1777816473867');
        console.log(result.stdout);
        ssh.dispose();
    } catch (e) {
        console.error("Error:", e.message);
    }
}

test();
