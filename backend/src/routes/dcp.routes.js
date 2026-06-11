// Data collection endpoints. Fine-grained access (who may enter vs review)
// is enforced inside the services; donor_viewer is blocked from all writes here.
const router = require('express').Router();
const ctrl = require('../controllers/dcp.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { upload } = require('../services/document.service');

router.use(authenticate);

const canWrite = requireRole('admin', 'mof_supervisor', 'gerpi_staff');
const canReview = requireRole('admin', 'mof_supervisor', 'ministry_officer');

// DCP-01: quarterly disbursement reports
router.get('/gerpi/:id/disbursements', ctrl.listDisbursements);
router.post('/gerpi/:id/disbursements', requireRole('admin', 'gerpi_staff'), ctrl.saveDisbursementDraft);
router.patch('/disbursements/:id/submit', requireRole('admin', 'gerpi_staff'), ctrl.submitDisbursement);
router.patch('/disbursements/:id/approve', canReview, ctrl.approveDisbursement);
router.patch('/disbursements/:id/reject', canReview, ctrl.rejectDisbursement);

// DCP-02: components
router.get('/gerpi/:id/components', ctrl.listComponents);
router.post('/gerpi/:id/components', canWrite, ctrl.createComponent);
router.patch('/components/:id', canWrite, ctrl.updateComponent);

// DCP-03: procurements
router.get('/gerpi/:id/procurements', ctrl.listProcurements);
router.post('/gerpi/:id/procurements', canWrite, ctrl.createProcurement);
router.patch('/procurements/:id', canWrite, ctrl.updateProcurement);

// DCP-04: documents
router.get('/gerpi/:id/documents', ctrl.listDocuments);
router.post('/gerpi/:id/documents', canWrite, upload.single('file'), ctrl.uploadDocument);
router.get('/documents/:id/download', ctrl.downloadDocument);

module.exports = router;
