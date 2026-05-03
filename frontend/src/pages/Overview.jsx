import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence, animate } from 'framer-motion';
import {
  Server, Database, AlertTriangle, Activity, Cpu, HardDrive,
  MemoryStick, Zap, TrendingUp, TrendingDown, Clock, Package,
  RefreshCw, ChevronDown
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadialBarChart, RadialBar
} from 'recharts';
import { apiFetch } from '../lib/api';
import Select from '../components/Select';

// ----------- Helpers -----------

function fmt(n, decimals = 1) { return (parseFloat(n) || 0).toFixed(decimals); }

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getThreshold(value, warn = 70, crit = 90) {
  if (value >= crit) return { color: '#ef4444', label: 'Critical', bg: 'bg-red-500/10 border-red-500/20' };
  if (value >= warn) return { color: '#f59e0b', label: 'Warning', bg: 'bg-amber-500/10 border-amber-500/20' };
  return { color: '#3ecf8e', label: 'Healthy', bg: 'bg-supa-green/10 border-supa-green/20' };
}

// ----------- Sub-components -----------

function StatCard({ icon: Icon, label, value, sub, color = '#3ecf8e', animate = false, loading = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className="glass p-5 rounded-xl border border-white/5 relative overflow-hidden group shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.4)]"
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: `radial-gradient(ellipse at 80% 20%, ${color}15 0%, transparent 70%)` }} />
      <div className="flex items-start justify-between mb-4">
        <div className="p-2 rounded border border-white/5 shadow-inner" style={{ background: `${color}10`, boxShadow: `inset 0 0 10px ${color}15` }}>
          <Icon size={18} style={{ color }} />
        </div>
        {animate && <span className="flex h-2 w-2"><span className="animate-ping absolute inline-flex h-2 w-2 rounded-sm opacity-75" style={{ background: color }} /><span className="relative inline-flex rounded-sm h-2 w-2 shadow-[0_0_8px_currentColor]" style={{ background: color }} /></span>}
      </div>
      <p className="text-gray-500 text-[10px] font-orbitron uppercase tracking-widest font-bold mb-1">{label}</p>
      {loading ? (
        <div className="h-8 w-16 bg-white/5 rounded animate-pulse" />
      ) : (
        <p className="text-3xl font-bold font-orbitron text-white tracking-wider" style={{ textShadow: `0 0 10px ${color}20` }}>{value}</p>
      )}
      {sub && <p className="text-[10px] text-gray-500 mt-2 tracking-wide uppercase">{sub}</p>}
    </motion.div>
  );
}



