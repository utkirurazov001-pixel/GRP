// Reference data for filters and forms (ministries / donors / regions).
const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { ok } = require('../utils/respond');

router.use(authenticate);

router.get('/ministries', async (req, res, next) => {
  try {
    ok(res, await db('ministries').whereNull('deleted_at').orderBy('name_uz_latn')
      .select('id', 'name_uz_latn', 'name_uz_cyrl', 'name_ru', 'name_en', 'code'));
  } catch (err) { next(err); }
});

router.get('/donors', async (req, res, next) => {
  try {
    ok(res, await db('donors').whereNull('deleted_at').orderBy('short_name')
      .select('id', 'name', 'short_name', 'country'));
  } catch (err) { next(err); }
});

router.get('/regions', async (req, res, next) => {
  try {
    ok(res, await db('regions').whereNull('deleted_at').orderBy('name_uz_latn')
      .select('id', 'name_uz_latn', 'name_uz_cyrl', 'name_ru', 'name_en', 'geojson_id', 'soato_code'));
  } catch (err) { next(err); }
});

module.exports = router;
