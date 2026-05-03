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
        PROJ_DIR="/opt/manager-db"
        if [ ! -d "$PROJ_DIR" ]; then
            git clone --depth 1 https://github.com/supabase/supabase "$PROJ_DIR"
        fi
        cd "$PROJ_DIR/docker"
        cp -n .env.example .env || true
        
        # Configure standard credentials
        sed -i "s|^API_EXTERNAL_URL=.*|API_EXTERNAL_URL=https://${domain}|" .env
        sed -i "s|^DASHBOARD_PASSWORD=.*|DASHBOARD_PASSWORD=${password}|" .env
        sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${pgPassword}|" .env
        
        # Use default ports for the master DB
        sed -i "s|^KONG_HTTP_PORT=.*|KONG_HTTP_PORT=8000|" .env
        sed -i "s|^STUDIO_PORT=.*|STUDIO_PORT=3000|" .env
        sed -i "s|^POSTGRES_PORT=.*|POSTGRES_PORT=5432|" .env
        
        # Site URL for Studio
        sed -i "s|^SITE_URL=.*|SITE_URL=https://manager-db-studio.veer-vps.duckdns.org|" .env

        # Create docker-compose.override.yml for port mappings
        cat > docker-compose.override.yml <<EOF
services:
  db:
    ports:
      - 5435:5432
  kong:
    ports:
      - 8000:8000
  studio:
    ports:
      - 3000:3000
EOF

        # Caddyfile setup
        cat > /etc/caddy/Caddyfile.manager <<CADDYEOF
veer-vps.duckdns.org {
    tls admin@veer-vps.duckdns.org
    reverse_proxy localhost:4000
}
manager-db.veer-vps.duckdns.org {
    tls admin@veer-vps.duckdns.org
    reverse_proxy localhost:8000
}
manager-db-studio.veer-vps.duckdns.org {
    tls admin@veer-vps.duckdns.org
    reverse_proxy localhost:3000
}
CADDYEOF

        # Replace main Caddyfile content for the manager
        cat /etc/caddy/Caddyfile.manager > /etc/caddy/Caddyfile
        systemctl restart caddy

        docker compose pull
        docker compose up -d

        echo "---SECRETS---"
        echo "POSTGRES_PASSWORD=${pgPassword}"
        cat .env | grep ANON_KEY
        cat .env | grep SERVICE_ROLE_KEY
    `;

    console.log("Deploying fresh manager-db...");
    const result = await ssh.execCommand(script, { cwd: '/root' });
    console.log(result.stdout);
    if(result.stderr) console.error(result.stderr);
    
    ssh.dispose();
}

main().catch(console.error);
