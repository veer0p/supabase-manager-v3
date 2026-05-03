const { Client } = require('pg');
const fs = require('fs');

const connectionString = 'postgresql://postgres:2mwh00YhDBQu@144.91.101.255:5433/postgres';

const client = new Client({ connectionString });

async function initDb() {
    await client.connect();
    console.log("Connected to Postgres");

    // 1. Create Tables
    await client.query(`
        CREATE TABLE IF NOT EXISTS vps_nodes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            ip TEXT NOT NULL,
            password TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS instances (
            project_name TEXT PRIMARY KEY,
            node_id UUID REFERENCES vps_nodes(id) ON DELETE CASCADE,
            domain TEXT NOT NULL,
            studio_domain TEXT NOT NULL,
            password TEXT NOT NULL,
            pg_password TEXT,
            status TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS config (
            id INTEGER PRIMARY KEY DEFAULT 1,
            auth_enabled BOOLEAN DEFAULT true,
            admin_pass TEXT DEFAULT 'admin123'
        );
    `);
    
    console.log("Tables created");

    // Initialize config if empty
    const res = await client.query('SELECT * FROM config WHERE id = 1');
    if (res.rows.length === 0) {
        await client.query('INSERT INTO config (id, auth_enabled, admin_pass) VALUES (1, true, $1)', ['admin123']);
    }

    // 2. Migrate Data from JSON
    try {
        const nodes = JSON.parse(fs.readFileSync('./data/nodes.json', 'utf8') || '[]');
        for (const n of nodes) {
            await client.query('INSERT INTO vps_nodes (id, name, ip, password) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', 
                [n.id, n.name, n.ip, n.password]);
        }

        const instances = JSON.parse(fs.readFileSync('./data/instances.json', 'utf8') || '{}');
        for (const [name, info] of Object.entries(instances)) {
            await client.query('INSERT INTO instances (project_name, node_id, domain, studio_domain, password, pg_password, status) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING',
                [name, info.nodeId, info.domain, info.studio_domain, info.password, info.pgPassword, info.status]);
        }
        
        const config = JSON.parse(fs.readFileSync('./data/config.json', 'utf8') || '{}');
        if (config.auth_enabled !== undefined) {
            await client.query('UPDATE config SET auth_enabled = $1, admin_pass = $2 WHERE id = 1', [config.auth_enabled, config.admin_pass]);
        }

        console.log("Data migrated successfully");
    } catch(e) {
        console.error("Migration error (maybe no data yet):", e.message);
    }

    await client.end();
}

initDb().catch(console.error);
