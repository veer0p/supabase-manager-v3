import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Trash2, Key, Database, Eye, EyeOff, ExternalLink, Lock, Copy, Check, Loader2, Server } from 'lucide-react';
import { apiFetch } from '../lib/api';
import Select from '../components/Select';
import ConfirmModal from '../components/ConfirmModal';
import TerminalLog from '../components/TerminalLog';
import { useNotification } from '../NotificationContext';
import { ListSkeleton } from '../components/Skeleton';

let cachedInstances = null;
let cachedNodes = null;

export default function Instances() {
  const [instances, setInstances] = useState(cachedInstances || {});
  const [nodes, setNodes] = useState(cachedNodes || []);
  const [dataLoading, setDataLoading] = useState(!cachedInstances);
  const [visibleFields, setVisibleFields] = useState({}); // { name_field: boolean }
  const [copiedField, setCopiedField] = useState(null);
  const [form, setForm] = useState({ project_name: '', nodeId: '' });
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const { error, success } = useNotification();

  const toggleVisibility = (instanceName, field) => {
    const key = `${instanceName}_${field}`;
    setVisibleFields(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const copyToClipboard = (text, fieldId) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Modals state
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: '', name: '' });
  const [logModal, setLogModal] = useState({ isOpen: false, name: '' });

  const fetchData = () => {
    if (!cachedInstances) setDataLoading(true);
    Promise.all([
      apiFetch('/instances').then(res => { cachedInstances = res; setInstances(res); }),
      apiFetch('/nodes').then(res => { cachedNodes = res; setNodes(res); })
    ]).finally(() => setDataLoading(false));
  };

  useEffect(() => {
    fetchData();
    const int = setInterval(() => apiFetch('/instances').then(res => { cachedInstances = res; setInstances(res); }), 3000);
    return () => clearInterval(int);
  }, []);

  const handleDeploy = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!form.project_name.trim()) errors.project_name = "Project name is required";
    else if (!/^[a-z0-9-]+$/.test(form.project_name)) errors.project_name = "Lowercase, numbers & hyphens only";
    if (!form.nodeId) errors.nodeId = "Please select a target node";

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    setLoading(true);
    try {
      await apiFetch('/deploy', { method: 'POST', body: JSON.stringify(form) });
      setForm({ ...form, project_name: '' });
      fetchData();
    } catch (e) {
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
      } catch (e) {
        error(e.message);
      }
    }
  };

  const nodeOptions = nodes.map(n => ({ label: `${n.name} (${n.ip})`, value: n.id }));

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white tracking-tight">Supabase Instances</h1>
        <div className="flex gap-4 items-center">
          <span className="text-xs text-gray-500 font-medium">Auto-refresh active</span>
          <div className="w-1.5 h-1.5 rounded-full bg-supa-green animate-pulse"></div>
        </div>
      </div>

      <section className="glass px-6 py-5 rounded-2xl border-gray-800/40 relative z-20">
        <form id="deploy-form" onSubmit={handleDeploy} noValidate className="flex flex-wrap md:flex-nowrap items-start gap-4">
          <div className="flex-1 min-w-[240px] space-y-1.5">
            <div className={`flex items-center gap-3 bg-black/40 border ${formErrors.project_name ? 'border-red-500/50' : 'border-white/5'} rounded-xl px-4 transition-all focus-within:border-supa-green/50`}>
              <Database className={formErrors.project_name ? 'text-red-400' : 'text-gray-500'} size={18} />
              <input 
                placeholder="Project Name" 
                value={form.project_name} 
                onChange={e => {
                  setForm({ ...form, project_name: e.target.value.toLowerCase() });
                  if (formErrors.project_name) setFormErrors(p => ({ ...p, project_name: null }));
                }}
                className="w-full bg-transparent border-none py-3 text-white placeholder:text-gray-600 focus:ring-0 outline-none font-medium text-sm" 
              />
            </div>
            {formErrors.project_name && <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-[10px] text-red-400 font-bold uppercase tracking-widest pl-1">{formErrors.project_name}</motion.p>}
          </div>

          <div className="flex-1 min-w-[240px] space-y-1.5">
            <div className={formErrors.nodeId ? 'border-red-500/50 rounded-xl' : ''}>
              <Select
                icon={Server}
                options={nodeOptions}
                value={form.nodeId}
                onChange={(val) => {
                  setForm({ ...form, nodeId: val });
                  if (formErrors.nodeId) setFormErrors(p => ({ ...p, nodeId: null }));
                }}
                placeholder="Select Target Node"
              />
            </div>
            {formErrors.nodeId && <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-[10px] text-red-400 font-bold uppercase tracking-widest pl-1">{formErrors.nodeId}</motion.p>}
          </div>

          <button disabled={loading} type="submit" className="bg-supa-green text-black text-xs font-bold uppercase tracking-wider rounded-xl px-8 hover:bg-supa-greenHover transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer h-[46px] mt-0">
            {loading ? 'Deploying...' : <><Play size={14} fill="currentColor" /> Deploy Instance</>}
          </button>
        </form>
      </section>

      {dataLoading ? (
        <ListSkeleton count={2} />
      ) : Object.keys(instances).length === 0 ? (
        <div className="glass p-12 rounded-2xl border border-white/5 text-center flex flex-col items-center">
          <Database size={32} className="text-gray-600 mb-4" />
          <h3 className="text-white font-bold tracking-widest uppercase mb-1">No Instances</h3>
          <p className="text-gray-500 text-sm">Deploy your first Supabase instance using the form above.</p>
        </div>
      ) : (
        <section className="space-y-8">
          {Object.entries(instances).map(([name, info]) => {
            const isDeploying = info.status === 'deploying' || info.status === 'provisioning';
            const isDeleting = info.status === 'deleting';
            const node = nodes.find(n => n.id === info.nodeId);

            return (
              <motion.div layout key={name} className={`glass px-8 py-6 rounded-2xl border ${isDeploying ? 'border-blue-500/30' : isDeleting ? 'border-red-500/30' : 'border-gray-800/40'} mb-6 transition-all hover:bg-white/[0.03] shadow-xl`}>
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-6 mb-6 pb-4 border-b border-white/5">
                  <div className="flex items-center gap-5">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isDeploying ? 'bg-blue-500/10 text-blue-400' : 'bg-supa-green/10 text-supa-green'}`}>
                        <Database size={20} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold tracking-tight text-white">{name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Node: {node ? node.name : 'Unknown'}</span>
                          {info.isProtected && <span className="text-[9px] font-bold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded flex items-center gap-1 border border-orange-500/20"><Lock size={10} /> PROTECTED</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 ml-auto">
                    <div className="flex items-center gap-2 px-3 py-1 bg-black/40 rounded-full border border-white/5">
                      <div className={`w-1.5 h-1.5 rounded-full ${isDeploying || isDeleting ? 'bg-blue-400 animate-pulse' : 'bg-supa-green shadow-[0_0_8px_#3ecf8e]'}`}></div>
                      <span className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">{info.status === 'active' ? 'Operational' : info.status}</span>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => setLogModal({ isOpen: true, name })} className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition cursor-pointer" title="Logs"><Eye size={18} /></button>
                      {!isDeploying && !isDeleting && (
                        <button onClick={() => setConfirmModal({ isOpen: true, type: 'reset', name })} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition cursor-pointer" title="Reset"><Key size={18} /></button>
                      )}
                      {!info.isProtected && !isDeploying && !isDeleting && (
                        <button onClick={() => setConfirmModal({ isOpen: true, type: 'delete', name })} className="p-2 text-red-500/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer" title="Delete"><Trash2 size={18} /></button>
                      )}
                    </div>

                    <div className="h-8 w-px bg-gray-800"></div>

                    {!isDeploying && !isDeleting && (
                      <div className="flex flex-wrap gap-3">
                        {info.status === 'error' ? (
                          <button 
                            onClick={() => {
                              setForm({ project_name: name, nodeId: info.nodeId });
                              // We use a small timeout to ensure state is set before triggering
                              setTimeout(() => {
                                document.getElementById('deploy-form')?.requestSubmit();
                              }, 100);
                            }}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-xl border border-orange-500/20 transition-all font-bold text-sm"
                          >
                            <Play size={16} /> Retry Deploy
                          </button>
                        ) : (
                          <a 
                            href={`https://${info.studio_domain}/project/default`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-supa-green/10 hover:bg-supa-green/20 text-supa-green rounded-xl border border-supa-green/20 transition-all font-bold text-sm"
                          >
                            <ExternalLink size={16} /> Launch Studio
                          </a>
                        )}
                        
                        <a 
                          href={`https://${info.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-all font-bold text-sm"
                        >
                          <ExternalLink size={16} /> API Edge
                        </a>
                      </div>
                    )}
                    {(isDeploying || isDeleting) && (
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-900/50 rounded-xl border border-white/5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                        <Loader2 size={14} className="animate-spin text-blue-400" />
                        {isDeploying ? 'Deploying...' : 'Deleting...'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Data Grid - 3 Columns De-congested */}
                <div className={`grid grid-cols-1 lg:grid-cols-3 gap-10 ${(isDeploying || isDeleting) ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                  {/* Column 1: Studio Credentials */}
                  <div className="space-y-4">
                    <span className="text-[11px] text-gray-500 uppercase font-black tracking-[0.2em]">Studio Auth</span>
                    <div className="bg-black/40 p-4 rounded-xl border border-white/5 flex items-center justify-between group hover:border-white/10 transition-colors">
                      <div className="flex-1 overflow-hidden mr-4 flex gap-6">
                        <div>
                          <span className="text-[10px] text-gray-500 block mb-1 uppercase font-bold">User</span>
                          <span className="font-mono text-sm text-gray-300">supabase</span>
                        </div>
                        <div className="flex-1">
                          <span className="text-[10px] text-gray-500 block mb-1 uppercase font-bold">Password</span>
                          <span className="font-mono text-sm text-supa-green tracking-tight truncate block">
                            {visibleFields[`${name}_pass`] ? info.password : '••••••••••••'}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => toggleVisibility(name, 'pass')} className="p-1.5 text-gray-500 hover:text-gray-300 cursor-pointer">
                          {visibleFields[`${name}_pass`] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button onClick={() => copyToClipboard(info.password, `${name}_pass`)} className="p-1.5 text-gray-500 hover:text-supa-green cursor-pointer">
                          {copiedField === `${name}_pass` ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: API Gateway */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-gray-500 uppercase font-black tracking-[0.2em]">API Gateway</span>
                      <button onClick={() => copyToClipboard(`https://${info.domain}`, `${name}_url`)} className="text-[10px] font-bold text-blue-400 hover:text-blue-300 cursor-pointer transition-colors uppercase tracking-wider">
                        {copiedField === `${name}_url` ? 'Copied' : 'Copy URL'}
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center px-1">
                        <code className="text-xs text-blue-400/80 font-mono truncate">https://{info.domain}</code>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { id: 'anon', label: 'Anon Key', val: info.anonKey },
                          { id: 'service', label: 'Service Role', val: info.serviceRoleKey }
                        ].map(k => (
                          <div key={k.id} className="bg-black/40 p-3 rounded-xl border border-white/5 flex items-center justify-between group hover:border-white/10 transition-colors">
                            <div className="overflow-hidden mr-1">
                              <span className="text-[9px] text-gray-500 block mb-0.5 uppercase font-bold">{k.label}</span>
                              <span className="font-mono text-[11px] text-gray-400 truncate block">
                                {visibleFields[`${name}_${k.id}`] ? (k.val || 'N/A') : '••••••••'}
                              </span>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => toggleVisibility(name, k.id)} className="p-1 text-gray-500 hover:text-gray-300 cursor-pointer">
                                {visibleFields[`${name}_${k.id}`] ? <EyeOff size={12} /> : <Eye size={12} />}
                              </button>
                              <button onClick={() => copyToClipboard(k.val, `${name}_${k.id}`)} className="p-1 text-gray-500 hover:text-supa-green cursor-pointer"><Copy size={12} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Column 3: External DB Access */}
                  <div className="space-y-4">
                    <span className="text-[11px] text-gray-500 uppercase font-black tracking-[0.2em]">Direct Postgres</span>
                    <div className="bg-black/40 p-4 rounded-xl border border-white/5 flex items-center justify-between group hover:border-white/10 transition-colors">
                      <div className="flex-1 overflow-hidden mr-4">
                        <span className="text-[10px] text-gray-500 block mb-1 uppercase font-bold tracking-wider">Host IP</span>
                        <code className="font-mono text-sm text-blue-300 font-bold block">
                          {node?.ip}
                        </code>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => toggleVisibility(name, 'pg')} className="p-1.5 text-gray-500 hover:text-gray-300 cursor-pointer">
                          {visibleFields[`${name}_pg`] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button onClick={() => copyToClipboard(`postgresql://postgres:${info.pgPassword}@${node?.ip}:5432/postgres`, `${name}_pg`)}
                          className="bg-white/5 hover:bg-white/10 p-2 rounded-lg transition cursor-pointer border border-white/5" title="Copy Connection String">
                          {copiedField === `${name}_pg` ? <Check size={14} className="text-supa-green" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                    <p className="text-[9px] text-gray-600 px-1 leading-relaxed">External connections allowed on port 5432. Use standard PostgreSQL client.</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </section>
      )}

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
