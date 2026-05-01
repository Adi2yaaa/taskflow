const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { rows } = await pool.query(
      'SELECT id, name, email, avatar_color FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    next(err);
  }
};

// Check if user is project admin
const requireProjectAdmin = async (req, res, next) => {
  try {
    const projectId = req.params.projectId || req.body.projectId;
    const { rows } = await pool.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );

    if (!rows.length) {
      return res.status(403).json({ error: 'You are not a member of this project' });
    }

    if (rows[0].role !== 'admin') {
      // Also allow if user is project owner
      const { rows: projectRows } = await pool.query(
        'SELECT owner_id FROM projects WHERE id = $1',
        [projectId]
      );
      if (!projectRows.length || projectRows[0].owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Admin access required' });
      }
    }

    req.userProjectRole = rows[0].role;
    next();
  } catch (err) {
    next(err);
  }
};

// Check if user is project member (any role)
const requireProjectMember = async (req, res, next) => {
  try {
    const projectId = req.params.projectId || req.params.id || req.body.projectId;
    const { rows } = await pool.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );

    if (!rows.length) {
      return res.status(403).json({ error: 'Access denied: not a project member' });
    }

    req.userProjectRole = rows[0].role;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { authenticate, requireProjectAdmin, requireProjectMember };
