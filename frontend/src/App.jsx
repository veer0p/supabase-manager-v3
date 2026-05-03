import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Server, Database, Folder, Settings, LayoutDashboard, Menu, X, Terminal, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from './lib/api';
import { supabase } from './lib/supabase';

import Overview from './pages/Overview';
import Nodes from './pages/Nodes';
import Instances from './pages/Instances';
import Files from './pages/Files';
import SettingsPage from './pages/Settings';
import Login from './pages/Login';
import { NotificationProvider, useNotification } from './NotificationContext';
import { DiscBrakeLoader } from './components/DiscBrakeLoader';


function Sidebar({ mobileOpen, setMobileOpen, alertCount, onLogout }) {
  const location = useLocation();
  const links = [
    { name: 'Overview', path: '/', icon: LayoutDashboard },
    { name: 'VPS Nodes', path: '/nodes', icon: Server },
    { name: 'Supabase', path: '/instances', icon: Database },
    { name: 'File Explorer', path: '/files', icon: Folder },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <>
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0a0a0c] bg-[radial-gradient(circle_at_top,_#1a1a2e_0%,_transparent_100%)] border-r border-white/5 transform transition-transform duration-300 ease-in-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 shadow-[4px_0_24px_rgba(0,0,0,0.5)] flex flex-col`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-white/10 bg-black/40 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#3ecf8e] flex items-center justify-center shadow-[0_0_15px_#3ecf8e80]">
              <Terminal size={18} className="text-black" />
            </div>
            <span className="text-lg font-bold font-orbitron tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-400">APEX DASH</span>
          </div>
          <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setMobileOpen(false)}>
            <X size={20} />
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {links.map((link) => {
            const isActive = location.pathname === link.path;
            const Icon = link.icon;
            const showBadge = link.path === '/' && alertCount > 0;
            return (
              <Link key={link.name} to={link.path} className={`flex items-center gap-3 px-4 py-3 rounded-r-xl transition-all duration-200 uppercase tracking-widest font-orbitron text-[11px] font-bold ${isActive ? 'bg-gradient-to-r from-[#3ecf8e20] to-transparent text-white border-l-2 border-[#3ecf8e]' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300 border-l-2 border-transparent'}`}>
                <Icon size={16} className={isActive ? 'text-[#3ecf8e]' : 'text-gray-600'} style={isActive ? { filter: 'drop-shadow(0 0 5px #3ecf8e)' } : {}} />
                <span className="flex-1">{link.name}</span>
                {showBadge && (
                  <span className="w-5 h-5 rounded bg-red-500 text-black text-[10px] font-bold flex items-center justify-center shadow-[0_0_10px_#ef444480] animate-pulse">
                    {alertCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5 bg-black/20">
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-500/70 hover:text-red-400 hover:bg-red-500/5 rounded-xl transition-all duration-200 uppercase tracking-widest font-orbitron text-[10px] font-black cursor-pointer">
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} />}
    </>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    const fetchAlerts = () => apiFetch('/alerts').then(a => setAlertCount(a.length)).catch(() => {});
    fetchAlerts();
    const int = setInterval(fetchAlerts, 15000);
    return () => clearInterval(int);
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  if (showSplash) {
    return (
      <NotificationProvider>
        <div className="h-screen bg-[#050505] flex items-center justify-center">
          <DiscBrakeLoader onReadyToExit={handleSplashComplete} dataReady={!authLoading} />
        </div>
      </NotificationProvider>
    );
  }

  if (authLoading) return null;

  return (
    <Router>
      <NotificationProvider>
        {!session ? (
          <Login onLogin={(s) => setSession(s)} />
        ) : (
          <div className="min-h-screen bg-[#050505] text-gray-100 flex selection:bg-supa-green/30 selection:text-supa-green">
            <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} alertCount={alertCount} onLogout={handleLogout} />
          
            <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden relative">
              <header className="h-16 border-b border-white/5 bg-black/20 backdrop-blur-md flex items-center justify-between px-6 z-30">
                <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setMobileOpen(true)}>
                  <Menu size={20} />
                </button>
                <div className="flex-1 flex justify-end items-center gap-4">
                  <div className="text-[10px] font-orbitron font-bold text-gray-500 flex items-center gap-2 uppercase tracking-widest border border-white/10 px-3 py-1.5 rounded bg-black/40 shadow-inner">
                    <span className="w-2 h-2 rounded-full bg-[#3ecf8e] shadow-[0_0_8px_#3ecf8e]"></span> TELEMETRY ONLINE
                  </div>
                </div>
              </header>
              
              <main className="flex-1 overflow-y-auto p-6 md:p-10 relative">
                {/* Ambient Background Glow */}
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-purple-900/10 blur-[150px] rounded-full pointer-events-none -z-10" />
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-900/10 blur-[150px] rounded-full pointer-events-none -z-10" />
                
                <AnimatePresence mode="wait">
                  <Routes>
                    <Route path="/" element={<Overview />} />
                    <Route path="/nodes" element={<Nodes />} />
                    <Route path="/instances" element={<Instances />} />
                    <Route path="/files" element={<Files />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </AnimatePresence>
              </main>
            </div>
          </div>
        )}
      </NotificationProvider>
    </Router>
  );
}

export default App;
