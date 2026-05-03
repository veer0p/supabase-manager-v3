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

    const domain = "manager-db.veer-vps.duckdns.org";
    const password = crypto.randomBytes(9).toString('base64').replace(/[\+\/]/g, 'a').slice(0, 12);
    const pgPassword = crypto.randomBytes(9).toString('base64').replace(/[\+\/]/g, 'a').slice(0, 12);

    const script = `
        set -e
        if [ ! -d "/opt/manager-db" ]; then
            git clone --depth 1 https://github.com/supabase/supabase /opt/manager-db
        fi
        cd /opt/manager-db/docker
        cp -n .env.example .env || true
        
        # Configure standard credentials
        sed -i "s|^API_EXTERNAL_URL=.*|API_EXTERNAL_URL=https://${domain}|" .env
        sed -i "s|^DASHBOARD_PASSWORD=.*|DASHBOARD_PASSWORD=${password}|" .env
        sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${pgPassword}|" .env
        
        # Change ports to avoid conflicts with future user instances!
        sed -i "s|^KONG_HTTP_PORT=.*|KONG_HTTP_PORT=8001|" .env
        sed -i "s|^KONG_HTTPS_PORT=.*|KONG_HTTPS_PORT=8444|" .env
        sed -i "s|^POSTGRES_PORT=.*|POSTGRES_PORT=5433|" .env
        
        # For Studio Port, it's not exposed via .env by default in the docker-compose mapping, 
        # but SITE_URL is used for auth redirection
        sed -i "s|^SITE_URL=.*|SITE_URL=https://manager-db-studio.veer-vps.duckdns.org|" .env
        
        # We MUST change the physical published ports in docker-compose.yml so it binds to 8001/3001/5433
        # Wait, using sed on docker-compose.yml is risky. It's safer to just change the env var and use sed for port mappings.
        sed -i 's/\${KONG_HTTP_PORT:-8000}:8000/8001:8000/g' docker-compose.yml || true
        sed -i 's/\${KONG_HTTPS_PORT:-8443}:8443/8444:8443/g' docker-compose.yml || true
        sed -i 's/\${POSTGRES_PORT:-5432}:5432/5433:5432/g' docker-compose.yml || true
        # Studio is bound to 3000:3000 directly
        sed -i 's/3000:3000/3001:3000/g' docker-compose.yml || true

        cat > /etc/caddy/Caddyfile.manager <<CADDYEOF
${domain} {
    tls admin@veer-vps.duckdns.org
    reverse_proxy localhost:8001
}
manager-db-studio.veer-vps.duckdns.org {
    tls admin@veer-vps.duckdns.org
    reverse_proxy localhost:3001
}
CADDYEOF

        # Append to main Caddyfile if not exists
        if ! grep -q "manager-db.veer-vps.duckdns.org" /etc/caddy/Caddyfile; then
            cat /etc/caddy/Caddyfile.manager >> /etc/caddy/Caddyfile
            systemctl restart caddy
        fi

        docker compose pull
        docker compose up -d

        echo "---SECRETS---"
        echo "POSTGRES_PASSWORD=${pgPassword}"
        cat .env | grep ANON_KEY
        cat .env | grep SERVICE_ROLE_KEY
    `;

    console.log("Deploying manager-db...");
    const result = await ssh.execCommand(script, { cwd: '/root' });
    console.log(result.stdout);
    if(result.stderr) console.error(result.stderr);
    
    ssh.dispose();
}

main().catch(console.error);
