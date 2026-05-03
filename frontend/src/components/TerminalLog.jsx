import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, X } from 'lucide-react';
import { apiFetch } from '../lib/api';

export default function TerminalLog({ isOpen, onClose, projectName }) {
  const [logs, setLogs] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !projectName) return;
    
    const fetchLogs = async () => {
      try {
        const data = await apiFetch(`/logs/${projectName}`);
        setLogs(data.logs || 'Waiting for logs...');
      } catch (e) {
        setLogs('Error fetching logs: ' + e.message);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 1000);
    return () => clearInterval(interval);
  }, [isOpen, projectName]);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10 pointer-events-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-[#0a0a0a] border border-gray-800 rounded-xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl overflow-hidden pointer-events-auto"
            >
              <div className="flex justify-between items-center bg-black/50 px-4 py-3 border-b border-gray-800/60">
                <div className="flex items-center gap-2 text-gray-300">
                  <Terminal size={18} className="text-supa-green" />
                  <span className="font-mono text-sm">logs / {projectName}</span>
                </div>
                <button onClick={onClose} className="text-gray-500 hover:text-white transition bg-white/5 hover:bg-white/10 p-1.5 rounded-lg">
                  <X size={18} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 bg-[#050505] font-mono text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                {logs}
                <div ref={bottomRef} />
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
