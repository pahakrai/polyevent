import { db } from './client';
import { notificationTemplates, notificationPreferences } from './schema';
import { eq } from 'drizzle-orm';

export async function seed() {
  console.log('Seeding notification-service...');

  // Default templates
  const templates = [
    {
      name: 'welcome',
      channel: 'EMAIL' as const,
      subject: 'Welcome to Polydom!',
      body: 'Hi {{firstName}}, welcome to Polydom! Discover local music events near you.',
      variables: ['firstName'],
    },
    {
      name: 'booking_confirmation',
      channel: 'EMAIL' as const,
      subject: 'Booking Confirmed — {{eventTitle}}',
      body: 'Your booking for {{eventTitle}} on {{eventDate}} at {{venueName}} is confirmed.\n\nTickets: {{ticketCount}}\nTotal: {{totalAmount}} {{currency}}',
      variables: ['eventTitle', 'eventDate', 'venueName', 'ticketCount', 'totalAmount', 'currency'],
    },
    {
      name: 'event_reminder',
      channel: 'PUSH' as const,
      subject: 'Event Reminder',
      body: '{{eventTitle}} starts in {{hoursUntil}} hours at {{venueName}}!',
      variables: ['eventTitle', 'hoursUntil', 'venueName'],
    },
  ];

  for (const template of templates) {
    const existing = await db
      .select()
      .from(notificationTemplates)
      .where(eq(notificationTemplates.name, template.name))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(notificationTemplates).values(template);
      console.log(`  Created template: ${template.name}`);
    }
  }

  // Default preferences for system user
  const existing = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, 'system'))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(notificationPreferences).values({
      userId: 'system',
      emailEnabled: true,
      smsEnabled: false,
      pushEnabled: true,
      inAppEnabled: true,
      marketingEmails: false,
    });
    console.log('  Created default preferences for system user');
  }

  console.log('notification-service seeding complete.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
