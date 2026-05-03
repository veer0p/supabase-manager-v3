import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Save, Lock, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNotification } from '../NotificationContext';

export default function Settings() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { error, success } = useNotification();

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return error('New passwords do not match');
    }

    setLoading(true);
    try {
      // 1. Verify old password by re-authenticating
      const { data: { user } } = await supabase.auth.getUser();
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      });

      if (reauthError) throw new Error('Current password verification failed');

      // 2. Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      success('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-2xl pb-10">
      <h1 className="text-2xl font-bold text-white tracking-tight font-orbitron uppercase tracking-[0.2em]">Security Settings</h1>

      <section className="bg-black/40 backdrop-blur-2xl px-8 py-6 rounded-[2rem] border border-white/5 relative z-20 shadow-2xl">
        <div className="flex items-center gap-4 mb-8 pb-4 border-b border-white/5">
          <div className="p-2 rounded-xl bg-[#3ecf8e10] text-[#3ecf8e]">
            <Shield size={20} />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight uppercase font-orbitron text-xs tracking-widest">Authentication Management</h2>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Current Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Shield size={16} className="text-gray-600 group-focus-within:text-[#3ecf8e] transition-colors" />
                </div>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-2xl px-12 py-3.5 text-white focus:ring-2 focus:ring-[#3ecf8e20] outline-none font-mono text-sm transition-all"
                  placeholder="Verify current password"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">New Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock size={16} className="text-gray-600 group-focus-within:text-[#3ecf8e] transition-colors" />
                  </div>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-2xl px-12 py-3.5 text-white focus:ring-2 focus:ring-[#3ecf8e20] outline-none font-mono text-sm transition-all"
                    placeholder="Min 6 characters"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-1">Confirm New</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock size={16} className="text-gray-600 group-focus-within:text-[#3ecf8e] transition-colors" />
                  </div>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-2xl px-12 py-3.5 text-white focus:ring-2 focus:ring-[#3ecf8e20] outline-none font-mono text-sm transition-all"
                    placeholder="Repeat password"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            disabled={loading}
            type="submit"
            className="bg-[#3ecf8e] text-black text-[11px] font-black uppercase tracking-widest rounded-2xl px-8 py-4 hover:bg-[#34b27a] transition-all duration-300 flex items-center justify-center gap-3 cursor-pointer shadow-lg shadow-[#3ecf8e10] font-orbitron w-full md:w-auto"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <><Save size={16} /> Update Security Profile</>}
          </button>
        </form>
      </section>

      <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-6">
        <h3 className="text-blue-400 font-bold text-sm mb-2 uppercase tracking-widest flex items-center gap-2">
          <Shield size={14} /> Security Notice
        </h3>
        <p className="text-gray-500 text-xs leading-relaxed">
          Updating your system password will invalidate all active sessions across other devices.
          The dashboard uses Supabase Identity management for enterprise-grade infrastructure security.
        </p>
      </div>
    </motion.div>
  );
}
