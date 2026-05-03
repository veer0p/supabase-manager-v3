import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

export default function Select({ options, value, onChange, placeholder = "Select an option" }) {
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
        className="flex items-center justify-between bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white cursor-pointer hover:border-gray-600 transition"
      >
        <span className={selectedOption ? "text-white" : "text-gray-500"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={18} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-2 bg-[#1a1a1a] border border-gray-800 rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="max-h-60 overflow-y-auto p-1">
              {options.length === 0 ? (
                <div className="p-3 text-sm text-gray-500 text-center">No options available</div>
              ) : (
                options.map((option) => (
                  <div
                    key={option.value}
                    onClick={() => { onChange(option.value); setIsOpen(false); }}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer hover:bg-white/10 text-sm text-gray-200 transition"
                  >
                    {option.label}
                    {value === option.value && <Check size={16} className="text-supa-green" />}
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
