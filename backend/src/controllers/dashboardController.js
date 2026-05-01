const { pool } = require('../config/database');

exports.getDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // My tasks across all projects
    const { rows: myTasks } = await pool.query(
      `SELECT t.*, p.name AS project_name, pm.role AS my_project_role,
        CASE WHEN t.due_date < NOW() AND t.status != 'done' THEN true ELSE false END AS is_overdue
       FROM tasks t
       JOIN projects p ON t.project_id = p.id
       JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $1
       WHERE t.assignee_id = $1 AND t.status != 'done'
       ORDER BY t.due_date ASC NULLS LAST
       LIMIT 20`,
      [userId]
    );

    // Project stats
    const { rows: projectStats } = await pool.query(
      `SELECT
        COUNT(DISTINCT p.id) AS total_projects,
        COUNT(DISTINCT CASE WHEN p.status = 'active' THEN p.id END) AS active_projects,
        COUNT(DISTINCT CASE WHEN t.assignee_id = $1 AND t.status != 'done' THEN t.id END) AS my_open_tasks,
        COUNT(DISTINCT CASE WHEN t.assignee_id = $1 AND t.due_date < NOW() AND t.status != 'done' THEN t.id END) AS overdue_tasks
       FROM projects p
       JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $1
       LEFT JOIN tasks t ON t.project_id = p.id`,
      [userId]
    );

    // Task status breakdown for my tasks
    const { rows: statusBreakdown } = await pool.query(
      `SELECT t.status, COUNT(*) AS count
       FROM tasks t
       JOIN project_members pm ON t.project_id = pm.project_id
       WHERE pm.user_id = $1 AND t.assignee_id = $1
       GROUP BY t.status`,
      [userId]
    );

    // Recent activity
    const { rows: activity } = await pool.query(
      `SELECT al.*, u.name AS user_name, u.avatar_color, p.name AS project_name, t.title AS task_title
       FROM activity_log al
       JOIN projects p ON al.project_id = p.id
       JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $1
       LEFT JOIN users u ON al.user_id = u.id
       LEFT JOIN tasks t ON al.task_id = t.id
       ORDER BY al.created_at DESC
       LIMIT 15`,
      [userId]
    );

    // Projects with progress
    const { rows: projects } = await pool.query(
      `SELECT p.id, p.name, p.status, p.deadline, pm.role,
        COUNT(t.id) AS total_tasks,
        COUNT(CASE WHEN t.status = 'done' THEN 1 END) AS done_tasks,
        COUNT(CASE WHEN t.due_date < NOW() AND t.status != 'done' THEN 1 END) AS overdue_tasks
       FROM projects p
       JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $1
       LEFT JOIN tasks t ON t.project_id = p.id
       GROUP BY p.id, pm.role
       ORDER BY p.updated_at DESC
       LIMIT 6`,
      [userId]
    );

    res.json({
      stats: projectStats[0],
      myTasks,
      statusBreakdown,
      recentActivity: activity,
      projects
    });
  } catch (err) {
    next(err);
  }
};
