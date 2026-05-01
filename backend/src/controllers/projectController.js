const { validationResult } = require('express-validator');
const { pool } = require('../config/database');

exports.createProject = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, description, deadline } = req.body;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `INSERT INTO projects (name, description, owner_id, deadline)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [name.trim(), description || null, req.user.id, deadline || null]
      );
      const project = rows[0];

      // Auto-add creator as admin
      await client.query(
        'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)',
        [project.id, req.user.id, 'admin']
      );

      await client.query('COMMIT');
      res.status(201).json({ project: { ...project, role: 'admin', member_count: 1 } });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
};

exports.getProjects = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, pm.role,
        (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) AS member_count,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) AS task_count,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done') AS completed_tasks,
        u.name AS owner_name
       FROM projects p
       JOIN project_members pm ON p.id = pm.project_id
       JOIN users u ON p.owner_id = u.id
       WHERE pm.user_id = $1
       ORDER BY p.updated_at DESC`,
      [req.user.id]
    );

    res.json({ projects: rows });
  } catch (err) {
    next(err);
  }
};

exports.getProject = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `SELECT p.*, pm.role, u.name AS owner_name
       FROM projects p
       JOIN project_members pm ON p.id = pm.project_id
       JOIN users u ON p.owner_id = u.id
       WHERE p.id = $1 AND pm.user_id = $2`,
      [id, req.user.id]
    );

    if (!rows.length) return res.status(404).json({ error: 'Project not found' });

    const project = rows[0];

    // Get members
    const { rows: members } = await pool.query(
      `SELECT u.id, u.name, u.email, u.avatar_color, pm.role, pm.joined_at
       FROM project_members pm
       JOIN users u ON pm.user_id = u.id
       WHERE pm.project_id = $1
       ORDER BY pm.role DESC, u.name`,
      [id]
    );

    // Task stats
    const { rows: stats } = await pool.query(
      `SELECT status, COUNT(*) as count FROM tasks WHERE project_id = $1 GROUP BY status`,
      [id]
    );

    res.json({ project, members, taskStats: stats });
  } catch (err) {
    next(err);
  }
};

exports.updateProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, status, deadline } = req.body;

    const { rows } = await pool.query(
      `UPDATE projects SET name = COALESCE($1, name), description = COALESCE($2, description),
       status = COALESCE($3, status), deadline = COALESCE($4, deadline), updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [name?.trim(), description, status, deadline, id]
    );

    if (!rows.length) return res.status(404).json({ error: 'Project not found' });
    res.json({ project: rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.deleteProject = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Only owner can delete
    const { rows } = await pool.query('SELECT owner_id FROM projects WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Project not found' });
    if (rows[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Only project owner can delete' });
    }

    await pool.query('DELETE FROM projects WHERE id = $1', [id]);
    res.json({ message: 'Project deleted' });
  } catch (err) {
    next(err);
  }
};

exports.addMember = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { userId, role = 'member' } = req.body;

    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Role must be admin or member' });
    }

    // Check user exists
    const { rows: userRows } = await pool.query('SELECT id, name, email, avatar_color FROM users WHERE id = $1', [userId]);
    if (!userRows.length) return res.status(404).json({ error: 'User not found' });

    // Check already member
    const existing = await pool.query(
      'SELECT id FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, userId]
    );
    if (existing.rows.length) return res.status(409).json({ error: 'User is already a member' });

    const { rows } = await pool.query(
      'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3) RETURNING *',
      [projectId, userId, role]
    );

    res.status(201).json({ member: { ...userRows[0], role: rows[0].role, joined_at: rows[0].joined_at } });
  } catch (err) {
    next(err);
  }
};

exports.updateMemberRole = async (req, res, next) => {
  try {
    const { projectId, userId } = req.params;
    const { role } = req.body;

    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Role must be admin or member' });
    }

    // Can't change own role
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    const { rows } = await pool.query(
      'UPDATE project_members SET role = $1 WHERE project_id = $2 AND user_id = $3 RETURNING *',
      [role, projectId, userId]
    );

    if (!rows.length) return res.status(404).json({ error: 'Member not found' });
    res.json({ message: 'Role updated', role });
  } catch (err) {
    next(err);
  }
};

exports.removeMember = async (req, res, next) => {
  try {
    const { projectId, userId } = req.params;

    // Can't remove project owner
    const { rows: proj } = await pool.query('SELECT owner_id FROM projects WHERE id = $1', [projectId]);
    if (proj[0]?.owner_id === parseInt(userId)) {
      return res.status(400).json({ error: 'Cannot remove project owner' });
    }

    await pool.query(
      'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, userId]
    );

    res.json({ message: 'Member removed' });
  } catch (err) {
    next(err);
  }
};
