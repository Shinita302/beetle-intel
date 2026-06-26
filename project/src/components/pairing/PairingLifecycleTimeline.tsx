import type { PairingMilestone } from '@/utils/pairingLifecycle';

const milestoneTone: Record<PairingMilestone['kind'], string> = {
  paired: 'text-sky-400',
  eggs: 'text-amber-300',
  hatched: 'text-violet-300',
  emerged: 'text-emerald-400',
};

const milestoneDot: Record<PairingMilestone['kind'], string> = {
  paired: 'bg-sky-400',
  eggs: 'bg-amber-300',
  hatched: 'bg-violet-300',
  emerged: 'bg-emerald-400',
};

interface PairingLifecycleTimelineProps {
  milestones: PairingMilestone[];
  emptyMessage?: string;
}

export function PairingLifecycleTimeline({
  milestones,
  emptyMessage = 'No breeding milestones recorded yet.',
}: PairingLifecycleTimelineProps) {
  if (milestones.length === 0) {
    return <p className="text-xs text-gray-500">{emptyMessage}</p>;
  }

  return (
    <ol className="space-y-3">
      {milestones.map((milestone, index) => (
        <li key={`${milestone.kind}-${milestone.date}-${index}`} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className={`w-2.5 h-2.5 rounded-full mt-1.5 ${milestoneDot[milestone.kind]}`} />
            {index < milestones.length - 1 && <span className="w-px flex-1 bg-gray-700/80 mt-1" />}
          </div>
          <div className="pb-1 min-w-0">
            <p className={`text-sm font-medium ${milestoneTone[milestone.kind]}`}>{milestone.label}</p>
            <p className="text-xs text-gray-500">{milestone.date}</p>
            {milestone.value != null && (
              <p className="text-xs text-gray-300 mt-0.5">Count: {milestone.value}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
