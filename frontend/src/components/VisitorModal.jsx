import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Mail, Phone, MessageSquare, Target, Send, Loader2 } from 'lucide-react';
import { apiFetch } from '../lib/api';
import Select from './Select';

const VISITOR_ID_KEY = 'visitor_id';
const LEAD_SUBMITTED_KEY = 'visitor_lead_submitted';
const TRIGGER_DELAY_MS = 60 * 1000; // 60 seconds

function getOrCreateVisitorId() {
  let id = localStorage.getItem(VISITOR_ID_KEY);
  if (!id) {
    id = `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(VISITOR_ID_KEY, id);
  }
  return id;
}

export default function VisitorModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', mobile: '', message: '', purpose: ''
  });

  const [formErrors, setFormErrors] = useState({});


  useEffect(() => {
    // Don't show if already submitted this session
    if (sessionStorage.getItem(LEAD_SUBMITTED_KEY)) return;

    const timer = setTimeout(() => {
      setIsOpen(true);
    }, TRIGGER_DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!form.name.trim()) errors.name = "Name is required";
    if (!form.email.trim()) errors.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) errors.email = "Invalid email format";
    if (!form.purpose) errors.purpose = "Purpose is required";

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    setLoading(true);
    try {
      await fetch(
        (import.meta.env.PROD ? '/api' : 'http://localhost:4000/api') + '/visitor/lead',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer visitor_token' },
          body: JSON.stringify({ ...form, visitor_id: getOrCreateVisitorId() })
        }
      );
      sessionStorage.setItem(LEAD_SUBMITTED_KEY, 'true');
      setSubmitted(true);
    } catch (err) {
      console.error('Failed to save lead:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem(LEAD_SUBMITTED_KEY, 'true'); // Don't show again this session
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
        >
          <motion.div
            initial={{ scale: 0.85, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="w-full max-w-lg relative"
          >
            {/* Glow border */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#3ecf8e20] to-blue-500/10 blur-2xl" />
            
            <div className="relative bg-[#0d0d10] border border-white/10 rounded-3xl p-8 shadow-2xl">
              {/* Close */}
              <button
                onClick={handleDismiss}
                className="absolute top-5 right-5 text-gray-500 hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>

              {submitted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-8"
                >
                  <div className="w-16 h-16 rounded-full bg-[#3ecf8e]/20 flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_#3ecf8e40]">
                    <Send size={28} className="text-[#3ecf8e]" />
                  </div>
                  <h2 className="text-2xl font-bold font-orbitron text-white tracking-wide mb-2">Thanks!</h2>
                  <p className="text-gray-400 text-sm">Your message has been saved. I'll reach out soon.</p>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="mt-6 bg-[#3ecf8e] text-black text-xs font-bold uppercase tracking-widest px-6 py-2.5 rounded-xl hover:bg-[#2dbe7d] transition-all cursor-pointer"
                  >
                    Continue Exploring
                  </button>
                </motion.div>
              ) : (
                <>
                  <div className="mb-6">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[10px] text-[#3ecf8e] font-bold uppercase tracking-widest bg-[#3ecf8e]/10 border border-[#3ecf8e]/20 px-2 py-0.5 rounded">
                        Visitor Mode
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold font-orbitron text-white tracking-wide">
                      Let's Connect 👋
                    </h2>
                    <p className="text-gray-400 text-sm mt-1.5">
                      You've been exploring for a bit. Drop your details — I'd love to know more about you!
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} noValidate className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <div className={`bg-black/40 border ${formErrors.name ? 'border-red-500/50' : 'border-white/5'} rounded-xl px-4 flex items-center gap-3 focus-within:border-[#3ecf8e]/40 transition-all`}>
                          <User size={14} className={formErrors.name ? 'text-red-400' : 'text-gray-500'} />
                          <input
                            placeholder="Your name"
                            value={form.name}
                            onChange={e => {
                              setForm(p => ({ ...p, name: e.target.value }));
                              if (formErrors.name) setFormErrors(p => ({ ...p, name: null }));
                            }}
                            className="w-full bg-transparent py-3 text-white placeholder:text-gray-600 outline-none text-sm"
                          />
                        </div>
                        {formErrors.name && <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-[10px] text-red-400 font-bold uppercase tracking-widest pl-1">{formErrors.name}</motion.p>}
                      </div>
                      
                      <div className="bg-black/40 border border-white/5 rounded-xl px-4 flex items-center gap-3 focus-within:border-[#3ecf8e]/40 transition-all">
                        <Phone size={14} className="text-gray-500 shrink-0" />
                        <input
                          placeholder="Mobile (optional)"
                          value={form.mobile}
                          onChange={e => setForm(p => ({ ...p, mobile: e.target.value }))}
                          className="w-full bg-transparent py-3 text-white placeholder:text-gray-600 outline-none text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className={`bg-black/40 border ${formErrors.email ? 'border-red-500/50' : 'border-white/5'} rounded-xl px-4 flex items-center gap-3 focus-within:border-[#3ecf8e]/40 transition-all`}>
                        <Mail size={14} className={formErrors.email ? 'text-red-400' : 'text-gray-500'} />
                        <input
                          type="email"
                          placeholder="Email address"
                          value={form.email}
                          onChange={e => {
                            setForm(p => ({ ...p, email: e.target.value }));
                            if (formErrors.email) setFormErrors(p => ({ ...p, email: null }));
                          }}
                          className="w-full bg-transparent py-3 text-white placeholder:text-gray-600 outline-none text-sm"
                        />
                      </div>
                      {formErrors.email && <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-[10px] text-red-400 font-bold uppercase tracking-widest pl-1">{formErrors.email}</motion.p>}
                    </div>

                    <div className="space-y-1.5">
                      <div className={formErrors.purpose ? 'border border-red-500/50 rounded-xl' : ''}>
                        <Select
                          icon={Target}
                          placeholder="Purpose of visit…"
                          value={form.purpose}
                          onChange={val => {
                            setForm(p => ({ ...p, purpose: val }));
                            if (formErrors.purpose) setFormErrors(p => ({ ...p, purpose: null }));
                          }}
                          options={[
                            { label: 'Hiring / Recruiting', value: 'hiring' },
                            { label: 'Collaboration / Project', value: 'collaboration' },
                            { label: 'Just curious / Learning', value: 'curiosity' },
                            { label: 'Potential Client', value: 'client' },
                            { label: 'Other', value: 'other' }
                          ]}
                        />
                      </div>
                      {formErrors.purpose && <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-[10px] text-red-400 font-bold uppercase tracking-widest pl-1">{formErrors.purpose}</motion.p>}
                    </div>

                    <div className="bg-black/40 border border-white/5 rounded-xl px-4 flex items-start gap-3 pt-1 focus-within:border-[#3ecf8e]/40 transition-all">
                      <MessageSquare size={14} className="text-gray-500 shrink-0 mt-3.5" />
                      <textarea
                        rows={3}
                        placeholder="Any message? (optional)"
                        value={form.message}
                        onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                        className="w-full bg-transparent py-3 text-white placeholder:text-gray-600 outline-none text-sm resize-none"
                      />
                    </div>

                    <div className="flex gap-3 pt-1">
                      <button
                        type="button"
                        onClick={handleDismiss}
                        className="flex-1 text-gray-500 text-xs font-medium border border-white/5 rounded-xl py-3 hover:bg-white/5 transition-all cursor-pointer"
                      >
                        Skip for now
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 bg-[#3ecf8e] text-black text-xs font-bold uppercase tracking-widest rounded-xl py-3 hover:bg-[#2dbe7d] transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                      >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        {loading ? 'Sending…' : 'Send'}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
