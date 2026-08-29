import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

// ── Table insertion order (respects foreign key dependencies) ──
const TABLE_ORDER = [
  'users',
  'products',
  'coupons',
  'hero_banners',
  'about_banner',
  'footer_columns',
  'site_content',
  'site_sections',
  'contact_messages',
  'newsletter_subscribers',
  'login_attempts',
  'email_otps',
  'webhook_events',
  'analytics_visitors',
  'analytics_sessions',
  'analytics_page_views',
  'customer_addresses',
  'otp_codes',
  'admin_logs',
  'orders',
  'product_images',
  'footer_links',
  'order_items',
  'reviews',
  'coupon_usages',
];

const TRUNCATE_ORDER = [...TABLE_ORDER].reverse();

const neonUrl = "postgresql://neondb_owner:npg_aikCM42gPleh@ep-aged-unit-adzixo2v-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require";
const supabaseUrl = process.env.DATABASE_URL;

if (!supabaseUrl) {
  console.error('ERROR: DATABASE_URL (Supabase) is not set in .env.');
  process.exit(1);
}

const neonPool = new Pool({ connectionString: neonUrl });
const supaPool = new Pool({ connectionString: supabaseUrl });

async function getNeonTables(pool) {
  const res = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  return res.rows.map(r => r.table_name);
}

async function getRowCount(pool, table) {
  const res = await pool.query(`SELECT COUNT(*) AS c FROM "${table}"`);
  return Number(res.rows[0].c);
}

