/**
 * GERPI Monitoring — boshlang'ich sxema.
 * Barcha jadvalda: id (uuid, matn ko'rinishida — PG va SQLite mosligi uchun),
 * created_at, updated_at. Soft-delete: deleted_at.
 */

const withBase = (knex, t) => {
  t.string("id", 36).primary();
  t.timestamp("created_at").defaultTo(knex.fn.now());
  t.timestamp("updated_at").defaultTo(knex.fn.now());
  t.timestamp("deleted_at").nullable();
};

export async function up(knex) {
  await knex.schema.createTable("ministries", (t) => {
    withBase(knex, t);
    t.string("name_uz_latn").notNullable();
    t.string("name_uz_cyrl");
    t.string("name_ru");
    t.string("name_en");
    t.string("code").unique().notNullable();
  });

  await knex.schema.createTable("donors", (t) => {
    withBase(knex, t);
    t.string("name").notNullable();
    t.string("short_name").notNullable();
    t.string("logo_url");
    t.string("country");
  });

  await knex.schema.createTable("regions", (t) => {
    withBase(knex, t);
    t.string("name_uz_latn").notNullable();
    t.string("name_uz_cyrl");
    t.string("name_ru");
    t.string("name_en");
    t.string("geojson_id").unique();
    t.string("soato_code");
  });

  await knex.schema.createTable("gerpi_organizations", (t) => {
    withBase(knex, t);
    t.string("name_uz_latn").notNullable();
    t.string("name_uz_cyrl");
    t.string("name_ru");
    t.string("name_en");
    t.string("ministry_id", 36).references("id").inTable("ministries");
    t.string("donor_id", 36).references("id").inTable("donors");
    t.string("agreement_number");
    t.date("agreement_date");
    t.decimal("budget_total_usd", 14, 2).notNullable().defaultTo(0);
    t.integer("start_year");
    t.integer("end_year");
    t.date("closing_date");
    t.string("status").notNullable().defaultTo("tayyorgarlik"); // tayyorgarlik|faol|kechikayotgan|yakunlangan|toxtatilgan
    t.string("risk_level").notNullable().defaultTo("past"); // past|orta|yuqori — AVTOMATIK
    t.integer("risk_score").notNullable().defaultTo(0);
    t.string("director_name");
    t.string("director_phone");
    t.string("address");
    t.string("website");
  });

  await knex.schema.createTable("users", (t) => {
    withBase(knex, t);
    t.string("full_name").notNullable();
    t.string("email").unique().notNullable();
    t.string("phone");
    t.string("password_hash").notNullable();
    t.string("role").notNullable(); // admin|mof_supervisor|ministry_officer|gerpi_staff|donor_viewer
    t.string("gerpi_id", 36).references("id").inTable("gerpi_organizations");
    t.string("ministry_id", 36).references("id").inTable("ministries");
    t.string("donor_id", 36).references("id").inTable("donors");
    t.string("locale").notNullable().defaultTo("uz_latn");
    t.string("telegram_chat_id");
    t.boolean("is_active").notNullable().defaultTo(true);
  });

  await knex.schema.createTable("refresh_tokens", (t) => {
    t.string("id", 36).primary();
    t.string("user_id", 36).notNullable().references("id").inTable("users");
    t.string("token_hash").notNullable().index();
    t.timestamp("expires_at").notNullable();
    t.timestamp("revoked_at");
    t.timestamp("created_at").defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("gerpi_regions", (t) => {
    t.string("id", 36).primary();
    t.string("gerpi_id", 36).notNullable().references("id").inTable("gerpi_organizations");
    t.string("region_id", 36).notNullable().references("id").inTable("regions");
    t.unique(["gerpi_id", "region_id"]);
  });

  await knex.schema.createTable("components", (t) => {
    withBase(knex, t);
    t.string("gerpi_id", 36).notNullable().references("id").inTable("gerpi_organizations");
    t.string("name").notNullable();
    t.decimal("budget_usd", 14, 2).defaultTo(0);
    t.integer("progress_pct").notNullable().defaultTo(0);
    t.integer("planned_progress_pct").notNullable().defaultTo(0);
    t.date("start_date");
    t.date("end_date");
    t.string("responsible_person");
  });

  await knex.schema.createTable("disbursement_reports", (t) => {
    withBase(knex, t);
    t.string("gerpi_id", 36).notNullable().references("id").inTable("gerpi_organizations");
    t.integer("year").notNullable();
    t.integer("quarter").notNullable(); // 1-4
    t.decimal("disbursed_usd_cumulative", 14, 2).notNullable().defaultTo(0);
    t.decimal("disbursed_pct", 5, 2).notNullable().defaultTo(0);
    t.decimal("planned_pct", 5, 2).notNullable().defaultTo(0);
    t.decimal("commitment_usd", 14, 2).defaultTo(0);
    t.text("narrative");
    t.string("status").notNullable().defaultTo("qoralama"); // qoralama|topshirilgan|tasdiqlangan|qaytarilgan
    t.string("submitted_by", 36).references("id").inTable("users");
    t.timestamp("submitted_at");
    t.string("reviewed_by", 36).references("id").inTable("users");
    t.timestamp("reviewed_at");
    t.text("review_comment");
    t.unique(["gerpi_id", "year", "quarter"]);
  });

  await knex.schema.createTable("procurement_records", (t) => {
    withBase(knex, t);
    t.string("gerpi_id", 36).notNullable().references("id").inTable("gerpi_organizations");
    t.string("title").notNullable();
    t.string("method").notNullable().defaultTo("boshqa"); // ICB|NCB|shopping|direct|QCBS|boshqa
    t.decimal("estimated_usd", 14, 2).defaultTo(0);
    t.decimal("contract_usd", 14, 2);
    t.string("status").notNullable().defaultTo("rejalashtirilgan"); // rejalashtirilgan|elon_qilingan|baholashda|imzolangan|bekor_qilingan
    t.integer("cancel_count").notNullable().defaultTo(0);
    t.date("announced_date");
    t.date("contract_date");
    t.string("supplier");
  });

  await knex.schema.createTable("documents", (t) => {
    withBase(knex, t);
    t.string("gerpi_id", 36).notNullable().references("id").inTable("gerpi_organizations");
    t.string("type").notNullable().defaultTo("boshqa"); // choraklik_hisobot|yillik_reja|audit_hisoboti|donor_missiya|shartnoma|boshqa
    t.string("title").notNullable();
    t.string("file_path");
    t.integer("file_size");
    t.string("mime_type");
    t.integer("period_year");
    t.integer("period_quarter");
    t.string("uploaded_by", 36).references("id").inTable("users");
    t.date("due_date");
    t.boolean("has_findings").notNullable().defaultTo(false); // audit nomuvofiqligi belgisi (R5 qoida)
  });

  await knex.schema.createTable("alerts", (t) => {
    withBase(knex, t);
    t.string("gerpi_id", 36).notNullable().references("id").inTable("gerpi_organizations");
    t.string("severity").notNullable(); // yuqori|orta|past
    t.string("type").notNullable(); // ozlashtirish_past|hisobot_kechikkan|muddat_yaqin|xarid_muammo|audit_nomuvofiqlik|hujjat_kutilmoqda|eslatma
    t.string("title").notNullable();
    t.text("description");
    t.string("rule_code");
    t.boolean("is_resolved").notNullable().defaultTo(false);
    t.string("resolved_by", 36).references("id").inTable("users");
    t.timestamp("resolved_at");
    t.text("resolution_note");
  });

  await knex.schema.createTable("audit_log", (t) => {
    t.string("id", 36).primary();
    t.string("user_id", 36).references("id").inTable("users");
    t.string("action").notNullable(); // create|update|delete|login|approve|reject|export
    t.string("entity_type").notNullable();
    t.string("entity_id");
    t.json("old_value");
    t.json("new_value");
    t.string("ip_address");
    t.string("user_agent");
    t.timestamp("created_at").defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("kpi_snapshots", (t) => {
    withBase(knex, t);
    t.integer("year").notNullable();
    t.integer("quarter").notNullable();
    t.integer("total_gerpi").notNullable().defaultTo(0);
    t.integer("active_gerpi").notNullable().defaultTo(0);
    t.decimal("total_budget_usd", 16, 2).defaultTo(0);
    t.decimal("total_disbursed_usd", 16, 2).defaultTo(0);
    t.decimal("avg_disbursement_pct", 5, 2).defaultTo(0);
    t.integer("high_risk_count").defaultTo(0);
    t.json("snapshot_json");
    t.unique(["year", "quarter"]);
  });
}

export async function down(knex) {
  const tables = [
    "kpi_snapshots", "audit_log", "alerts", "documents", "procurement_records",
    "disbursement_reports", "components", "gerpi_regions", "refresh_tokens",
    "users", "gerpi_organizations", "regions", "donors", "ministries",
  ];
  for (const t of tables) await knex.schema.dropTableIfExists(t);
}
