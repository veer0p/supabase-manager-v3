import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useAnimationFrame, animate, useTransform } from 'framer-motion';
import { Activity } from 'lucide-react';

export function DiscBrakeLoader({ onReadyToExit, dataReady }) {
  const rotation = useMotionValue(0);
  const velocity = useMotionValue(8); 
  const caliperX = useMotionValue(0); 
  const [phase, setPhase] = useState('constant'); 
  const dataReadyRef = useRef(dataReady);
  
  useEffect(() => {
    dataReadyRef.current = dataReady;
  }, [dataReady]);
  
  useAnimationFrame((_, delta) => {
    rotation.set(rotation.get() + (velocity.get() * (delta / 16.67)));
  });

  useEffect(() => {
    let mounted = true;
    const runLoop = async () => {
      while (mounted) {
        setPhase('constant');
        await new Promise(r => setTimeout(r, 800));
        
        setPhase('braking');
        animate(caliperX, -2, { duration: 0.15 }); 
        await animate(velocity, 0, { duration: 1.2, ease: [0.22, 1, 0.36, 1] });
        
        setPhase('stopped');
        animate(caliperX, 0, { duration: 0.3, ease: "easeOut" }); 
        if (dataReadyRef.current) {
          setTimeout(onReadyToExit, 400);
          break;
        }
        
        await new Promise(r => setTimeout(r, 800));

        setPhase('accelerating');
        await animate(velocity, 8, { duration: 1.5, ease: "easeIn" });
      }
    };
    runLoop();
    return () => { mounted = false; };
  }, [onReadyToExit]); 

  const heatOpacity = useTransform(velocity, [0, 15, 25], [0.1, 0.3, 0.6]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-2xl overflow-hidden">
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_#ffffff11_0%,_transparent_70%)]" />
      <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-white/5 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-white/5 blur-[120px] pointer-events-none" />
      
      <div className="relative w-96 h-96 flex items-center justify-center">
        <motion.div
          style={{ opacity: heatOpacity, scale: useTransform(velocity, [0, 25], [0.8, 1.2]) }}
          className="absolute w-64 h-64 rounded-full bg-red-600/40 blur-[60px]"
        />

        <motion.div 
          style={{ rotate: rotation, willChange: "transform", translateZ: 0 }}
          className="relative z-10"
        >
          <svg width="280" height="280" viewBox="0 0 240 240">
            <defs>
              <radialGradient id="rotorGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#1a1a1a" />
                <stop offset="80%" stopColor="#2a2a2a" />
                <stop offset="100%" stopColor="#0a0a0a" />
              </radialGradient>
            </defs>
            <circle cx="120" cy="120" r="105" fill="url(#rotorGrad)" stroke="#333" strokeWidth="1" />
            {[...Array(18)].map((_, i) => (
              <rect key={i} x="118" y="30" width="4" height="20" rx="2" fill="#000" opacity="0.8" transform={`rotate(${i * 20}, 120, 120)`} />
            ))}
            {[...Array(36)].map((_, i) => (
              <circle key={i} cx="120" cy="65" r="2.5" fill="#000" opacity="0.9" transform={`rotate(${i * 10}, 120, 120)`} />
            ))}
            <circle cx="120" cy="120" r="45" fill="#111" stroke="#333" strokeWidth="2" />
            {[...Array(5)].map((_, i) => (
              <circle key={i} cx="120" cy="95" r="5" fill="#2a2a2a" stroke="#444" strokeWidth="1" transform={`rotate(${i * 72}, 120, 120)`} />
            ))}
            <circle cx="120" cy="120" r="12" fill="#000" stroke="#222" strokeWidth="1" />
          </svg>
        </motion.div>
        
        <div className="absolute right-8 top-1/2 -translate-y-1/2 z-20">
          <motion.div style={{ x: caliperX }} className="relative">
            <svg width="110" height="210" viewBox="0 0 110 210" className="drop-shadow-[0_0_30px_rgba(239,68,68,0.6)]">
              <path 
                d="M5,15 L55,20 C80,20 95,45 95,100 C95,155 80,180 55,180 L5,185 L0,165 L15,165 C25,165 35,145 35,100 C35,55 25,35 15,35 L0,35 Z" 
                fill="#ef4444" 
                stroke="#991b1b" 
                strokeWidth="3.5" 
                strokeLinejoin="round" 
              />
              <path d="M55,25 C75,25 88,45 88,100 C88,155 75,175 55,175" fill="none" stroke="#ff6666" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
              <circle cx="26" cy="65" r="10" fill="#7f1d1d" opacity="0.6" />
              <circle cx="26" cy="100" r="10" fill="#7f1d1d" opacity="0.6" />
              <circle cx="26" cy="135" r="10" fill="#7f1d1d" opacity="0.6" />
              <text x="72" y="100" transform="rotate(90, 72, 100)" fill="white" fontSize="18" fontWeight="950" fontFamily="Orbitron" letterSpacing="4" textAnchor="middle" dominantBaseline="middle" opacity="1" style={{ filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.8))' }}>APEX</text>
              <circle cx="78" cy="45" r="3" fill="#111" />
              <circle cx="78" cy="155" r="3" fill="#111" />
            </svg>
          </motion.div>
        </div>
      </div>
      
      <div className="mt-12 flex flex-col items-center gap-6">
        <div className="text-center">
          <motion.h2 
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="font-orbitron text-3xl font-black tracking-[0.5em] text-white uppercase mb-2 drop-shadow-[0_0_15px_#3ecf8e]"
          >
            Apex Telemetry
          </motion.h2>
          <div className="h-[2px] w-full bg-white/5 relative overflow-hidden">
            <motion.div 
              animate={{ x: ['-100%', '100%'] }} 
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }} 
              className="absolute inset-0 bg-gradient-to-r from-transparent via-[#3ecf8e] to-transparent shadow-[0_0_10px_#3ecf8e]" 
            />
          </div>
        </div>
        
        <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/10 backdrop-blur-sm">
          <Activity size={14} className="text-[#3ecf8e] animate-pulse" />
          <span className="text-[10px] font-mono text-gray-400 tracking-[0.2em] uppercase">Synchronizing Systems...</span>
        </div>
      </div>
    </div>
  );
}
