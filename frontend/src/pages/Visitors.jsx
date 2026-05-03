import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Mail, Phone, MessageSquare, Target, Calendar, Hash } from 'lucide-react';
import { apiFetch } from '../lib/api';

export default function VisitorsPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/admin/visitors')
      .then(data => { setLeads(Array.isArray(data) ? data : []); })
      .catch(err => console.error('Failed to load visitor leads:', err))
      .finally(() => setLoading(false));
  }, []);

  const uniqueVisitors = new Set(leads.map(l => l.visitor_id).filter(Boolean)).size;
  const totalLeads = leads.length;
  const purposeCounts = leads.reduce((acc, l) => {
    if (l.purpose) acc[l.purpose] = (acc[l.purpose] || 0) + 1;
    return acc;
  }, {});

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold font-orbitron text-white tracking-tight">Visitor Analytics</h1>
          <p className="text-gray-500 text-sm mt-1">Portfolio visitor leads & engagement data</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-[#3ecf8e] bg-[#3ecf8e]/10 border border-[#3ecf8e]/20 px-4 py-2 rounded-xl uppercase tracking-widest">
          <div className="w-1.5 h-1.5 rounded-full bg-[#3ecf8e] animate-pulse" />
          Admin Only
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {[
          { icon: Hash, label: 'Unique Visitors', value: loading ? '…' : uniqueVisitors, color: '#3ecf8e' },
          { icon: Users, label: 'Total Leads', value: loading ? '…' : totalLeads, color: '#60a5fa' },
          { icon: Target, label: 'Top Purpose', value: loading ? '…' : (Object.entries(purposeCounts).sort((a,b) => b[1]-a[1])[0]?.[0] || '—'), color: '#a78bfa' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="glass p-6 rounded-2xl border-gray-800/40 flex items-center gap-5">
            <div className="p-3 rounded-xl" style={{ background: `${color}18` }}>
              <Icon size={22} style={{ color }} />
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-widest font-medium">{label}</p>
              <p className="text-2xl font-extrabold text-white font-orbitron mt-0.5 capitalize">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Leads Table */}
      <section className="glass rounded-2xl border-gray-800/40 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
          <Users size={16} className="text-[#3ecf8e]" />
          <h2 className="font-bold text-white tracking-tight uppercase text-xs font-orbitron">Visitor Leads</h2>
        </div>

        {loading ? (
          <div className="p-10 text-center text-gray-500 text-sm">Loading…</div>
        ) : leads.length === 0 ? (
          <div className="p-16 text-center">
            <Users size={40} className="text-gray-700 mx-auto mb-4" />
            <p className="text-gray-500 text-sm font-medium">No visitor leads yet.</p>
            <p className="text-gray-600 text-xs mt-1">They appear after a visitor submits the engagement form.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-white/5">
                  {['#', 'Name', 'Email', 'Mobile', 'Purpose', 'Message', 'Date'].map(h => (
                    <th key={h} className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, i) => (
                  <tr key={lead.id || i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4 text-gray-600 font-mono text-xs">{i + 1}</td>
                    <td className="px-5 py-4 text-white font-semibold whitespace-nowrap">{lead.name || '—'}</td>
                    <td className="px-5 py-4 text-gray-300 font-mono text-xs whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Mail size={11} className="text-gray-500" />
                        {lead.email || '—'}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-300 font-mono text-xs whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Phone size={11} className="text-gray-500" />
                        {lead.mobile || '—'}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {lead.purpose ? (
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border"
                          style={{
                            color: { hiring: '#3ecf8e', collaboration: '#60a5fa', curiosity: '#f59e0b', client: '#a78bfa', other: '#6b7280' }[lead.purpose] || '#6b7280',
                            background: `${({ hiring: '#3ecf8e', collaboration: '#60a5fa', curiosity: '#f59e0b', client: '#a78bfa', other: '#6b7280' }[lead.purpose] || '#6b7280')}18`,
                            borderColor: `${({ hiring: '#3ecf8e', collaboration: '#60a5fa', curiosity: '#f59e0b', client: '#a78bfa', other: '#6b7280' }[lead.purpose] || '#6b7280')}40`,
                          }}
                        >
                          {lead.purpose}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-4 text-gray-400 text-xs max-w-[200px] truncate">
                      <div className="flex items-start gap-2">
                        <MessageSquare size={11} className="text-gray-600 shrink-0 mt-0.5" />
                        {lead.message || <span className="text-gray-600 italic">No message</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar size={11} />
                        {lead.created_at ? new Date(lead.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </motion.div>
  );
}
