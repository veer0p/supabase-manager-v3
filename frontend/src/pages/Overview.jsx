import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Server, Database, AlertTriangle, Activity, Cpu, HardDrive,
  MemoryStick, Zap, TrendingUp, TrendingDown, Clock, Package,
  RefreshCw, ChevronDown
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, RadialBarChart, RadialBar, Cell
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
      className="glass p-6 rounded-2xl border-gray-800 relative overflow-hidden group"
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: `radial-gradient(ellipse at 80% 20%, ${color}08 0%, transparent 70%)` }} />
      <div className="flex items-start justify-between mb-4">
        <div className="p-2.5 rounded-xl" style={{ background: `${color}15` }}>
          <Icon size={20} style={{ color }} />
        </div>
        {animate && <span className="flex h-2 w-2"><span className="animate-ping absolute inline-flex h-2 w-2 rounded-full opacity-75" style={{ background: color }} /><span className="relative inline-flex rounded-full h-2 w-2" style={{ background: color }} /></span>}
      </div>
      <p className="text-gray-500 text-xs uppercase tracking-wider font-medium mb-1">{label}</p>
      {loading ? (
        <div className="h-8 w-16 bg-white/5 rounded-lg animate-pulse" />
      ) : (
        <p className="text-3xl font-bold text-white">{value}</p>
      )}
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </motion.div>
  );
}

