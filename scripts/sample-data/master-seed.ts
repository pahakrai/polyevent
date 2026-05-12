/**
 * Master Migration Script — Runs migrations for all databases.
 * Sample data is now included in 0001_sample_data.sql migration files.
 *
 * Usage:
 *   npx tsx scripts/sample-data/master-seed.ts              # Run migrations for all services
 *   npx tsx scripts/sample-data/master-seed.ts --service=auth  # Run migration for specific service
 */

import { execSync } from 'child_process';

const SERVICES = ['auth', 'user', 'vendor', 'event', 'booking'] as const;
type Service = (typeof SERVICES)[number];

const SERVICE_PATHS: Record<Service, string> = {
  auth: 'apps/nestjs-services/auth-service',
  user: 'apps/nestjs-services/user-service',
  vendor: 'apps/nestjs-services/vendor-service',
  event: 'apps/nestjs-services/event-service',
  booking: 'apps/nestjs-services/booking-service',
};

function runMigration(service: Service): boolean {
  const svcPath = SERVICE_PATHS[service];
  console.log(`  Running migration for ${service}-service...`);

  try {
    execSync('npx drizzle-kit migrate --config=src/database/drizzle.config.ts', {
      cwd: `${process.cwd()}/${svcPath}`,
      stdio: 'inherit',
      env: { ...process.env, USE_NEON: 'false' },
    });
    console.log(`  ✓ ${service}-service migration complete`);
    return true;
  } catch (error) {
    console.error(`  ✗ ${service}-service migration failed:`, error instanceof Error ? error.message : error);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const serviceFilter = args.find(a => a.startsWith('--service='))?.split('=')[1] as Service | undefined;

  if (serviceFilter && !SERVICES.includes(serviceFilter)) {
    console.error(`Unknown service: ${serviceFilter}. Valid options: ${SERVICES.join(', ')}`);
    process.exit(1);
  }

  const toMigrate = serviceFilter ? [serviceFilter] : [...SERVICES];

  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║     Polydom — Database Migration Orchestrator        ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`\nTarget services: ${toMigrate.join(', ')}`);

  // Run migrations (includes schema + sample data via 0001_sample_data.sql)
  const migrationOrder: Service[] = ['auth', 'user', 'vendor', 'event', 'booking'];
  const ordered = migrationOrder.filter(s => toMigrate.includes(s));

  const results: Record<string, boolean> = {};
  for (const service of ordered) {
    results[service] = runMigration(service);
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('  Migration Summary');
  console.log(`${'='.repeat(60)}`);
  for (const [service, ok] of Object.entries(results)) {
    console.log(`  ${ok ? '✓' : '✗'} ${service}-service`);
  }

  const allOk = Object.values(results).every(Boolean);
  if (allOk) {
    console.log('\n  All migrations applied successfully!');
    console.log('\n  Sample data included in migrations:');
    console.log('    • 25 users (3 admins, 5 vendors, 17 regular users)');
    console.log('    • 8 vendors across MUSIC, ART, SPORTS, ACTIVITIES');
    console.log('    • 16 venues with varied capacities and amenities');
    console.log('    • 500+ time slots across all venues');
    console.log('    • 40 events (12 MUSIC, 8 ART, 10 SPORTS, 10 ACTIVITIES)');
    console.log('    • 20 bookings with payments');
    console.log('    • 500+ user activities for ML training');
    console.log('\n  Login credentials:');
    console.log('    Superadmin: pahakadmin@polydom.io / Three1288');
    console.log('    Admin:      admin@example.com      / admin123');
    console.log('    User:       user@example.com       / user123');
    console.log('    Vendor:     vendor@example.com     / vendor123');
  } else {
    console.error('\n  Some services failed. Check errors above.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
