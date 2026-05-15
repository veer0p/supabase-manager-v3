import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Server, Lock, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

export default function CredentialsDialog({ open, onConnect, error, loading, initialIp = '' }) {
  const [ip, setIp] = useState(initialIp);
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setLocalError('');
    if (!ip.trim()) return setLocalError('VPS IP address is required');
    if (!password.trim()) return setLocalError('SSH password is required');
    onConnect(ip.trim(), password.trim());
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="glass w-full max-w-md rounded-3xl p-8 border border-white/10"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="p-4 rounded-2xl bg-supa-green/10 border border-supa-green/20 mb-4">
              <Server size={28} className="text-supa-green" />
            </div>
            <h2 className="text-2xl font-orbitron font-black text-white tracking-widest uppercase">
              VPS Connect
            </h2>
            <p className="text-gray-500 text-xs mt-2 text-center max-w-xs">
              Enter your VPS IP and root SSH password. A lightweight monitoring agent will be installed automatically.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest mb-2 block">
                VPS IP Address
              </label>
              <div className="relative">
                <Server size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type="text"
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                  placeholder="e.g. 144.91.101.255"
                  className="w-full bg-black/60 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-supa-green/50 transition-colors"
                  autoFocus
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest mb-2 block">
                SSH Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Root SSH password"
                  className="w-full bg-black/60 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-supa-green/50 transition-colors"
                  disabled={loading}
                />
              </div>
            </div>

            {(error || localError) && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl"
              >
                <AlertCircle size={14} className="text-red-400 shrink-0" />
                <span className="text-red-300 text-xs">{error || localError}</span>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-supa-green hover:bg-supa-greenHover disabled:opacity-50 disabled:cursor-not-allowed text-black font-orbitron font-bold text-sm uppercase tracking-widest py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(62,207,142,0.3)] hover:shadow-[0_0_30px_rgba(62,207,142,0.5)]"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Setting up agent...
                </>
              ) : (
                <>
                  Connect
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {loading && (
            <div className="mt-4 p-3 bg-supa-green/5 rounded-xl border border-supa-green/10">
              <p className="text-[10px] text-supa-green text-center leading-relaxed font-orbitron uppercase tracking-wider">
                Installing metrics agent on your VPS...
              </p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
