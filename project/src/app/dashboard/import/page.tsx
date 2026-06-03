'use client';

import { ImportSpreadsheet } from '@/features/ImportSpreadsheet';
import { useBeetleApp } from '@/contexts/BeetleAppContext';

export default function DashboardImportPage() {
  const { beetles, larvalRecords, importData, busy } = useBeetleApp();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-100">Import Spreadsheet</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Upload breeding data from Excel or CSV. Beetles are saved to your account; growth logs stay in this browser.
        </p>
      </div>
      {busy && (
        <div className="mb-4 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-300">
          Saving your records…
        </div>
      )}
      <ImportSpreadsheet
        beetles={beetles}
        larvalRecords={larvalRecords}
        onImportConfirmed={importData}
      />
    </div>
  );
}
