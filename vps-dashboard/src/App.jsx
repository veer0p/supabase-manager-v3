import { useState, useEffect } from 'react';
import Overview from './pages/Overview';
import CredentialsDialog from './components/CredentialsDialog';
import { setupAgent } from './lib/api';

export default function App() {
  const [ip, setIp] = useState('');
  const [token, setToken] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [error, setError] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [connected, setConnected] = useState(false);

  // Load saved connection on mount (only IP + token needed for monitoring)
  useEffect(() => {
    const savedIp = localStorage.getItem('vps_ip');
    const savedToken = localStorage.getItem('vps_agent_token');
    if (savedIp && savedToken) {
      setIp(savedIp);
      setToken(savedToken);
      setConnected(true);
    } else {
      setShowDialog(true);
    }
    // Clean up legacy stored password if present
    localStorage.removeItem('vps_password');
  }, []);

  const handleConnect = async (newIp, newPassword) => {
    setSetupLoading(true);
    setError('');
    try {
      const result = await setupAgent(newIp, newPassword);
      // Save only what's needed for monitoring (not the SSH password)
      localStorage.setItem('vps_ip', newIp);
      localStorage.setItem('vps_agent_token', result.token);
      setIp(newIp);
      setToken(result.token);
      setShowDialog(false);
      setConnected(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSetupLoading(false);
    }
  };

  const handleStatsError = (msg) => {
    // If stats fail (e.g. agent died), try re-setup automatically
    // But don't spam — only show error
    setError(msg);
  };

  const handleChangeCredentials = () => {
    setError('');
    setShowDialog(true);
  };

  return (
    <div className="min-h-screen">
      <CredentialsDialog
        open={showDialog}
        onConnect={handleConnect}
        error={error}
        loading={setupLoading}
        initialIp={ip}
      />

      {connected && !showDialog && (
        <div className="max-w-[1400px] mx-auto px-6 py-8">
          <Overview
            key={`${ip}-${token}`}
            ip={ip}
            token={token}
            onError={handleStatsError}
            onChangeCredentials={handleChangeCredentials}
          />
        </div>
      )}
    </div>
  );
}
