
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Terminal, Lock, User, Eye, EyeOff, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNotification } from '../NotificationContext';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { error, success } = useNotification();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Map username to dummy email for Supabase Auth
      const email = `${username.toLowerCase().trim()}@apex.internal`;
      
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;
      
      // Notification removed to prevent blocking dashboard view
      onLogin(data.session);
    } catch (err) {
      error(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 overflow-hidden relative">
      {/* Background Effects */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-purple-900/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-900/10 blur-[150px] rounded-full pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="glass p-8 rounded-[2.5rem] shadow-2xl relative">
          <div className="flex flex-col items-center mb-10">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="w-16 h-16 rounded-2xl bg-[#3ecf8e] flex items-center justify-center shadow-[0_0_30px_#3ecf8e80] mb-6"
            >
              <Terminal size={32} className="text-black" />
            </motion.div>
            <h1 className="text-3xl font-bold font-orbitron tracking-[0.2em] text-white">APEX DASH</h1>
            <p className="text-gray-500 text-xs font-medium mt-2 uppercase tracking-widest">Secure Infrastructure Control</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest px-1">Username</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User size={16} className="text-gray-500 group-focus-within:text-[#3ecf8e] transition-colors" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-black/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium text-white placeholder:text-gray-600 focus:outline-none focus:border-[#3ecf8e/50] focus:ring-4 focus:ring-[#3ecf8e10] transition-all"
                  placeholder="Enter username"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest px-1">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock size={16} className="text-gray-500 group-focus-within:text-[#3ecf8e] transition-colors" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/50 border border-white/5 rounded-2xl py-4 pl-12 pr-12 text-sm font-medium text-white placeholder:text-gray-600 focus:outline-none focus:border-[#3ecf8e/50] focus:ring-4 focus:ring-[#3ecf8e10] transition-all"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#3ecf8e] hover:bg-[#34b27a] text-black font-bold py-4 rounded-2xl transition-all duration-300 shadow-[0_0_20px_#3ecf8e40] hover:shadow-[0_0_30px_#3ecf8e60] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4 cursor-pointer"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : 'AUTHENTICATE SYSTEM'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 flex flex-col items-center">
            <p className="text-gray-500 text-xs font-medium mb-4 uppercase tracking-widest text-center">Or Explore the Demo</p>
            <button 
              type="button"
              onClick={() => {
                localStorage.setItem('visitor_mode', 'true');
                onLogin({ user: { role: 'visitor' }, access_token: 'visitor_token' });
              }}
              className="w-full bg-blue-500/10 border border-blue-500/30 text-blue-400 py-3 rounded-xl font-bold tracking-widest text-xs uppercase hover:bg-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(59,130,246,0.1)]"
            >
              <Eye size={16} /> Enter Visitor Mode
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">
              Restricted Access. Unauthorized entry is monitored.
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
