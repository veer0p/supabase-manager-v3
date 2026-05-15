export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { ip, token } = req.body || {};
  if (!ip || !token) {
    return res.status(400).json({ error: 'Missing ip or token' });
  }

  // Basic IP validation
  if (!/^[\d.]+$/.test(ip) && !/^[\w\-.:]+$/.test(ip)) {
    return res.status(400).json({ error: 'Invalid IP address' });
  }

  const url = `http://${ip}:9100/metrics`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.status === 401) {
      return res.status(401).json({ error: 'Invalid auth token. Check your VPS metrics agent token.' });
    }
    if (!response.ok) {
      return res.status(502).json({ error: `VPS agent returned ${response.status}` });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Connection timed out. Check if the VPS is reachable and port 9100 is open.' });
    }
    if (err.cause?.code === 'ECONNREFUSED') {
      return res.status(502).json({ error: 'Connection refused. Is the metrics agent running on the VPS?' });
    }
    return res.status(502).json({ error: `Could not reach VPS: ${err.message}` });
  }
}
