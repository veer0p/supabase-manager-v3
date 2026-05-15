import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

export default function Select({ options, value, onChange, placeholder = "Select an option", icon: Icon }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div className="relative flex-1" ref={ref}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-white cursor-pointer hover:border-white/10 transition-all shadow-inner group"
      >
        {Icon && <Icon size={14} className="text-gray-500 shrink-0" />}
        <span className={`flex-1 text-sm ${selectedOption ? "text-white" : "text-gray-600"}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={16} className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute z-[60] w-full mt-2 bg-[#0d0d10]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden"
          >
            <div className="max-h-60 overflow-y-auto p-2 space-y-1">
              {options.length === 0 ? (
                <div className="p-4 text-[10px] font-orbitron uppercase tracking-widest text-gray-600 text-center">No options available</div>
              ) : (
                options.map((option) => (
                  <div
                    key={option.value}
                    onClick={() => { onChange(option.value); setIsOpen(false); }}
                    className={`flex items-center justify-between px-4 py-2.5 rounded-xl cursor-pointer transition-all ${
                        value === option.value
                        ? 'bg-supa-green/10 text-supa-green border border-supa-green/20'
                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className="text-sm">{option.label}</span>
                    {value === option.value && <Check size={14} className="text-supa-green" />}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
