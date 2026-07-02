import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { isPaymentsEnabled } from '@/lib/featureFlags';
import { getStripeWebhookSecret } from '@/lib/stripe/config';
import { getStripe } from '@/lib/stripe/server';

export async function POST(request: Request) {
  if (!isPaymentsEnabled()) {
    return NextResponse.json({ error: 'Payments are disabled.' }, { status: 403 });
  }

  const webhookSecret = getStripeWebhookSecret();
  if (!webhookSecret) {
    return NextResponse.json({ error: 'STRIPE_WEBHOOK_SECRET is not configured.' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature.' }, { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid webhook signature.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed':
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      // Subscription state will be persisted in a follow-up migration.
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
