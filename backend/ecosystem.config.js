module.exports = {
  apps: [{
    name: 'supabase-manager',
    script: 'server.js',
    cwd: '/opt/supabase-manager/backend',
    instances: 1,
    autorestart: true,
    watch: false,
    env: {
      PORT: 4000,
      DATABASE_URL: 'postgresql://postgres:vcp2CWFk91DO@localhost:5435/postgres'
    }
  }]
};
