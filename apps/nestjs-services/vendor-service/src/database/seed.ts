import { db } from './client';
import { vendors, venues } from './schema';
import * as dotenv from 'dotenv';

dotenv.config();

async function seed() {
  console.log('Seeding vendor database...');

  // Clear existing data
  await db.delete(venues);
  await db.delete(vendors);

  // Create a vendor
  const [vendor] = await db.insert(vendors).values({
    userId: 'vendor-user-id-123', // This should match a user ID from auth service
    businessName: 'LA Music Hall',
    description: 'Premier music venue in Los Angeles',
    category: 'MUSIC',
    contactEmail: 'info@lamusichall.com',
    contactPhone: '+1-555-123-4567',
    website: 'https://lamusichall.com',
    address: { street: '123 Music Ave', city: 'Los Angeles', state: 'CA', zip: '90001' },
    location: { type: 'Point', coordinates: [-118.2437, 34.0522] },
    verificationStatus: 'VERIFIED',
    rating: 4.8,
    totalReviews: 125,
    isActive: true,
  }).returning();

  // Create a venue for the vendor
  await db.insert(venues).values({
    vendorId: vendor.id,
    name: 'Main Concert Hall',
    description: 'Spacious concert hall with excellent acoustics',
    type: 'INDOOR',
    capacity: 500,
    address: { street: '123 Music Ave', city: 'Los Angeles', state: 'CA', zip: '90001' },
    location: { type: 'Point', coordinates: [-118.2437, 34.0522] },
    amenities: ['Stage', 'Lighting', 'Sound System', 'Bar', 'Seating'],
    images: ['hall1.jpg', 'hall2.jpg'],
    hourlyRate: 250.0,
    isAvailable: true,
  });

  console.log('Vendor database seeded successfully!');
  console.log(`Created vendor: LA Music Hall with Main Concert Hall venue`);
}

seed().catch((error) => {
  console.error('Error seeding vendor database:', error);
  process.exit(1);
});