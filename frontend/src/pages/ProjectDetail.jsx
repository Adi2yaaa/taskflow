import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { format, parseISO } from 'date-fns';

const STATUSES = ['todo', 'in_progress', 'in_review', 'done'];
const STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', in_review: 'In Review', done: 'Done' };
const STATUS_COLORS = { todo: 'var(--todo)', in_progress: 'var(--in-progress)', in_review: 'var(--in-review)', done: 'var(--done)' };
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const PRIORITY_COLORS = { low: 'var(--low)', medium: 'var(--medium)', high: 'var(--high)', urgent: 'var(--urgent)' };

// ── Task Card ────────────────────────────────────────────────────────────────
function TaskCard({ task, onEdit, onDelete, isAdmin, currentUserId }) {
  const isOverdue = task.is_overdue;
  return (
    <div style={{
      background: 'var(--bg2)', border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
      borderRadius: 'var(--radius)', padding: 14, marginBottom: 8,
      cursor: 'pointer', transition: 'var(--transition)',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = isOverdue ? 'rgba(239,68,68,0.6)' : 'var(--indigo)'}
    onMouseLeave={e => e.currentTarget.style.borderColor = isOverdue ? 'rgba(239,68,68,0.3)' : 'var(--border)'}
    onClick={() => onEdit(task)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_COLORS[task.priority] }} title={`Priority: ${task.priority}`} />
          <span style={{ fontSize: 12, color: PRIORITY_COLORS[task.priority], fontWeight: 600, textTransform: 'capitalize' }}>{task.priority}</span>
        </div>
        {isOverdue && <span className="badge badge-overdue">Overdue</span>}
      </div>
      <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, lineHeight: 1.4 }}>{task.title}</h4>
      {task.description && (
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {task.description}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {task.assignee_id ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="avatar avatar-sm" style={{ background: task.assignee_avatar || '#6366f1', width: 22, height: 22, fontSize: 9 }}>
              {task.assignee_name?.[0]?.toUpperCase()}
            </div>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>{task.assignee_name}</span>
          </div>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>Unassigned</span>
        )}
        {task.due_date && (
          <span style={{ fontSize: 11, color: isOverdue ? 'var(--urgent)' : 'var(--text3)' }}>
            📅 {format(parseISO(task.due_date), 'MMM d')}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Task Modal ───────────────────────────────────────────────────────────────
function TaskModal({ task, projectId, members, isAdmin, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || 'todo',
    priority: task?.priority || 'medium',
    assigneeId: task?.assignee_id || '',
    dueDate: task?.due_date ? task.due_date.substring(0, 10) : '',
  });
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let res;
      if (task) {
        res = await api.patch(`/projects/${projectId}/tasks/${task.id}`, {
          ...form, assigneeId: form.assigneeId || null, dueDate: form.dueDate || null
        });
      } else {
        res = await api.post(`/projects/${projectId}/tasks`, {
          ...form, assigneeId: form.assigneeId || null, dueDate: form.dueDate || null
        });
      }
      onSave(res.data.task, !!task);
      addToast(task ? 'Task updated!' : 'Task created!', 'success');
      onClose();
    } catch (err) {
      addToast(err.response?.data?.error || 'Operation failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const del = async () => {
    if (!confirm('Delete this task?')) return;
    try {
      await api.delete(`/projects/${projectId}/tasks/${task.id}`);
      onDelete(task.id);
      addToast('Task deleted', 'success');
      onClose();
    } catch (err) {
      addToast('Failed to delete', 'error');
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h2 className="modal-title">{task ? 'Edit Task' : 'Create Task'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          {isAdmin && (
            <div className="form-group">
              <label>Title *</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="Task title" />
            </div>
          )}
          {isAdmin && (
            <div className="form-group">
              <label>Description</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} style={{ resize: 'vertical' }} placeholder="Add details..." />
            </div>
          )}
          <div className="grid-2">
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            {isAdmin && (
              <div className="form-group">
                <label>Priority</label>
                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
            )}
          </div>
          {isAdmin && (
            <div className="grid-2">
              <div className="form-group">
                <label>Assignee</label>
                <select value={form.assigneeId} onChange={e => setForm({ ...form, assigneeId: e.target.value })}>
                  <option value="">Unassigned</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Due Date</label>
                <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 8 }}>
            {task && (isAdmin || task.created_by === task.created_by) ? (
              <button type="button" className="btn btn-danger btn-sm" onClick={del}>Delete</button>
            ) : <div />}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? '...' : (task ? 'Save Changes' : 'Create Task')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Members Modal ────────────────────────────────────────────────────────────
function MembersModal({ projectId, members, onClose, onUpdate }) {
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const { addToast } = useToast();

  const doSearch = async (q) => {
    setSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const { data } = await api.get(`/users/search?q=${q}`);
      const memberIds = members.map(m => m.id);
      setSearchResults(data.users.filter(u => !memberIds.includes(u.id)));
    } finally { setSearching(false); }
  };

  const addMember = async (user, role = 'member') => {
    try {
      const { data } = await api.post(`/projects/${projectId}/members`, { userId: user.id, role });
      onUpdate([...members, data.member]);
      setSearchResults(r => r.filter(u => u.id !== user.id));
      addToast(`${user.name} added as ${role}`, 'success');
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to add member', 'error');
    }
  };

  const changeRole = async (member, role) => {
    try {
      await api.patch(`/projects/${projectId}/members/${member.id}`, { role });
      onUpdate(members.map(m => m.id === member.id ? { ...m, role } : m));
      addToast('Role updated', 'success');
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  const removeMember = async (member) => {
    if (!confirm(`Remove ${member.name}?`)) return;
    try {
      await api.delete(`/projects/${projectId}/members/${member.id}`);
      onUpdate(members.filter(m => m.id !== member.id));
      addToast(`${member.name} removed`, 'success');
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <h2 className="modal-title">Manage Members</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="form-group">
          <label>Add Member</label>
          <input value={search} onChange={e => doSearch(e.target.value)} placeholder="Search by name or email..." />
          {searchResults.length > 0 && (
            <div style={{ marginTop: 8, background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              {searchResults.map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                  <div className="avatar avatar-sm" style={{ background: u.avatar_color }}>
                    {u.name[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{u.email}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => addMember(u, 'member')}>+ Member</button>
                  <button className="btn btn-primary btn-sm" onClick={() => addMember(u, 'admin')}>+ Admin</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="divider" />

        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Current Members ({members.length})</h3>
        {members.map(m => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div className="avatar avatar-sm" style={{ background: m.avatar_color }}>
              {m.name[0]}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{m.email}</div>
            </div>
            <select value={m.role} onChange={e => changeRole(m, e.target.value)}
              style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeMember(m)} title="Remove">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Project Page ────────────────────────────────────────────────────────
export default function ProjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [taskModal, setTaskModal] = useState(null); // null | 'new' | task object
  const [showMembers, setShowMembers] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQ, setSearchQ] = useState('');

  const isAdmin = project?.role === 'admin';

  const load = useCallback(async () => {
    try {
      const [projRes, taskRes] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get(`/projects/${id}/tasks`),
      ]);
      setProject(projRes.data.project);
      setMembers(projRes.data.members);
      setTasks(taskRes.data.tasks);
    } catch { navigate('/projects'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const filteredTasks = tasks.filter(t => {
    const matchStatus = filterStatus === 'all' || t.status === filterStatus;
    const matchSearch = !searchQ || t.title.toLowerCase().includes(searchQ.toLowerCase());
    return matchStatus && matchSearch;
  });

  const tasksByStatus = STATUSES.reduce((acc, s) => ({
    ...acc, [s]: filteredTasks.filter(t => t.status === s)
  }), {});

  const onSaveTask = (task, isUpdate) => {
    if (isUpdate) setTasks(ts => ts.map(t => t.id === task.id ? task : t));
    else setTasks(ts => [task, ...ts]);
  };

  const onDeleteTask = (taskId) => setTasks(ts => ts.filter(t => t.id !== taskId));

  const deleteProject = async () => {
    if (!confirm('Delete this entire project? This cannot be undone.')) return;
    try {
      await api.delete(`/projects/${id}`);
      addToast('Project deleted', 'success');
      navigate('/projects');
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="spinner" />
    </div>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>
              <span style={{ cursor: 'pointer', color: 'var(--indigo)' }} onClick={() => navigate('/projects')}>Projects</span>
              <span style={{ margin: '0 8px' }}>›</span>
              {project.name}
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>{project.name}</h1>
            {project.description && <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>{project.description}</p>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Members avatars */}
            <div style={{ display: 'flex', marginRight: 8 }}>
              {members.slice(0, 5).map((m, i) => (
                <div key={m.id} className="avatar avatar-sm" title={m.name}
                  style={{ background: m.avatar_color, marginLeft: i ? -8 : 0, border: '2px solid var(--bg2)', zIndex: members.length - i }}>
                  {m.name[0]}
                </div>
              ))}
              {members.length > 5 && (
                <div className="avatar avatar-sm" style={{ background: 'var(--bg3)', color: 'var(--text2)', marginLeft: -8, border: '2px solid var(--bg2)', fontSize: 10 }}>
                  +{members.length - 5}
                </div>
              )}
            </div>
            {isAdmin && <button className="btn btn-ghost btn-sm" onClick={() => setShowMembers(true)}>👥 Members</button>}
            {isAdmin && <button className="btn btn-primary btn-sm" onClick={() => setTaskModal('new')}>+ Task</button>}
            {isAdmin && (
              <button className="btn btn-danger btn-sm btn-icon" onClick={deleteProject} title="Delete project">🗑</button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={searchQ} onChange={e => setSearchQ(e.target.value)}
            placeholder="Search tasks..." style={{ maxWidth: 220, padding: '6px 12px', fontSize: 13 }}
          />
          {['all', ...STATUSES].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`btn btn-sm ${filterStatus === s ? 'btn-primary' : 'btn-ghost'}`}
              style={{ textTransform: 'capitalize' }}>
              {s === 'all' ? 'All' : STATUS_LABELS[s]}
              {s !== 'all' && <span style={{ marginLeft: 4, opacity: 0.7 }}>{tasks.filter(t => t.status === s).length}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Kanban Board */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, minWidth: 900, height: '100%' }}>
          {STATUSES.map(status => (
            <div key={status}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[status] }} />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{STATUS_LABELS[status]}</span>
                </div>
                <span style={{
                  background: 'var(--bg3)', color: 'var(--text2)',
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20
                }}>{tasksByStatus[status].length}</span>
              </div>

              <div style={{
                background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: 12,
                minHeight: 200, border: '1px solid var(--border)',
              }}>
                {tasksByStatus[status].map(task => (
                  <TaskCard key={task.id} task={task} onEdit={setTaskModal} onDelete={onDeleteTask}
                    isAdmin={isAdmin} currentUserId={user.id} />
                ))}
                {tasksByStatus[status].length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text3)', fontSize: 13 }}>
                    No tasks
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      {taskModal && (
        <TaskModal
          task={taskModal === 'new' ? null : taskModal}
          projectId={id}
          members={members}
          isAdmin={isAdmin}
          onClose={() => setTaskModal(null)}
          onSave={onSaveTask}
          onDelete={onDeleteTask}
        />
      )}

      {showMembers && (
        <MembersModal
          projectId={id}
          members={members}
          onClose={() => setShowMembers(false)}
          onUpdate={setMembers}
        />
      )}
    </div>
  );
}
