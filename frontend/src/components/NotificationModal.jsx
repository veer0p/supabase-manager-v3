import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export default function NotificationModal({ isOpen, onClose, type = 'error', title, message }) {
  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle2 size={24} className="text-green-500" />;
      case 'info': return <Info size={24} className="text-blue-500" />;
      default: return <AlertCircle size={24} className="text-red-500" />;
    }
  };

  const getColorClass = () => {
    switch (type) {
      case 'success': return 'bg-green-500/10 border-green-500/20';
      case 'info': return 'bg-blue-500/10 border-blue-500/20';
      default: return 'bg-red-500/10 border-red-500/20';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={`bg-[#111] border rounded-2xl p-6 w-full max-w-sm shadow-2xl pointer-events-auto ${getColorClass()}`}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="p-2 rounded-lg bg-black/20">
                  {getIcon()}
                </div>
                <h3 className="text-lg font-bold text-white flex-1">{title || (type === 'error' ? 'Error' : 'Notification')}</h3>
                <button onClick={onClose} className="text-gray-500 hover:text-white transition">
                  <X size={20} />
                </button>
              </div>
              
              <p className="text-gray-300 text-sm leading-relaxed mb-6">{message}</p>
              
              <button 
                onClick={onClose}
                className="w-full py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95"
              >
                Dismiss
              </button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
