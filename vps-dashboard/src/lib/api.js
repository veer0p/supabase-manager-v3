const API_BASE = import.meta.env.PROD ? '/api' : 'http://localhost:3000/api';

export const setupAgent = async (ip, password) => {
  const res = await fetch(`${API_BASE}/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ip, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Setup failed');
  }
  return res.json();
};

export const fetchStats = async (ip, token) => {
  const res = await fetch(`${API_BASE}/stats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ip, token }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to fetch stats');
  }
  return res.json();
};
