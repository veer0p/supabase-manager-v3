import { motion, AnimatePresence, animate, useMotionValue, useTransform } from 'framer-motion';
import {
  Server, AlertTriangle, Activity, Cpu, HardDrive,
  MemoryStick, Zap, TrendingUp, Clock, Package,
  RefreshCw, Settings2, ListOrdered, WifiOff,
  ChevronLeft, ChevronRight, Container, Layers
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import { fetchStats } from '../lib/api';
import { Skeleton, CardSkeleton } from '../components/Skeleton';
import { useState, useEffect, useRef, useCallback } from 'react';

// ----------- Helpers -----------

function fmt(n, decimals = 1) { return (parseFloat(n) || 0).toFixed(decimals); }

function GraphSkeleton() {
  return (
    <div className="w-full h-full relative overflow-hidden rounded-xl bg-black/40 border border-white/5 shadow-inner p-4 flex items-end justify-between gap-1">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] opacity-20 pointer-events-none" />
      {Array.from({ length: 24 }).map((_, i) => (
        <motion.div key={i} className="w-full bg-[#3ecf8e15] rounded-t-sm"
          initial={{ height: '10%' }}
          animate={{ height: `${10 + Math.random() * 40}%` }}
          transition={{
            duration: 2 + Math.random(),
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'easeInOut'
          }}
        />
      ))}
      <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-[-20deg]"
        animate={{ x: ['-100%', '200%'] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function getThreshold(val, warn = 50, crit = 80) {
  if (val >= crit) return { color: '#ef4444', label: 'Critical', bg: 'bg-red-500/10 border-red-500/30' };
  if (val >= warn) return { color: '#f59e0b', label: 'Warning', bg: 'bg-amber-500/10 border-amber-500/30' };
  return { color: '#3ecf8e', label: 'Optimal', bg: 'bg-supa-green/5 border-[#3ecf8e]/30' };
}

// ----------- Components -----------

function ApexStatCard({ icon: Icon, label, value, sub, color, loading, animate: pulse }) {
  return (
    <motion.div whileHover={{ y: -4 }} className="glass p-5 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden transition-all duration-300 group">
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        <Icon size={64} style={{ color }} />
      </div>
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl border border-white/10 shadow-inner" style={{ background: `${color}15` }}>
            <Icon size={18} style={{ color }} />
          </div>
          <span className="text-[10px] font-orbitron font-bold tracking-widest text-gray-500 uppercase">{label}</span>
        </div>
        <div className="flex flex-col gap-1">
          {loading ? (
            <Skeleton className="h-8 w-24 rounded-lg" />
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-orbitron tracking-tight text-white drop-shadow-md">
                {value}
              </span>
              {pulse && <div className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: color }} />}
            </div>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{sub}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Tachometer({ value, color }) {
  const mv = useMotionValue(0);
  const [isSequenceDone, setIsSequenceDone] = useState(false);

  useEffect(() => {
    let controls;
    const runSequence = async () => {
      controls = animate(mv, 100, { duration: 1.4, ease: "easeInOut" });
      await controls;
      controls = animate(mv, 0, { duration: 1.4, ease: "easeInOut" });
      await controls;
      setIsSequenceDone(true);
    };
    runSequence();
    return () => controls?.stop();
  }, [mv]);

  useEffect(() => {
    if (isSequenceDone && value !== undefined) {
      const controls = animate(mv, value, { duration: 0.8, ease: "easeOut" });
      return () => controls?.stop();
    }
  }, [value, isSequenceDone, mv]);

  const R = 54; const cx = 70; const cy = 70;
  const sweep = 240;
  const startAngle = 210;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const arcX = (a) => cx + R * Math.cos(toRad(startAngle - a));
  const arcY = (a) => cy - R * Math.sin(toRad(startAngle - a));

  const trackPath = `M ${arcX(0)} ${arcY(0)} A ${R} ${R} 0 1 1 ${arcX(sweep)} ${arcY(sweep)}`;
  const redlinePath = `M ${arcX(sweep * 0.85)} ${arcY(sweep * 0.85)} A ${R} ${R} 0 0 1 ${arcX(sweep)} ${arcY(sweep)}`;

  const fillSweep = useTransform(mv, v => (v / 100) * sweep);
  const fillPath = useTransform(fillSweep, s => s > 0.5 ? `M ${arcX(0)} ${arcY(0)} A ${R} ${R} 0 ${s > 180 ? 1 : 0} 1 ${arcX(s)} ${arcY(s)}` : '');

  const nx = useTransform(fillSweep, s => cx + (R - 12) * Math.cos(toRad(startAngle - s)));
  const ny = useTransform(fillSweep, s => cy - (R - 12) * Math.sin(toRad(startAngle - s)));
  const displayStr = useTransform(mv, v => Math.round(v).toString());
  const textColor = useTransform(mv, v => v > 85 ? '#ef4444' : '#fff');
  const glowColor = useTransform(mv, v => v > 85 ? '#ef4444' : color);

  return (
    <div className="relative flex flex-col items-center">
      <svg width="140" height="120" viewBox="0 0 140 120" className="overflow-visible">
        <path d={trackPath} fill="none" stroke="#ffffff0a" strokeWidth="8" strokeLinecap="round" />
        <path d={redlinePath} fill="none" stroke="#ef444440" strokeWidth="8" strokeLinecap="round" />

        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => {
          const a = (i / 10) * sweep;
          const isRed = i >= 9;
          const tnx = cx + (R - 4) * Math.cos(toRad(startAngle - a));
          const tny = cy - (R - 4) * Math.sin(toRad(startAngle - a));
          const tox = cx + (R + 4) * Math.cos(toRad(startAngle - a));
          const toy = cy - (R + 4) * Math.sin(toRad(startAngle - a));
          return <line key={i} x1={tnx} y1={tny} x2={tox} y2={toy} stroke={isRed ? '#ef4444' : '#555'} strokeWidth="2" />
        })}

        <motion.path d={fillPath} fill="none" stroke={glowColor} strokeWidth="8" strokeLinecap="round" style={{ filter: useTransform(glowColor, c => `drop-shadow(0 0 6px ${c})`) }} />
        <motion.line x1={cx} y1={cy} x2={nx} y2={ny} stroke={textColor} strokeWidth="2.5" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.8))' }} />
        <circle cx={cx} cy={cy} r="5" fill="#222" stroke="#fff" strokeWidth="2" />
      </svg>
      <div className="absolute top-[85px] flex flex-col items-center justify-center pointer-events-none">
        <motion.span className="text-2xl font-bold font-orbitron tracking-wider" style={{ color: textColor, textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
          {displayStr}
        </motion.span>
        <motion.span className="text-[9px] font-bold tracking-widest uppercase mt-0.5" style={{ color: glowColor, textShadow: useTransform(glowColor, c => `0 0 8px ${c}80`) }}>CPU %</motion.span>
      </div>
    </div>
  );
}

function FuelGauge({ percent, used, total, color }) {
  const mv = useMotionValue(0);
  const [isSequenceDone, setIsSequenceDone] = useState(false);

  useEffect(() => {
    let controls;
    const runSequence = async () => {
      controls = animate(mv, 100, { duration: 1.4, ease: "easeInOut" });
      await controls;
      controls = animate(mv, 0, { duration: 1.4, ease: "easeInOut" });
      await controls;
      setIsSequenceDone(true);
    };
    runSequence();
    return () => controls?.stop();
  }, [mv]);

  useEffect(() => {
    if (isSequenceDone && percent !== undefined) {
      const controls = animate(mv, percent, { duration: 0.8, ease: "easeOut" });
      return () => controls?.stop();
    }
  }, [percent, isSequenceDone, mv]);

  const segments = 16;
  const displayStr = useTransform(mv, v => `${Math.round(v)}`);

  return (
    <div className="flex flex-col w-full gap-2 mt-4">
      <div className="flex justify-between items-end mb-1">
        <span className="font-orbitron font-bold text-gray-500 text-xl leading-none">E</span>
        <div className="flex gap-1.5 flex-1 mx-4 h-10">
          {Array.from({ length: segments }).map((_, i) => (
            <FuelSegment key={i} index={i} mv={mv} totalSegments={segments} color={color} />
          ))}
        </div>
        <span className="font-orbitron font-bold text-gray-400 text-xl leading-none">F</span>
      </div>
      <div className="flex justify-between items-center text-[11px] text-gray-500 font-orbitron px-1 tracking-wider uppercase">
        <span>{used} MB</span>
        <div className="flex items-center gap-1">
          <motion.span className="text-white font-bold">{displayStr}</motion.span>
          <span>%</span>
        </div>
        <span>{total} MB</span>
      </div>
    </div>
  );
}

function FuelSegment({ index, mv, totalSegments, color }) {
  const background = useTransform(mv, v => {
    const activeSegments = Math.round((v / 100) * totalSegments);
    if (index >= activeSegments) return '#ffffff05';
    const isCritical = index >= totalSegments - 2;
    return isCritical ? '#ef4444' : (index >= totalSegments - 5 ? '#f59e0b' : color);
  });
  const opacity = useTransform(mv, v => {
    const activeSegments = Math.round((v / 100) * totalSegments);
    return index < activeSegments ? 1 : 0.4;
  });
  const boxShadow = useTransform(background, bg => bg === '#ffffff05' ? 'none' : `0 0 10px ${bg}80`);

  return (
    <motion.div
      className="flex-1 rounded-sm skew-x-[-15deg] border border-black/20"
      style={{ background, opacity, boxShadow }}
    />
  );
}

function Odometer({ usedGb, totalGb, color }) {
  const mv = useMotionValue(0);
  const [isSequenceDone, setIsSequenceDone] = useState(false);

  useEffect(() => {
    let controls;
    const runSequence = async () => {
      controls = animate(mv, 999999, { duration: 1.6, ease: "easeInOut" });
      await controls;
      controls = animate(mv, 0, { duration: 1.6, ease: "easeInOut" });
      await controls;
      setIsSequenceDone(true);
    };
    runSequence();
    return () => controls?.stop();
  }, [mv]);

  useEffect(() => {
    if (isSequenceDone && usedGb !== undefined) {
      const controls = animate(mv, usedGb, { duration: 0.8, ease: "easeOut" });
      return () => controls?.stop();
    }
  }, [usedGb, isSequenceDone, mv]);

  const displayUsed = useTransform(mv, v => Math.round(v).toString().padStart(6, '0'));

  return (
    <div className="flex items-center gap-5 bg-black/60 px-4 py-3 rounded-xl border border-white/5 shadow-inner">
      <div className="flex bg-[#111] p-1 rounded border-y border-white/10 shadow-[inset_0_4px_8px_rgba(0,0,0,0.8)]">
        {Array.from({ length: 6 }).map((_, i) => (
          <OdometerDigit key={i} index={i} displayUsed={displayUsed} />
        ))}
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Used (GB)</span>
        <span className="font-orbitron text-sm text-gray-300 mt-0.5">/ {totalGb} MAX</span>
      </div>
    </div>
  );
}

function OdometerDigit({ index, displayUsed }) {
  const digit = useTransform(displayUsed, s => s[index] || '0');
  return (
    <div className={`w-7 h-10 flex items-center justify-center font-orbitron text-xl font-bold
      ${index === 5 ? 'bg-white text-black' : 'bg-[#1a1a1a] text-gray-200'}
      border-r border-black/60 last:border-0 relative overflow-hidden`}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/50 pointer-events-none" />
      <motion.span key={index}>
        {digit}
      </motion.span>
    </div>
  );
}

function PressureGauge({ load1m, load5m, load15m, cpuCores = 2 }) {
  const pressure = Math.min((load1m / cpuCores) * 100, 120);
  const targetPct = Math.min(pressure, 100);

  const mv = useMotionValue(0);
  const [isSequenceDone, setIsSequenceDone] = useState(false);

  useEffect(() => {
    let controls;
    const runSequence = async () => {
      controls = animate(mv, 100, { duration: 1.4, ease: "easeInOut" });
      await controls;
      controls = animate(mv, 0, { duration: 1.4, ease: "easeInOut" });
      await controls;
      setIsSequenceDone(true);
    };
    runSequence();
    return () => controls?.stop();
  }, [mv]);

  useEffect(() => {
    if (isSequenceDone && targetPct !== undefined) {
      const controls = animate(mv, targetPct, { duration: 0.8, ease: "easeOut" });
      return () => controls?.stop();
    }
  }, [targetPct, isSequenceDone, mv]);

  const R = 52; const cx = 70; const cy = 68;
  const sweep = 180;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const arcX = (a) => cx + R * Math.cos(toRad(180 - a));
  const arcY = (a) => cy - R * Math.sin(toRad(180 - a));
  const trackPath = `M ${arcX(0)} ${arcY(0)} A ${R} ${R} 0 0 1 ${arcX(sweep)} ${arcY(sweep)}`;

  const fillSweep = useTransform(mv, v => (v / 100) * sweep);
  const fillPath = useTransform(fillSweep, s => s > 0.5 ? `M ${arcX(0)} ${arcY(0)} A ${R} ${R} 0 ${s > 180 ? 1 : 0} 1 ${arcX(s)} ${arcY(s)}` : '');
  const nx = useTransform(fillSweep, s => cx + (R - 10) * Math.cos(toRad(180 - s)));
  const ny = useTransform(fillSweep, s => cy - (R - 10) * Math.sin(toRad(180 - s)));

  const color = useTransform(mv, v => {
    if (v < 30) return '#3ecf8e';
    if (v < 60) return '#3b82f6';
    if (v < 85) return '#f59e0b';
    return '#ef4444';
  });
  const status = useTransform(mv, v => {
    if (v < 30) return 'Idle';
    if (v < 60) return 'Normal';
    if (v < 85) return 'Busy';
    return 'Overloaded';
  });
  const glow = useTransform(color, c => `${c}30`);
  const displayStr = useTransform(mv, v => `${Math.round(v)}%`);

  return (
    <div className="flex flex-col items-center">
      <svg width="140" height="80" viewBox="0 0 140 80" className="overflow-visible">
        <path d={trackPath} fill="none" stroke="#ffffff0a" strokeWidth="8" strokeLinecap="round" />
        <motion.path d={fillPath} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" style={{ filter: useTransform(color, c => `drop-shadow(0 0 6px ${c})`) }} />
        <motion.line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.8))' }} />
        <circle cx={cx} cy={cy} r="5" fill="#222" stroke="#fff" strokeWidth="2" />
      </svg>
      <div className="flex flex-col items-center mt-2">
        <motion.span className="text-xl font-bold font-orbitron" style={{ color }}>{displayStr}</motion.span>
        <div className="flex gap-2 mt-1">
          <motion.span className="text-[9px] font-bold tracking-widest uppercase border border-white/10 px-1.5 py-0.5 rounded" style={{ color: color, backgroundColor: glow }}>
            {status}
          </motion.span>
        </div>
      </div>
    </div>
  );
}

// ----------- Offline Banner -----------

function OfflineBanner({ ip, onChangeCredentials }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
    >
      <div className="glass rounded-3xl border border-red-500/30 p-10 max-w-md w-full mx-4 text-center shadow-2xl">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="inline-flex p-4 rounded-full bg-red-500/10 border border-red-500/20 mb-6"
        >
          <WifiOff size={40} className="text-red-400" />
        </motion.div>
        <h2 className="text-2xl font-orbitron font-bold text-white mb-3">VPS Offline</h2>
        <p className="text-gray-400 text-sm mb-2">Unable to reach <span className="text-white font-mono">{ip}</span></p>
        <p className="text-gray-500 text-xs mb-8">The metrics agent is not responding. The VPS may be down or port 9100 is blocked.</p>
        <div className="flex gap-3 justify-center">
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl"
          >
            <RefreshCw size={14} className="text-amber-400 animate-spin" style={{ animationDuration: '3s' }} />
            <span className="text-amber-400 text-xs font-bold">Reconnecting...</span>
          </motion.div>
          <button
            onClick={onChangeCredentials}
            className="px-4 py-2 text-xs font-bold text-white bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 transition-all"
          >
            Change VPS
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ----------- Pagination Component -----------

function Pagination({ currentPage, totalPages, onPageChange }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        <ChevronLeft size={14} className="text-gray-400" />
      </button>
      <span className="text-[10px] font-orbitron font-bold text-gray-500 tracking-wider px-2">
        {currentPage} / {totalPages}
      </span>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        <ChevronRight size={14} className="text-gray-400" />
      </button>
    </div>
  );
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0]?.payload;
  return (
    <div className="bg-[#111] border border-gray-800 rounded-xl p-3 shadow-2xl text-xs">
      <p className="text-gray-400 mb-2 font-mono">{point?.fullTime || point?.time}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-medium" style={{ color: p.color }}>{p.name}: {fmt(p.value)}%</p>
      ))}
    </div>
  );
};

