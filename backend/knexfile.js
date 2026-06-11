require('dotenv').config();

module.exports = {
  client: 'pg',
  connection: process.env.DATABASE_URL || 'postgres://gerpi:gerpi_dev_2026@localhost:5432/gerpi_monitoring',
  pool: { min: 1, max: 10 },
  migrations: { directory: './migrations', tableName: 'knex_migrations' },
  seeds: { directory: './seeds' },
};
