
import React from 'react';
import { motion } from 'framer-motion';

export const Skeleton = ({ className }) => (
  <div className={`relative overflow-hidden bg-white/5 rounded-xl ${className}`}>
    <motion.div
      animate={{
        x: ['-100%', '100%'],
      }}
      transition={{
        repeat: Infinity,
        duration: 1.5,
        ease: 'linear',
      }}
      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
    />
  </div>
);

export const CardSkeleton = () => (
  <div className="bg-black/40 p-6 rounded-3xl border border-white/5 backdrop-blur-xl space-y-4">
    <div className="flex items-center gap-4">
      <Skeleton className="w-12 h-12 rounded-2xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="w-24 h-4" />
        <Skeleton className="w-32 h-3" />
      </div>
    </div>
    <Skeleton className="w-full h-10 rounded-xl" />
  </div>
);
