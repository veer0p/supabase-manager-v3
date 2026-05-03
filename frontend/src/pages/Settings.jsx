import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Save } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useNotification } from '../NotificationContext';

export default function Settings() {
  const [config, setConfig] = useState({ auth_enabled: true, admin_pass: '' });
  const { error, success, info } = useNotification();

  useEffect(() => {
    apiFetch('/config').then(setConfig);
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
        await apiFetch('/config', { method: 'POST', body: JSON.stringify(config) });
        success('Settings saved. Dashboard may require re-login if auth changed.', 'Success');
    } catch(e) {
        error(e.message);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 max-w-2xl">
      <h1 className="text-3xl font-bold text-white">System Settings</h1>

      <section className="glass p-6 rounded-2xl border-gray-800">
        <div className="flex items-center gap-3 mb-6 border-b border-gray-800/60 pb-4">
            <Shield className="text-blue-400" />
            <h2 className="text-xl font-semibold">Security & Authentication</h2>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-white font-medium">Require Login</h3>
                    <p className="text-sm text-gray-400">Protect this dashboard with basic authentication.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={config.auth_enabled} onChange={e=>setConfig({...config, auth_enabled: e.target.checked})} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-supa-green"></div>
                </label>
            </div>

            {config.auth_enabled && (
                <div>
                    <label className="block text-sm text-gray-400 mb-2">Admin Password</label>
                    <input type="text" value={config.admin_pass} onChange={e=>setConfig({...config, admin_pass: e.target.value})} className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-supa-green outline-none" />
                    <p className="text-xs text-gray-500 mt-2">Username is always `admin`.</p>
                </div>
            )}

            <button type="submit" className="bg-white text-black font-semibold rounded-lg px-6 py-3 hover:bg-gray-200 transition flex items-center gap-2">
                <Save size={18} /> Save Settings
            </button>
        </form>
      </section>
    </motion.div>
  );
}
