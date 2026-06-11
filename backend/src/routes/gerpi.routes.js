const router = require('express').Router();
const ctrl = require('../controllers/gerpi.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

router.use(authenticate);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.get('/:id/history', ctrl.history);
router.post('/', requireRole('admin', 'mof_supervisor'), ctrl.create);
router.patch('/:id', requireRole('admin', 'mof_supervisor'), ctrl.update);
router.delete('/:id', requireRole('admin'), ctrl.remove);

module.exports = router;
