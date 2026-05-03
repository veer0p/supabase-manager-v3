import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Server } from 'lucide-react';
import { apiFetch } from '../lib/api';
import ConfirmModal from '../components/ConfirmModal';
import { useNotification } from '../NotificationContext';

export default function Nodes() {
  const [nodes, setNodes] = useState([]);
  const [form, setForm] = useState({ name: '', ip: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const { error, success } = useNotification();

  const fetchNodes = () => apiFetch('/nodes').then(setNodes);
  useEffect(() => { fetchNodes(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch('/nodes', { method: 'POST', body: JSON.stringify(form) });
      setForm({ name: '', ip: '', password: '' });
      success("Node added successfully");
    } catch(e) {
      error(e.message);
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if(!confirmId) return;
    try {
        await apiFetch(`/nodes/${confirmId}`, { method: 'DELETE' });
        fetchNodes();
        success("Node deleted");
    } catch(e) { error(e.message); }
    setConfirmId(null);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <h1 className="text-3xl font-bold text-white">VPS Nodes</h1>

      <section className="glass p-6 rounded-2xl border-gray-800">
        <h2 className="text-xl font-semibold mb-4">Add New Node</h2>
        <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4">
          <input required placeholder="Node Name (e.g. Production)" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} className="flex-1 bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-supa-green outline-none" />
          <input required placeholder="IP Address (e.g. 144.91.101.255)" value={form.ip} onChange={e=>setForm({...form, ip: e.target.value})} className="flex-1 bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-supa-green outline-none" />
          <input required type="password" placeholder="Root Password" value={form.password} onChange={e=>setForm({...form, password: e.target.value})} className="flex-1 bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-supa-green outline-none" />
          <button disabled={loading} type="submit" className="bg-white text-black font-semibold rounded-lg px-6 py-3 hover:bg-gray-200 transition flex items-center gap-2 disabled:opacity-50">
            <Plus size={18} /> Add Node
          </button>
        </form>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {nodes.map(node => (
          <div key={node.id} className="glass p-6 rounded-2xl border-gray-800 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Server size={18} className="text-gray-400" />
                <h3 className="text-lg font-semibold">{node.name}</h3>
              </div>
              <p className="text-gray-400 font-mono text-sm">{node.ip}</p>
            </div>
            <button onClick={() => setConfirmId(node.id)} className="text-gray-500 hover:text-red-400 transition p-2">
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </section>

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
