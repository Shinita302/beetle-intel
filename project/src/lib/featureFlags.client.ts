import type { DeploymentTier } from '@/lib/featureFlags';

function parseEnvFlag(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

/** Client-safe payments gate for UI only — API routes must use isPaymentsEnabled() on the server. */
export function isPaymentsEnabledClient(): boolean {
  return parseEnvFlag(process.env.NEXT_PUBLIC_PAYMENTS_ENABLED);
}

export function getClientDeploymentTier(): DeploymentTier {
  const env = process.env.NEXT_PUBLIC_VERCEL_ENV?.trim().toLowerCase();
  if (env === 'production') return 'production';
  if (env === 'preview') return 'preview';
  return 'development';
}

export function isPreviewDeploymentClient(): boolean {
  return getClientDeploymentTier() === 'preview';
}
