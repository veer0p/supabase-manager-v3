const API_BASE = import.meta.env.PROD ? '/api' : 'http://localhost:4000/api';

const getHeaders = () => {
    // For local testing, fallback to basic auth if needed, or if the user enabled it
    return {
        'Authorization': 'Basic ' + btoa('admin:admin123'),
        'Content-Type': 'application/json'
    };
};

export const apiFetch = async (path, options = {}) => {
    const isFormData = options.body instanceof FormData;
    const headers = { ...getHeaders(), ...options.headers };
    if (isFormData) delete headers['Content-Type']; // Let browser set boundary

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (!res.ok) {
        let err;
        try { err = await res.json(); } catch(e) { err = { error: res.statusText }; }
        throw new Error(err.error || 'API Error');
    }
    return res.json();
};
