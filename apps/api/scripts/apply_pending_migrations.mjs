import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import mysql from '../node_modules/mysql2/promise.js';

import dotenv from 'dotenv';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required.');
  process.exit(1);
}

async function applyMigrations() {
  const connection = await mysql.createConnection({
    uri: DATABASE_URL,
    multipleStatements: true
  });
  console.log('Connected to MySQL database.');

  const [appliedRows] = await connection.query('SELECT migration_name FROM `_prisma_migrations`');
  const appliedNames = new Set(appliedRows.map(r => r.migration_name));

  // 1. Check 20261103000000_support_dummy_trip_members
  const mig1 = '20261103000000_support_dummy_trip_members';
  if (!appliedNames.has(mig1)) {
    const migPath = path.resolve('prisma/migrations', mig1, 'migration.sql');
    const sql = fs.readFileSync(migPath, 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');
    const id = crypto.randomUUID();
    const now = new Date();
    await connection.query(
      `INSERT INTO \`_prisma_migrations\` 
       (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) 
       VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)`,
      [id, checksum, now, mig1, now]
    );
    console.log(`Marked ${mig1} as applied in _prisma_migrations.`);
  }

  // 2. Apply 20261103180000_expense_deletion_ledger
  const mig2 = '20261103180000_expense_deletion_ledger';
  if (!appliedNames.has(mig2)) {
    const migPath = path.resolve('prisma/migrations', mig2, 'migration.sql');
    const sql = fs.readFileSync(migPath, 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');
    const startedAt = new Date();

    console.log(`Applying migration: ${mig2}...`);
    await connection.query(sql);
    const finishedAt = new Date();
    const id = crypto.randomUUID();

    await connection.query(
      `INSERT INTO \`_prisma_migrations\` 
       (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) 
       VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)`,
      [id, checksum, finishedAt, mig2, startedAt]
    );
    console.log(`Successfully applied and recorded migration: ${mig2}`);
  }

  // Verify
  const [paymentCols] = await connection.query("SHOW COLUMNS FROM `Payment` WHERE Field = 'isDeleted'");
  console.log('Verification: Payment.isDeleted ->', paymentCols);

  const [ledgerEnum] = await connection.query("SHOW COLUMNS FROM `LedgerEntry` WHERE Field = 'eventType'");
  console.log('Verification: LedgerEntry.eventType ->', ledgerEnum[0]?.Type);

  await connection.end();
  console.log('Migration process completed successfully.');
}

applyMigrations().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
