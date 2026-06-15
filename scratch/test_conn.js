const { Pool } = require('pg');
const { parse } = require('pg-connection-string');

async function tryConnect(connStr, label) {
  console.log(`Trying ${label}...`);
  const config = parse(connStr);
  config.ssl = { rejectUnauthorized: false };
  config.connectionTimeoutMillis = 5000;
  const pool = new Pool(config);
  try {
    const res = await pool.query('SELECT NOW()');
    console.log(`✅ Success ${label}:`, res.rows[0]);
    return true;
  } catch (err) {
    console.error(`❌ Failed ${label}:`, err.message);
    return false;
  } finally {
    await pool.end();
  }
}

async function main() {
  const directStr = "postgresql://postgres:Gamehub%404455@db.uuzhepbedmyvtztnbfiu.supabase.co:5432/postgres";
  const poolerStr = "postgresql://postgres.uuzhepbedmyvtztnbfiu:Gamehub%404455@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres";
  
  await tryConnect(directStr, "Direct (5432)");
  await tryConnect(poolerStr, "Pooler (6543)");
}

main();
