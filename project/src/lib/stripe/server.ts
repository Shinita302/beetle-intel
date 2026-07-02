import Stripe from 'stripe';
import {
  assertStripeTestModeKeys,
  getStripeSecretKey,
  isStripeConfigured,
} from '@/lib/stripe/config';

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeClient) return stripeClient;

  const secretKey = getStripeSecretKey();
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
  }

  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? '';
  assertStripeTestModeKeys(secretKey, publishableKey);

  stripeClient = new Stripe(secretKey, {
    appInfo: {
      name: 'BeetleIntel',
    },
  });

  return stripeClient;
}

export function requireStripeConfigured(): void {
  if (!isStripeConfigured()) {
    throw new Error(
      'Stripe is not fully configured. Add test-mode STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, and STRIPE_PRICE_ID.'
    );
  }
}
