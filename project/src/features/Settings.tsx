import { useState } from 'react';
import { AlertTriangle, Database, RotateCcw, Trash2, UserX } from 'lucide-react';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { FormField, TextInput } from '../components/ui/FormField';
import { BillingPanel } from '../components/billing/BillingPanel';

interface SettingsProps {
  userEmail?: string;
  beetleCount: number;
  larvalCount: number;
  pairingCount: number;
  pestCount: number;
  onClearAll: () => void | Promise<void>;
  onRestoreDemo: () => void | Promise<void>;
  onDeleteAccount: () => void | Promise<void>;
}

const CLEAR_DATA_PHRASE = 'DELETE ALL';
const DELETE_ACCOUNT_PHRASE = 'DELETE ACCOUNT';

export function Settings({
  userEmail,
  beetleCount,
  larvalCount,
  pairingCount,
  pestCount,
  onClearAll,
  onRestoreDemo,
  onDeleteAccount,
}: SettingsProps) {
  const [confirmText, setConfirmText] = useState('');
  const [accountConfirmText, setAccountConfirmText] = useState('');
  const [cleared, setCleared] = useState(false);
  const [restored, setRestored] = useState(false);
  const [accountDeleted, setAccountDeleted] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const totalRecords = beetleCount + larvalCount + pairingCount + pestCount;
  const canClearData = confirmText.trim().toUpperCase() === CLEAR_DATA_PHRASE;
  const canDeleteAccount = accountConfirmText.trim().toUpperCase() === DELETE_ACCOUNT_PHRASE;

  const handleClear = () => {
    if (!canClearData) return;
    onClearAll();
    setConfirmText('');
    setCleared(true);
    setRestored(false);
    setTimeout(() => setCleared(false), 4000);
  };

  const handleRestore = () => {
    onRestoreDemo();
    setConfirmText('');
    setRestored(true);
    setCleared(false);
    setTimeout(() => setRestored(false), 4000);
  };

  const handleDeleteAccount = async () => {
    if (!canDeleteAccount) return;

    setDeletingAccount(true);
    setDeleteAccountError(null);

    try {
      await onDeleteAccount();
      setDeleteAccountOpen(false);
      setAccountConfirmText('');
      setAccountDeleted(true);
    } catch (err) {
      setDeleteAccountError(err instanceof Error ? err.message : 'Could not delete account.');
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-100">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          All breeding data syncs to your account and appears on any device after you log in
        </p>
      </div>

      <BillingPanel />

      <Card>
        <CardHeader title="Account" subtitle="Your BeetleIntel login" />
        <div className="space-y-3">
          <p className="text-sm text-gray-300">{userEmail || 'Signed in'}</p>
          <p className="text-xs text-gray-500">
            Deleting your account permanently removes your login and all synced breeding data.
          </p>
          <FormField
            label={`Type ${DELETE_ACCOUNT_PHRASE} to confirm`}
            hint="Case insensitive"
          >
            <TextInput
              value={accountConfirmText}
              onChange={setAccountConfirmText}
              placeholder={DELETE_ACCOUNT_PHRASE}
            />
          </FormField>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              setDeleteAccountError(null);
              setDeleteAccountOpen(true);
            }}
            disabled={!canDeleteAccount || deletingAccount}
          >
            <UserX className="w-4 h-4" />
            Delete account
          </Button>
          {accountDeleted && <Badge variant="success">Account deleted</Badge>}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Your data"
          subtitle="Beetles, growth logs, inventory, pairings, and pest notes in Supabase"
        />
        <div className="flex flex-wrap gap-2">
          <Badge variant="info">{beetleCount} beetles</Badge>
          <Badge variant="neutral">{larvalCount} growth records</Badge>
          <Badge variant="neutral">{pairingCount} pairings</Badge>
          <Badge variant="neutral">{pestCount} pest logs</Badge>
        </div>
        {totalRecords === 0 && (
          <p className="text-sm text-gray-500 mt-3">No breeding data saved yet.</p>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Delete all breeding data"
          subtitle="Removes beetles, growth records, pairings, pest logs, and inventory — keeps your login"
        />

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 mb-4">
          <p className="text-sm text-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            This cannot be undone. Your account stays active — only the breeding data is removed.
          </p>
        </div>

        <FormField
          label={`Type ${CLEAR_DATA_PHRASE} to confirm`}
          hint="Case insensitive"
        >
          <TextInput
            value={confirmText}
            onChange={setConfirmText}
            placeholder={CLEAR_DATA_PHRASE}
          />
        </FormField>

        <div className="flex flex-wrap items-center gap-3 mt-4">
          <Button
            type="button"
            variant="primary"
            onClick={handleClear}
            disabled={!canClearData}
            className="!bg-red-600 hover:!bg-red-500 disabled:!bg-gray-800 disabled:!text-gray-600"
          >
            <Trash2 className="w-4 h-4" />
            Delete everything
          </Button>
          {cleared && <Badge variant="success">All data deleted</Badge>}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Restore sample data"
          subtitle="Reload the built-in demo beetles and records (replaces current data)"
        />
        <p className="text-xs text-gray-500 mb-4">
          Use this after deleting everything, or if you want to start over with example profiles.
        </p>
        <Button type="button" variant="secondary" onClick={handleRestore}>
          <RotateCcw className="w-4 h-4" />
          Restore demo data
        </Button>
        {restored && <Badge variant="success" className="ml-3">Demo data restored</Badge>}
      </Card>

      <p className="text-[11px] text-gray-600 flex items-center gap-1.5">
        <Database className="w-3.5 h-3.5" />
        Breeding data is stored in your Supabase account and syncs across browsers when you log in.
      </p>

      <ConfirmDialog
        open={deleteAccountOpen}
        title="Delete your account?"
        message="This permanently deletes your login, beetles, growth logs, inventory, pairings, and pest notes. This cannot be undone."
        confirmLabel={deletingAccount ? 'Deleting…' : 'Delete account'}
        confirmVariant="danger"
        onConfirm={handleDeleteAccount}
        onCancel={() => {
          if (deletingAccount) return;
          setDeleteAccountOpen(false);
          setDeleteAccountError(null);
        }}
        error={deleteAccountError}
      />
    </div>
  );
}
