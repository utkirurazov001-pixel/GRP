/**
 * GERPI Monitoring — initial schema.
 * All tables: uuid id, created_at, updated_at, soft-delete via deleted_at.
 * Enums are stored as text + CHECK constraints to keep migrations simple.
 */

const ROLES = ['admin', 'mof_supervisor', 'ministry_officer', 'gerpi_staff', 'donor_viewer'];
const GERPI_STATUSES = ['tayyorgarlik', 'faol', 'kechikayotgan', 'yakunlangan', 'toxtatilgan'];
const RISK_LEVELS = ['past', 'orta', 'yuqori'];
const REPORT_STATUSES = ['qoralama', 'topshirilgan', 'tasdiqlangan', 'qaytarilgan'];
const PROCUREMENT_METHODS = ['ICB', 'NCB', 'shopping', 'direct', 'QCBS', 'boshqa'];
const PROCUREMENT_STATUSES = ['rejalashtirilgan', 'elon_qilingan', 'baholashda', 'imzolangan', 'bekor_qilingan'];
const DOCUMENT_TYPES = ['choraklik_hisobot', 'yillik_reja', 'audit_hisoboti', 'donor_missiya', 'shartnoma', 'boshqa'];
const ALERT_SEVERITIES = ['yuqori', 'orta', 'past'];
const ALERT_TYPES = ['ozlashtirish_past', 'hisobot_kechikkan', 'muddat_yaqin', 'xarid_muammo', 'audit_nomuvofiqlik', 'hujjat_kutilmoqda', 'eslatma'];
const AUDIT_ACTIONS = ['create', 'update', 'delete', 'login', 'approve', 'reject', 'export'];

function base(t, knex) {
  t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
  t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  t.timestamp('deleted_at').nullable();
}

