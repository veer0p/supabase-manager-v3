import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", isDanger = false }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-[#111] border border-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl pointer-events-auto"
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${isDanger ? 'bg-red-500/10 text-red-500' : 'bg-supa-green/10 text-supa-green'}`}>
                  <AlertTriangle size={24} />
                </div>
                <button onClick={onClose} className="text-gray-500 hover:text-white transition">
                  <X size={20} />
                </button>
              </div>
              
              <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
              <p className="text-gray-400 text-sm mb-6">{message}</p>
              
              <div className="flex gap-3 justify-end">
                <button onClick={onClose} className="px-4 py-2 rounded-lg font-medium text-gray-300 hover:bg-white/5 transition">
                  Cancel
                </button>
                <button 
                  onClick={() => { onConfirm(); onClose(); }} 
                  className={`px-4 py-2 rounded-lg font-medium transition ${isDanger ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-supa-green hover:bg-supa-greenHover text-black'}`}
                >
                  {confirmText}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
