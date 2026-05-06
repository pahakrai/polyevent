'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { registerUser } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

const CATEGORIES = [
  { value: 'MUSIC', label: 'Music' },
  { value: 'ART', label: 'Art' },
  { value: 'SPORTS', label: 'Sports' },
  { value: 'ACTIVITIES', label: 'Activities' },
  { value: 'OTHER', label: 'Other' },
];

export default function RegisterPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  // User fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'USER' | 'VENDOR'>('USER');

  // Vendor fields
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('MUSIC');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [addressZip, setAddressZip] = useState('');
  const [addressCountry, setAddressCountry] = useState('');
  const [lat, setLat] = useState(60.1699);
  const [lng, setLng] = useState(24.9384);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload: any = { email, password, firstName, lastName, role };

      if (role === 'VENDOR') {
        payload.vendor = {
          businessName,
          category,
          contactEmail: contactEmail || email,
          contactPhone,
          description: description || undefined,
          website: website || undefined,
          address: {
            street: addressStreet,
            city: addressCity,
            state: addressState,
            zip: addressZip,
            country: addressCountry,
          },
          location: { latitude: lat, longitude: lng },
        };
      }

      const result = await registerUser(payload);
      login(result.accessToken, result.refreshToken, result.user);
      router.push('/');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Registration failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-8">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create an account</CardTitle>
          <CardDescription>Join Polydom and discover live music</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Role selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">I want to</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRole('USER')}
                  className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                    role === 'USER'
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input bg-background hover:bg-accent'
                  }`}
                >
                  Discover events
                </button>
                <button
                  type="button"
                  onClick={() => setRole('VENDOR')}
                  className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                    role === 'VENDOR'
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input bg-background hover:bg-accent'
                  }`}
                >
                  Host & earn
                </button>
              </div>
            </div>

            {/* User fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label htmlFor="firstName" className="text-sm font-medium">First name</label>
                <Input id="firstName" placeholder="John" value={firstName}
                  onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <label htmlFor="lastName" className="text-sm font-medium">Last name</label>
                <Input id="lastName" placeholder="Doe" value={lastName}
                  onChange={(e) => setLastName(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <Input id="email" type="email" placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">Password</label>
              <Input id="password" type="password" placeholder="Choose a password" value={password}
                onChange={(e) => setPassword(e.target.value)} required minLength={8}
                autoComplete="new-password" />
            </div>

            {/* Vendor fields — shown only when VENDOR role is selected */}
            {role === 'VENDOR' && (
              <div className="space-y-4 border-t pt-4">
                <p className="text-sm font-semibold text-muted-foreground">Business details</p>

                <div className="space-y-2">
                  <label htmlFor="businessName" className="text-sm font-medium">Business name</label>
                  <Input id="businessName" placeholder="Your business or stage name" value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)} required />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label htmlFor="category" className="text-sm font-medium">Category</label>
                    <select id="category" value={category}
                      onChange={(e) => setCategory(e.target.value)} required
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="contactPhone" className="text-sm font-medium">Phone</label>
                    <Input id="contactPhone" placeholder="+1 555 123 4567" value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)} required />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="contactEmail" className="text-sm font-medium">Contact email</label>
                  <Input id="contactEmail" type="email" placeholder={email || 'contact@business.com'} value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <label htmlFor="description" className="text-sm font-medium">Description (optional)</label>
                  <Input id="description" placeholder="Tell us about your business" value={description}
                    onChange={(e) => setDescription(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <label htmlFor="website" className="text-sm font-medium">Website (optional)</label>
                  <Input id="website" type="url" placeholder="https://yourbusiness.com" value={website}
                    onChange={(e) => setWebsite(e.target.value)} />
                </div>

                <p className="text-sm font-semibold text-muted-foreground pt-2">Address</p>
                <div className="space-y-2">
                  <label htmlFor="street" className="text-sm font-medium">Street</label>
                  <Input id="street" placeholder="123 Main St" value={addressStreet}
                    onChange={(e) => setAddressStreet(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label htmlFor="city" className="text-sm font-medium">City</label>
                    <Input id="city" placeholder="Helsinki" value={addressCity}
                      onChange={(e) => setAddressCity(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="state" className="text-sm font-medium">State / Province</label>
                    <Input id="state" placeholder="Uusimaa" value={addressState}
                      onChange={(e) => setAddressState(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label htmlFor="zip" className="text-sm font-medium">ZIP / Postal code</label>
                    <Input id="zip" placeholder="00100" value={addressZip}
                      onChange={(e) => setAddressZip(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="country" className="text-sm font-medium">Country</label>
                    <Input id="country" placeholder="Finland" value={addressCountry}
                      onChange={(e) => setAddressCountry(e.target.value)} required />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3 pt-2">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Create account'}
            </Button>
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
