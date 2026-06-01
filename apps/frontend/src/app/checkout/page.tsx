'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import {
  ArrowLeft,
  Shield,
  CreditCard,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { createBooking, confirmBooking } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder',
);

function CheckoutForm({
  clientSecret,
  bookingId,
  onSuccess,
}: {
  clientSecret: string;
  bookingId: string;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError('');

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message || 'Payment failed');
      setProcessing(false);
      return;
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/events`,
      },
      redirect: 'if_required',
    });

    if (confirmError) {
      setError(confirmError.message || 'Payment confirmation failed');
    } else {
      onSuccess();
    }
    setProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-border/50 bg-card p-4">
        <PaymentElement />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || processing}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:shadow-primary/40 disabled:opacity-50"
      >
        {processing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4" />
            Pay Now
          </>
        )}
      </button>
    </form>
  );
}

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();

  const eventId = searchParams.get('eventId') || '';
  const vendorId = searchParams.get('vendorId') || '';
  const amountCents = parseInt(searchParams.get('amount') || '0', 10);
  const eventTitle = searchParams.get('title') || 'Event';

  const [loading, setLoading] = useState(true);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string>('');
  const [feeBreakdown, setFeeBreakdown] = useState<any>(null);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!eventId || !vendorId) return;
    setLoading(true);
    createBooking({
      userId: user?.id || 'anonymous',
      eventId,
      vendorId,
      amountCents,
      currency: 'EUR',
      ticketCount: 1,
    })
      .then((result) => {
        setClientSecret(result.clientSecret);
        setBookingId(result.booking?.id);
        setFeeBreakdown(result.feeBreakdown);
      })
      .catch((err) => {
        setError(err?.response?.data?.message || 'Failed to create booking');
      })
      .finally(() => setLoading(false));
  }, [eventId, vendorId, amountCents]);

  const handlePaymentSuccess = async () => {
    if (bookingId) {
      try {
        await confirmBooking(bookingId);
      } catch {
        // Webhook will also confirm — dual-path for reliability
      }
    }
    setConfirmed(true);
  };

  if (confirmed) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10">
          <Check className="h-8 w-8 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold">Booking Confirmed!</h1>
        <p className="mt-2 text-muted-foreground">
          Your spot has been reserved. You&apos;ll receive a confirmation email shortly.
        </p>
        <Link
          href={`/events/${eventId}`}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25"
        >
          View Event
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href={`/events/${eventId}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Event
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">Checkout</h1>
      <p className="mt-1 text-sm text-muted-foreground">{eventTitle}</p>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-8 space-y-4">
          <div className="h-48 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          {/* Order Summary */}
          <div className="rounded-xl border border-border/50 bg-card p-5 lg:col-span-2">
            <h3 className="mb-3 text-sm font-semibold">Order Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Event</span>
                <span className="font-medium">{eventTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Quantity</span>
                <span>1 ticket</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">
                  €{(amountCents / 100).toFixed(2)}
                </span>
              </div>
              {feeBreakdown && feeBreakdown.enabled && (
                <>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Platform fee ({feeBreakdown.feePercent}%)</span>
                    <span>€{(feeBreakdown.feeAmountCents / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Vendor receives</span>
                    <span>€{(feeBreakdown.netAmountCents / 100).toFixed(2)}</span>
                  </div>
                </>
              )}
              {feeBreakdown && !feeBreakdown.enabled && (
                <div className="flex justify-between text-xs text-emerald-400">
                  <span>Platform fee</span>
                  <span>Free</span>
                </div>
              )}
              <div className="border-t border-border/50 pt-2 flex justify-between font-semibold">
                <span>Total</span>
                <span>€{(amountCents / 100).toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5" />
              Secured by Stripe · SSL encrypted
            </div>
          </div>

          {/* Payment Form */}
          <div className="rounded-xl border border-border/50 bg-card p-5 lg:col-span-3">
            <h3 className="mb-3 text-sm font-semibold">Payment</h3>

            {clientSecret ? (
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <CheckoutForm
                  clientSecret={clientSecret}
                  bookingId={bookingId}
                  onSuccess={handlePaymentSuccess}
                />
              </Elements>
            ) : (
              <div className="rounded-xl bg-muted/50 p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No payment required for this booking.
                </p>
                <Link
                  href={`/events/${eventId}`}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                  Done
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
