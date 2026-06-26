import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  detail?: string;
  valueClassName?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  color: string;
  onClick?: () => void;
}

export function StatCard({ label, value, detail, valueClassName, icon: Icon, trend, color, onClick }: StatCardProps) {
  const content = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</span>
        <div className={`p-2 rounded-lg transition-colors duration-200 ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-end gap-2">
          <span className={`text-2xl font-bold text-gray-100 leading-tight ${valueClassName ?? ''}`}>{value}</span>
          {trend && (
            <span
              className={`text-xs font-medium mb-1 ${
                trend.value >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {trend.value >= 0 ? '+' : ''}
              {trend.value}% {trend.label}
            </span>
          )}
        </div>
        {detail && <span className="text-xs font-medium text-gray-400">{detail}</span>}
      </div>
    </>
  );

  const baseClass =
    'w-full text-left bg-gray-900/80 border border-gray-800 rounded-xl p-5 flex flex-col gap-3';
  const interactiveClass = onClick
    ? 'cursor-pointer transition-all duration-200 ease-out hover:border-gray-600 hover:bg-gray-800/90 hover:shadow-md hover:shadow-black/20 hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:ring-offset-2 focus:ring-offset-gray-950'
    : '';

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${baseClass} ${interactiveClass}`}
        aria-label={`${label}: go to related page`}
      >
        {content}
      </button>
    );
  }

  return <div className={baseClass}>{content}</div>;
}
