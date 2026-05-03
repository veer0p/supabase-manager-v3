import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Folder, File, Upload, Download, Home, Server } from 'lucide-react';
import { apiFetch } from '../lib/api';
import Select from '../components/Select';
import { useNotification } from '../NotificationContext';

const API_BASE = import.meta.env.PROD ? '/api' : 'http://localhost:4000/api';

export default function Files() {
  const [nodes, setNodes] = useState([]);
  const [selectedNode, setSelectedNode] = useState('');
  const [path, setPath] = useState('/');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const { error, success } = useNotification();
  const fileInputRef = useRef(null);

  useEffect(() => {
    apiFetch('/nodes').then(data => {
        setNodes(data);
        if(data.length > 0) setSelectedNode(data[0].id);
    });
  }, []);

  const fetchFiles = async () => {
    if (!selectedNode) return;
    setLoading(true);
    try {
        const data = await apiFetch(`/files/${selectedNode}?path=${encodeURIComponent(path)}`);
        setFiles(data.files);
    } catch(e) {
        error("Error loading files: " + e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFiles();
  }, [selectedNode, path]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if(!file || !selectedNode) return;
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);

    try {
        await apiFetch(`/files/upload/${selectedNode}`, {
            method: 'POST',
            body: formData
        });
        fetchFiles();
    } catch(err) {
        error("Upload failed: " + err.message);
    }
  };

  const goUp = () => {
      const parts = path.split('/').filter(Boolean);
      if(parts.length > 0) {
          parts.pop();
          setPath('/' + parts.join('/'));
      }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-bold text-white">File Browser</h1>
        <div className="w-full md:w-64">
            <Select 
                options={nodes.map(n => ({ label: n.name, value: n.id }))}
                value={selectedNode}
                onChange={setSelectedNode}
                placeholder="Select Node"
            />
        </div>
      </div>

      <div className="glass flex-1 rounded-2xl border-gray-800 flex flex-col overflow-hidden">
        <div className="bg-white/5 border-b border-gray-800/60 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-300 font-mono">
                <button onClick={()=>setPath('/')} className="hover:text-white p-1"><Home size={16}/></button>
                <span className="text-gray-600">/</span>
                {path.split('/').filter(Boolean).map((part, i, arr) => (
                    <React.Fragment key={i}>
                        <button onClick={() => setPath('/' + arr.slice(0, i+1).join('/'))} className="hover:text-white">{part}</button>
                        {i < arr.length - 1 && <span className="text-gray-600">/</span>}
                    </React.Fragment>
                ))}
            </div>
            
            <div className="flex gap-2">
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleUpload} />
                <button onClick={()=>fileInputRef.current?.click()} className="flex items-center gap-2 bg-blue-500/20 text-blue-400 px-3 py-1.5 rounded-lg hover:bg-blue-500/30 transition text-sm">
                    <Upload size={16}/> Upload
                </button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
            {loading ? <div className="text-center p-10 text-gray-500">Loading...</div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {path !== '/' && (
                        <div onClick={goUp} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer text-gray-400">
                            <Folder size={20} className="text-gray-500" />
                            <span>.. (Up a dir)</span>
                        </div>
                    )}
                    {files.map((f, i) => (
                        <div key={i} onClick={() => f.isDirectory && setPath(path === '/' ? `/${f.name}` : `${path}/${f.name}`)} 
                             className={`flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition group ${f.isDirectory ? 'cursor-pointer' : ''}`}>
                            {f.isDirectory ? <Folder size={20} className="text-blue-400" /> : <File size={20} className="text-gray-400" />}
                            <div className="flex-1 overflow-hidden">
                                <p className="text-sm text-gray-200 truncate">{f.name}</p>
                                {!f.isDirectory && <p className="text-xs text-gray-500">{(f.size/1024).toFixed(1)} KB</p>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>
    </motion.div>
  );
}
