import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Server, Activity } from 'lucide-react';
import { apiFetch } from '../lib/api';
import ConfirmModal from '../components/ConfirmModal';
import { useNotification } from '../NotificationContext';
import { CardSkeleton } from '../components/Skeleton';

let cachedNodes = null;

export default function Nodes() {
  const [nodes, setNodes] = useState(cachedNodes || []);
  const [form, setForm] = useState({ name: '', ip: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(!cachedNodes);
  const [confirmId, setConfirmId] = useState(null);
  const { error, success } = useNotification();
  const isVisitor = localStorage.getItem('visitor_mode') === 'true';

  const fetchNodes = () => {
    if (!cachedNodes) setDataLoading(true);
    apiFetch('/nodes')
      .then(res => {
        cachedNodes = res;
        setNodes(res);
      })
      .finally(() => setDataLoading(false));
  };

  useEffect(() => { fetchNodes(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch('/nodes', { method: 'POST', body: JSON.stringify(form) });
      setForm({ name: '', ip: '', password: '' });
      success("Node added successfully");
      fetchNodes();
    } catch (e) {
      error(e.message);
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!confirmId) return;
    try {
      await apiFetch(`/nodes/${confirmId}`, { method: 'DELETE' });
      fetchNodes();
      success("Node deleted");
    } catch (e) { error(e.message); }
    setConfirmId(null);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white tracking-tight">VPS Nodes</h1>
        <div className="flex gap-4 items-center">
          <span className="text-xs text-gray-500 font-medium">Node discovery active</span>
          <div className="w-1.5 h-1.5 rounded-full bg-supa-green animate-pulse"></div>
        </div>
      </div>

      {!isVisitor && (
        <section className="glass px-6 py-5 rounded-2xl border-gray-800/40 relative z-20">
          <form onSubmit={handleAdd} className="flex flex-wrap md:flex-nowrap items-stretch gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-[200px] bg-black/40 border border-white/5 rounded-xl px-4 transition-all focus-within:border-supa-green/50">
              <Server className="text-gray-500" size={18} />
              <input required placeholder="Node Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full bg-transparent border-none py-3 text-white placeholder:text-gray-600 focus:ring-0 outline-none font-medium text-sm" />
            </div>
  
            <div className="flex items-center gap-3 flex-1 min-w-[200px] bg-black/40 border border-white/5 rounded-xl px-4 transition-all focus-within:border-supa-green/50">
              <Activity className="text-gray-500" size={18} />
              <input required placeholder="IP Address" value={form.ip} onChange={e => setForm({ ...form, ip: e.target.value })} className="w-full bg-transparent border-none py-3 text-white placeholder:text-gray-600 focus:ring-0 outline-none font-medium text-sm" />
            </div>
  
            <div className="flex items-center gap-3 flex-1 min-w-[200px] bg-black/40 border border-white/5 rounded-xl px-4 transition-all focus-within:border-supa-green/50">
              <input required type="password" placeholder="SSH Password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="w-full bg-transparent border-none py-3 text-white placeholder:text-gray-600 focus:ring-0 outline-none font-medium text-sm" />
            </div>
  
            <button disabled={loading} type="submit" className="bg-supa-green text-black text-xs font-bold uppercase tracking-wider rounded-xl px-8 hover:bg-supa-greenHover transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer h-full min-h-[46px]">
              {loading ? 'Connecting...' : <><Plus size={14} fill="currentColor" /> Add Node</>}
            </button>
          </form>
        </section>
      )}

      {dataLoading && nodes.length === 0 ? (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </section>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {nodes.map(node => (
            <div key={node.id} className="glass p-6 rounded-2xl border-gray-800/40 flex justify-between items-center group hover:bg-white/[0.03] transition-all">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-supa-green/10 text-supa-green">
                  <Server size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">{node.name}</h3>
                  <p className="text-gray-400 font-mono text-xs mt-0.5 uppercase tracking-wider opacity-60">{node.ip}</p>
                </div>
              </div>
              {!isVisitor && (
                <button onClick={() => setConfirmId(node.id)} className="text-gray-600 hover:text-red-500 transition-all p-2 rounded-lg hover:bg-red-500/10 cursor-pointer">
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      <ConfirmModal
        isOpen={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={handleDelete}
        title="Delete Node"
        message="Are you sure you want to remove this VPS node? This will not stop any running instances, but you will no longer be able to manage them through this dashboard."
        confirmText="Remove Node"
        isDanger={true}
      />
    </motion.div>
  );
}