async function getColumns(pool, table) {
  const res = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `, [table]);
  return res.rows.map(r => r.column_name);
}

async function getSequences(pool) {
  const res = await pool.query(`
    SELECT 
      t.relname AS table_name,
      a.attname AS column_name,
      pg_get_serial_sequence(t.relname, a.attname) AS seq_name
    FROM pg_class t
    JOIN pg_attribute a ON a.attrelid = t.oid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND pg_get_serial_sequence(t.relname, a.attname) IS NOT NULL
  `);
  return res.rows;
}

async function main() {
  console.log('=== Neon → Supabase Data Migration ===\n');

  console.log('[1/7] Testing connections...');
  await neonPool.query('SELECT 1');
  console.log('  ✅ Neon: connected');
  await supaPool.query('SELECT 1');
  console.log('  ✅ Supabase: connected');

  console.log('\n[2/7] Inspecting Neon database...');
  const neonTables = await getNeonTables(neonPool);
  console.log(`  Found ${neonTables.length} tables`);

  const neonCounts = {};
  for (const table of neonTables) {
    neonCounts[table] = await getRowCount(neonPool, table);
    console.log(`  ${table}: ${neonCounts[table]} rows`);
  }

  console.log('\n[3/7] Inspecting Supabase schema...');
  const supaTables = await getNeonTables(supaPool);
  
  const missingTables = neonTables.filter(t => !supaTables.includes(t));
  if (missingTables.length > 0) {
    console.log(`  ⚠️  Missing tables in Supabase: ${missingTables.join(', ')}`);
    for (const table of missingTables) {
      const colRes = await neonPool.query(`
        SELECT column_name, data_type, is_nullable, column_default,
               character_maximum_length, numeric_precision, numeric_scale
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [table]);

      if (colRes.rows.length === 0) continue;

      const colDefs = colRes.rows.map(col => {
        let def = `"${col.column_name}" ${col.data_type}`;
        if (col.character_maximum_length) def += `(${col.character_maximum_length})`;
        if (col.is_nullable === 'NO') def += ' NOT NULL';
        if (col.column_default) def += ` DEFAULT ${col.column_default}`;
        return def;
      });

      const ddl = `CREATE TABLE IF NOT EXISTS "${table}" (\n  ${colDefs.join(',\n  ')}\n)`;
      await supaPool.query(ddl);
      console.log(`  ✅ Created table: ${table}`);
      supaTables.push(table);
    }
  } else {
    console.log('  ✅ All tables present in Supabase');
  }

  console.log('\n[4/7] Clearing existing Supabase data...');
  const supaClient = await supaPool.connect();
  try {
    await supaClient.query('BEGIN');
    for (const table of TRUNCATE_ORDER) {
      if (supaTables.includes(table) || neonTables.includes(table)) {
        try {
          await supaClient.query(`ALTER TABLE "${table}" DISABLE TRIGGER ALL`);
        } catch (e) {}
      }
    }
    for (const table of TRUNCATE_ORDER) {
      if (supaTables.includes(table) || neonTables.includes(table)) {
        try {
          await supaClient.query(`DELETE FROM "${table}"`);
        } catch (e) {}
      }
    }
    await supaClient.query('COMMIT');
  } catch (e) {
    await supaClient.query('ROLLBACK');
    throw e;
  } finally {
    supaClient.release();
  }

  console.log('\n[5/7] Copying data from Neon to Supabase...');
  const copyClient = await supaPool.connect();
  let totalRows = 0;

  try {
    await copyClient.query('BEGIN');

    for (const table of TABLE_ORDER) {
      if (!neonTables.includes(table)) continue;
      if (neonCounts[table] === 0) continue;

      const neonCols = await getColumns(neonPool, table);
      const supaCols = await getColumns(supaPool, table);
      const commonCols = neonCols.filter(c => supaCols.includes(c));

      if (commonCols.length === 0) continue;

      const colList = commonCols.map(c => `"${c}"`).join(', ');
      const rows = (await neonPool.query(`SELECT ${colList} FROM "${table}"`)).rows;

      const BATCH_SIZE = 200;
      let inserted = 0;

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const placeholders = [];
        const values = [];
        let paramIdx = 1;

        for (const row of batch) {
          const rowPlaceholders = [];
          for (const col of commonCols) {
            rowPlaceholders.push(`$${paramIdx++}`);
            values.push(row[col] !== undefined ? row[col] : null);
          }
          placeholders.push(`(${rowPlaceholders.join(', ')})`);
        }

        const insertSql = `INSERT INTO "${table}" (${colList}) VALUES ${placeholders.join(', ')}`;
        await copyClient.query(insertSql, values);
        inserted += batch.length;
      }
      console.log(`  ✅ ${table}: ${inserted} rows copied`);
      totalRows += inserted;
    }

    for (const table of TABLE_ORDER) {
      try {
        await copyClient.query(`ALTER TABLE "${table}" ENABLE TRIGGER ALL`);
      } catch (e) {}
    }

    await copyClient.query('COMMIT');
    console.log(`\n  📊 Total rows copied: ${totalRows}`);
  } catch (e) {
    await copyClient.query('ROLLBACK');
    for (const table of TABLE_ORDER) {
      try { await supaPool.query(`ALTER TABLE "${table}" ENABLE TRIGGER ALL`); } catch (_) {}
    }
    throw e;
  } finally {
    copyClient.release();
  }

  console.log('\n[6/7] Resetting sequences in Supabase...');
  try {
    const sequences = await getSequences(supaPool);
    for (const seq of sequences) {
      try {
        const maxRes = await supaPool.query(`SELECT COALESCE(MAX("${seq.column_name}"), 0) AS max_val FROM "${seq.table_name}"`);
        const maxVal = Number(maxRes.rows[0].max_val);
        if (maxVal > 0) {
          await supaPool.query(`SELECT setval('${seq.seq_name}', $1)`, [maxVal]);
        }
      } catch (e) {}
    }
    console.log('  ✅ Sequences synced');
  } catch (e) {}

  console.log('\n[7/7] Verifying row counts...\n');
  console.log('  Table                        | Neon    | Supabase | Match');
  console.log('  -----------------------------|---------|----------|------');

  let allMatch = true;
  for (const table of neonTables) {
    const neonCount = neonCounts[table];
    let supaCount;
    try {
      supaCount = await getRowCount(supaPool, table);
    } catch (e) {
      supaCount = 'ERR';
    }
    const match = neonCount === supaCount ? '✅' : '❌';
    if (neonCount !== supaCount) allMatch = false;
    const tName = table.padEnd(29);
    const nC = String(neonCount).padStart(7);
    const sC = String(supaCount).padStart(8);
    console.log(`  ${tName}| ${nC} | ${sC} | ${match}`);
  }

  console.log('\n' + (allMatch ? '🎉 ALL TABLES MATCH — Migration successful!' : '⚠️  SOME TABLES HAVE MISMATCHES'));

  await neonPool.end();
  await supaPool.end();
  process.exit(allMatch ? 0 : 1);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
