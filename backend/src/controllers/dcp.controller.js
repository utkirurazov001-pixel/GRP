// Data Collection Point handlers: disbursement reports, components,
// procurements, documents.
const disb = require('../services/disbursement.service');
const comp = require('../services/component.service');
const proc = require('../services/procurement.service');
const docs = require('../services/document.service');
const { writeAudit } = require('../services/audit.service');
const { ok } = require('../utils/respond');

// ---------- Disbursement reports (DCP-01) ----------
async function listDisbursements(req, res, next) {
  try { ok(res, await disb.listByGerpi(req.user, req.params.id)); } catch (e) { next(e); }
}

async function saveDisbursementDraft(req, res, next) {
  try {
    const { row, old } = await disb.saveDraft(req.user, req.params.id, req.body || {});
    await writeAudit(req, {
      action: old ? 'update' : 'create', entityType: 'disbursement_report',
      entityId: row.id, oldValue: old, newValue: row,
    });
    ok(res, row, null, old ? 200 : 201);
  } catch (e) { next(e); }
}

async function submitDisbursement(req, res, next) {
  try {
    const { row, old } = await disb.submit(req.user, req.params.id);
    await writeAudit(req, { action: 'update', entityType: 'disbursement_report', entityId: row.id, oldValue: old, newValue: row });
    ok(res, row);
  } catch (e) { next(e); }
}

async function approveDisbursement(req, res, next) {
  try {
    const { row, old, alert } = await disb.approve(req.user, req.params.id);
    await writeAudit(req, { action: 'approve', entityType: 'disbursement_report', entityId: row.id, oldValue: old, newValue: row });
    ok(res, { report: row, alert });
  } catch (e) { next(e); }
}

async function rejectDisbursement(req, res, next) {
  try {
    const { row, old } = await disb.reject(req.user, req.params.id, (req.body || {}).comment);
    await writeAudit(req, { action: 'reject', entityType: 'disbursement_report', entityId: row.id, oldValue: old, newValue: row });
    ok(res, row);
  } catch (e) { next(e); }
}

// ---------- Components (DCP-02) ----------
async function listComponents(req, res, next) {
  try { ok(res, await comp.listByGerpi(req.user, req.params.id)); } catch (e) { next(e); }
}

async function createComponent(req, res, next) {
  try {
    const row = await comp.create(req.user, req.params.id, req.body || {});
    await writeAudit(req, { action: 'create', entityType: 'component', entityId: row.id, newValue: row });
    ok(res, row, null, 201);
  } catch (e) { next(e); }
}

async function updateComponent(req, res, next) {
  try {
    const { row, old } = await comp.update(req.user, req.params.id, req.body || {});
    await writeAudit(req, { action: 'update', entityType: 'component', entityId: row.id, oldValue: old, newValue: row });
    ok(res, row);
  } catch (e) { next(e); }
}

// ---------- Procurements (DCP-03) ----------
async function listProcurements(req, res, next) {
  try { ok(res, await proc.listByGerpi(req.user, req.params.id)); } catch (e) { next(e); }
}

async function createProcurement(req, res, next) {
  try {
    const row = await proc.create(req.user, req.params.id, req.body || {});
    await writeAudit(req, { action: 'create', entityType: 'procurement_record', entityId: row.id, newValue: row });
    ok(res, row, null, 201);
  } catch (e) { next(e); }
}

async function updateProcurement(req, res, next) {
  try {
    const { row, old, alert } = await proc.update(req.user, req.params.id, req.body || {});
    await writeAudit(req, { action: 'update', entityType: 'procurement_record', entityId: row.id, oldValue: old, newValue: row });
    ok(res, { procurement: row, alert });
  } catch (e) { next(e); }
}

// ---------- Documents (DCP-04) ----------
async function listDocuments(req, res, next) {
  try { ok(res, await docs.listByGerpi(req.user, req.params.id)); } catch (e) { next(e); }
}

async function uploadDocument(req, res, next) {
  try {
    const row = await docs.create(req.user, req.params.id, req.body || {}, req.file);
    await writeAudit(req, {
      action: 'create', entityType: 'document', entityId: row.id,
      newValue: { id: row.id, title: row.title, type: row.type, file_size: row.file_size },
    });
    ok(res, row, null, 201);
  } catch (e) { next(e); }
}

async function downloadDocument(req, res, next) {
  try {
    const { doc, abs } = await docs.getForDownload(req.user, req.params.id);
    await writeAudit(req, { action: 'export', entityType: 'document', entityId: doc.id });
    res.download(abs, doc.title.replace(/[^\w.\-Ѐ-ӿ ]+/g, '_') + (abs.match(/\.\w+$/) || [''])[0]);
  } catch (e) { next(e); }
}

module.exports = {
  listDisbursements, saveDisbursementDraft, submitDisbursement, approveDisbursement, rejectDisbursement,
  listComponents, createComponent, updateComponent,
  listProcurements, createProcurement, updateProcurement,
  listDocuments, uploadDocument, downloadDocument,
};
