/**
 * Admin user migration — upserts the pahakadmin user.
 * Run: npx tsx src/database/migrate-admin.ts
 */
import { upsertAdminUser } from './seed';

async function main() {
  console.log('Running admin user migration...');
  await upsertAdminUser('pahakadmin@polydom.io', 'Three1288', 'Pahak', 'Admin');
  console.log('Admin migration complete.');
}

main().catch((error) => {
  console.error('Admin migration failed:', error);
  process.exit(1);
});
