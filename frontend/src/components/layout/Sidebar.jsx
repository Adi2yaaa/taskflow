import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { path: '/dashboard', icon: '⊞', label: 'Dashboard' },
  { path: '/projects', icon: '◫', label: 'Projects' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <aside style={{
      width: collapsed ? 68 : 240,
      background: 'var(--bg2)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      transition: 'width 0.2s ease',
      flexShrink: 0,
      height: '100vh', position: 'sticky', top: 0,
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 34, height: 34, background: 'var(--indigo)', borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, fontSize: 16, fontWeight: 900, color: 'white'
        }}>✓</div>
        {!collapsed && <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.03em' }}>TaskFlow</span>}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="btn btn-ghost btn-icon btn-sm"
          style={{ marginLeft: 'auto', flexShrink: 0 }}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {/* Nav */}
      <nav style={{ padding: '12px 8px', flex: 1 }}>
        {navItems.map(item => {
          const active = location.pathname.startsWith(item.path);
          return (
            <Link key={item.path} to={item.path} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: collapsed ? '10px 0' : '9px 12px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 2,
              justifyContent: collapsed ? 'center' : 'flex-start',
              background: active ? 'var(--indigo-dim)' : 'transparent',
              color: active ? 'var(--indigo-hover)' : 'var(--text2)',
              fontWeight: active ? 600 : 400,
              fontSize: 14,
              transition: 'var(--transition)',
            }}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border)' }}>
        <Link to="/profile" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 'var(--radius-sm)',
          color: 'var(--text)', marginBottom: 4,
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}>
          <div className="avatar avatar-sm" style={{ background: user?.avatar_color, flexShrink: 0 }}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
          {!collapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
            </div>
          )}
        </Link>
        <button onClick={handleLogout} className="btn btn-ghost btn-sm" style={{
          width: '100%', justifyContent: collapsed ? 'center' : 'flex-start',
          color: 'var(--text3)', fontSize: 13
        }}>
          <span>⎋</span>
          {!collapsed && 'Logout'}
        </button>
      </div>
    </aside>
  );
}
