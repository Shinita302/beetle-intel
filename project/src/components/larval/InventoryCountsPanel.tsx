import type { Beetle, BeetleInventoryCounts } from '../../types';
import { hasAnyInventoryCounts } from '../../types';
import { Card, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';

const INVENTORY_ROWS: { key: keyof BeetleInventoryCounts; label: string }[] = [
  { key: 'egg', label: 'Egg' },
  { key: 'l1', label: 'L1' },
  { key: 'l2', label: 'L2' },
  { key: 'l3', label: 'L3' },
  { key: 'pupa', label: 'Pupa' },
  { key: 'adult', label: 'Adult' },
];

interface InventoryCountsPanelProps {
  beetle: Beetle | null;
}

export function InventoryCountsPanel({ beetle }: InventoryCountsPanelProps) {
  if (!beetle) return null;

  const counts = beetle.inventoryCounts;
  const hasData = hasAnyInventoryCounts(counts);

  return (
    <Card>
      <CardHeader
        title="Inventory counts"
        subtitle="Head counts from spreadsheets (plain numbers like L1 106) — not larval weights"
      />
      {!hasData ? (
        <p className="text-sm text-gray-500">
          No inventory counts on this profile. Import a spreadsheet with stage rows (e.g. L1 106) or edit counts on
          Add Beetle.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {INVENTORY_ROWS.map(({ key, label }) => (
            <div
              key={key}
              className="rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2 text-center"
            >
              <p className="text-[11px] text-gray-500 mb-1">{label}</p>
              <p className="text-lg font-semibold text-gray-100 tabular-nums">
                {counts[key] > 0 ? counts[key] : '—'}
              </p>
            </div>
          ))}
        </div>
      )}
      {hasData && (
        <p className="text-[11px] text-gray-500 mt-3">
          <Badge variant="neutral" className="mr-1">
            Tip
          </Badge>
          Growth weights use units (e.g. 24g, 12 mm). Plain numbers stay here only.
        </p>
      )}
    </Card>
  );
}
