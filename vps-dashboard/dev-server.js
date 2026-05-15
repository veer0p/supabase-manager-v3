/**
 * Local dev server that runs the Vercel serverless functions.
 * Usage: node dev-server.js
 * Runs on port 3000 — the Vite frontend proxies API calls here.
 *
 * When connecting to 127.0.0.1 or localhost, it uses mock mode
 * (skips SSH, returns mock token). Run mock-vps.js alongside for full testing.
 */

import http from 'http';

// Dynamic import the serverless handlers
const statsModule = await import('./api/stats.js');
const statsHandler = statsModule.default;

// Only import setup for real VPS connections
let setupHandler;
try {
  const setupModule = await import('./api/setup.js');
  setupHandler = setupModule.default;
} catch (e) {
  console.warn('Could not load setup.js (ssh2 may not be available):', e.message);
}

const MOCK_TOKEN = 'mock-token-12345';
const MOCK_HOSTS = ['127.0.0.1', 'localhost', '0.0.0.0'];

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

function createRes(nodeRes) {
  const res = {
    statusCode: 200,
    status(code) { res.statusCode = code; return res; },
    json(data) {
      nodeRes.writeHead(res.statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      nodeRes.end(JSON.stringify(data));
    },
  };
  return res;
}

const server = http.createServer(async (req, nodeRes) => {
  if (req.method === 'OPTIONS') {
    nodeRes.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return nodeRes.end();
  }

  const url = new URL(req.url, 'http://localhost');
  const body = await parseBody(req);
  const fakeReq = { method: req.method, body, headers: req.headers };
  const fakeRes = createRes(nodeRes);

  if (url.pathname === '/api/setup') {
    const ip = body.ip || '';

    // Mock mode for localhost — skip SSH, return mock token
    if (MOCK_HOSTS.includes(ip)) {
      console.log(`[MOCK] Setup for ${ip} — returning mock token`);
      return fakeRes.json({
        success: true,
        token: MOCK_TOKEN,
        verified: true,
        message: 'Mock mode — using local mock VPS agent',
      });
    }

    // Real VPS — use SSH setup
    if (!setupHandler) {
      return fakeRes.status(500).json({ error: 'SSH setup not available. Use 127.0.0.1 for mock mode.' });
    }
    return setupHandler(fakeReq, fakeRes);
  }

  if (url.pathname === '/api/stats') {
    return statsHandler(fakeReq, fakeRes);
  }

  nodeRes.writeHead(404, { 'Content-Type': 'application/json' });
  nodeRes.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(3000, () => {
  console.log('');
  console.log('API dev server running on http://localhost:3000');
  console.log('');
  console.log('Endpoints:');
  console.log('  POST /api/setup  — SSH auto-install (or mock for localhost)');
  console.log('  POST /api/stats  — HTTP proxy to VPS agent');
  console.log('');
  console.log('--- MOCK MODE ---');
  console.log('Enter IP: 127.0.0.1 and any password in the dialog.');
  console.log('Make sure mock-vps.js is running: node mock-vps.js');
  console.log('');
});
