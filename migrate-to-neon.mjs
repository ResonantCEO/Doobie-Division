import pg from 'pg';
import { readFileSync } from 'fs';

const { Pool } = pg;
const data = JSON.parse(readFileSync('/tmp/prod-data.json', 'utf8'));

const neonUrl = process.env.NEON_DATABASE_URL;
if (!neonUrl) { console.error('NEON_DATABASE_URL not set'); process.exit(1); }

const pool = new Pool({ connectionString: neonUrl, ssl: { rejectUnauthorized: false } });

function val(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function insertRows(client, table, rows) {
  if (!rows || rows.length === 0) { console.log(`  ${table}: empty`); return; }
  const keys = Object.keys(rows[0]);
  const cols = keys.map(k => `"${k}"`).join(', ');
  let ok = 0;
  for (const row of rows) {
    const values = keys.map(k => val(row[k])).join(', ');
    try {
      await client.query(`INSERT INTO "${table}" (${cols}) VALUES (${values}) ON CONFLICT DO NOTHING`);
      ok++;
    } catch (e) {
      console.error(`  ERROR ${table}: ${e.message.slice(0,120)}`);
    }
  }
  console.log(`  ${table}: ${ok}/${rows.length}`);
}

async function run() {
  const client = await pool.connect();
  try {
    console.log('Connected to Neon\n--- Clearing existing data ---');
    const deleteOrder = [
      'user_activity_logs','support_ticket_responses','support_tickets',
      'notifications','promo_code_uses','order_items','orders','inventory_logs',
      'product_quantity_pricing','product_sizes','products','categories',
      'city_purchase_limits','discounts','price_templates','promotional_ads',
      'promo_codes','password_reset_tokens','sessions','users','access_passwords',
    ];
    for (const t of deleteOrder) {
      try { const r = await client.query(`DELETE FROM "${t}"`); console.log(`  ${t}: ${r.rowCount} deleted`); }
      catch (e) { console.error(`  skip ${t}: ${e.message.slice(0,80)}`); }
    }

    console.log('\n--- Inserting production data ---');
    await insertRows(client, 'access_passwords', data.access_passwords);
    await insertRows(client, 'users', data.users);
    await insertRows(client, 'categories', data.categories);
    await insertRows(client, 'products', data.products);
    await insertRows(client, 'product_sizes', data.product_sizes);
    await insertRows(client, 'product_quantity_pricing', data.product_quantity_pricing);
    await insertRows(client, 'inventory_logs', data.inventory_logs);
    await insertRows(client, 'notifications', data.notifications);
    await insertRows(client, 'city_purchase_limits', data.city_purchase_limits);
    await insertRows(client, 'price_templates', data.price_templates);
    await insertRows(client, 'user_activity_logs', data.user_activity_logs);

    console.log('\n--- Final counts ---');
    for (const t of ['users','products','categories','product_sizes','notifications','city_purchase_limits','price_templates','user_activity_logs']) {
      const r = await client.query(`SELECT COUNT(*) FROM "${t}"`);
      console.log(`  ${t}: ${r.rows[0].count}`);
    }
    console.log('\nDone!');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error('Failed:', e.message); process.exit(1); });
