import { db } from './client';
import { events } from './schema';
import * as dotenv from 'dotenv';

dotenv.config();

async function seed() {
  console.log('Seeding event database...');

  // Clear existing data
  await db.delete(events);

  // Create sample events
  await db.insert(events).values([
    {
      vendorId: 'vendor-id-123', // Should match vendor ID from vendor service
      venueId: 'venue-id-123', // Should match venue ID from vendor service
      title: 'Jazz Night Live',
      description: 'An evening of smooth jazz with local artists',
      category: 'CONCERT',
      subCategory: 'Jazz',
      startTime: new Date('2024-12-15T20:00:00Z'),
      endTime: new Date('2024-12-15T23:00:00Z'),
      location: { venueName: 'Main Concert Hall', address: '123 Music Ave, Los Angeles, CA' },
      price: { general: 25.0, vip: 50.0, currency: 'USD' },
      maxAttendees: 200,
      currentBookings: 45,
      status: 'PUBLISHED',
      tags: ['jazz', 'live music', 'weekend'],
      images: ['jazz1.jpg', 'jazz2.jpg'],
      ageRestriction: 21,
      isRecurring: false,
    },
    {
      vendorId: 'vendor-id-123',
      venueId: 'venue-id-123',
      title: 'Rock Guitar Workshop',
      description: 'Learn rock guitar techniques from professional musicians',
      category: 'WORKSHOP',
      subCategory: 'Music Education',
      startTime: new Date('2024-12-20T18:00:00Z'),
      endTime: new Date('2024-12-20T21:00:00Z'),
      location: { venueName: 'Main Concert Hall', address: '123 Music Ave, Los Angeles, CA' },
      price: { general: 40.0, student: 30.0, currency: 'USD' },
      maxAttendees: 30,
      currentBookings: 15,
      status: 'PUBLISHED',
      tags: ['workshop', 'guitar', 'education'],
      images: ['workshop1.jpg'],
      ageRestriction: 16,
      isRecurring: true,
      recurringRule: 'WEEKLY',
    },
  ]);

  console.log('Event database seeded successfully!');
  console.log(`Created 2 sample events: Jazz Night Live and Rock Guitar Workshop`);
}

seed().catch((error) => {
  console.error('Error seeding event database:', error);
  process.exit(1);
});