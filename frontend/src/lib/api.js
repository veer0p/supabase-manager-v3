const API_BASE = import.meta.env.PROD ? '/api' : 'http://localhost:4000/api';

import { supabase } from './supabase';

const getHeaders = async () => {
    if (localStorage.getItem('visitor_mode') === 'true') {
        return {
            'Authorization': 'Bearer visitor_token',
            'Content-Type': 'application/json'
        };
    }
    const { data: { session } } = await supabase.auth.getSession();
    return {
        'Authorization': session ? `Bearer ${session.access_token}` : '',
        'Content-Type': 'application/json'
    };
};

export const apiFetch = async (path, options = {}) => {
    const isFormData = options.body instanceof FormData;
    const headers = { ...(await getHeaders()), ...options.headers };
    if (isFormData) delete headers['Content-Type']; // Let browser set boundary

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (!res.ok) {
        // Auto-clear stale session and redirect to login on 401
        if (res.status === 401 && localStorage.getItem('visitor_mode') !== 'true') {
            await supabase.auth.signOut();
            window.location.href = '/';
            return;
        }
        let err;
        try { err = await res.json(); } catch(e) { err = { error: res.statusText }; }
        throw new Error(err.error || 'API Error');
    }
    return res.json();
};
