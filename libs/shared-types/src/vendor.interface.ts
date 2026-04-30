export interface Vendor {
  id: string;
  userId: string;
  businessName: string;
  description: string;
  contact: ContactInfo;
  businessType: BusinessType;
  verificationStatus: VerificationStatus;
  documents: VendorDocument[];
  paymentSettings: PaymentSettings;
  rating?: VendorRating;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactInfo {
  email: string;
  phone: string;
  website?: string;
  socialMedia?: SocialMedia;
}

export interface SocialMedia {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  youtube?: string;
}

export type BusinessType = 'venue' | 'band' | 'instructor' | 'event_organizer' | 'music_school';

export type VendorCategory = 'music' | 'art' | 'sports' | 'activities' | 'other';

export type VendorPricingModel = 'free' | 'per_hour' | 'contract' | 'mixed';

export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'suspended';

export interface VendorDocument {
  type: DocumentType;
  url: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedAt?: Date;
  reviewedBy?: string;
}

export type DocumentType = 'business_license' | 'tax_id' | 'id_card' | 'proof_of_address' | 'insurance';

export interface PaymentSettings {
  stripeAccountId?: string;
  paypalEmail?: string;
  bankAccount?: BankAccount;
  payoutSchedule: 'weekly' | 'biweekly' | 'monthly';
  minimumPayout: number;
}

export interface BankAccount {
  accountHolder: string;
  bankName: string;
  accountNumber: string;
  routingNumber?: string;
  iban?: string;
  swift?: string;
}

export interface VendorRating {
  average: number;
  totalReviews: number;
  breakdown: {
    [key: number]: number; // rating -> count
  };
}

export interface VendorPerformance {
  vendorId: string;
  period: DateRange;
  totalEvents: number;
  totalBookings: number;
  totalRevenue: number;
  averageRating: number;
  cancellationRate: number;
}

export interface DateRange {
  start: Date;
  end: Date;
}