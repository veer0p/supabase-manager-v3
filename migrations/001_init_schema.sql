-- Migration 001: Initial Schema
-- Creates the base tables for the Supabase Manager Control Plane

CREATE TABLE IF NOT EXISTS vps_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    ip TEXT NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS instances (
    project_name TEXT PRIMARY KEY,
    node_id UUID REFERENCES vps_nodes(id) ON DELETE SET NULL,
    domain TEXT NOT NULL,
    studio_domain TEXT NOT NULL,
    password TEXT NOT NULL,
    pg_password TEXT,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    auth_enabled BOOLEAN DEFAULT true,
    admin_pass TEXT DEFAULT 'admin123'
);

INSERT INTO config (id) VALUES (1) ON CONFLICT DO NOTHING;
