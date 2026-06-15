import pg from 'pg'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

console.log('Testing connection to DATABASE_URL:', process.env.DATABASE_URL)

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL?.replace(':6543/', ':5432/'),
  connectionTimeoutMillis: 5000,
})

async function run() {
  try {
    const client = await pool.connect()
    console.log('Connected successfully!')
    const res = await client.query('SELECT NOW()')
    console.log('Query output:', res.rows[0])
    client.release()
  } catch (err) {
    console.error('Connection failed:', err)
  } finally {
    await pool.end()
  }
}

run()
