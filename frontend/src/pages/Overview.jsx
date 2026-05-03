import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Server, Database, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { apiFetch } from '../lib/api';
import Select from '../components/Select';

export default function Overview() {
  const [stats, setStats] = useState({ nodes: 0, instances: 0 });
  const [nodes, setNodes] = useState([]);
  const [selectedNode, setSelectedNode] = useState('');
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    Promise.all([
      apiFetch('/nodes'),
      apiFetch('/instances')
    ]).then(([n, i]) => {
      setStats({ nodes: n.length, instances: Object.keys(i).length });
      setNodes(n);
      if (n.length > 0) setSelectedNode(n[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedNode) return;
    
    const fetchStats = async () => {
        try {
            const data = await apiFetch(`/stats/${selectedNode}`);
            const now = new Date().toLocaleTimeString();
            setChartData(prev => {
                const updated = [...prev, { time: now, cpu: parseFloat(data.cpu), mem: parseFloat(data.mem) }];
                if (updated.length > 20) updated.shift(); // Keep last 20 points
                return updated;
            });
        } catch(e) {
            console.error(e);
        }
    };

    fetchStats();
    const int = setInterval(fetchStats, 3000);
    return () => clearInterval(int);
  }, [selectedNode]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">System Overview</h1>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass p-6 rounded-2xl border-gray-800">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-500/10 rounded-xl"><Server className="text-blue-400" /></div>
            <h3 className="text-lg font-medium text-gray-300">Connected Nodes</h3>
          </div>
          <p className="text-4xl font-bold text-white">{stats.nodes}</p>
        </div>
        
        <div className="glass p-6 rounded-2xl border-gray-800">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-supa-green/10 rounded-xl"><Database className="text-supa-green" /></div>
            <h3 className="text-lg font-medium text-gray-300">Active Instances</h3>
          </div>
          <p className="text-4xl font-bold text-white">{stats.instances}</p>
        </div>

        <div className="glass p-6 rounded-2xl border-gray-800">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-purple-500/10 rounded-xl"><Activity className="text-purple-400" /></div>
            <h3 className="text-lg font-medium text-gray-300">System Health</h3>
          </div>
          <p className="text-4xl font-bold text-white">Optimal</p>
        </div>
      </div>

      {nodes.length > 0 && (
        <section className="glass p-6 rounded-2xl border-gray-800 mt-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h2 className="text-xl font-semibold">Live Server Statistics</h2>
                <div className="w-full md:w-64">
                    <Select 
                        options={nodes.map(n => ({ label: n.name, value: n.id }))}
                        value={selectedNode}
                        onChange={setSelectedNode}
                        placeholder="Select Node"
                    />
                </div>
            </div>
            
            {chartData.length === 0 ? <p className="text-gray-500 py-10 text-center">Loading stats via SSH...</p> : (
                <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3ecf8e" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#3ecf8e" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                            <XAxis dataKey="time" stroke="#666" tick={{fill: '#888', fontSize: 12}} />
                            <YAxis stroke="#666" tick={{fill: '#888', fontSize: 12}} domain={[0, 100]} unit="%" />
                            <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333', borderRadius: '8px' }} />
                            <Area type="monotone" dataKey="cpu" stroke="#3ecf8e" fillOpacity={1} fill="url(#colorCpu)" name="CPU Usage %" />
                            <Area type="monotone" dataKey="mem" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorMem)" name="RAM Usage %" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </section>
      )}
    </motion.div>
  );
}
