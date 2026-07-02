export type DeploymentTier = 'production' | 'preview' | 'development';

function parseEnvFlag(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

/** Vercel sets VERCEL_ENV to production | preview | development. */
export function getDeploymentTier(): DeploymentTier {
  const env = process.env.VERCEL_ENV?.trim().toLowerCase();
  if (env === 'production') return 'production';
  if (env === 'preview') return 'preview';
  return 'development';
}

export function isProductionDeployment(): boolean {
  return getDeploymentTier() === 'production';
}

/** Server-side payments gate — use in API routes and server components. */
export function isPaymentsEnabled(): boolean {
  return (
    parseEnvFlag(process.env.PAYMENTS_ENABLED) ||
    parseEnvFlag(process.env.NEXT_PUBLIC_PAYMENTS_ENABLED)
  );
}

export function paymentsDisabledReason(): string {
  if (!isPaymentsEnabled()) {
    return 'Payments are disabled. Set PAYMENTS_ENABLED=true when you are ready to launch.';
  }
  return '';
}
