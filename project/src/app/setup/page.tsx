import Link from 'next/link';

export default function SetupPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="max-w-lg w-full rounded-xl border border-amber-500/30 bg-gray-900/60 p-6 space-y-5">
        <div>
          <p className="text-xs font-mono text-amber-400/90 mb-1">BeetleIntel setup</p>
          <h1 className="text-xl font-bold text-gray-100">Connect Supabase</h1>
          <p className="text-sm text-gray-400 mt-2">
            The app needs your Supabase project URL and anon key before login or beetle storage will work.
          </p>
          <p className="text-sm text-amber-200/90 mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            On <strong>Vercel</strong>, add these in <strong>Settings → Environment Variables</strong> (not only
            .env.local), enable <strong>Production</strong>, then <strong>Redeploy</strong>.
          </p>
        </div>

        <ol className="text-sm text-gray-300 space-y-3 list-decimal list-inside">
          <li>
            Open{' '}
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="text-sky-400 hover:underline"
            >
              supabase.com/dashboard
            </a>{' '}
            → your project → <strong className="text-gray-200">Settings → API</strong>
          </li>
          <li>
            Copy <strong className="text-gray-200">Project URL</strong> (looks like{' '}
            <code className="text-xs text-gray-500">https://xxxxx.supabase.co</code>) and your{' '}
            <strong className="text-gray-200">publishable</strong> or <strong className="text-gray-200">anon</strong>{' '}
            key (<code className="text-xs text-gray-500">sb_publishable_…</code> or <code className="text-xs text-gray-500">eyJ…</code>)
          </li>
          <li>
            <strong className="text-gray-200">Vercel:</strong> add the two variables below under{' '}
            <strong className="text-gray-200">Environment Variables</strong>, or edit{' '}
            <code className="text-amber-200/90 bg-gray-800 px-1.5 py-0.5 rounded text-xs">
              project/.env.local
            </code>{' '}
            for local dev only
          </li>
          <li>
            Run the SQL migrations in the Supabase SQL Editor:
            <ul className="list-disc list-inside mt-1.5 space-y-1 text-gray-400">
              <li>
                <code className="text-amber-200/90 bg-gray-800 px-1.5 py-0.5 rounded text-xs">
                  supabase/migrations/001_beetles_rls.sql
                </code>
              </li>
              <li>
                <code className="text-amber-200/90 bg-gray-800 px-1.5 py-0.5 rounded text-xs">
                  supabase/migrations/002_user_breeding_data.sql
                </code>
              </li>
            </ul>
          </li>
          <li>
            Restart the dev server:{' '}
            <code className="text-amber-200/90 bg-gray-800 px-1.5 py-0.5 rounded text-xs">npm run dev</code>
          </li>
        </ol>

        <pre className="text-[11px] text-gray-400 bg-gray-950 border border-gray-800 rounded-lg p-3 overflow-x-auto">
{`NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...`}
        </pre>

        <p className="text-xs text-gray-500">
          After saving <code className="text-gray-400">.env.local</code>, refresh this page or go to{' '}
          <Link href="/login" className="text-sky-400 hover:underline">
            /login
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