// Tachometer for CPU (RPM style)
function Tachometer({ value, color }) {
  const [displayValue, setDisplayValue] = useState(0);
  const currentVal = useRef(0);
  
  useEffect(() => {
    const controls = animate(currentVal.current, value, {
      duration: 1.2,
      ease: "easeOut",
      onUpdate: (v) => { setDisplayValue(v); currentVal.current = v; }
    });
    return controls.stop;
  }, [value]);

  const R = 54; const cx = 70; const cy = 70;
  const sweep = 240; 
  const startAngle = 210;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const arcX = (a) => cx + R * Math.cos(toRad(startAngle - a));
  const arcY = (a) => cy - R * Math.sin(toRad(startAngle - a));
  
  const trackPath = `M ${arcX(0)} ${arcY(0)} A ${R} ${R} 0 1 1 ${arcX(sweep)} ${arcY(sweep)}`;
  const redlinePath = `M ${arcX(sweep * 0.85)} ${arcY(sweep * 0.85)} A ${R} ${R} 0 0 1 ${arcX(sweep)} ${arcY(sweep)}`;
  
  const fillSweep = (displayValue / 100) * sweep;
  const fillPath = fillSweep > 0.5 ? `M ${arcX(0)} ${arcY(0)} A ${R} ${R} 0 ${fillSweep > 180 ? 1 : 0} 1 ${arcX(fillSweep)} ${arcY(fillSweep)}` : '';

  const needleRad = toRad(startAngle - fillSweep);
  const nx = cx + (R - 12) * Math.cos(needleRad);
  const ny = cy - (R - 12) * Math.sin(needleRad);

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

        {fillPath && <path d={fillPath} fill="none" stroke={displayValue > 85 ? '#ef4444' : color} strokeWidth="8" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${displayValue > 85 ? '#ef4444' : color})` }} />}
        
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={displayValue > 85 ? '#ef4444' : '#fff'} strokeWidth="2.5" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.8))' }} />
        <circle cx={cx} cy={cy} r="5" fill="#222" stroke={displayValue > 85 ? '#ef4444' : '#fff'} strokeWidth="2" />
      </svg>
      <div className="absolute top-[85px] flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-bold font-orbitron tracking-wider" style={{ color: displayValue > 85 ? '#ef4444' : '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
          {Math.round(displayValue)}
        </span>
        <span className="text-[9px] font-bold tracking-widest uppercase mt-0.5" style={{ color: displayValue > 85 ? '#ef4444' : color, textShadow: `0 0 8px ${color}80`, transition: 'color 0.8s' }}>RPM x100</span>
      </div>
    </div>
  );
}

// Fuel Gauge for RAM (Segmented)
function FuelGauge({ percent, used, total, color }) {
  const [displayValue, setDisplayValue] = useState(0);
  const currentVal = useRef(0);
  
  useEffect(() => {
    const controls = animate(currentVal.current, percent, {
      duration: 1.2,
      ease: "easeOut",
      onUpdate: (v) => { setDisplayValue(v); currentVal.current = v; }
    });
    return controls.stop;
  }, [percent]);

  const segments = 16;
  const activeSegments = Math.round((displayValue / 100) * segments);

  return (
    <div className="flex flex-col w-full gap-2 mt-4">
      <div className="flex justify-between items-end mb-1">
        <span className="font-orbitron font-bold text-gray-500 text-xl leading-none">E</span>
        <div className="flex gap-1.5 flex-1 mx-4 h-10">
          {Array.from({ length: segments }).map((_, i) => {
            const isActive = i < activeSegments;
            const isCritical = i >= segments - 2;
            const segColor = isCritical ? '#ef4444' : (i >= segments - 5 ? '#f59e0b' : color);
            return (
              <div key={i} 
                className="flex-1 rounded-sm skew-x-[-15deg] transition-all duration-300 border border-black/20"
                style={{ 
                  background: isActive ? segColor : '#ffffff05',
                  boxShadow: isActive ? `0 0 10px ${segColor}80` : 'none',
                  opacity: isActive ? 1 : 0.4
                }} 
              />
            );
          })}
        </div>
        <span className="font-orbitron font-bold text-gray-400 text-xl leading-none">F</span>
      </div>
      <div className="flex justify-between text-[11px] text-gray-500 font-orbitron px-1 tracking-wider uppercase">
        <span>{used} MB</span>
        <span>{total} MB</span>
      </div>
    </div>
  );
}

// Odometer for Disk Space
function Odometer({ usedGb, totalGb, color }) {
  const [displayUsed, setDisplayUsed] = useState(0);
  const currentVal = useRef(0);
  
  useEffect(() => {
    const controls = animate(currentVal.current, usedGb, {
      duration: 1.2,
      ease: "easeOut",
      onUpdate: (v) => { setDisplayUsed(v); currentVal.current = v; }
    });
    return controls.stop;
  }, [usedGb, totalGb]);

  const padStr = Math.round(displayUsed).toString().padStart(6, '0');

  return (
    <div className="flex items-center gap-5 bg-black/60 px-4 py-3 rounded-xl border border-white/5 shadow-inner">
      <div className="flex bg-[#111] p-1 rounded border-y border-white/10 shadow-[inset_0_4px_8px_rgba(0,0,0,0.8)]">
        {padStr.split('').map((digit, i) => (
          <div key={i} className={`w-7 h-10 flex items-center justify-center font-orbitron text-xl font-bold
            ${i === padStr.length - 1 ? 'bg-white text-black' : 'bg-[#1a1a1a] text-gray-200'} 
            border-r border-black/60 last:border-0 relative overflow-hidden`}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/50 pointer-events-none" />
            <motion.span
              key={digit + i}
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              {digit}
            </motion.span>
          </div>
        ))}
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Mileage (GB)</span>
        <span className="font-orbitron text-sm text-gray-300 mt-0.5">/ {totalGb} MAX</span>
      </div>
    </div>
  );
}

// Semi-circle pressure gauge — reads like a speedometer
function PressureGauge({ load1m, load5m, load15m, cpuCores = 2 }) {
  const pressure = Math.min((load1m / cpuCores) * 100, 120);
  const targetPct = Math.min(pressure, 100);

  const [displayValue, setDisplayValue] = useState(0);
  const currentVal = useRef(0);
  
  useEffect(() => {
    const controls = animate(currentVal.current, targetPct, {
      duration: 1.2,
      ease: "easeOut",
      onUpdate: (v) => { setDisplayValue(v); currentVal.current = v; }
    });
    return controls.stop;
  }, [targetPct]);

  let status, color, glow;
  if (displayValue < 30)      { status = 'Idle';       color = '#3ecf8e'; glow = '#3ecf8e30'; }
  else if (displayValue < 60) { status = 'Normal';     color = '#3b82f6'; glow = '#3b82f630'; }
  else if (displayValue < 85) { status = 'Busy';       color = '#f59e0b'; glow = '#f59e0b30'; }
  else               { status = 'Overloaded'; color = '#ef4444'; glow = '#ef444430'; }

  const R = 52; const cx = 70; const cy = 68;
  const sweep = 180;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const arcX = (a) => cx + R * Math.cos(toRad(180 - a));
  const arcY = (a) => cy - R * Math.sin(toRad(180 - a));
  const trackPath = `M ${arcX(0)} ${arcY(0)} A ${R} ${R} 0 0 1 ${arcX(sweep)} ${arcY(sweep)}`;
  const fillSweep = (displayValue / 100) * sweep;
  const fillPath = fillSweep > 0.5
    ? `M ${arcX(0)} ${arcY(0)} A ${R} ${R} 0 ${fillSweep > 180 ? 1 : 0} 1 ${arcX(fillSweep)} ${arcY(fillSweep)}`
    : '';
  const needleRad = toRad(180 - fillSweep);
  const nx = cx + (R - 10) * Math.cos(needleRad);
  const ny = cy - (R - 10) * Math.sin(needleRad);
  const trend = load1m > load15m * 1.1 ? 'up' : load1m < load15m * 0.9 ? 'down' : 'flat';
  const zones = [
    { from: 0, to: 30, c: '#3ecf8e20' }, { from: 30, to: 60, c: '#3b82f620' },
    { from: 60, to: 85, c: '#f59e0b20' }, { from: 85, to: 100, c: '#ef444420' },
  ];

  return (
    <div className="flex flex-col items-center w-full">
      <svg width="140" height="90" viewBox="0 0 140 90" className="overflow-visible">
        {zones.map(({ from, to, c }, i) => {
          const f = (from / 100) * sweep; const t = (to / 100) * sweep;
          return <path key={i} d={`M ${arcX(f)} ${arcY(f)} A ${R} ${R} 0 0 1 ${arcX(t)} ${arcY(t)}`}
            fill="none" stroke={c} strokeWidth="14" strokeLinecap="butt" />;
        })}
        <path d={trackPath} fill="none" stroke="#ffffff08" strokeWidth="6" strokeLinecap="round" />
        {fillPath && <path d={fillPath} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 5px ${color})` }} />}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth="2.5" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
        <circle cx={cx} cy={cy} r="4" fill={color} style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
        <text x="18" y="84" fill="#444" fontSize="8.5" fontFamily="monospace">0</text>
        <text x="108" y="84" fill="#444" fontSize="8.5" fontFamily="monospace">100%</text>
      </svg>
      <div className="flex items-center gap-2 -mt-2">
        <span className="text-2xl font-bold font-orbitron" style={{ color }}>{Math.round(displayValue)}%</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold border" style={{ color, background: glow, borderColor: `${color}40` }}>{status}</span>
        {trend === 'up'   && <span className="text-red-400 font-bold text-sm" title="Load increasing">↑</span>}
        {trend === 'down' && <span className="text-green-400 font-bold text-sm" title="Load decreasing">↓</span>}
        {trend === 'flat' && <span className="text-gray-500 text-sm" title="Load stable">→</span>}
      </div>
      <div className="flex gap-4 mt-2.5 text-xs text-gray-600">
        <span>1m <span className="text-gray-300 font-mono">{load1m.toFixed(2)}</span></span>
        <span>5m <span className="text-gray-300 font-mono">{load5m.toFixed(2)}</span></span>
        <span>15m <span className="text-gray-300 font-mono">{load15m.toFixed(2)}</span></span>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111] border border-gray-800 rounded-xl p-3 shadow-2xl text-xs">
      <p className="text-gray-400 mb-2 font-mono">{label}</p>
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

