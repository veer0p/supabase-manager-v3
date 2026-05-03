-- Migration 002: VPS Metrics Time-Series Table
-- Stores 30-second VPS snapshots, auto-purges data older than 30 days

CREATE TABLE IF NOT EXISTS vps_metrics (
    id BIGSERIAL PRIMARY KEY,
    node_id UUID REFERENCES vps_nodes(id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    cpu_percent FLOAT DEFAULT 0,
    ram_percent FLOAT DEFAULT 0,
    ram_used_mb BIGINT DEFAULT 0,
    ram_total_mb BIGINT DEFAULT 0,
    disk_percent FLOAT DEFAULT 0,
    disk_used_gb FLOAT DEFAULT 0,
    disk_total_gb FLOAT DEFAULT 0,
    load_avg_1m FLOAT DEFAULT 0,
    load_avg_5m FLOAT DEFAULT 0,
    load_avg_15m FLOAT DEFAULT 0,
    uptime_seconds BIGINT DEFAULT 0,
    top_process_name TEXT DEFAULT '',
    top_process_ram_mb BIGINT DEFAULT 0,
    docker_container_count INT DEFAULT 0
);

-- Index for fast time-range queries per node
CREATE INDEX IF NOT EXISTS idx_vps_metrics_node_time
    ON vps_metrics(node_id, recorded_at DESC);

-- Migration tracking table (must be idempotent)
CREATE TABLE IF NOT EXISTS _migrations (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);
