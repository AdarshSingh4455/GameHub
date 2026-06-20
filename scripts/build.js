const { execSync } = require('child_process');

console.log('--- BUILD START ---');

try {
  console.log('Generating Prisma Client...');
  execSync('npx prisma generate', { stdio: 'inherit' });
} catch (err) {
  console.error('Prisma generation failed:', err);
  process.exit(1);
}

// Only push schema to live DB on production deployments (Vercel)
if (process.env.VERCEL === '1') {
  console.log('Production Vercel environment detected. Synchronizing database schema via prisma db push...');
  try {
    // Run db push using the production DATABASE_URL environment variable
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
    console.log('Database schema synchronized successfully.');
  } catch (err) {
    console.error('Database schema synchronization failed:', err);
    process.exit(1);
  }
} else {
  console.log('Local development environment. Skipping prisma db push.');
}

try {
  console.log('Building Next.js application...');
  execSync('npx next build', { stdio: 'inherit' });
  console.log('--- BUILD SUCCESS ---');
} catch (err) {
  console.error('Next.js build failed:', err);
  process.exit(1);
}
