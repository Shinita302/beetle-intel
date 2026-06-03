/** Auth callback URL must match Supabase Redirect URLs exactly (no extra query params). */
export function getAuthCallbackUrl(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/auth/callback`;
}