export default function Overview() {
  const [nodes, setNodes] = useState([]);
  const [instances, setInstances] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [selectedNode, setSelectedNode] = useState('');
  const [liveData, setLiveData] = useState(null);
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState({});
  const [period, setPeriod] = useState('1h');
  const [liveLoading, setLiveLoading] = useState(true);
  const [histLoading, setHistLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Load nodes and instances once
  useEffect(() => {
    Promise.all([apiFetch('/nodes'), apiFetch('/instances')]).then(([n, i]) => {
      setNodes(n);
      setInstances(i);
      if (n.length > 0) setSelectedNode(n[0].id);
    });
  }, []);

  // Poll live stats every 5 seconds
  useEffect(() => {
    if (!selectedNode) return;
    setLiveLoading(true);
    const fetchLive = async () => {
      try {
        const data = await apiFetch(`/stats/${selectedNode}`);
        setLiveData(data);
        setLastUpdated(new Date());
        setLiveLoading(false);
      } catch { setLiveLoading(false); }
    };
    fetchLive();
    const int = setInterval(fetchLive, 15000); // 15s — data updates every 30s via poller
    return () => clearInterval(int);
  }, [selectedNode]);

  // Poll alerts every 15 seconds
  useEffect(() => {
    const fetchAlerts = async () => {
      try { setAlerts(await apiFetch('/alerts')); } catch {}
    };
    fetchAlerts();
    const int = setInterval(fetchAlerts, 30000);
    return () => clearInterval(int);
  }, []);

  // Fetch historical data when period or node changes
  useEffect(() => {
    if (!selectedNode) return;
    setHistLoading(true);
    Promise.all([
      apiFetch(`/metrics/${selectedNode}?period=${period}`),
      apiFetch(`/metrics/summary/${selectedNode}`)
    ]).then(([hist, sum]) => {
      setHistory(hist.map(r => ({
        time: formatTime(r.recorded_at),
        cpu: parseFloat(r.cpu_percent) || 0,
        ram: parseFloat(r.ram_percent) || 0,
        disk: parseFloat(r.disk_percent) || 0,
        load: parseFloat(r.load_avg_1m) || 0,
      })));
      setSummary(sum);
      setHistLoading(false);
    }).catch(() => setHistLoading(false));
  }, [selectedNode, period]);

  const node = nodes.find(n => n.id === selectedNode);
  const cpuThresh = getThreshold(liveData?.cpu || 0);
  const ramThresh = getThreshold(liveData?.ram_percent || 0);
  const diskThresh = getThreshold(liveData?.disk_percent || 0, 75, 90);

  const activeCount = Object.values(instances).flat().filter(i => i.status === 'running').length;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pb-10">
      {/* Full Screen Cyberpunk Loader Overlay */}
      {!liveData && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050505]/80 backdrop-blur-md">
          <div className="relative flex items-center justify-center w-64 h-64 mb-8">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 8, ease: "linear" }} className="absolute inset-0 rounded-full border border-white/10 border-t-[#3ecf8e] opacity-80 shadow-[0_0_15px_#3ecf8e]" />
            <motion.div animate={{ scale: [0.95, 1.05, 0.95], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }} className="absolute inset-8 rounded-full border border-dashed border-[#3ecf8e]/50" />
            <div className="absolute inset-16 bg-[radial-gradient(ellipse_at_center,_#3ecf8e33_0%,_transparent_70%)] rounded-full animate-pulse" />
            <Activity size={40} className="text-[#3ecf8e] z-10" />
          </div>
          <h2 className="font-orbitron text-2xl font-bold tracking-[0.3em] text-white uppercase drop-shadow-[0_0_10px_rgba(62,207,142,0.5)]">Apex Telemetry</h2>
          <div className="flex flex-col items-center mt-6 gap-2">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 bg-[#3ecf8e] rounded-full shadow-[0_0_8px_#3ecf8e] animate-ping" />
              <span className="text-xs font-mono text-[#3ecf8e] tracking-widest uppercase">Establishing Secure Uplink</span>
            </div>
            <div className="w-48 h-1 bg-white/10 rounded overflow-hidden mt-2">
              <motion.div initial={{ x: '-100%' }} animate={{ x: '100%' }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }} className="w-full h-full bg-[#3ecf8e] shadow-[0_0_10px_#3ecf8e]" />
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-orbitron text-white uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-400">Telemetry Overview</h1>
          <p className="text-gray-500 text-[10px] mt-2 font-orbitron uppercase tracking-widest border border-white/5 inline-block px-2 py-0.5 rounded bg-black/20">Real-time intelligence for your infrastructure.</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[10px] text-gray-500 font-orbitron uppercase tracking-wider flex items-center gap-2 border border-white/5 px-2 py-1 rounded bg-black/20">
              <RefreshCw size={10} className="animate-spin text-[#3ecf8e]" style={{ animationDuration: '3s' }} />
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <div className="w-48">
            <Select options={nodes.map(n => ({ label: n.name, value: n.id }))} value={selectedNode}
              onChange={setSelectedNode} placeholder="Select Node" />
          </div>
        </div>
      </div>

      {/* Alerts banner */}
      <AnimatePresence>
        {alerts.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex flex-wrap gap-3 items-center">
            <AlertTriangle size={18} className="text-red-400 shrink-0" />
            <span className="text-red-300 font-semibold text-sm">Active Alerts:</span>
            {alerts.map((a, i) => (
              <span key={i} className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded-full border border-red-500/20">
                {a.node}: {a.message}
              </span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Server} label="Connected Nodes" value={nodes.length}
          sub={`${nodes.length} reachable`} color="#3b82f6" />
        <StatCard icon={Database} label="Active Instances" value={activeCount}
          sub={`${Object.keys(instances).length} total`} color="#3ecf8e" animate />
        <StatCard icon={AlertTriangle} label="Active Alerts" value={alerts.length}
          sub={alerts.length === 0 ? "All systems healthy" : "Requires attention"}
          color={alerts.length > 0 ? "#ef4444" : "#3ecf8e"} />
        <StatCard icon={Cpu} label="Current CPU" value={liveData ? `${fmt(liveData.cpu)}%` : '—'}
          sub={liveData ? `Load: ${fmt(liveData.load_avg_1m, 2)}` : 'Fetching...'}
          color={cpuThresh.color} loading={liveLoading} animate />
      </div>

      {/* Live Metrics 2x2 Grid */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <span className="w-1.5 h-6 bg-[#3ecf8e] rounded-r shadow-[0_0_8px_#3ecf8e]" />
          <h2 className="text-lg font-orbitron font-bold text-white tracking-widest uppercase flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-supa-green animate-pulse inline-block" />
            Live Metrics — {node?.name || "Connecting"}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* CPU (Tachometer) */}
            <motion.div whileHover={{ y: -2 }} className={`glass p-5 rounded-2xl border ${cpuThresh.bg} relative overflow-hidden`}>
              <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/10 to-transparent" />
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-2">
                  <Cpu size={18} style={{ color: cpuThresh.color }} />
                  <span className="font-semibold font-orbitron tracking-widest text-[10px] text-white">CPU RPM</span>
                </div>
                <span className="text-[10px] font-orbitron tracking-widest px-2 py-0.5 rounded-full" style={{ color: cpuThresh.color, background: `${cpuThresh.color}15` }}>
                  {cpuThresh.label}
                </span>
              </div>
              <Tachometer value={liveData?.cpu || 0} color={cpuThresh.color} />
            </motion.div>

            {/* RAM (Fuel Gauge) */}
            <motion.div whileHover={{ y: -2 }} className={`glass p-5 rounded-2xl border ${ramThresh.bg} relative overflow-hidden flex flex-col justify-between`}>
              <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/10 to-transparent" />
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <MemoryStick size={18} style={{ color: ramThresh.color }} />
                  <span className="font-semibold font-orbitron tracking-widest text-[10px] text-white">RAM FUEL</span>
                </div>
                <span className="text-[10px] font-orbitron px-2 py-0.5 rounded border border-white/10" style={{ color: ramThresh.color, background: `${ramThresh.color}15` }}>
                  {fmt(liveData?.ram_percent || 0)}%
                </span>
              </div>
              <FuelGauge 
                percent={liveData?.ram_percent || 0} 
                used={liveData?.ram_used_mb || 0} 
                total={liveData?.ram_total_mb || 1024} 
                color={ramThresh.color} 
              />
            </motion.div>

            {/* Disk Gauge (Odometer) */}
            <motion.div whileHover={{ y: -2 }} className={`glass p-5 rounded-2xl border ${diskThresh.bg} flex flex-col justify-between`}>
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <HardDrive size={18} style={{ color: diskThresh.color }} />
                  <span className="font-semibold font-orbitron tracking-widest text-[10px] text-white">DISK ODOMETER</span>
                </div>
                <span className="text-[10px] font-orbitron px-2 py-0.5 rounded border border-white/10" style={{ color: diskThresh.color, background: `${diskThresh.color}15` }}>
                  {diskThresh.label}
                </span>
              </div>
              <Odometer usedGb={liveData?.disk_used_gb || 0} totalGb={Math.round(liveData?.disk_total_gb || 0)} color={diskThresh.color} />
            </motion.div>

            {/* System Pressure (Turbo Boost) */}
            <motion.div whileHover={{ y: -2 }} className="glass p-5 rounded-2xl border border-white/5 shadow-inner flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_bottom,_var(--tw-gradient-stops))] from-purple-500 to-transparent" />
              <div className="flex items-center gap-2 mb-2 self-start">
                <Activity size={18} className="text-purple-400" />
                <span className="font-semibold font-orbitron tracking-widest text-[10px] text-white">TURBO BOOST</span>
                <span className="text-[9px] text-gray-500 font-orbitron ml-1 mt-0.5">[{liveData?.cpu_cores || 2} CORES]</span>
              </div>
              <PressureGauge
                load1m={liveData?.load_avg_1m || 0}
                load5m={liveData?.load_avg_5m || 0}
                load15m={liveData?.load_avg_15m || 0}
                cpuCores={liveData?.cpu_cores || 2}
              />
            </motion.div>

          </div>
        </section>

      {/* Insights Panel */}
      {liveData && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <span className="w-1.5 h-6 bg-amber-500 rounded-r shadow-[0_0_8px_#f59e0b]" />
            <h2 className="text-lg font-orbitron font-bold text-white tracking-widest uppercase flex items-center gap-2">
              <Zap size={18} className="text-amber-400" /> Intelligent Insights
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Top process */}
            <motion.div whileHover={{ scale: 1.01 }} className="glass p-4 rounded-xl border border-white/5 shadow-inner flex items-start gap-4">
              <div className="p-2 border border-purple-500/20 bg-purple-500/10 rounded shadow-[inset_0_0_8px_rgba(168,85,247,0.2)]"><Package size={16} className="text-purple-400" /></div>
              <div>
                <p className="text-[10px] font-orbitron uppercase tracking-widest text-gray-500 mb-1">Top Memory Consumer</p>
                <p className="text-white font-mono font-bold">{liveData.top_process_name || '—'}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1"><span className="text-purple-400">{liveData.top_process_ram_mb || 0}</span> MB RAM</p>
              </div>
            </motion.div>

            {/* Uptime */}
            <motion.div whileHover={{ scale: 1.01 }} className="glass p-4 rounded-xl border border-white/5 shadow-inner flex items-start gap-4">
              <div className="p-2 border border-[#3ecf8e20] bg-[#3ecf8e10] rounded shadow-[inset_0_0_8px_rgba(62,207,142,0.2)]"><Clock size={16} className="text-[#3ecf8e]" /></div>
              <div>
                <p className="text-[10px] font-orbitron uppercase tracking-widest text-gray-500 mb-1">Server Uptime</p>
                <p className="text-white font-mono font-bold tracking-wider">{formatUptime(liveData.uptime_seconds || 0)}</p>
                <p className="text-[10px] text-[#3ecf8e] uppercase tracking-widest mt-1">Stable</p>
              </div>
            </motion.div>

            {/* Docker containers */}
            <motion.div whileHover={{ scale: 1.01 }} className="glass p-4 rounded-xl border border-white/5 shadow-inner flex items-start gap-4">
              <div className="p-2 border border-blue-500/20 bg-blue-500/10 rounded shadow-[inset_0_0_8px_rgba(59,130,246,0.2)]"><Database size={16} className="text-blue-400" /></div>
              <div>
                <p className="text-[10px] font-orbitron uppercase tracking-widest text-gray-500 mb-1">Docker Containers</p>
                <p className="text-white font-mono font-bold"><span className="text-blue-400">{liveData.docker_container_count || 0}</span> running</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">{activeCount} managed instances</p>
              </div>
            </motion.div>

            {/* 24h CPU peak */}
            {summary.peak_cpu && (
              <motion.div whileHover={{ scale: 1.01 }} className="glass p-4 rounded-xl border border-white/5 shadow-inner flex items-start gap-4">
                <div className="p-2 border border-amber-500/20 bg-amber-500/10 rounded shadow-[inset_0_0_8px_rgba(245,158,11,0.2)]"><TrendingUp size={16} className="text-amber-400" /></div>
                <div>
                  <p className="text-[10px] font-orbitron uppercase tracking-widest text-gray-500 mb-1">24h CPU Peak</p>
                  <p className="text-white font-mono font-bold tracking-wider">{fmt(summary.peak_cpu)}%</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">avg: <span className="text-amber-400">{fmt(summary.avg_cpu)}%</span></p>
                </div>
              </motion.div>
            )}

            {/* 24h RAM peak */}
            {summary.peak_ram && (
              <motion.div whileHover={{ scale: 1.01 }} className="glass p-4 rounded-xl border border-white/5 shadow-inner flex items-start gap-4">
                <div className="p-2 border border-red-500/20 bg-red-500/10 rounded shadow-[inset_0_0_8px_rgba(239,68,68,0.2)]"><TrendingUp size={16} className="text-red-400" /></div>
                <div>
                  <p className="text-[10px] font-orbitron uppercase tracking-widest text-gray-500 mb-1">24h RAM Peak</p>
                  <p className="text-white font-mono font-bold tracking-wider">{fmt(summary.peak_ram)}%</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">avg: <span className="text-red-400">{fmt(summary.avg_ram)}%</span></p>
                </div>
              </motion.div>
            )}
          </div>
        </section>
      )}

      {/* Historical Trend */}
      <section className="glass p-6 rounded-xl border border-white/5 shadow-inner">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-8 bg-blue-500 rounded-r shadow-[0_0_8px_#3b82f6]" />
            <div>
              <h2 className="text-lg font-orbitron font-bold tracking-widest text-white uppercase">Historical Trend</h2>
              <p className="text-gray-500 text-[10px] uppercase tracking-widest mt-1">
                {history.length === 0 ? 'Collecting data — updates every 30s' : `${history.length} telemetry points logged`}
              </p>
            </div>
          </div>
          <div className="flex bg-[#0a0a0c] p-1 rounded border border-white/10 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]">
            {['1h', '6h', '24h', '7d', '30d'].map(p => (
              <PeriodBtn key={p} label={p} active={period === p} onClick={() => setPeriod(p)} />
            ))}
          </div>
        </div>

        {histLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="flex gap-2">
              {[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-supa-green animate-bounce" style={{ animationDelay: `${i*150}ms` }} />)}
            </div>
          </div>
        ) : history.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-600 text-sm">
            <div className="text-center">
              <Activity size={32} className="mx-auto mb-3 opacity-30" />
              <p>No historical data yet.</p>
              <p className="text-xs mt-1 text-gray-700">Data is collected every 30 seconds once nodes are configured.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3ecf8e" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3ecf8e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gRam" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gDisk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                  <XAxis dataKey="time" stroke="transparent" tick={{ fill: '#555', fontSize: 11 }}
                    interval="preserveStartEnd" />
                  <YAxis stroke="transparent" tick={{ fill: '#555', fontSize: 11 }} domain={[0, 100]} unit="%" />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="cpu" stroke="#3ecf8e" strokeWidth={2}
                    fillOpacity={1} fill="url(#gCpu)" name="CPU" dot={false} />
                  <Area type="monotone" dataKey="ram" stroke="#8b5cf6" strokeWidth={2}
                    fillOpacity={1} fill="url(#gRam)" name="RAM" dot={false} />
                  <Area type="monotone" dataKey="disk" stroke="#f59e0b" strokeWidth={1.5}
                    fillOpacity={1} fill="url(#gDisk)" name="Disk" dot={false} strokeDasharray="4 2" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 mt-3 justify-end">
              {[['CPU', '#3ecf8e'], ['RAM', '#8b5cf6'], ['Disk', '#f59e0b']].map(([name, color]) => (
                <span key={name} className="flex items-center gap-1.5 text-xs text-gray-400">
                  <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: color }} />
                  {name}
                </span>
              ))}
            </div>
          </>
        )}
      </section>
    </motion.div>
  );
}