exports.up = async function (knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  await knex.schema.createTable('ministries', (t) => {
    base(t, knex);
    t.string('name_uz_latn').notNullable();
    t.string('name_uz_cyrl').notNullable();
    t.string('name_ru').notNullable();
    t.string('name_en').notNullable();
    t.string('code').notNullable().unique();
  });

  await knex.schema.createTable('donors', (t) => {
    base(t, knex);
    t.string('name').notNullable();
    t.string('short_name').notNullable();
    t.string('logo_url').nullable();
    t.string('country').nullable();
  });

  await knex.schema.createTable('regions', (t) => {
    base(t, knex);
    t.string('name_uz_latn').notNullable();
    t.string('name_uz_cyrl').notNullable();
    t.string('name_ru').notNullable();
    t.string('name_en').notNullable();
    t.string('geojson_id').nullable();
    t.string('soato_code').nullable();
  });

  await knex.schema.createTable('gerpi_organizations', (t) => {
    base(t, knex);
    t.string('name_uz_latn').notNullable();
    t.string('name_uz_cyrl').notNullable();
    t.string('name_ru').notNullable();
    t.string('name_en').notNullable();
    t.uuid('ministry_id').notNullable().references('id').inTable('ministries');
    t.uuid('donor_id').notNullable().references('id').inTable('donors');
    t.string('agreement_number').nullable();
    t.date('agreement_date').nullable();
    t.decimal('budget_total_usd', 14, 2).notNullable().defaultTo(0);
    t.integer('start_year').nullable();
    t.integer('end_year').nullable();
    t.date('closing_date').nullable();
    t.enu('status', GERPI_STATUSES, { useNative: false }).notNullable().defaultTo('tayyorgarlik');
    t.enu('risk_level', RISK_LEVELS, { useNative: false }).notNullable().defaultTo('past');
    t.string('director_name').nullable();
    t.string('director_phone').nullable();
    t.string('address').nullable();
    t.string('website').nullable();
    t.index(['ministry_id']);
    t.index(['donor_id']);
    t.index(['status']);
  });

  await knex.schema.createTable('users', (t) => {
    base(t, knex);
    t.string('full_name').notNullable();
    t.string('email').notNullable().unique();
    t.string('phone').nullable();
    t.string('password_hash').notNullable();
    t.enu('role', ROLES, { useNative: false }).notNullable();
    t.uuid('gerpi_id').nullable().references('id').inTable('gerpi_organizations');
    t.uuid('ministry_id').nullable().references('id').inTable('ministries');
    t.uuid('donor_id').nullable().references('id').inTable('donors');
    t.string('locale').notNullable().defaultTo('uz_latn');
    t.string('telegram_chat_id').nullable();
    t.boolean('is_active').notNullable().defaultTo(true);
  });

  await knex.schema.createTable('gerpi_regions', (t) => {
    base(t, knex);
    t.uuid('gerpi_id').notNullable().references('id').inTable('gerpi_organizations').onDelete('CASCADE');
    t.uuid('region_id').notNullable().references('id').inTable('regions').onDelete('CASCADE');
    t.unique(['gerpi_id', 'region_id']);
  });

  await knex.schema.createTable('components', (t) => {
    base(t, knex);
    t.uuid('gerpi_id').notNullable().references('id').inTable('gerpi_organizations').onDelete('CASCADE');
    t.string('name').notNullable();
    t.decimal('budget_usd', 14, 2).notNullable().defaultTo(0);
    t.integer('progress_pct').notNullable().defaultTo(0);
    t.integer('planned_progress_pct').notNullable().defaultTo(0);
    t.date('start_date').nullable();
    t.date('end_date').nullable();
    t.string('responsible_person').nullable();
    t.index(['gerpi_id']);
  });

  await knex.schema.createTable('disbursement_reports', (t) => {
    base(t, knex);
    t.uuid('gerpi_id').notNullable().references('id').inTable('gerpi_organizations').onDelete('CASCADE');
    t.integer('year').notNullable();
    t.integer('quarter').notNullable();
    t.decimal('disbursed_usd_cumulative', 14, 2).notNullable().defaultTo(0);
    t.decimal('disbursed_pct', 5, 2).notNullable().defaultTo(0);
    t.decimal('planned_pct', 5, 2).notNullable().defaultTo(0);
    t.decimal('commitment_usd', 14, 2).nullable();
    t.text('narrative').nullable();
    t.enu('status', REPORT_STATUSES, { useNative: false }).notNullable().defaultTo('qoralama');
    t.uuid('submitted_by').nullable().references('id').inTable('users');
    t.timestamp('submitted_at').nullable();
    t.uuid('reviewed_by').nullable().references('id').inTable('users');
    t.timestamp('reviewed_at').nullable();
    t.text('review_comment').nullable();
    t.unique(['gerpi_id', 'year', 'quarter']);
    t.index(['gerpi_id', 'status']);
  });

  await knex.schema.createTable('procurement_records', (t) => {
    base(t, knex);
    t.uuid('gerpi_id').notNullable().references('id').inTable('gerpi_organizations').onDelete('CASCADE');
    t.string('title').notNullable();
    t.enu('method', PROCUREMENT_METHODS, { useNative: false }).notNullable().defaultTo('boshqa');
    t.decimal('estimated_usd', 14, 2).notNullable().defaultTo(0);
    t.decimal('contract_usd', 14, 2).nullable();
    t.enu('status', PROCUREMENT_STATUSES, { useNative: false }).notNullable().defaultTo('rejalashtirilgan');
    t.integer('cancel_count').notNullable().defaultTo(0);
    t.date('announced_date').nullable();
    t.date('contract_date').nullable();
    t.string('supplier').nullable();
    t.index(['gerpi_id']);
  });

  await knex.schema.createTable('documents', (t) => {
    base(t, knex);
    t.uuid('gerpi_id').notNullable().references('id').inTable('gerpi_organizations').onDelete('CASCADE');
    t.enu('type', DOCUMENT_TYPES, { useNative: false }).notNullable().defaultTo('boshqa');
    t.string('title').notNullable();
    t.string('file_path').nullable();
    t.integer('file_size').nullable();
    t.string('mime_type').nullable();
    t.integer('period_year').nullable();
    t.integer('period_quarter').nullable();
    t.uuid('uploaded_by').nullable().references('id').inTable('users');
    t.date('due_date').nullable();
    t.index(['gerpi_id', 'type']);
  });

  await knex.schema.createTable('alerts', (t) => {
    base(t, knex);
    t.uuid('gerpi_id').notNullable().references('id').inTable('gerpi_organizations').onDelete('CASCADE');
    t.enu('severity', ALERT_SEVERITIES, { useNative: false }).notNullable();
    t.enu('type', ALERT_TYPES, { useNative: false }).notNullable().defaultTo('eslatma');
    t.string('title').notNullable();
    t.text('description').nullable();
    t.string('rule_code').nullable();
    t.boolean('is_resolved').notNullable().defaultTo(false);
    t.uuid('resolved_by').nullable().references('id').inTable('users');
    t.timestamp('resolved_at').nullable();
    t.text('resolution_note').nullable();
    t.index(['gerpi_id', 'is_resolved']);
    t.index(['severity']);
  });

  await knex.schema.createTable('audit_log', (t) => {
    base(t, knex);
    t.uuid('user_id').nullable().references('id').inTable('users');
    t.enu('action', AUDIT_ACTIONS, { useNative: false }).notNullable();
    t.string('entity_type').notNullable();
    t.string('entity_id').nullable();
    t.jsonb('old_value').nullable();
    t.jsonb('new_value').nullable();
    t.string('ip_address').nullable();
    t.string('user_agent').nullable();
    t.index(['entity_type', 'entity_id']);
    t.index(['user_id']);
  });

  await knex.schema.createTable('kpi_snapshots', (t) => {
    base(t, knex);
    t.integer('year').notNullable();
    t.integer('quarter').notNullable();
    t.integer('total_gerpi').notNullable().defaultTo(0);
    t.integer('active_gerpi').notNullable().defaultTo(0);
    t.decimal('total_budget_usd', 16, 2).notNullable().defaultTo(0);
    t.decimal('total_disbursed_usd', 16, 2).notNullable().defaultTo(0);
    t.decimal('avg_disbursement_pct', 5, 2).notNullable().defaultTo(0);
    t.integer('high_risk_count').notNullable().defaultTo(0);
    t.jsonb('snapshot_json').nullable();
    t.unique(['year', 'quarter']);
  });
};

exports.down = async function (knex) {
  const tables = [
    'kpi_snapshots', 'audit_log', 'alerts', 'documents', 'procurement_records',
    'disbursement_reports', 'components', 'gerpi_regions', 'users',
    'gerpi_organizations', 'regions', 'donors', 'ministries',
  ];
  for (const t of tables) await knex.schema.dropTableIfExists(t);
};
