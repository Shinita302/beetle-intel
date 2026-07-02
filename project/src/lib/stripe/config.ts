const TEST_SECRET_PREFIX = 'sk_test_';
const TEST_PUBLISHABLE_PREFIX = 'pk_test_';

export function getStripeSecretKey(): string {
  return process.env.STRIPE_SECRET_KEY?.trim() ?? '';
}

export function getStripePublishableKey(): string {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? '';
}

export function getStripeWebhookSecret(): string {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? '';
}

export function getStripePriceId(): string {
  return process.env.STRIPE_PRICE_ID?.trim() ?? '';
}

export function getStripeBillingPortalReturnUrl(origin: string): string {
  const configured = process.env.STRIPE_BILLING_PORTAL_RETURN_URL?.trim();
  return configured || `${origin}/dashboard/settings`;
}

export function getStripeCheckoutSuccessUrl(origin: string): string {
  const configured = process.env.STRIPE_CHECKOUT_SUCCESS_URL?.trim();
  return configured || `${origin}/dashboard/settings?billing=success`;
}

export function getStripeCheckoutCancelUrl(origin: string): string {
  const configured = process.env.STRIPE_CHECKOUT_CANCEL_URL?.trim();
  return configured || `${origin}/dashboard/settings?billing=cancel`;
}

/** Beta policy: reject live Stripe keys until you intentionally launch. */
export function assertStripeTestModeKeys(secretKey: string, publishableKey: string): void {
  if (secretKey && !secretKey.startsWith(TEST_SECRET_PREFIX)) {
    throw new Error(
      `Stripe secret key must be test mode (${TEST_SECRET_PREFIX}…). Live keys are blocked during beta.`
    );
  }

  if (publishableKey && !publishableKey.startsWith(TEST_PUBLISHABLE_PREFIX)) {
    throw new Error(
      `Stripe publishable key must be test mode (${TEST_PUBLISHABLE_PREFIX}…). Live keys are blocked during beta.`
    );
  }
}

export function isStripeConfigured(): boolean {
  const secretKey = getStripeSecretKey();
  const publishableKey = getStripePublishableKey();
  const priceId = getStripePriceId();

  if (!secretKey || !publishableKey || !priceId) return false;

  try {
    assertStripeTestModeKeys(secretKey, publishableKey);
    return true;
  } catch {
    return false;
  }
}
