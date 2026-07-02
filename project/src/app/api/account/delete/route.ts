import { NextResponse } from 'next/server';
import { deleteAllBeetlesForUser } from '@/lib/beetles';
import { createAdminClient, isAccountDeletionConfigured } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { deleteUserBreedingData } from '@/lib/userBreedingData';

export async function POST() {
  if (!isAccountDeletionConfigured()) {
    return NextResponse.json(
      {
        error:
          'Account deletion is not configured on the server. Add SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables.',
      },
      { status: 503 }
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'You must be signed in to delete your account.' }, { status: 401 });
    }

    await deleteUserBreedingData(supabase, user.id);
    await deleteAllBeetlesForUser(supabase, user.id);

    const admin = createAdminClient();
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    await supabase.auth.signOut();

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not delete account.' },
      { status: 500 }
    );
  }
}
