const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const authController = require('../controllers/authController');
const projectController = require('../controllers/projectController');
const taskController = require('../controllers/taskController');
const dashboardController = require('../controllers/dashboardController');
const { authenticate, requireProjectAdmin, requireProjectMember } = require('../middleware/auth');

// ── Auth Routes ──────────────────────────────────────────────────────────────
router.post('/auth/signup', [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], authController.signup);

router.post('/auth/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], authController.login);

router.get('/auth/me', authenticate, authController.getMe);
router.patch('/auth/me', authenticate, authController.updateProfile);
router.get('/users/search', authenticate, authController.searchUsers);

// ── Dashboard ────────────────────────────────────────────────────────────────
router.get('/dashboard', authenticate, dashboardController.getDashboard);

// ── Project Routes ───────────────────────────────────────────────────────────
router.post('/projects', authenticate, [
  body('name').trim().isLength({ min: 1, max: 200 }).withMessage('Project name required'),
], projectController.createProject);

router.get('/projects', authenticate, projectController.getProjects);
router.get('/projects/:id', authenticate, projectController.getProject);

router.patch('/projects/:id', authenticate, (req, res, next) => {
  req.params.projectId = req.params.id;
  next();
}, requireProjectAdmin, projectController.updateProject);

router.delete('/projects/:id', authenticate, projectController.deleteProject);

// Member management (admin only)
router.post('/projects/:projectId/members', authenticate, requireProjectAdmin, projectController.addMember);
router.patch('/projects/:projectId/members/:userId', authenticate, requireProjectAdmin, projectController.updateMemberRole);
router.delete('/projects/:projectId/members/:userId', authenticate, requireProjectAdmin, projectController.removeMember);

// ── Task Routes ──────────────────────────────────────────────────────────────
router.post('/projects/:projectId/tasks', authenticate, requireProjectMember, [
  body('title').trim().isLength({ min: 1, max: 300 }).withMessage('Task title required'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
], taskController.createTask);

router.get('/projects/:projectId/tasks', authenticate, requireProjectMember, taskController.getTasks);

router.get('/projects/:projectId/tasks/:taskId', authenticate, requireProjectMember, taskController.getTask);

router.patch('/projects/:projectId/tasks/:taskId', authenticate, requireProjectMember, taskController.updateTask);

router.delete('/projects/:projectId/tasks/:taskId', authenticate, requireProjectMember, taskController.deleteTask);

router.post('/projects/:projectId/tasks/:taskId/comments', authenticate, requireProjectMember, taskController.addComment);

module.exports = router;
