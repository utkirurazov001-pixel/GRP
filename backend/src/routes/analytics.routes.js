const router = require('express').Router();
const ctrl = require('../controllers/analytics.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/dashboard', ctrl.dashboard);
router.get('/risk-matrix', ctrl.riskMatrix);
router.get('/trends', ctrl.trends);

module.exports = router;
