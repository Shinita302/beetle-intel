import { useState } from 'react';
import { AlertTriangle, Database, RotateCcw, Trash2 } from 'lucide-react';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { FormField, TextInput } from '../components/ui/FormField';

interface SettingsProps {
  beetleCount: number;
  larvalCount: number;
  pairingCount: number;
  pestCount: number;
  onClearAll: () => void | Promise<void>;
  onRestoreDemo: () => void | Promise<void>;
}

const CONFIRM_PHRASE = 'DELETE ALL';

export function Settings({
  beetleCount,
  larvalCount,
  pairingCount,
  pestCount,
  onClearAll,
  onRestoreDemo,
}: SettingsProps) {
  const [confirmText, setConfirmText] = useState('');
  const [cleared, setCleared] = useState(false);
  const [restored, setRestored] = useState(false);

  const totalRecords = beetleCount + larvalCount + pairingCount + pestCount;
  const canDelete = confirmText.trim().toUpperCase() === CONFIRM_PHRASE;

  const handleClear = () => {
    if (!canDelete) return;
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

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-100">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          All breeding data syncs to your account and appears on any device after you log in
        </p>
      </div>

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
          subtitle="Removes beetles, growth records, pairings, pest logs, and growth-track overrides"
        />

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 mb-4">
          <p className="text-sm text-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            This cannot be undone. Data is only stored in your browser — there is no cloud backup.
          </p>
        </div>

        <FormField
          label={`Type ${CONFIRM_PHRASE} to confirm`}
          hint="Case insensitive"
        >
          <TextInput
            value={confirmText}
            onChange={setConfirmText}
            placeholder={CONFIRM_PHRASE}
          />
        </FormField>

        <div className="flex flex-wrap items-center gap-3 mt-4">
          <Button
            type="button"
            variant="primary"
            onClick={handleClear}
            disabled={!canDelete}
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
    </div>
  );
}
