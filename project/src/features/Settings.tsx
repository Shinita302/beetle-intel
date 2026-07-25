'use client';

import { useState } from 'react';
import { AlertTriangle, Database, RotateCcw, Trash2, UserX } from 'lucide-react';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { FormField, TextInput } from '../components/ui/FormField';
import { LanguageSwitcher } from '../layout/LanguageSwitcher';
import { useLanguage } from '@/contexts/LanguageContext';

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
  const { t } = useLanguage();
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
      setDeleteAccountError(
        err instanceof Error ? err.message : t('settings.deleteAccountError')
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-100">{t('settings.title')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t('settings.subtitle')}</p>
      </div>

      <Card>
        <CardHeader title={t('settings.languageTitle')} subtitle={t('settings.languageSubtitle')} />
        <LanguageSwitcher />
      </Card>

      <Card>
        <CardHeader title={t('settings.accountTitle')} subtitle={t('settings.accountSubtitle')} />
        <div className="space-y-3">
          <p className="text-sm text-gray-300">{userEmail || t('common.signedIn')}</p>
          <p className="text-xs text-gray-500">{t('settings.deleteAccountHint')}</p>
          <FormField
            label={t('settings.typeConfirm', { phrase: DELETE_ACCOUNT_PHRASE })}
            hint={t('common.caseInsensitive')}
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
            {t('settings.deleteAccount')}
          </Button>
          {accountDeleted && <Badge variant="success">{t('settings.accountDeleted')}</Badge>}
        </div>
      </Card>

      <Card>
        <CardHeader title={t('settings.yourDataTitle')} subtitle={t('settings.yourDataSubtitle')} />
        <div className="flex flex-wrap gap-2">
          <Badge variant="info">{t('settings.beetles', { count: beetleCount })}</Badge>
          <Badge variant="neutral">{t('settings.growthRecords', { count: larvalCount })}</Badge>
          <Badge variant="neutral">{t('settings.pairings', { count: pairingCount })}</Badge>
          <Badge variant="neutral">{t('settings.pestLogs', { count: pestCount })}</Badge>
        </div>
        {totalRecords === 0 && (
          <p className="text-sm text-gray-500 mt-3">{t('settings.noDataYet')}</p>
        )}
      </Card>

      <Card>
        <CardHeader
          title={t('settings.deleteDataTitle')}
          subtitle={t('settings.deleteDataSubtitle')}
        />

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 mb-4">
          <p className="text-sm text-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            {t('settings.deleteDataWarning')}
          </p>
        </div>

        <FormField
          label={t('settings.typeConfirm', { phrase: CLEAR_DATA_PHRASE })}
          hint={t('common.caseInsensitive')}
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
            {t('settings.deleteEverything')}
          </Button>
          {cleared && <Badge variant="success">{t('settings.allDataDeleted')}</Badge>}
        </div>
      </Card>

      <Card>
        <CardHeader title={t('settings.restoreTitle')} subtitle={t('settings.restoreSubtitle')} />
        <p className="text-xs text-gray-500 mb-4">{t('settings.restoreHint')}</p>
        <Button type="button" variant="secondary" onClick={handleRestore}>
          <RotateCcw className="w-4 h-4" />
          {t('settings.restoreDemo')}
        </Button>
        {restored && (
          <Badge variant="success" className="ml-3">
            {t('settings.demoRestored')}
          </Badge>
        )}
      </Card>

      <p className="text-[11px] text-gray-600 flex items-center gap-1.5">
        <Database className="w-3.5 h-3.5" />
        {t('settings.footerSync')}
      </p>

      <ConfirmDialog
        open={deleteAccountOpen}
        title={t('settings.deleteAccountDialogTitle')}
        message={t('settings.deleteAccountDialogMessage')}
        confirmLabel={deletingAccount ? t('settings.deleting') : t('settings.deleteAccount')}
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
