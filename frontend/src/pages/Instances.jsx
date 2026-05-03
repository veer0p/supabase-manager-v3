import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Trash2, Key, Database, Eye, ExternalLink } from 'lucide-react';
import { apiFetch } from '../lib/api';
import Select from '../components/Select';
import ConfirmModal from '../components/ConfirmModal';
import TerminalLog from '../components/TerminalLog';
import { useNotification } from '../NotificationContext';

export default function Instances() {
  const [instances, setInstances] = useState({});
  const [nodes, setNodes] = useState([]);
  const [form, setForm] = useState({ project_name: '', nodeId: '' });
  const [loading, setLoading] = useState(false);
  const { error, success } = useNotification();

  // Modals state
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: '', name: '' });
  const [logModal, setLogModal] = useState({ isOpen: false, name: '' });

  const fetchData = () => {
    apiFetch('/instances').then(setInstances);
    apiFetch('/nodes').then(setNodes);
  };
  
  useEffect(() => {
    fetchData();
    const int = setInterval(() => apiFetch('/instances').then(setInstances), 3000);
    return () => clearInterval(int);
  }, []);

  const handleDeploy = async (e) => {
    e.preventDefault();
    if (!form.nodeId) return error("Select a node first");
    
    setLoading(true);
    try {
      await apiFetch('/deploy', { method: 'POST', body: JSON.stringify(form) });
      setForm({ ...form, project_name: '' });
      fetchData();
    } catch(e) {
      error(e.message);
    }
    setLoading(false);
  };

  const executeAction = async () => {
    const { type, name } = confirmModal;
    if (type === 'delete') {
      await apiFetch('/delete', { method: 'POST', body: JSON.stringify({ project_name: name }) });
    } else if (type === 'reset') {
      try {
        await apiFetch('/reset-password', { method: 'POST', body: JSON.stringify({ project_name: name }) });
      } catch(e) {
        error(e.message);
      }
    }
  };

  const nodeOptions = nodes.map(n => ({ label: `${n.name} (${n.ip})`, value: n.id }));

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pb-10">
      <h1 className="text-3xl font-bold text-white">Supabase Instances</h1>

      <section className="glass p-6 rounded-2xl border-gray-800 relative z-20">
        <h2 className="text-xl font-semibold mb-4">Deploy New Instance</h2>
        <form onSubmit={handleDeploy} className="flex flex-col md:flex-row gap-4">
          <input required placeholder="Project Name" value={form.project_name} onChange={e=>setForm({...form, project_name: e.target.value.toLowerCase()})} pattern="[a-zA-Z0-9-]+" className="flex-1 bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-supa-green outline-none transition" />
          
          <Select 
            options={nodeOptions} 
            value={form.nodeId} 
            onChange={(val) => setForm({...form, nodeId: val})} 
            placeholder="Select Target Node" 
          />

          <button disabled={loading} type="submit" className="bg-supa-green text-black font-semibold rounded-lg px-6 py-3 hover:bg-supa-greenHover transition flex items-center justify-center gap-2 disabled:opacity-50">
            {loading ? (
                <div className="flex gap-1.5 items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-black animate-bounce" style={{animationDelay: '0ms'}}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-black animate-bounce" style={{animationDelay: '150ms'}}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-black animate-bounce" style={{animationDelay: '300ms'}}></span>
                </div>
            ) : <><Play size={18} /> Deploy</>}
          </button>
        </form>
      </section>

      <section className="grid grid-cols-1 gap-6 relative z-10">
        {Object.entries(instances).map(([name, info]) => {
            const isDeploying = info.status === 'deploying';
            const isDeleting = info.status === 'deleting';
            const node = nodes.find(n => n.id === info.nodeId);
            
            return (
              <motion.div layout key={name} className={`glass p-6 rounded-2xl border ${isDeploying ? 'border-blue-500/30' : isDeleting ? 'border-red-500/30' : 'border-gray-800'} flex flex-col gap-4 transition-colors`}>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <Database className={isDeploying ? "text-blue-400 animate-pulse" : isDeleting ? "text-red-400 animate-pulse" : "text-supa-green"} size={24} />
                        <h3 className="text-2xl font-bold capitalize flex items-center gap-3">
                            {name}
                            {(isDeploying || isDeleting) && (
                                <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/5 text-xs font-medium text-gray-300">
                                    <div className="w-2 h-2 rounded-full border-2 border-t-transparent border-gray-400 animate-spin"></div>
                                    {isDeploying ? 'Deploying...' : 'Deleting...'}
                                </div>
                            )}
                        </h3>
                        <span className="text-xs font-mono text-gray-400 bg-black/40 border border-gray-800 px-2 py-1 rounded">Node: {node ? node.name : 'Unknown'}</span>
                    </div>
                    
                    <div className="flex gap-2">
                        {(isDeploying || isDeleting) && (
                            <button onClick={() => setLogModal({ isOpen: true, name })} className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 p-2 rounded-lg transition border border-blue-500/20" title="View Logs">
                                <Eye size={18} />
                            </button>
                        )}
                        <button disabled={isDeploying||isDeleting} onClick={() => setConfirmModal({ isOpen: true, type: 'reset', name })} className="bg-white/5 hover:bg-white/10 text-white p-2 rounded-lg transition disabled:opacity-30" title="Reset Password"><Key size={18} /></button>
                        <button disabled={isDeploying||isDeleting} onClick={() => setConfirmModal({ isOpen: true, type: 'delete', name })} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2 rounded-lg transition disabled:opacity-30" title="Delete Instance"><Trash2 size={18} /></button>
                    </div>
                </div>

                <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 transition-opacity duration-500 ${(isDeploying || isDeleting) ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                    <div className="bg-[#0f0f0f] p-5 rounded-xl border border-gray-800">
                        <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-semibold">Studio Dashboard</p>
                        <a href={`https://${info.domain}`} target="_blank" className="text-gray-200 font-medium hover:text-white transition flex items-center gap-1.5">
                            {info.domain} <ExternalLink size={14} className="text-gray-500" />
                        </a>
                        <div className="mt-4 flex gap-4 text-sm bg-black/30 p-3 rounded-lg">
                            <div>
                                <span className="text-gray-500 block text-xs mb-0.5">User</span>
                                <span className="text-gray-300 font-mono">supabase</span>
                            </div>
                            <div className="w-px bg-gray-800"></div>
                            <div>
                                <span className="text-gray-500 block text-xs mb-0.5">Password</span>
                                <span className="font-mono text-supa-green cursor-pointer hover:underline" onClick={()=>navigator.clipboard.writeText(info.password)} title="Click to copy">{info.password}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-[#0f0f0f] p-5 rounded-xl border border-gray-800">
                        <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-semibold">PostgreSQL Connection</p>
                        {info.pgPassword ? (
                            <div className="bg-black/30 p-3 rounded-lg border border-gray-800/50 mt-1">
                                <code className="text-xs text-blue-300 break-all cursor-pointer hover:text-blue-200 transition" onClick={()=>navigator.clipboard.writeText(`postgresql://postgres:${info.pgPassword}@${node?.ip}:5432/postgres`)} title="Click to copy">
                                    postgresql://postgres:{info.pgPassword}@{node?.ip}:5432/postgres
                                </code>
                            </div>
                        ) : (
                            <span className="text-gray-600 text-sm mt-2 block">Not available for older instances</span>
                        )}
                    </div>
                </div>
              </motion.div>
            );
        })}
      </section>

      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, type: '', name: '' })}
        onConfirm={executeAction}
        title={confirmModal.type === 'delete' ? 'Delete Instance' : 'Regenerate Password'}
        message={confirmModal.type === 'delete' 
            ? `Are you sure you want to permanently delete the "${confirmModal.name}" Supabase instance? This will wipe all data and Docker volumes.`
            : `Are you sure you want to regenerate the Studio password for "${confirmModal.name}"? The container will restart gracefully.`}
        confirmText={confirmModal.type === 'delete' ? 'Delete' : 'Regenerate'}
        isDanger={confirmModal.type === 'delete'}
      />

      <TerminalLog 
        isOpen={logModal.isOpen}
        onClose={() => setLogModal({ isOpen: false, name: '' })}
        projectName={logModal.name}
      />
    </motion.div>
  );
}
