# BeetleIntel — Beta production & staging workflow

This guide keeps **https://beetle-intel.vercel.app** stable for beta testers while you develop Stripe and new features on a separate branch with Vercel Preview deployments.

## Branch strategy

| Branch | Vercel deployment | Audience | Purpose |
|--------|-------------------|----------|---------|
| `main` | **Production** → `beetle-intel.vercel.app` | Beta testers | Stable app, bug fixes only |
| `stripe-test` (or any feature branch) | **Preview** → unique `*.vercel.app` URL | You / internal testers | Stripe, new features, experiments |

### Daily workflow

1. **Beta bug fix** → commit on `main` → push → production auto-deploys.
2. **New feature / Stripe** → commit on `stripe-test` → push → Vercel creates a Preview URL (find it in the Vercel dashboard or GitHub PR).
3. **Never merge unfinished payment work** into `main` until you are ready to launch.

### Create the staging branch (one time)

```bash
git checkout main
git pull origin main
git checkout -b stripe-test
git push -u origin stripe-test
```

Vercel will build a Preview deployment for `stripe-test` automatically (default for Git-connected projects).

---

## Environment variables (Vercel)

Open **Vercel → beetle-intel → Settings → Environment Variables**.

### Production (`main` only) — beta users

Keep payments **off** until launch:

| Variable | Value | Environment |
|----------|-------|---------------|
| `PAYMENTS_ENABLED` | `false` | Production |
| `NEXT_PUBLIC_PAYMENTS_ENABLED` | `false` | Production |
| Supabase keys | (existing) | Production |

Do **not** add Stripe live keys to Production during beta.

### Preview (`stripe-test` and PRs) — your testing

| Variable | Value | Environment |
|----------|-------|---------------|
| `PAYMENTS_ENABLED` | `true` | Preview |
| `NEXT_PUBLIC_PAYMENTS_ENABLED` | `true` | Preview |
| `STRIPE_SECRET_KEY` | `sk_test_…` | Preview |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` | Preview |
| `STRIPE_PRICE_ID` | `price_…` (test mode) | Preview |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` (from Stripe CLI or test webhook) | Preview |
| Supabase keys | same as production (or a separate test project) | Preview |

The app **rejects live Stripe keys** (`sk_live_` / `pk_live_`) at runtime during beta.

### Local development

Copy `project/.env.example` → `project/.env.local` and set Preview-style values when testing Stripe locally.

---

## Feature flag: `PAYMENTS_ENABLED`

- **Server** (`PAYMENTS_ENABLED`) — gates `/api/stripe/*` routes.
- **Client** (`NEXT_PUBLIC_PAYMENTS_ENABLED`) — shows/hides billing UI in Settings.

When `false` (production default):

- No checkout API calls succeed.
- Settings shows “Payments disabled” — beta users see no paywall changes.
- Existing Premium preview UI (e.g. Pest Risk) stays as-is.

When `true` (Preview only, while developing):

- Settings → **Billing & Premium** → **Test Premium checkout** opens Stripe test checkout.

---

## Testing Stripe (Preview or local)

1. Use [Stripe test mode](https://dashboard.stripe.com/test/apikeys) keys only.
2. Create a test **Product** + **Price** → copy `price_…` into `STRIPE_PRICE_ID`.
3. On Preview deployment, open **Settings** and click **Test Premium checkout**.
4. Card: `4242 4242 4242 4242`, any future expiry, any CVC.

### Webhooks (optional for now)

For subscription lifecycle events:

```bash
stripe listen --forward-to https://YOUR-PREVIEW-URL.vercel.app/api/stripe/webhook
```

Paste the signing secret into `STRIPE_WEBHOOK_SECRET` for Preview.

---

## Merging to production without disrupting beta

### Phase 1 — Ship code, keep payments off (recommended)

1. Open a PR: `stripe-test` → `main`.
2. Review and merge (production still has `PAYMENTS_ENABLED=false`).
3. Beta users get code updates; **payments remain invisible/disabled**.
4. Fix any production bugs on `main` directly or via hotfix branches.

### Phase 2 — Launch payments (when ready)

1. Complete subscription storage + webhook handling.
2. Test end-to-end on Preview with `PAYMENTS_ENABLED=true`.
3. In Vercel, set on **Production only**:
   - `PAYMENTS_ENABLED=true`
   - `NEXT_PUBLIC_PAYMENTS_ENABLED=true`
   - Stripe **test** keys first, then live keys when you exit beta billing.
4. Redeploy production (or push an empty commit to `main`).

### Hotfixes while developing Stripe

```bash
# Fix production bug
git checkout main
git pull
# fix, commit, push → production deploys

# Bring fix into stripe branch
git checkout stripe-test
git merge main
git push
```

This keeps beta on `main` current while `stripe-test` stays up to date.

---

## SaaS checklist

- [x] Production URL fixed to `main` only
- [x] Feature branch → Vercel Preview
- [x] Feature flag defaults off on production
- [x] Stripe test keys enforced in code
- [ ] Subscription status in database (next step after checkout works)
- [ ] Stripe Customer Portal for cancel/update
- [ ] Production live keys only after explicit launch

---

## Quick reference

| I want to… | Do this |
|------------|---------|
| Fix a beta bug | Push to `main` |
| Test Stripe | Push to `stripe-test`, open Preview URL, `PAYMENTS_ENABLED=true` on Preview |
| Hide payments from beta | `PAYMENTS_ENABLED=false` on Production |
| Launch payments | Merge code → flip Production env vars → redeploy |
