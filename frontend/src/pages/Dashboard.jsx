import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { formatDistanceToNow, format, isPast, parseISO } from 'date-fns';

const STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', in_review: 'In Review', done: 'Done' };
const STATUS_COLORS = { todo: 'var(--todo)', in_progress: 'var(--in-progress)', in_review: 'var(--in-review)', done: 'var(--done)' };
const PRIORITY_COLORS = { low: 'var(--low)', medium: 'var(--medium)', high: 'var(--high)', urgent: 'var(--urgent)' };

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="card" style={{ borderTop: `3px solid ${accent}` }}>
      <div style={{ fontSize: 32, fontWeight: 800, color: accent, lineHeight: 1 }}>{value}</div>
      <div style={{ fontWeight: 600, fontSize: 15, marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function TaskRow({ task }) {
  const isOverdue = task.is_overdue || (task.due_date && isPast(parseISO(task.due_date)) && task.status !== 'done');
  return (
    <Link to={`/projects/${task.project_id}`} style={{ display: 'block', textDecoration: 'none' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px', borderRadius: 'var(--radius-sm)',
        background: 'var(--bg3)', marginBottom: 6,
        transition: 'var(--transition)', cursor: 'pointer',
        border: '1px solid transparent',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
      >
        <div style={{
          width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
          background: STATUS_COLORS[task.status]
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.title}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{task.project_name}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: PRIORITY_COLORS[task.priority]
          }} title={task.priority} />
          {task.due_date && (
            <span style={{ fontSize: 11, color: isOverdue ? 'var(--urgent)' : 'var(--text3)' }}>
              {isOverdue ? '⚠ ' : ''}{format(parseISO(task.due_date), 'MMM d')}
            </span>
          )}
          <span className={`badge badge-${task.status}`}>{STATUS_LABELS[task.status]}</span>
        </div>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard').then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="spinner" />
    </div>
  );

  const stats = data?.stats || {};
  const projects = data?.projects || [];
  const myTasks = data?.myTasks || [];
  const activity = data?.recentActivity || [];
  const statusBreakdown = data?.statusBreakdown || [];

  // Build status chart data
  const allStatuses = ['todo', 'in_progress', 'in_review', 'done'];
  const statusMap = Object.fromEntries(statusBreakdown.map(s => [s.status, parseInt(s.count)]));
  const totalTasks = allStatuses.reduce((sum, s) => sum + (statusMap[s] || 0), 0);

  return (
    <div style={{ padding: '32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em' }}>
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p style={{ color: 'var(--text2)', marginTop: 4, fontSize: 14 }}>
          {format(new Date(), "EEEE, MMMM d, yyyy")}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <StatCard label="Active Projects" value={stats.active_projects || 0} accent="var(--indigo)" />
        <StatCard label="My Open Tasks" value={stats.my_open_tasks || 0} accent="var(--in-progress)" />
        <StatCard label="Overdue Tasks" value={stats.overdue_tasks || 0} accent="var(--urgent)" sub="Needs attention" />
        <StatCard label="Total Projects" value={stats.total_projects || 0} accent="var(--done)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* My Tasks */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>My Tasks</h2>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>{myTasks.length} open</span>
          </div>
          {myTasks.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
              <p style={{ fontSize: 13, color: 'var(--text2)' }}>No tasks assigned to you</p>
            </div>
          ) : (
            <div style={{ maxHeight: 340, overflowY: 'auto' }}>
              {myTasks.map(task => <TaskRow key={task.id} task={task} />)}
            </div>
          )}
        </div>

        {/* Status breakdown */}
        <div className="card">
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>My Task Status</h2>
          {totalTasks === 0 ? (
            <div className="empty-state" style={{ padding: '30px 0' }}>
              <p style={{ fontSize: 13 }}>No tasks yet</p>
            </div>
          ) : (
            <div>
              {/* Segmented bar */}
              <div style={{ height: 12, borderRadius: 6, display: 'flex', overflow: 'hidden', marginBottom: 20, gap: 2 }}>
                {allStatuses.map(s => {
                  const pct = ((statusMap[s] || 0) / totalTasks) * 100;
                  if (!pct) return null;
                  return <div key={s} style={{ width: `${pct}%`, background: STATUS_COLORS[s], transition: 'width 0.5s ease' }} />;
                })}
              </div>
              {allStatuses.map(s => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS[s] }} />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{STATUS_LABELS[s]}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 80, height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${((statusMap[s] || 0) / totalTasks) * 100}%`, background: STATUS_COLORS[s], borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, minWidth: 20, textAlign: 'right' }}>{statusMap[s] || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Projects overview */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Projects</h2>
            <Link to="/projects" className="btn btn-ghost btn-sm">View all</Link>
          </div>
          {projects.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px 0' }}>
              <p style={{ fontSize: 13 }}>No projects yet</p>
            </div>
          ) : (
            projects.map(p => {
              const progress = p.total_tasks > 0 ? Math.round((p.done_tasks / p.total_tasks) * 100) : 0;
              return (
                <Link key={p.id} to={`/projects/${p.id}`} style={{ display: 'block', marginBottom: 12, textDecoration: 'none' }}>
                  <div style={{
                    padding: '12px 14px',
                    background: 'var(--bg3)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid transparent',
                    transition: 'var(--transition)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
                  >
                    <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {p.overdue_tasks > 0 && <span style={{ fontSize: 11, color: 'var(--urgent)' }}>⚠ {p.overdue_tasks}</span>}
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{p.done_tasks}/{p.total_tasks}</span>
                      </div>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5 }}>{progress}% complete</div>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {/* Recent activity */}
        <div className="card">
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Recent Activity</h2>
          {activity.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px 0' }}>
              <p style={{ fontSize: 13 }}>No activity yet</p>
            </div>
          ) : (
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {activity.map(a => (
                <div key={a.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div className="avatar avatar-sm" style={{ background: a.avatar_color || '#6366f1', flexShrink: 0 }}>
                    {a.user_name?.[0] || '?'}
                  </div>
                  <div>
                    <div style={{ fontSize: 12 }}>
                      <span style={{ fontWeight: 600 }}>{a.user_name}</span>
                      <span style={{ color: 'var(--text2)' }}> {a.action === 'task_created' ? 'created' : 'updated'} </span>
                      <span style={{ fontWeight: 500 }}>{a.task_title}</span>
                      {a.project_name && <span style={{ color: 'var(--text3)' }}> in {a.project_name}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
