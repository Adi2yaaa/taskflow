const { validationResult } = require('express-validator');
const { pool } = require('../config/database');

exports.createTask = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { title, description, priority, assigneeId, dueDate, tags } = req.body;
    const { projectId } = req.params;

    // Validate assignee is a project member
    if (assigneeId) {
      const { rows } = await pool.query(
        'SELECT id FROM project_members WHERE project_id = $1 AND user_id = $2',
        [projectId, assigneeId]
      );
      if (!rows.length) return res.status(400).json({ error: 'Assignee must be a project member' });
    }

    const { rows } = await pool.query(
      `INSERT INTO tasks (title, description, priority, project_id, assignee_id, created_by, due_date, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [title.trim(), description || null, priority || 'medium', projectId,
       assigneeId || null, req.user.id, dueDate || null, tags || []]
    );

    const task = rows[0];

    // Enrich with user info
    const enriched = await getEnrichedTask(task.id);

    // Log activity
    await pool.query(
      `INSERT INTO activity_log (user_id, project_id, task_id, action, metadata)
       VALUES ($1, $2, $3, 'task_created', $4)`,
      [req.user.id, projectId, task.id, JSON.stringify({ title: task.title })]
    );

    // Update project timestamp
    await pool.query('UPDATE projects SET updated_at = NOW() WHERE id = $1', [projectId]);

    res.status(201).json({ task: enriched });
  } catch (err) {
    next(err);
  }
};

exports.getTasks = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { status, priority, assigneeId, search, sortBy = 'created_at', order = 'desc' } = req.query;

    let query = `
      SELECT t.*,
        u_assignee.name AS assignee_name, u_assignee.email AS assignee_email, u_assignee.avatar_color AS assignee_avatar,
        u_creator.name AS creator_name,
        CASE WHEN t.due_date < NOW() AND t.status != 'done' THEN true ELSE false END AS is_overdue
      FROM tasks t
      LEFT JOIN users u_assignee ON t.assignee_id = u_assignee.id
      LEFT JOIN users u_creator ON t.created_by = u_creator.id
      WHERE t.project_id = $1
    `;

    const params = [projectId];
    let paramIdx = 2;

    if (status) {
      query += ` AND t.status = $${paramIdx++}`;
      params.push(status);
    }
    if (priority) {
      query += ` AND t.priority = $${paramIdx++}`;
      params.push(priority);
    }
    if (assigneeId) {
      query += ` AND t.assignee_id = $${paramIdx++}`;
      params.push(assigneeId);
    }
    if (search) {
      query += ` AND (t.title ILIKE $${paramIdx} OR t.description ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    const validSorts = ['created_at', 'due_date', 'priority', 'title', 'updated_at'];
    const sortCol = validSorts.includes(sortBy) ? sortBy : 'created_at';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY t.${sortCol} ${sortOrder}`;

    const { rows } = await pool.query(query, params);
    res.json({ tasks: rows });
  } catch (err) {
    next(err);
  }
};

exports.getTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const task = await getEnrichedTask(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Get comments
    const { rows: comments } = await pool.query(
      `SELECT tc.*, u.name, u.avatar_color FROM task_comments tc
       JOIN users u ON tc.user_id = u.id
       WHERE tc.task_id = $1 ORDER BY tc.created_at`,
      [taskId]
    );

    res.json({ task, comments });
  } catch (err) {
    next(err);
  }
};

exports.updateTask = async (req, res, next) => {
  try {
    const { taskId, projectId } = req.params;
    const { title, description, status, priority, assigneeId, dueDate, tags } = req.body;

    // Members can only update status/assignee; admins can update everything
    const isAdmin = req.userProjectRole === 'admin';

    let updateQuery, updateParams;
    if (isAdmin) {
      const { rows } = await pool.query(
        `UPDATE tasks SET
          title = COALESCE($1, title),
          description = COALESCE($2, description),
          status = COALESCE($3, status),
          priority = COALESCE($4, priority),
          assignee_id = CASE WHEN $5::int IS NOT NULL THEN $5::int ELSE assignee_id END,
          due_date = CASE WHEN $6::date IS NOT NULL THEN $6::date ELSE due_date END,
          tags = COALESCE($7, tags),
          updated_at = NOW()
         WHERE id = $8 AND project_id = $9
         RETURNING *`,
        [title?.trim(), description, status, priority, assigneeId || null, dueDate || null, tags, taskId, projectId]
      );
      if (!rows.length) return res.status(404).json({ error: 'Task not found' });
    } else {
      // Members can only update status
      if (!status) return res.status(403).json({ error: 'Members can only update task status' });
      const { rows } = await pool.query(
        'UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2 AND project_id = $3 RETURNING *',
        [status, taskId, projectId]
      );
      if (!rows.length) return res.status(404).json({ error: 'Task not found' });
    }

    // Log status change
    if (status) {
      await pool.query(
        `INSERT INTO activity_log (user_id, project_id, task_id, action, metadata)
         VALUES ($1, $2, $3, 'status_changed', $4)`,
        [req.user.id, projectId, taskId, JSON.stringify({ status })]
      );
    }

    await pool.query('UPDATE projects SET updated_at = NOW() WHERE id = $1', [projectId]);
    const enriched = await getEnrichedTask(taskId);
    res.json({ task: enriched });
  } catch (err) {
    next(err);
  }
};

exports.deleteTask = async (req, res, next) => {
  try {
    const { taskId, projectId } = req.params;

    if (req.userProjectRole !== 'admin') {
      // Task creator can also delete
      const { rows } = await pool.query('SELECT created_by FROM tasks WHERE id = $1', [taskId]);
      if (!rows.length || rows[0].created_by !== req.user.id) {
        return res.status(403).json({ error: 'Only admins or task creators can delete tasks' });
      }
    }

    await pool.query('DELETE FROM tasks WHERE id = $1 AND project_id = $2', [taskId, projectId]);
    res.json({ message: 'Task deleted' });
  } catch (err) {
    next(err);
  }
};

exports.addComment = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { content } = req.body;

    if (!content?.trim()) return res.status(400).json({ error: 'Comment cannot be empty' });

    const { rows } = await pool.query(
      `INSERT INTO task_comments (task_id, user_id, content) VALUES ($1, $2, $3)
       RETURNING *, (SELECT name FROM users WHERE id = $2) AS name,
       (SELECT avatar_color FROM users WHERE id = $2) AS avatar_color`,
      [taskId, req.user.id, content.trim()]
    );

    res.status(201).json({ comment: rows[0] });
  } catch (err) {
    next(err);
  }
};

async function getEnrichedTask(taskId) {
  const { rows } = await pool.query(
    `SELECT t.*,
      u_assignee.name AS assignee_name, u_assignee.email AS assignee_email, u_assignee.avatar_color AS assignee_avatar,
      u_creator.name AS creator_name,
      CASE WHEN t.due_date < NOW() AND t.status != 'done' THEN true ELSE false END AS is_overdue
     FROM tasks t
     LEFT JOIN users u_assignee ON t.assignee_id = u_assignee.id
     LEFT JOIN users u_creator ON t.created_by = u_creator.id
     WHERE t.id = $1`,
    [taskId]
  );
  return rows[0] || null;
}
