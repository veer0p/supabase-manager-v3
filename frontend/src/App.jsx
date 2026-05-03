import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Server, Database, Folder, Settings, LayoutDashboard, Menu, X, Terminal, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from './lib/api';

import Overview from './pages/Overview';
import Nodes from './pages/Nodes';
import Instances from './pages/Instances';
import Files from './pages/Files';
import SettingsPage from './pages/Settings';
import { NotificationProvider } from './NotificationContext';

function Sidebar({ mobileOpen, setMobileOpen, alertCount }) {
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
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0a0a0a] border-r border-gray-800/60 transform transition-transform duration-300 ease-in-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-800/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-supa-green to-emerald-600 flex items-center justify-center shadow-lg shadow-supa-green/20">
              <Terminal size={18} className="text-black" />
            </div>
            <span className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-400">Control Panel</span>
          </div>
          <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setMobileOpen(false)}>
            <X size={20} />
          </button>
        </div>
        
        <nav className="p-4 space-y-1">
          {links.map((link) => {
            const isActive = location.pathname === link.path;
            const Icon = link.icon;
            const showBadge = link.path === '/' && alertCount > 0;
            return (
              <Link key={link.name} to={link.path} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive ? 'bg-white/5 text-supa-green border border-white/10' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200 border border-transparent'}`}>
                <Icon size={18} className={isActive ? 'text-supa-green' : 'text-gray-500'} />
                <span className="font-medium text-sm flex-1">{link.name}</span>
                {showBadge && (
                  <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                    {alertCount}
                  </span>
                )}
                {isActive && <motion.div layoutId="activeNav" className="absolute left-0 w-1 h-6 bg-supa-green rounded-r-full" />}
              </Link>
            );
          })}
        </nav>
      </div>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} />}
    </>
  );
}

function App() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    const fetchAlerts = () => apiFetch('/alerts').then(a => setAlertCount(a.length)).catch(() => {});
    fetchAlerts();
    const int = setInterval(fetchAlerts, 15000);
    return () => clearInterval(int);
  }, []);

  return (
    <Router>
        <NotificationProvider>
        <div className="min-h-screen bg-[#050505] text-gray-100 flex selection:bg-supa-green/30 selection:text-supa-green">
          <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} alertCount={alertCount} />
        
        <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden">
          <header className="h-16 border-b border-gray-800/60 bg-[#0a0a0a]/80 backdrop-blur-xl flex items-center justify-between px-6 z-30">
            <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setMobileOpen(true)}>
              <Menu size={20} />
            </button>
            <div className="flex-1 flex justify-end items-center gap-4">
              <div className="text-xs font-mono text-gray-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-supa-green animate-pulse"></span> System Online
              </div>
            </div>
          </header>
          
          <main className="flex-1 overflow-y-auto p-6 md:p-10 relative">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-supa-green/5 blur-[120px] rounded-full pointer-events-none -z-10" />
            
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/" element={<Overview />} />
                <Route path="/nodes" element={<Nodes />} />
                <Route path="/instances" element={<Instances />} />
                <Route path="/files" element={<Files />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </AnimatePresence>
          </main>
        </div>
      </div>
      </NotificationProvider>
    </Router>
  );
}

export default App;
