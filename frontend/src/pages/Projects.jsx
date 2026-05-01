import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import { format, parseISO, isPast } from 'date-fns';

const STATUS_COLORS = { active: 'var(--done)', on_hold: 'var(--in-review)', completed: 'var(--indigo)', archived: 'var(--text3)' };

function CreateProjectModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', description: '', deadline: '' });
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.post('/projects', form);
      onCreate(data.project);
      addToast('Project created!', 'success');
      onClose();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to create project', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">New Project</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Project Name *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Website Redesign" required />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What is this project about?" rows={3} style={{ resize: 'vertical' }} />
          </div>
          <div className="form-group">
            <label>Deadline</label>
            <input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProjectCard({ project }) {
  const progress = project.task_count > 0 ? Math.round((project.completed_tasks / project.task_count) * 100) : 0;
  const isDeadlineClose = project.deadline && isPast(parseISO(project.deadline)) && project.status !== 'completed';

  return (
    <Link to={`/projects/${project.id}`} style={{ textDecoration: 'none' }}>
      <div className="card" style={{
        cursor: 'pointer', transition: 'var(--transition)',
        borderColor: 'var(--border)',
        ':hover': { borderColor: 'var(--indigo)' }
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--indigo)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[project.status] }} />
            <span style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'capitalize' }}>{project.status.replace('_', ' ')}</span>
          </div>
          <span className={`badge badge-${project.role}`}>{project.role}</span>
        </div>

        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.02em' }}>{project.name}</h3>

        {project.description && (
          <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {project.description}
          </p>
        )}

        <div style={{ marginBottom: 12 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>Progress</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>{project.completed_tasks}/{project.task_count} tasks</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div style={{ display: 'flex', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>👥 {project.member_count}</span>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>📋 {project.task_count}</span>
          </div>
          {project.deadline && (
            <span style={{ fontSize: 12, color: isDeadlineClose ? 'var(--urgent)' : 'var(--text3)' }}>
              {isDeadlineClose ? '⚠ ' : '📅 '}{format(parseISO(project.deadline), 'MMM d, yyyy')}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data.projects)).finally(() => setLoading(false));
  }, []);

  const filtered = projects.filter(p => filter === 'all' || p.status === filter);

  return (
    <div style={{ padding: '32px', maxWidth: 1200, margin: '0 auto' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>Projects</h1>
          <p style={{ color: 'var(--text2)', fontSize: 14, marginTop: 4 }}>{projects.length} projects total</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + New Project
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {['all', 'active', 'on_hold', 'completed', 'archived'].map(f => (
          <button key={f} className={`btn ${filter === f ? 'btn-primary' : 'btn-ghost'} btn-sm`}
            onClick={() => setFilter(f)} style={{ textTransform: 'capitalize' }}>
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">◫</div>
          <h3>No projects yet</h3>
          <p>Create your first project to get started</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowCreate(true)}>
            Create Project
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {filtered.map(p => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}

      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreate={p => setProjects([p, ...projects])}
        />
      )}
    </div>
  );
}
