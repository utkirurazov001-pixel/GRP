const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const db = require('../db');
const { ApiError } = require('../utils/respond');
const { getOrg, canEnterData } = require('./disbursement.service');

// DCP-04: document archive. Local /uploads storage behind a small
// abstraction so it can later move to S3-compatible storage.

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};
const TYPES = ['choraklik_hisobot', 'yillik_reja', 'audit_hisoboti', 'donor_missiya', 'shartnoma', 'boshqa'];
const MAX_SIZE = 20 * 1024 * 1024;

const storage = {
  // returns the stored relative path
  save(buffer, ext) {
    const name = crypto.randomUUID() + ext;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), buffer);
    return name;
  },
  resolve(relPath) {
    const abs = path.join(UPLOAD_DIR, path.basename(relPath));
    return fs.existsSync(abs) ? abs : null;
  },
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter(req, file, cb) {
    if (!ALLOWED[file.mimetype]) {
      return cb(new ApiError(422, 'BAD_FILE_TYPE', 'Faqat PDF, DOCX, XLSX, JPG, PNG fayllar qabul qilinadi'));
    }
    cb(null, true);
  },
});

async function listByGerpi(user, gerpiId) {
  await getOrg(user, gerpiId);
  return db('documents as doc')
    .leftJoin('users as u', 'u.id', 'doc.uploaded_by')
    .where('doc.gerpi_id', gerpiId)
    .whereNull('doc.deleted_at')
    .orderBy('doc.created_at', 'desc')
    .select('doc.*', 'u.full_name as uploaded_by_name');
}

async function create(user, gerpiId, body, file) {
  const org = await getOrg(user, gerpiId);
  if (!canEnterData(user, org) && user.role !== 'mof_supervisor') {
    throw new ApiError(403, 'FORBIDDEN', 'Hujjat yuklash vakolati yo\'q');
  }
  if (!file) throw new ApiError(422, 'VALIDATION', 'Fayl biriktirilmagan');
  const type = TYPES.includes(body.type) ? body.type : 'boshqa';
  const title = String(body.title || file.originalname).trim().slice(0, 255);
  if (!title) throw new ApiError(422, 'VALIDATION', 'Hujjat nomi majburiy');

  const stored = storage.save(file.buffer, ALLOWED[file.mimetype]);
  const [row] = await db('documents').insert({
    gerpi_id: gerpiId,
    type,
    title,
    file_path: stored,
    file_size: file.size,
    mime_type: file.mimetype,
    period_year: body.period_year ? parseInt(body.period_year, 10) : null,
    period_quarter: body.period_quarter ? parseInt(body.period_quarter, 10) : null,
    uploaded_by: user.id,
    due_date: body.due_date || null,
  }).returning('*');
  return row;
}

async function getForDownload(user, id) {
  const doc = await db('documents').where({ id }).whereNull('deleted_at').first()
    .catch(() => null);
  if (!doc) throw new ApiError(404, 'NOT_FOUND', 'Hujjat topilmadi');
  await getOrg(user, doc.gerpi_id); // scope check
  const abs = storage.resolve(doc.file_path);
  if (!abs) throw new ApiError(404, 'FILE_MISSING', 'Fayl saqlovda topilmadi');
  return { doc, abs };
}

module.exports = { upload, listByGerpi, create, getForDownload };
