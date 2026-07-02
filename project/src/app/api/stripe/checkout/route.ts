import { NextResponse } from 'next/server';
import { isPaymentsEnabled } from '@/lib/featureFlags';
import { createClient } from '@/lib/supabase/server';
import {
  getStripeCheckoutCancelUrl,
  getStripeCheckoutSuccessUrl,
  getStripePriceId,
} from '@/lib/stripe/config';
import { getStripe, requireStripeConfigured } from '@/lib/stripe/server';

export async function POST(request: Request) {
  if (!isPaymentsEnabled()) {
    return NextResponse.json(
      { error: 'Payments are disabled. Set PAYMENTS_ENABLED=true to test checkout.' },
      { status: 403 }
    );
  }

  try {
    requireStripeConfigured();

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      return NextResponse.json({ error: 'Sign in to start checkout.' }, { status: 401 });
    }

    const origin = new URL(request.url).origin;
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: user.email,
      client_reference_id: user.id,
      line_items: [{ price: getStripePriceId(), quantity: 1 }],
      success_url: getStripeCheckoutSuccessUrl(origin),
      cancel_url: getStripeCheckoutCancelUrl(origin),
      metadata: {
        user_id: user.id,
        deployment: process.env.VERCEL_ENV ?? 'development',
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: 'Stripe did not return a checkout URL.' }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not start checkout.' },
      { status: 500 }
    );
  }
}
