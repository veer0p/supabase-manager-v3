import { useState, useEffect } from 'react';
import Overview from './pages/Overview';
import CredentialsDialog from './components/CredentialsDialog';
import { setupAgent } from './lib/api';

export default function App() {
  const [ip, setIp] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [error, setError] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [connected, setConnected] = useState(false);

  // Load saved credentials on mount
  useEffect(() => {
    const savedIp = localStorage.getItem('vps_ip');
    const savedPassword = localStorage.getItem('vps_password');
    const savedToken = localStorage.getItem('vps_agent_token');
    if (savedIp && savedPassword && savedToken) {
      setIp(savedIp);
      setPassword(savedPassword);
      setToken(savedToken);
      setConnected(true);
    } else {
      setShowDialog(true);
    }
  }, []);

  const handleConnect = async (newIp, newPassword) => {
    setSetupLoading(true);
    setError('');
    try {
      const result = await setupAgent(newIp, newPassword);
      // Save everything
      localStorage.setItem('vps_ip', newIp);
      localStorage.setItem('vps_password', newPassword);
      localStorage.setItem('vps_agent_token', result.token);
      setIp(newIp);
      setPassword(newPassword);
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
