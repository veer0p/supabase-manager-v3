import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Folder, File, Upload, Download, Home, Server, Laptop, ArrowRightLeft } from 'lucide-react';
import { apiFetch } from '../lib/api';
import Select from '../components/Select';
import { useNotification } from '../NotificationContext';
import { CardSkeleton } from '../components/Skeleton';

const API_BASE = import.meta.env.PROD ? '/api' : 'http://localhost:4000/api';

let cachedNodes = null;
let cachedSelectedNode = '';
let cachedRemotePath = '/';
let cachedLocalPath = ''; // starts empty, backend resolves

export default function Files() {
  const [nodes, setNodes] = useState(cachedNodes || []);
  const [selectedNode, setSelectedNode] = useState(cachedSelectedNode);
  
  const [remotePath, setRemotePath] = useState(cachedRemotePath);
  const [remoteFiles, setRemoteFiles] = useState([]);
  const [remoteLoading, setRemoteLoading] = useState(true);
  
  const [localPath, setLocalPath] = useState(cachedLocalPath);
  const [localFiles, setLocalFiles] = useState([]);
  const [localLoading, setLocalLoading] = useState(true);

  const [selectedLocal, setSelectedLocal] = useState(null);
  const [selectedRemote, setSelectedRemote] = useState(null);
  
  const [transferring, setTransferring] = useState(false);
  const { error, success } = useNotification();

  useEffect(() => {
    if (!cachedNodes) {
      apiFetch('/nodes').then(data => {
          cachedNodes = data;
          setNodes(data);
          if(data.length > 0 && !cachedSelectedNode) {
              cachedSelectedNode = data[0].id;
              setSelectedNode(data[0].id);
          }
      });
    }
  }, []);

  const fetchRemoteFiles = async () => {
    if (!selectedNode) return;
    setRemoteLoading(true);
    try {
        const data = await apiFetch(`/files/${selectedNode}?path=${encodeURIComponent(remotePath)}`);
        setRemoteFiles(data.files);
        setRemotePath(data.path); // Use resolved path
        cachedRemotePath = data.path;
    } catch(e) {
        error("Error loading remote files: " + e.message);
    }
    setRemoteLoading(false);
  };

  const fetchLocalFiles = async () => {
    setLocalLoading(true);
    try {
        const query = localPath ? `?path=${encodeURIComponent(localPath)}` : '';
        const data = await apiFetch(`/local/files${query}`);
        setLocalFiles(data.files);
        setLocalPath(data.path); // Use resolved path (e.g. homedir)
        cachedLocalPath = data.path;
    } catch(e) {
        error("Error loading local files: " + e.message);
    }
    setLocalLoading(false);
  };

  useEffect(() => {
    fetchRemoteFiles();
    setSelectedRemote(null);
  }, [selectedNode, remotePath]);

  useEffect(() => {
    fetchLocalFiles();
    setSelectedLocal(null);
  }, [localPath]);

  const handleTransfer = async (direction) => {
    if (transferring || !selectedNode) return;
    
    let lPath, rPath;

    if (direction === 'local_to_vps') {
      if (!selectedLocal) return error("Select a local file first");
      if (selectedLocal.isDirectory) return error("Cannot transfer directories yet");
      lPath = `${localPath}/${selectedLocal.name}`;
      rPath = `${remotePath}/${selectedLocal.name}`;
    } else {
      if (!selectedRemote) return error("Select a remote file first");
      if (selectedRemote.isDirectory) return error("Cannot transfer directories yet");
      lPath = `${localPath}/${selectedRemote.name}`;
      rPath = `${remotePath}/${selectedRemote.name}`;
    }

    setTransferring(true);
    try {
      await apiFetch('/tunnel/transfer', {
        method: 'POST',
        body: JSON.stringify({
          nodeId: selectedNode,
          direction,
          localPath: lPath,
          remotePath: rPath
        })
      });
      success(`Transferred ${direction === 'local_to_vps' ? 'to' : 'from'} VPS successfully`);
      
      // Refresh the target pane
      if (direction === 'local_to_vps') fetchRemoteFiles();
      else fetchLocalFiles();
      
    } catch(e) {
      error("Transfer failed: " + e.message);
    }
    setTransferring(false);
  };

  const FileList = ({ files, path, setPath, loading, selected, setSelected, isLocal }) => {
    const isVisitor = localStorage.getItem('visitor_mode') === 'true';
    const isRoot = isVisitor && !isLocal ? path === '/tmp/visitor_demo' : path === '/';

    const goUp = () => {
        if (isRoot) return;
        const parts = path.split('/').filter(Boolean);
        if(parts.length > 0) {
            parts.pop();
            setPath('/' + parts.join('/'));
        }
    };

    return (
      <div className="flex-1 overflow-y-auto p-4 bg-black/20">
          {loading ? (
              <div className="flex flex-col gap-2">
                <CardSkeleton />
                <CardSkeleton />
              </div>
          ) : (
              <div className="flex flex-col gap-2">
                  {!isRoot && (
                      <div onDoubleClick={goUp} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-transparent hover:border-white/10 hover:bg-white/10 transition-all cursor-pointer group">
                          <Folder size={16} className="text-gray-500" />
                          <span className="text-xs font-medium text-gray-400 group-hover:text-gray-300">.. (Up Level)</span>
                      </div>
                  )}
                  {files.map((f, i) => {
                      const isSelected = selected?.name === f.name;
                      return (
                      <div 
                        key={i} 
                        onClick={() => setSelected(f)}
                        onDoubleClick={() => {
                          if (f.isDirectory) {
                            setPath(path === '/' ? `/${f.name}` : `${path}/${f.name}`);
                          }
                        }}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer select-none
                          ${isSelected ? (isLocal ? 'bg-blue-500/20 border-blue-500/50' : 'bg-supa-green/20 border-supa-green/50') : 'bg-white/5 border-transparent hover:border-white/10 hover:bg-white/10'}
                        `}>
                          <div className={`${f.isDirectory ? (isLocal ? 'text-blue-400' : 'text-supa-green') : 'text-gray-400'}`}>
                              {f.isDirectory ? <Folder size={16} /> : <File size={16} />}
                          </div>
                          <div className="flex-1 overflow-hidden flex justify-between items-center">
                              <p className={`text-xs font-bold truncate transition-colors ${isSelected ? 'text-white' : 'text-gray-300'}`}>{f.name}</p>
                              {!f.isDirectory && <p className="text-[10px] text-gray-500 font-mono uppercase tracking-tighter">{(f.size/1024).toFixed(1)} KB</p>}
                          </div>
                      </div>
                    )})}
              </div>
          )}
      </div>
    );
  };

  const Breadcrumb = ({ path, setPath }) => {
    const isVisitor = localStorage.getItem('visitor_mode') === 'true';
    const basePath = isVisitor && path.startsWith('/tmp/visitor_demo') ? '/tmp/visitor_demo' : '/';
    
    return (
    <div className="flex items-center gap-2 text-[10px] text-gray-400 font-mono tracking-wider uppercase bg-black/40 p-2 rounded border border-white/5 overflow-x-auto whitespace-nowrap">
        <button onClick={()=>setPath(basePath)} className="hover:text-white transition-colors cursor-pointer"><Home size={12}/></button>
        <span className="text-gray-700">/</span>
        {path.replace(basePath, '').split('/').filter(Boolean).map((part, i, arr) => (
            <React.Fragment key={i}>
                <button onClick={() => setPath(basePath + (basePath === '/' ? '' : '/') + arr.slice(0, i+1).join('/'))} className="hover:text-white transition-colors cursor-pointer truncate max-w-[80px]">{part}</button>
                {i < arr.length - 1 && <span className="text-gray-700">/</span>}
            </React.Fragment>
        ))}
    </div>
  )};

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 h-full flex flex-col pb-10">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
              Commander Transfer <ArrowRightLeft size={20} className="text-gray-500" />
            </h1>
            <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-orbitron font-bold">Direct SFTP Tunnel</p>
          </div>
          <div className="flex gap-4 items-center bg-black/40 p-2 rounded-xl border border-white/5">
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest ml-2">Target VPS:</span>
            <div className="w-64">
                <Select 
                    options={nodes.map(n => ({ label: n.name, value: n.id }))}
                    value={selectedNode}
                    onChange={(val) => {
                      cachedSelectedNode = val;
                      setSelectedNode(val);
                    }}
                    placeholder="Select Target Node"
                />
            </div>
          </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 h-[600px] min-h-[500px]">
        {/* Local PC Pane */}
        <div className="glass flex-1 rounded-2xl border-blue-500/20 flex flex-col overflow-hidden shadow-2xl relative h-full">
          <div className="bg-blue-500/10 border-b border-blue-500/20 px-4 py-3 flex items-center justify-between shadow-[inset_0_0_20px_rgba(59,130,246,0.1)]">
            <div className="flex items-center gap-2 text-blue-400 font-bold uppercase tracking-widest text-xs">
              <Laptop size={16} /> Local Workstation
            </div>
          </div>
          <div className="px-4 pt-3 pb-1 border-b border-white/5 bg-black/20 shrink-0">
            <Breadcrumb path={localPath} setPath={setLocalPath} />
          </div>
          <FileList files={localFiles} path={localPath} setPath={setLocalPath} loading={localLoading} selected={selectedLocal} setSelected={setSelectedLocal} isLocal={true} />
        </div>

        {/* Transfer Controls */}
        <div className="flex lg:flex-col items-center justify-center gap-4 py-4 lg:py-0 shrink-0">
          <button 
            disabled={transferring || !selectedLocal || selectedLocal.isDirectory}
            onClick={() => handleTransfer('local_to_vps')}
            className="flex flex-col items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500 hover:text-white transition-all disabled:opacity-30 disabled:hover:bg-blue-500/10 disabled:hover:text-blue-400 cursor-pointer shadow-[0_0_15px_rgba(59,130,246,0.2)]"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest mb-1 hidden lg:block">Push</span>
            <Upload size={20} />
          </button>
          
          <div className="h-px w-10 lg:w-px lg:h-10 bg-white/10" />

          <button 
            disabled={transferring || !selectedRemote || selectedRemote.isDirectory}
            onClick={() => handleTransfer('vps_to_local')}
            className="flex flex-col items-center justify-center w-16 h-16 rounded-2xl bg-supa-green/10 border border-supa-green/30 text-supa-green hover:bg-supa-green hover:text-black transition-all disabled:opacity-30 disabled:hover:bg-supa-green/10 disabled:hover:text-supa-green cursor-pointer shadow-[0_0_15px_rgba(62,207,142,0.2)]"
          >
            <Download size={20} />
            <span className="text-[10px] font-bold uppercase tracking-widest mt-1 hidden lg:block">Pull</span>
          </button>
        </div>

        {/* Remote VPS Pane */}
        <div className="glass flex-1 rounded-2xl border-supa-green/20 flex flex-col overflow-hidden shadow-2xl relative h-full">
          <div className="bg-supa-green/10 border-b border-supa-green/20 px-4 py-3 flex items-center justify-between shadow-[inset_0_0_20px_rgba(62,207,142,0.1)]">
            <div className="flex items-center gap-2 text-supa-green font-bold uppercase tracking-widest text-xs">
              <Server size={16} /> Remote Node
            </div>
          </div>
          <div className="px-4 pt-3 pb-1 border-b border-white/5 bg-black/20 shrink-0">
            <Breadcrumb path={remotePath} setPath={setRemotePath} />
          </div>
          <FileList files={remoteFiles} path={remotePath} setPath={setRemotePath} loading={remoteLoading} selected={selectedRemote} setSelected={setSelectedRemote} isLocal={false} />
        </div>
      </div>
      
      {transferring && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-16 h-16 rounded-full border-4 border-white/10 border-t-[#3ecf8e] animate-spin mb-6" />
          <h2 className="text-white font-orbitron font-bold text-xl tracking-[0.2em] animate-pulse">Establishing Tunnel...</h2>
          <p className="text-gray-400 text-sm mt-2 font-mono">Transferring via encrypted SFTP stream</p>
        </div>
      )}
    </motion.div>
  );
}
