import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../utils/api';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const { addToast } = useToast();
  const [name, setName] = useState(user?.name || '');
  const [loading, setLoading] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.patch('/auth/me', { name });
      updateUser(data.user);
      addToast('Profile updated!', 'success');
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ padding: 32, maxWidth: 560 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 28 }}>Profile</h1>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <div className="avatar avatar-lg" style={{ background: user?.avatar_color, width: 64, height: 64, fontSize: 24 }}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{user?.name}</div>
            <div style={{ color: 'var(--text2)', fontSize: 14 }}>{user?.email}</div>
          </div>
        </div>
        <form onSubmit={save}>
          <div className="form-group">
            <label>Full Name</label>
            <input value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input value={user?.email} disabled style={{ opacity: 0.5 }} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
