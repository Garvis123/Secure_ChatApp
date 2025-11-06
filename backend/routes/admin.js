import express from 'express';
import { param, query } from 'express-validator';
import {
  getDashboardStats,
  getAuditLogs,
  getAnomalies,
  getUserActivity,
  getSystemHealth
} from '../controllers/adminController.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

// Dashboard statistics
router.get('/dashboard/stats', getDashboardStats);

// Audit logs
router.get('/audit-logs',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('userId').optional().isMongoId(),
    query('activityType').optional().isString(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  validate,
  getAuditLogs
);

// Anomaly detection
router.get('/anomalies',
  [
    query('userId').optional().isMongoId(),
    query('severity').optional().isIn(['low', 'medium', 'high', 'critical']),
    query('limit').optional().isInt({ min: 1, max: 500 })
  ],
  validate,
  getAnomalies
);

// User activity
router.get('/users/:userId/activity',
  [param('userId').isMongoId()],
  validate,
  getUserActivity
);

// System health
router.get('/health', getSystemHealth);

export default router;

