const router = require('express').Router();
const ctrl = require('../controllers/analytics.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/dashboard', ctrl.dashboard);

module.exports = router;
