'use client';

import { useState } from 'react';
import { CreditCard, FlaskConical, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import {
  getClientDeploymentTier,
  isPaymentsEnabledClient,
  isPreviewDeploymentClient,
} from '@/lib/featureFlags.client';

export function BillingPanel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paymentsEnabled = isPaymentsEnabledClient();
  const deployment = getClientDeploymentTier();
  const isPreview = isPreviewDeploymentClient();

  const startCheckout = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/stripe/checkout', { method: 'POST' });
      const body = (await response.json()) as { url?: string; error?: string };

      if (!response.ok) {
        throw new Error(body.error ?? 'Could not start checkout.');
      }

      if (!body.url) {
        throw new Error('Stripe checkout URL was missing.');
      }

      window.location.href = body.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout.');
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Billing & Premium"
        subtitle="Stripe integration — test mode only during beta"
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {isPreview && <Badge variant="warning">Preview deployment</Badge>}
        <Badge variant={deployment === 'production' ? 'success' : 'neutral'}>
          {deployment}
        </Badge>
        <Badge variant={paymentsEnabled ? 'info' : 'neutral'}>
          {paymentsEnabled ? 'Payments enabled' : 'Payments disabled'}
        </Badge>
        <Badge variant="neutral">
          <FlaskConical className="w-3 h-3 inline mr-1" />
          Stripe test mode
        </Badge>
      </div>

      {!paymentsEnabled ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4">
          <p className="text-sm text-gray-300 flex items-start gap-2">
            <Lock className="w-4 h-4 shrink-0 mt-0.5 text-gray-500" />
            Premium checkout is turned off. Beta users on production are unaffected.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Enable <code className="text-gray-400">PAYMENTS_ENABLED=true</code> on a Preview deployment
            to test Stripe without changing production.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">
            Test checkout uses Stripe test cards only (e.g. <span className="text-gray-300">4242 4242 4242 4242</span>).
          </p>
          <Button type="button" variant="primary" onClick={startCheckout} disabled={loading}>
            <CreditCard className="w-4 h-4" />
            {loading ? 'Opening checkout…' : 'Test Premium checkout'}
          </Button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      )}
    </Card>
  );
}