const PeriodBtn = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1 text-[10px] font-orbitron font-bold uppercase tracking-wider border-r border-white/5 last:border-0 transition-all ${
      active ? 'bg-[#3ecf8e] text-black shadow-[0_0_10px_#3ecf8e80]' : 'text-gray-500 hover:text-white hover:bg-white/5'
    }`}
  >
    {label}
  </button>
);

// ----------- Main Page -----------

const MAX_HISTORY = 43200; // ~24h at 2s intervals
const ITEMS_PER_PAGE = 5;

export default function Overview({ ip, token, onError, onChangeCredentials }) {
  const [liveData, setLiveData] = useState(null);
  const [liveLoading, setLiveLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [minLoadingDone, setMinLoadingDone] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [hasConnectedOnce, setHasConnectedOnce] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState('cpu');
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [processPage, setProcessPage] = useState(1);
  const [dockerPage, setDockerPage] = useState(1);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);

  const historyRef = useRef([]);
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState({});
  const pollingRef = useRef(true);
  const mountedRef = useRef(true);

  // Client-side alerts computed from live data
  const alerts = [];
  if (liveData && isOnline) {
    if (liveData.cpu > 85) alerts.push({ type: 'cpu', message: `CPU at ${fmt(liveData.cpu)}%` });
    if (liveData.ram_percent > 90) alerts.push({ type: 'ram', message: `RAM at ${fmt(liveData.ram_percent)}%` });
    if (liveData.disk_percent > 90) alerts.push({ type: 'disk', message: `Disk at ${fmt(liveData.disk_percent)}%` });
  }

  // Intro animation timer
  useEffect(() => {
    const timer = setTimeout(() => setMinLoadingDone(true), 3200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (minLoadingDone && !liveLoading && !isReady) {
      setIsReady(true);
    }
  }, [minLoadingDone, liveLoading, isReady]);

  // Compute summary from history
  const computeSummary = useCallback((hist) => {
    if (hist.length === 0) return {};
    const cpus = hist.map(h => h.cpu);
    const rams = hist.map(h => h.ram);
    return {
      avg_cpu: cpus.reduce((a, b) => a + b, 0) / cpus.length,
      peak_cpu: Math.max(...cpus),
      avg_ram: rams.reduce((a, b) => a + b, 0) / rams.length,
      peak_ram: Math.max(...rams),
      peak_disk: Math.max(...hist.map(h => h.disk)),
    };
  }, []);

  // Poll-after-response pattern
  useEffect(() => {
    mountedRef.current = true;
    pollingRef.current = true;

    const poll = async () => {
      while (pollingRef.current && mountedRef.current) {
        try {
          const data = await fetchStats(ip, token);
          if (!mountedRef.current) break;

          setLiveData(data);
          setIsOnline(true);
          setHasConnectedOnce(true);
          setConsecutiveFailures(0);
          setLastUpdated(new Date());
          setLiveLoading(false);

          // Accumulate history
          const now = new Date();
          const point = {
            ts: Date.now(),
            fullTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            timeSec: now.toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
            timeHM: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            cpu: parseFloat(data.cpu) || 0,
            ram: parseFloat(data.ram_percent) || 0,
            disk: parseFloat(data.disk_percent) || 0,
            load: parseFloat(data.load_avg_1m) || 0,
          };
          historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), point];
          setHistory([...historyRef.current]);
          setSummary(computeSummary(historyRef.current));

        } catch (err) {
          if (!mountedRef.current) break;
          setConsecutiveFailures(prev => prev + 1);
          // Mark offline after 3 consecutive failures
          if (consecutiveFailures >= 2) {
            setIsOnline(false);
          }
          setLiveLoading(false);
          if (onError) onError(err.message);
        }

        // Wait 2s before next poll
        await new Promise(r => setTimeout(r, 2000));
      }
    };

    poll();

    return () => {
      mountedRef.current = false;
      pollingRef.current = false;
    };
  }, [ip, token, onError, computeSummary]);

  // Safe data accessors - show 0 when offline
  const safeData = isOnline && liveData ? liveData : {
    cpu: 0, ram_percent: 0, ram_used_mb: 0, ram_total_mb: 0,
    disk_percent: 0, disk_used_gb: 0, disk_total_gb: 0,
    load_avg_1m: 0, load_avg_5m: 0, load_avg_15m: 0,
    uptime_seconds: 0, cpu_cores: 0, docker_container_count: 0,
    docker_containers: [], top_processes: [],
    top_process_name: '', top_process_ram_mb: 0,
  };

  const cpuThresh = getThreshold(safeData.cpu);
  const ramThresh = getThreshold(safeData.ram_percent);
  const diskThresh = getThreshold(safeData.disk_percent, 75, 90);

  // Pagination for processes
  const allProcesses = safeData.top_processes || [];
  const totalProcessPages = Math.max(1, Math.ceil(allProcesses.length / ITEMS_PER_PAGE));
  const paginatedProcesses = allProcesses.slice((processPage - 1) * ITEMS_PER_PAGE, processPage * ITEMS_PER_PAGE);

  // Normalize docker containers — handle both old format (image/status/ports) and new format (cpu/ram_mb/mem_percent)
  const allContainers = (safeData.docker_containers || []).map(c => ({
    name: c.name || '',
    cpu: c.cpu ?? 0,
    ram_mb: c.ram_mb ?? 0,
    mem_percent: c.mem_percent ?? 0,
    // Old format fields used as fallback display
    image: c.image || '',
    status: c.status || '',
  }));
  const totalDockerPages = Math.max(1, Math.ceil(allContainers.length / ITEMS_PER_PAGE));
  const paginatedContainers = allContainers.slice((dockerPage - 1) * ITEMS_PER_PAGE, dockerPage * ITEMS_PER_PAGE);
  // Detect if agent returns new format (has cpu/ram_mb) or old format (has image/status)
  const hasDockerStats = allContainers.length > 0 && allContainers.some(c => c.ram_mb > 0 || c.cpu > 0);

  // Filter history for display
  const getFilteredHistory = () => {
    const h = historyRef.current;
    if (selectedPeriod === 'all') return h;
    const limits = { '1m': 60000, '5m': 300000, '15m': 900000, '1d': 86400000 };
    const cutoff = Date.now() - (limits[selectedPeriod] || Infinity);
    const filtered = h.filter(p => p.ts >= cutoff);
    if (selectedPeriod === '1m') {
      return filtered.map(p => ({ ...p, time: p.timeSec }));
    }
    if (selectedPeriod === '1d') {
      return filtered.map(p => ({ ...p, time: p.timeHM }));
    }
    return filtered;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pb-10">
      {/* Offline overlay - only show after initial connection succeeded then lost */}
      <AnimatePresence>
        {!isOnline && hasConnectedOnce && (
          <OfflineBanner ip={ip} onChangeCredentials={onChangeCredentials} />
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-orbitron text-white uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-400">Telemetry Overview</h1>
          <p className="text-gray-500 text-[10px] mt-2 font-orbitron uppercase tracking-widest border border-white/5 inline-block px-2 py-0.5 rounded bg-black/20">Real-time intelligence for your VPS.</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[10px] text-gray-500 font-orbitron uppercase tracking-wider flex items-center gap-2 border border-white/5 px-2 py-1 rounded bg-black/20">
              <RefreshCw size={10} className="animate-spin text-[#3ecf8e]" style={{ animationDuration: '3s' }} />
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={onChangeCredentials}
            className="flex items-center gap-2 px-3 py-2 text-[10px] font-orbitron font-bold uppercase tracking-wider text-gray-400 border border-white/10 rounded-xl hover:bg-white/5 hover:text-white transition-all"
          >
            <Settings2 size={14} />
            Change VPS
          </button>
        </div>
      </div>

      <AnimatePresence>
        {alerts.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex flex-wrap gap-3 items-center">
            <AlertTriangle size={18} className="text-red-400 shrink-0" />
            <span className="text-red-300 font-semibold text-sm">Active Alerts:</span>
            {alerts.map((a, i) => (
              <span key={i} className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded-full border border-red-500/20">
                {a.message}
              </span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {!liveData && liveLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <ApexStatCard icon={Server} label="VPS Status"
              value={isOnline ? 'Online' : 'Offline'}
              sub={ip}
              color={isOnline ? "#3ecf8e" : "#ef4444"} />
            <ApexStatCard icon={Package} label="Containers"
              value={safeData.docker_container_count}
              sub="Docker active"
              color="#3b82f6" />
            <ApexStatCard icon={AlertTriangle} label="System Alerts"
              value={alerts.length}
              sub={alerts.length === 0 ? "All systems healthy" : "Requires attention"}
              color={alerts.length > 0 ? "#ef4444" : "#3ecf8e"} />
            <ApexStatCard icon={Cpu} label="Current CPU"
              value={`${fmt(safeData.cpu)}%`}
              sub={`Load: ${fmt(safeData.load_avg_1m, 2)}`}
              color={cpuThresh.color} loading={liveLoading} animate={isOnline} />
          </>
        )}
      </div>

      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-8 bg-supa-green rounded-r shadow-[0_0_12px_#3ecf8e]" />
          <h2 className="text-xl font-orbitron font-bold text-white tracking-[0.2em] uppercase">System Metrics</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <motion.div whileHover={{ y: -4 }} className={`glass p-6 rounded-3xl border ${cpuThresh.bg} relative overflow-hidden flex flex-col justify-between shadow-2xl transition-all duration-300`}>
            <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/10 to-transparent" />
            <div className="flex justify-between items-center mb-4 relative z-10">
              <div className="flex items-center gap-2">
                <Cpu size={20} style={{ color: cpuThresh.color }} />
                <span className="font-black font-orbitron tracking-[0.15em] text-[11px] text-white">CPU USAGE</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[11px] font-orbitron font-bold" style={{ color: cpuThresh.color }}>{fmt(safeData.cpu)}%</span>
                <span className="text-[8px] text-gray-500 font-mono uppercase tracking-tighter">Usage</span>
              </div>
            </div>
            <div className="relative h-44 flex items-center justify-center">
              <Tachometer value={safeData.cpu} color={cpuThresh.color} />
            </div>
          </motion.div>

          <motion.div whileHover={{ y: -4 }} className={`glass p-6 rounded-3xl border ${ramThresh.bg} relative overflow-hidden flex flex-col justify-between shadow-2xl transition-all duration-300`}>
            <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/10 to-transparent" />
            <div className="flex justify-between items-center mb-4 relative z-10">
              <div className="flex items-center gap-2">
                <MemoryStick size={20} style={{ color: ramThresh.color }} />
                <span className="font-black font-orbitron tracking-[0.15em] text-[11px] text-white">RAM USAGE</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[11px] font-orbitron font-bold" style={{ color: ramThresh.color }}>{fmt(safeData.ram_percent)}%</span>
                <span className="text-[8px] text-gray-500 font-mono uppercase tracking-tighter">{safeData.ram_used_mb} MB</span>
              </div>
            </div>
            <div className="relative h-44 flex items-center justify-center">
              <FuelGauge
                percent={safeData.ram_percent}
                used={safeData.ram_used_mb}
                total={safeData.ram_total_mb || 1024}
                color={ramThresh.color}
              />
            </div>
          </motion.div>

          <motion.div whileHover={{ y: -4 }} className={`glass p-6 rounded-3xl border ${diskThresh.bg} relative overflow-hidden flex flex-col justify-between shadow-2xl transition-all duration-300`}>
            <div className="flex justify-between items-center mb-6 relative z-10">
              <div className="flex items-center gap-2">
                <HardDrive size={20} style={{ color: diskThresh.color }} />
                <span className="font-black font-orbitron tracking-[0.15em] text-[11px] text-white">DISK USAGE</span>
              </div>
              <span className="text-[11px] font-orbitron px-2 py-0.5 rounded-lg border border-white/10 font-bold uppercase tracking-widest" style={{ color: diskThresh.color, background: `${diskThresh.color}15` }}>
                {diskThresh.label}
              </span>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <Odometer usedGb={safeData.disk_used_gb} totalGb={Math.round(safeData.disk_total_gb)} color={diskThresh.color} />
            </div>
            <p className="text-[9px] text-center text-gray-600 mt-4 uppercase tracking-[0.2em] font-bold">Storage Status</p>
          </motion.div>

          <motion.div whileHover={{ y: -4 }} className="glass p-6 rounded-3xl border border-white/5 shadow-inner flex flex-col items-center justify-center relative overflow-hidden shadow-2xl transition-all duration-300">
            <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/10 to-transparent" />
            <div className="flex justify-between items-center w-full mb-4 relative z-10">
              <div className="flex items-center gap-2">
                <Zap size={20} className="text-blue-400" />
                <span className="font-black font-orbitron tracking-[0.15em] text-[11px] text-white">LOAD AVG</span>
              </div>
              <span className="text-[9px] text-blue-400 font-black uppercase tracking-tighter bg-blue-400/10 px-2 py-0.5 rounded-lg border border-blue-400/20">{safeData.cpu_cores} CORES</span>
            </div>
            <div className="relative h-44 flex items-center justify-center">
              <PressureGauge
                load1m={safeData.load_avg_1m}
                load5m={safeData.load_avg_5m}
                load15m={safeData.load_avg_15m}
                cpuCores={safeData.cpu_cores || 2}
              />
            </div>
          </motion.div>
        </div>
      </section>

      {!isReady ? (
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton className="w-1.5 h-8 rounded-r" />
            <Skeleton className="w-48 h-6" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </section>
      ) : (
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-8 bg-blue-500 rounded-r shadow-[0_0_12px_#3b82f6]" />
            <h2 className="text-xl font-orbitron font-bold text-white tracking-[0.2em] uppercase">System Info</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <motion.div whileHover={{ scale: 1.02 }} className="glass p-6 rounded-2xl border border-white/5 shadow-xl flex flex-col items-center text-center gap-4 transition-all">
              <div className="p-3 border border-gray-600/30 bg-gray-600/10 rounded-2xl shadow-[inset_0_0_12px_rgba(255,255,255,0.05)]"><Package size={22} className="text-gray-400" /></div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2">Platform OS</p>
                <p className="text-white font-mono font-black text-sm tracking-tight">Linux</p>
                <div className="mt-3 px-3 py-1 bg-black/40 rounded-full border border-white/10">
                  <span className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">{ip}</span>
                </div>
              </div>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} className="glass p-6 rounded-2xl border border-white/5 shadow-xl flex flex-col items-center text-center gap-4 transition-all">
              <div className="p-3 border border-[#3ecf8e20] bg-[#3ecf8e10] rounded-2xl shadow-[inset_0_0_12px_rgba(62,207,142,0.2)]"><Clock size={22} className="text-[#3ecf8e]" /></div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2">Runtime</p>
                <p className="text-white font-mono font-black text-sm tracking-tight">{formatUptime(safeData.uptime_seconds)}</p>
                <div className="mt-3 px-3 py-1 bg-[#3ecf8e10] rounded-full border border-[#3ecf8e20]">
                  <span className="text-[11px] text-[#3ecf8e] font-bold uppercase tracking-widest">{isOnline ? 'STABLE' : 'OFFLINE'}</span>
                </div>
              </div>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} className="glass p-6 rounded-2xl border border-white/5 shadow-xl flex flex-col items-center text-center gap-4 transition-all">
              <div className="p-3 border border-blue-500/20 bg-blue-500/10 rounded-2xl shadow-[inset_0_0_12px_rgba(59,130,246,0.2)]"><Package size={22} className="text-blue-400" /></div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2">Containers</p>
                <p className="text-white font-mono font-black text-sm tracking-tight">{safeData.docker_container_count} ACTIVE</p>
                <div className="mt-3 px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20">
                  <span className="text-[11px] text-blue-400 font-bold uppercase tracking-widest">DOCKER</span>
                </div>
              </div>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} className="glass p-6 rounded-2xl border border-white/5 shadow-xl flex flex-col items-center text-center gap-4 transition-all">
              <div className="p-3 border border-amber-500/20 bg-amber-500/10 rounded-2xl shadow-[inset_0_0_12px_rgba(245,158,11,0.2)]"><TrendingUp size={22} className="text-amber-400" /></div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2">CPU Peak</p>
                <p className="text-white font-mono font-black text-sm tracking-tight">{fmt(summary.peak_cpu || 0)}%</p>
                <div className="mt-3 px-3 py-1 bg-amber-500/10 rounded-full border border-amber-500/20">
                  <span className="text-[11px] text-amber-400 font-bold uppercase tracking-widest">AVG: {fmt(summary.avg_cpu || 0)}%</span>
                </div>
              </div>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} className="glass p-6 rounded-2xl border border-white/5 shadow-xl flex flex-col items-center text-center gap-4 transition-all">
              <div className="p-3 border border-red-500/20 bg-red-500/10 rounded-2xl shadow-[inset_0_0_12px_rgba(239,68,68,0.2)]"><TrendingUp size={22} className="text-red-400" /></div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2">RAM Peak</p>
                <p className="text-white font-mono font-black text-sm tracking-tight">{fmt(summary.peak_ram || 0)}%</p>
                <div className="mt-3 px-3 py-1 bg-red-500/10 rounded-full border border-red-500/20">
                  <span className="text-[11px] text-red-400 font-bold uppercase tracking-widest">AVG: {fmt(summary.avg_ram || 0)}%</span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Top Processes & Docker Containers - Side by Side */}
      {isReady && (
        <section className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Top Processes Widget */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-1.5 h-8 bg-purple-500 rounded-r shadow-[0_0_12px_#8b5cf6]" />
                  <h2 className="text-lg font-orbitron font-bold text-white tracking-[0.15em] uppercase">Top Processes</h2>
                  <span className="text-[10px] font-orbitron text-gray-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                    {allProcesses.length}
                  </span>
                </div>
                {totalProcessPages > 1 && (
                  <Pagination currentPage={processPage} totalPages={totalProcessPages} onPageChange={setProcessPage} />
                )}
              </div>

              <div className="glass rounded-2xl border border-white/5 overflow-hidden">
                {allProcesses.length === 0 ? (
                  <div className="p-8 text-center">
                    <ListOrdered size={28} className="mx-auto mb-3 text-gray-600" />
                    <p className="text-gray-500 text-sm">No process data available</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left px-4 py-3 text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest">#</th>
                        <th className="text-left px-4 py-3 text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest">Process</th>
                        <th className="text-right px-4 py-3 text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest">CPU</th>
                        <th className="text-right px-4 py-3 text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest">Memory</th>
                        <th className="text-left px-4 py-3 text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest w-1/4"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedProcesses.map((proc, i) => {
                        const globalIndex = (processPage - 1) * ITEMS_PER_PAGE + i;
                        const maxMem = allProcesses[0]?.ram_mb || 1;
                        const barPct = Math.min((proc.ram_mb / maxMem) * 100, 100);
                        const barColor = globalIndex === 0 ? '#8b5cf6' : globalIndex < 3 ? '#3b82f6' : '#3ecf8e';
                        return (
                          <tr key={proc.name} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3 text-gray-600 font-mono text-xs">{globalIndex + 1}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: barColor, boxShadow: `0 0 6px ${barColor}` }} />
                                <span className="text-white font-mono font-semibold text-xs truncate max-w-[120px]" title={proc.name}>{proc.name}</span>
                                {proc.count > 1 && <span className="text-[9px] text-gray-500 bg-white/5 px-1.5 rounded">{proc.count}x</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`font-mono font-bold text-xs ${proc.cpu > 100 ? 'text-red-400' : proc.cpu > 50 ? 'text-amber-400' : 'text-gray-300'}`}>{fmt(proc.cpu, 1)}%</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-white font-mono font-bold text-xs">{proc.ram_mb >= 1024 ? `${(proc.ram_mb / 1024).toFixed(1)}G` : `${proc.ram_mb}M`}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${barPct}%` }}
                                  transition={{ duration: 0.8, ease: 'easeOut' }}
                                  className="h-full rounded-full"
                                  style={{ backgroundColor: barColor, boxShadow: `0 0 8px ${barColor}40` }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Docker Containers Widget */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-1.5 h-8 bg-blue-500 rounded-r shadow-[0_0_12px_#3b82f6]" />
                  <h2 className="text-lg font-orbitron font-bold text-white tracking-[0.15em] uppercase">Docker Containers</h2>
                  <span className="text-[10px] font-orbitron text-gray-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                    {allContainers.length}
                  </span>
                </div>
                {totalDockerPages > 1 && (
                  <Pagination currentPage={dockerPage} totalPages={totalDockerPages} onPageChange={setDockerPage} />
                )}
              </div>

              <div className="glass rounded-2xl border border-white/5 overflow-hidden">
                {allContainers.length === 0 ? (
                  <div className="p-8 text-center">
                    <Layers size={28} className="mx-auto mb-3 text-gray-600" />
                    <p className="text-gray-500 text-sm">{isOnline ? 'No containers running' : 'No data available'}</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left px-4 py-3 text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest">#</th>
                        <th className="text-left px-4 py-3 text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest">Container</th>
                        {hasDockerStats ? (
                          <>
                            <th className="text-right px-4 py-3 text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest">CPU</th>
                            <th className="text-right px-4 py-3 text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest">Memory</th>
                            <th className="text-left px-4 py-3 text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest w-1/4"></th>
                          </>
                        ) : (
                          <>
                            <th className="text-left px-4 py-3 text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest">Image</th>
                            <th className="text-left px-4 py-3 text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest">Status</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedContainers.map((container, i) => {
                        const globalIndex = (dockerPage - 1) * ITEMS_PER_PAGE + i;
                        const barColor = globalIndex === 0 ? '#3b82f6' : globalIndex < 3 ? '#8b5cf6' : '#3ecf8e';
                        const isUp = container.status?.toLowerCase().includes('up');
                        const statusColor = isUp ? '#3ecf8e' : container.status ? '#ef4444' : '#555';
                        return (
                          <tr key={container.name + i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3 text-gray-600 font-mono text-xs">{globalIndex + 1}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hasDockerStats ? barColor : statusColor, boxShadow: `0 0 6px ${hasDockerStats ? barColor : statusColor}` }} />
                                <span className="text-white font-mono font-semibold text-xs truncate max-w-[120px]" title={container.name}>{container.name}</span>
                              </div>
                            </td>
                            {hasDockerStats ? (
                              <>
                                <td className="px-4 py-3 text-right">
                                  <span className={`font-mono font-bold text-xs ${container.cpu > 100 ? 'text-red-400' : container.cpu > 50 ? 'text-amber-400' : 'text-gray-300'}`}>{fmt(container.cpu, 1)}%</span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className="text-white font-mono font-bold text-xs">{container.ram_mb >= 1024 ? `${(container.ram_mb / 1024).toFixed(1)}G` : `${container.ram_mb}M`}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${Math.min((container.ram_mb / (allContainers[0]?.ram_mb || 1)) * 100, 100)}%` }}
                                      transition={{ duration: 0.8, ease: 'easeOut' }}
                                      className="h-full rounded-full"
                                      style={{ backgroundColor: barColor, boxShadow: `0 0 8px ${barColor}40` }}
                                    />
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-4 py-3">
                                  <span className="text-gray-400 font-mono text-xs truncate block max-w-[140px]" title={container.image}>
                                    {container.image?.split('/').pop()?.split(':')[0] || container.image}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-full border" style={{
                                    color: statusColor,
                                    backgroundColor: `${statusColor}15`,
                                    borderColor: `${statusColor}30`,
                                  }}>
                                    {container.status?.split(' ').slice(0, 3).join(' ') || 'Unknown'}
                                  </span>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="glass p-10 rounded-3xl border border-white/5 shadow-2xl relative z-10">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 gap-6">
          <div className="flex items-center gap-4">
            <span className="w-1.5 h-10 bg-blue-500 rounded-r shadow-[0_0_12px_#3b82f6]" />
            <div>
              <h2 className="text-2xl font-orbitron font-black tracking-[0.25em] text-white uppercase">Live Stream</h2>
              <p className="text-gray-600 text-[11px] uppercase font-bold tracking-[0.1em] mt-2">
                {history.length === 0 ? 'WAITING FOR DATA...' : `${history.length} DATA POINTS COLLECTED`}
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex bg-black/60 p-1.5 rounded-2xl border border-white/10 shadow-inner">
              {['cpu', 'ram', 'disk'].map(m => (
                <button
                  key={m}
                  onClick={() => setSelectedMetric(m)}
                  className={`px-4 py-1.5 text-[10px] font-orbitron font-bold uppercase tracking-[0.2em] rounded-xl transition-all ${
                    selectedMetric === m ? (m==='cpu'?'bg-[#3ecf8e] text-black shadow-[0_0_15px_#3ecf8e80]':m==='ram'?'bg-[#8b5cf6] text-white shadow-[0_0_15px_#8b5cf680]':'bg-[#f59e0b] text-black shadow-[0_0_15px_#f59e0b80]') : 'text-gray-500 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="flex bg-black/60 p-1.5 rounded-2xl border border-white/10 shadow-inner">
              {[{ key: '1m', label: '1M' }, { key: '5m', label: '5M' }, { key: '15m', label: '15M' }, { key: '1d', label: '1D' }, { key: 'all', label: 'ALL' }].map(p => (
                <PeriodBtn key={p.key} label={p.label} active={selectedPeriod === p.key} onClick={() => setSelectedPeriod(p.key)} />
              ))}
            </div>
          </div>
        </div>

        {!isReady ? (
          <div className="h-64 flex flex-col items-center justify-center gap-6 px-10">
            <div className="flex gap-2">
              {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-supa-green animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />)}
            </div>
            <GraphSkeleton />
          </div>
        ) : history.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-600 text-sm">
            <div className="text-center">
              <Activity size={32} className="mx-auto mb-3 opacity-30" />
              <p>Waiting for data points...</p>
              <p className="text-xs mt-1 text-gray-700">Data is collected every 2 seconds from your VPS.</p>
            </div>
          </div>
        ) : isReady && (
          <>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={getFilteredHistory()} margin={{ top: 5, right: 10, left: -20, bottom: 0 }} barGap={2}>
                  <defs>
                    <linearGradient id="gCpuBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3ecf8e" stopOpacity={1} />
                      <stop offset="100%" stopColor="#3ecf8e" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="gRamBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="gDiskBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                  <XAxis dataKey="time" stroke="transparent" tick={{ fill: '#555', fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis stroke="transparent" tick={{ fill: '#555', fontSize: 11 }} domain={[0, 100]} unit="%" />
                  <Tooltip cursor={{ fill: '#ffffff0a' }} content={<CustomTooltip />} />
                  <Bar
                    dataKey={selectedMetric}
                    radius={[4, 4, 0, 0]}
                    fill={selectedMetric === 'cpu' ? 'url(#gCpuBar)' : selectedMetric === 'ram' ? 'url(#gRamBar)' : 'url(#gDiskBar)'}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </section>
    </motion.div>
  );
}