function GaugeChart({ value, label, color }) {
  const data = [{ value, fill: color }, { value: 100 - value, fill: 'transparent' }];
  return (
    <div className="relative flex flex-col items-center justify-center h-40">
      <RadialBarChart width={140} height={140} cx={70} cy={70} innerRadius={48} outerRadius={64}
        barSize={12} data={[{ value, fill: color }]} startAngle={220} endAngle={-40}>
        <RadialBar dataKey="value" cornerRadius={6} background={{ fill: '#ffffff0a' }} />
      </RadialBarChart>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>{fmt(value)}%</span>
        <span className="text-xs text-gray-500">{label}</span>
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
    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
      active ? 'bg-supa-green text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'
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

  const loadBarData = liveData ? [
    { name: '1m', value: liveData.load_avg_1m || 0 },
    { name: '5m', value: liveData.load_avg_5m || 0 },
    { name: '15m', value: liveData.load_avg_15m || 0 },
  ] : [];

  const activeCount = Object.values(instances).filter(i => i.status === 'active').length;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">System Overview</h1>
          <p className="text-gray-500 text-sm mt-1">Real-time intelligence for your infrastructure.</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-600 flex items-center gap-1">
              <RefreshCw size={10} className="animate-spin" style={{ animationDuration: '3s' }} />
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
      {liveData && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-supa-green animate-pulse inline-block" />
            Live Metrics — {node?.name}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* CPU */}
            <motion.div whileHover={{ y: -2 }} className={`glass p-5 rounded-2xl border ${cpuThresh.bg}`}>
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <Cpu size={18} style={{ color: cpuThresh.color }} />
                  <span className="font-semibold text-white">CPU Usage</span>
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ color: cpuThresh.color, background: `${cpuThresh.color}15` }}>
                  {cpuThresh.label}
                </span>
              </div>
              <div className="flex items-end gap-4">
                <span className="text-4xl font-bold" style={{ color: cpuThresh.color }}>{fmt(liveData.cpu)}%</span>
                <span className="text-gray-500 text-sm pb-1">of 100%</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-1.5 mt-3">
                <motion.div className="h-1.5 rounded-full" style={{ background: cpuThresh.color }}
                  initial={{ width: 0 }} animate={{ width: `${Math.min(liveData.cpu, 100)}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
              </div>
            </motion.div>

            {/* RAM */}
            <motion.div whileHover={{ y: -2 }} className={`glass p-5 rounded-2xl border ${ramThresh.bg}`}>
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <MemoryStick size={18} style={{ color: ramThresh.color }} />
                  <span className="font-semibold text-white">RAM Usage</span>
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ color: ramThresh.color, background: `${ramThresh.color}15` }}>
                  {Math.round(liveData.ram_used_mb / 1024 * 10) / 10} / {Math.round(liveData.ram_total_mb / 1024 * 10) / 10} GB
                </span>
              </div>
              <div className="flex items-end gap-4">
                <span className="text-4xl font-bold" style={{ color: ramThresh.color }}>{fmt(liveData.ram_percent)}%</span>
                <span className="text-gray-500 text-sm pb-1">{liveData.ram_used_mb} MB used</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-1.5 mt-3">
                <motion.div className="h-1.5 rounded-full" style={{ background: ramThresh.color }}
                  initial={{ width: 0 }} animate={{ width: `${Math.min(liveData.ram_percent, 100)}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
              </div>
            </motion.div>

            {/* Disk Gauge */}
            <motion.div whileHover={{ y: -2 }} className={`glass p-5 rounded-2xl border ${diskThresh.bg} flex items-center gap-6`}>
              <GaugeChart value={liveData.disk_percent || 0} label="Disk" color={diskThresh.color} />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <HardDrive size={18} style={{ color: diskThresh.color }} />
                  <span className="font-semibold text-white">Disk Space</span>
                </div>
                <p className="text-gray-400 text-sm">{fmt(liveData.disk_used_gb, 0)} GB / {fmt(liveData.disk_total_gb, 0)} GB used</p>
                <p className="text-gray-600 text-xs mt-1">{fmt(liveData.disk_total_gb - liveData.disk_used_gb, 0)} GB free</p>
                <span className="text-xs mt-2 inline-block px-2 py-0.5 rounded-full" style={{ color: diskThresh.color, background: `${diskThresh.color}15` }}>
                  {diskThresh.label}
                </span>
              </div>
            </motion.div>

            {/* Load Average */}
            <motion.div whileHover={{ y: -2 }} className="glass p-5 rounded-2xl border-gray-800">
              <div className="flex items-center gap-2 mb-4">
                <Activity size={18} className="text-purple-400" />
                <span className="font-semibold text-white">Load Average</span>
              </div>
              <ResponsiveContainer width="100%" height={90}>
                <BarChart data={loadBarData} barCategoryGap="30%">
                  <XAxis dataKey="name" tick={{ fill: '#888', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {loadBarData.map((entry, index) => (
                      <Cell key={index} fill={entry.value > 2 ? '#ef4444' : entry.value > 1 ? '#f59e0b' : '#8b5cf6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex justify-between text-xs text-gray-500 mt-1 px-1">
                <span>1 min: <span className="text-white">{fmt(liveData.load_avg_1m, 2)}</span></span>
                <span>5 min: <span className="text-white">{fmt(liveData.load_avg_5m, 2)}</span></span>
                <span>15 min: <span className="text-white">{fmt(liveData.load_avg_15m, 2)}</span></span>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Insights Panel */}
      {liveData && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Zap size={18} className="text-amber-400" /> Intelligent Insights
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Top process */}
            <motion.div whileHover={{ scale: 1.01 }} className="glass p-4 rounded-xl border-gray-800 flex items-start gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg"><Package size={16} className="text-purple-400" /></div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Top Memory Consumer</p>
                <p className="text-white font-mono font-bold">{liveData.top_process_name || '—'}</p>
                <p className="text-xs text-gray-500">{liveData.top_process_ram_mb || 0} MB RAM</p>
              </div>
            </motion.div>

            {/* Uptime */}
            <motion.div whileHover={{ scale: 1.01 }} className="glass p-4 rounded-xl border-gray-800 flex items-start gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg"><Clock size={16} className="text-green-400" /></div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Server Uptime</p>
                <p className="text-white font-bold">{formatUptime(liveData.uptime_seconds || 0)}</p>
                <p className="text-xs text-green-400">Stable</p>
              </div>
            </motion.div>

            {/* Docker containers */}
            <motion.div whileHover={{ scale: 1.01 }} className="glass p-4 rounded-xl border-gray-800 flex items-start gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg"><Database size={16} className="text-blue-400" /></div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Docker Containers</p>
                <p className="text-white font-bold">{liveData.docker_container_count || 0} running</p>
                <p className="text-xs text-gray-500">{activeCount} managed instances</p>
              </div>
            </motion.div>

            {/* 24h CPU peak */}
            {summary.peak_cpu && (
              <motion.div whileHover={{ scale: 1.01 }} className="glass p-4 rounded-xl border-gray-800 flex items-start gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg"><TrendingUp size={16} className="text-amber-400" /></div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">24h CPU Peak</p>
                  <p className="text-white font-bold">{fmt(summary.peak_cpu)}%</p>
                  <p className="text-xs text-gray-500">avg: {fmt(summary.avg_cpu)}%</p>
                </div>
              </motion.div>
            )}

            {/* 24h RAM peak */}
            {summary.peak_ram && (
              <motion.div whileHover={{ scale: 1.01 }} className="glass p-4 rounded-xl border-gray-800 flex items-start gap-3">
                <div className="p-2 bg-red-500/10 rounded-lg"><TrendingUp size={16} className="text-red-400" /></div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">24h RAM Peak</p>
                  <p className="text-white font-bold">{fmt(summary.peak_ram)}%</p>
                  <p className="text-xs text-gray-500">avg: {fmt(summary.avg_ram)}%</p>
                </div>
              </motion.div>
            )}
          </div>
        </section>
      )}

      {/* Historical Trend */}
      <section className="glass p-6 rounded-2xl border-gray-800">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Historical Trend</h2>
            <p className="text-gray-500 text-xs mt-0.5">
              {history.length === 0 ? 'Collecting data — updates every 30s' : `${history.length} data points`}
            </p>
          </div>
          <div className="flex gap-1 bg-white/5 p-1 rounded-xl">
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
