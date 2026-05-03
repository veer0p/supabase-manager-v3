#!/usr/bin/env node
// migrations/migrate.js
// Runs all pending SQL migrations in order against the configured database.
// Safe to run multiple times — tracks applied migrations in `_migrations` table.

const fs = require('fs');
const path = require('path');
// Use backend's node_modules since migrations share deps
const backendDir = path.join(__dirname, '../backend');
const { Pool } = require(path.join(backendDir, 'node_modules', 'pg'));
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:vcp2CWFk91DO@144.91.101.255:5435/postgres';
const pool = new Pool({ connectionString: DB_URL, connectionTimeoutMillis: 10000 });

async function migrate() {
    const client = await pool.connect();
    try {
        // Ensure migrations tracking table exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS _migrations (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                applied_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        // Get already-applied migrations
        const applied = new Set(
            (await client.query('SELECT name FROM _migrations')).rows.map(r => r.name)
        );

        // Read all migration files sorted by number
        const migrationsDir = __dirname;
        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();

        let count = 0;
        for (const file of files) {
            if (applied.has(file)) {
                console.log(`  ✓ [SKIP] ${file} (already applied)`);
                continue;
            }

            console.log(`  ➜ [RUN ] ${file}...`);
            const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
            await client.query('BEGIN');
            try {
                await client.query(sql);
                await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
                await client.query('COMMIT');
                console.log(`  ✅ [DONE] ${file}`);
                count++;
            } catch (e) {
                await client.query('ROLLBACK');
                throw new Error(`Migration ${file} failed: ${e.message}`);
            }
        }

        if (count === 0) {
            console.log('  ✓ All migrations already applied. Nothing to do.');
        } else {
            console.log(`\n  ✅ ${count} migration(s) applied successfully.`);
        }
    } finally {
        client.release();
        await pool.end();
    }
}

console.log('\n📦 Running database migrations...');
migrate().catch(e => {
    console.error('❌ Migration failed:', e.message);
    process.exit(1);
});
