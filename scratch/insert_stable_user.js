const { Pool } = require('pg');
const { parse } = require('pg-connection-string');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not defined');
    return;
  }
  const sessionConnectionString = connectionString.replace(':6543/', ':5432/');
  const config = parse(sessionConnectionString);
  if (!connectionString.includes('localhost') && !connectionString.includes('127.0.0.1')) {
    config.ssl = { rejectUnauthorized: false };
  }

  const pool = new Pool(config);
  try {
    const email = 'test_user_stable@example.com';
    const passwordHash = '$2a$10$wE99qIfevV87s1l3tQ9bOu17Lz3tFz2bZ27h8g36U64V1Rz96v5yC'; // bcrypt hash for Password123!
    const username = 'test_stable_user';
    const userId = 'c25a77ef-03ff-4ef0-96be-67ff5dc36388';

    // Delete existing stable user if any, to avoid conflicts
    console.log('Cleaning existing stable user rows if any...');
    await pool.query('DELETE FROM "Profile" WHERE username = $1 OR "userId" = $2', [username, userId]);
    await pool.query('DELETE FROM auth.users WHERE email = $1 OR id = $2', [email, userId]);

    // Insert into auth.users
    console.log('Inserting user into auth.users...');
    await pool.query(`
      INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        created_at,
        updated_at,
        is_anonymous
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        $1,
        'authenticated',
        'authenticated',
        $2,
        $3,
        NOW(),
        '{"provider":"email","providers":["email"]}',
        '{"username":"test_stable_user"}',
        FALSE,
        NOW(),
        NOW(),
        FALSE
      );
    `, [userId, email, passwordHash]);
    console.log('User inserted into auth.users!');

    // Insert into public.Profile
    console.log('Inserting profile into public.Profile...');
    await pool.query(`
      INSERT INTO "Profile" (
        id,
        "userId",
        username,
        coins,
        xp,
        level,
        role,
        "createdAt",
        "updatedAt"
      ) VALUES (
        $1,
        $2,
        $3,
        100,
        0,
        1,
        'USER',
        NOW(),
        NOW()
      );
    `, [userId, userId, username]);
    console.log('Profile created in public."Profile"!');

    console.log('Stable test user successfully configured!');
  } catch (err) {
    console.error('Error during setup:', err);
  } finally {
    await pool.end();
  }
}

main();
