const { Pool } = require('pg');
const { parse } = require('pg-connection-string');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const connectionString = process.env.DATABASE_URL;

async function main() {
  const email = 'test_user_stable@example.com';
  const password = 'Password123!';
  const username = 'test_stable_user';

  console.log('1. Signing up user via Supabase JS...');
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username }
    }
  });

  if (error) {
    console.log('Signup message:', error.message);
  } else {
    console.log('Signup succeeded. User ID:', data.user.id);
  }

  console.log('2. Connecting to DB to confirm email and create profile...');
  const sessionConnectionString = connectionString.replace(':6543/', ':5432/');
  const config = parse(sessionConnectionString);
  if (!connectionString.includes('localhost') && !connectionString.includes('127.0.0.1')) {
    config.ssl = { rejectUnauthorized: false };
  }

  const pool = new Pool(config);
  try {
    // Check if user exists in auth.users
    const userRes = await pool.query('SELECT id FROM auth.users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      console.error('User was not found in auth.users. Signup probably failed.');
      return;
    }
    const userId = userRes.rows[0].id;

    // Confirm email
    await pool.query('UPDATE auth.users SET email_confirmed_at = NOW(), confirmed_at = NOW() WHERE id = $1', [userId]);
    console.log('Email confirmed in DB!');

    // Create profile if not exists
    const profileRes = await pool.query('SELECT id FROM "Profile" WHERE "userId" = $1', [userId]);
    if (profileRes.rows.length === 0) {
      await pool.query(
        'INSERT INTO "Profile" (id, "userId", username, coins, xp, level, role, "createdAt", "updatedAt") VALUES ($1, $2, $3, 100, 0, 1, \'USER\', NOW(), NOW())',
        [userId, userId, username]
      );
      console.log('Profile created in public."Profile"!');
    } else {
      console.log('Profile already exists.');
    }
  } catch (err) {
    console.error('DB Error:', err);
  } finally {
    await pool.end();
  }
}

main();
