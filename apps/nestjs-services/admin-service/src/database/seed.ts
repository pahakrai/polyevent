import { db } from './client';
import { featureFlags, systemConfig } from './schema';
import { eq } from 'drizzle-orm';

export async function seed() {
  console.log('Seeding admin-service...');

  const flags = [
    { key: 'enable_social_features', name: 'Social Features', description: 'Enable musician profiles, jam sessions, group hubs', enabled: true },
    { key: 'enable_ai_recommendations', name: 'AI Recommendations', description: 'Enable ML-powered event recommendations', enabled: false },
    { key: 'maintenance_mode', name: 'Maintenance Mode', description: 'Block all non-admin access', enabled: false },
  ];

  for (const flag of flags) {
    const [existing] = await db.select().from(featureFlags).where(eq(featureFlags.key, flag.key)).limit(1);
    if (!existing) {
      await db.insert(featureFlags).values(flag);
      console.log(`  Created flag: ${flag.key}`);
    }
  }

  const configs = [
    { key: 'platform.default_currency', value: 'EUR', description: 'Default currency for the platform' },
    { key: 'platform.items_per_page', value: 20, description: 'Default pagination limit' },
  ];

  for (const cfg of configs) {
    const [existing] = await db.select().from(systemConfig).where(eq(systemConfig.key, cfg.key)).limit(1);
    if (!existing) {
      await db.insert(systemConfig).values(cfg);
      console.log(`  Created config: ${cfg.key}`);
    }
  }

  console.log('admin-service seeding complete.');
}

seed().catch((err) => { console.error('Seed failed:', err); process.exit(1); });
