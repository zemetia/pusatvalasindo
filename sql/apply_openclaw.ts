import 'dotenv/config';
import { Client } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL not set in .env');

const OPENCLAW_PASSWORD = crypto.randomBytes(20).toString('hex');

async function run(client: Client, label: string, sql: string) {
  try {
    await client.query(sql);
    console.log(`  ✓ ${label}`);
    return true;
  } catch (e: any) {
    console.warn(`  ⚠ ${label} — ${e.message.split('\n')[0]}`);
    return false;
  }
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log('Connected.\n');

  const sqlPath = join(process.cwd(), 'sql', 'openclaw_setup.sql');
  const rawSql = readFileSync(sqlPath, 'utf-8');

  // Extract all CREATE OR REPLACE VIEW blocks (no semicolons inside them, safe split)
  const viewBlocks = rawSql.match(/CREATE OR REPLACE VIEW[\s\S]+?(?=;\s*(?:\r?\n){2,}|;\s*$)/g) ?? [];
  const viewStatements = viewBlocks.map((v) => v.trim() + ';');

  // ── 1. Create views ──────────────────────────────────────────────────────────
  console.log('=== Creating / replacing views ===');
  for (const stmt of viewStatements) {
    const name = stmt.match(/CREATE OR REPLACE VIEW\s+(\w+)/i)?.[1] ?? '???';
    await run(client, name, stmt);
  }

  // ── 2. Create user ───────────────────────────────────────────────────────────
  console.log('\n=== openclaw_reader user ===');
  const created = await run(
    client,
    'CREATE USER oc_pvi_reader',
    `CREATE USER oc_pvi_reader WITH PASSWORD '${OPENCLAW_PASSWORD}'`
  );
  if (!created) {
    // Try updating password if user already exists
    const updated = await run(
      client,
      'ALTER USER (update password)',
      `ALTER USER oc_pvi_reader WITH PASSWORD '${OPENCLAW_PASSWORD}'`
    );
    if (!updated) {
      console.log('  → Managed service does not allow custom roles.');
      console.log('  → Openclaw must use the main DATABASE_URL instead.');
    }
  }

  const dbName = new URL(DATABASE_URL!).pathname.replace('/', '');
  await run(client, `GRANT CONNECT ON DATABASE ${dbName}`, `GRANT CONNECT ON DATABASE "${dbName}" TO oc_pvi_reader`);
  await run(client, 'GRANT USAGE ON SCHEMA public', 'GRANT USAGE ON SCHEMA public TO oc_pvi_reader');

  // ── 3. Grant SELECT on all hv_ views ─────────────────────────────────────────
  console.log('\n=== Granting SELECT on views ===');
  const hvViews = [
    'hv_companies', 'hv_branches', 'hv_employees',
    'hv_attendance', 'hv_attendance_monthly',
    'hv_kpi_definitions', 'hv_kpi_logs', 'hv_kpi_monthly',
    'hv_revenue', 'hv_revenue_monthly',
    'hv_payroll_monthly',
    'hv_bank_accounts', 'hv_bank_balance_by_company', 'hv_bank_daily', 'hv_bank_mutations',
    'hv_currency_stock', 'hv_currency_stock_by_company',
    'hv_stock_daily', 'hv_bonus_tiers',
    'hv_company_stock_items',
    'hv_stockist_pockets', 'hv_stockist_balances', 'hv_stockist_stock_by_company',
    'hv_stockist_mutations', 'hv_stockist_daily_checks',
    'hv_kas_pockets', 'hv_kas_daily', 'hv_kas_balance_by_company',
    'hv_stockist_head_confirmations', 'hv_stockist_total_head_confirmations',
    'hv_kas_head_confirmations', 'hv_bank_head_confirmations', 'hv_finance_confirmed_daily',
  ];
  for (const v of hvViews) {
    await run(client, `GRANT SELECT ON ${v}`, `GRANT SELECT ON ${v} TO oc_pvi_reader`);
  }

  // ── 4. Revoke auth tables ────────────────────────────────────────────────────
  console.log('\n=== Revoking auth table access ===');
  for (const t of ['"user"', '"account"', '"session"', '"verification"']) {
    await run(client, `REVOKE ${t}`, `REVOKE ALL ON ${t} FROM oc_pvi_reader`);
  }

  await client.end();

  const dbUrl = new URL(DATABASE_URL!);
  const ocHost = dbUrl.host;
  const ocDb   = dbUrl.pathname.replace('/', '');
  console.log('\n════════════════════════════════════════════');
  console.log('  Openclaw connection string (if user was created):');
  console.log(`  postgresql://oc_pvi_reader:${OPENCLAW_PASSWORD}@${ocHost}/${ocDb}`);
  console.log('════════════════════════════════════════════');
  console.log('  Save the password — it will NOT be shown again.');
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
