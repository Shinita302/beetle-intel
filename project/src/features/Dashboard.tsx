import { useMemo, useState } from 'react';
import {
  Bug,
  Sprout,
  Egg,
  Flame,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  HeartHandshake,
  ShieldAlert,
  Trophy,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { FormField, SelectInput } from '../components/ui/FormField';
import type { Beetle, GrowthEntry, Pairing, PestRisk, SpeciesInventory } from '../types';
import {
  beetleLabel,
  pairingFertilityScore,
  totalInstarLarvaeInventory,
  totalAdultsInventory,
  totalPopulationInventory,
} from '../types';
import { beetleCountTrend, larvalActivityTrend } from '../utils/dashboardMetrics';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  ALL_SPECIES_FILTER,
  calcAvgHatchRate,
  calcTopPerformingSpecies,
  filterPairingsBySpecies,
  getBreedingSpeciesOptions,
  getFertilityRanking,
} from '../utils/dashboardBreedingMetrics';

interface DashboardProps {
  beetles: Beetle[];
  growthEntries: GrowthEntry[];
  speciesInventory: SpeciesInventory[];
  pairings: Pairing[];
  pestRisks: PestRisk[];
  onNavigate: (page: string) => void;
}

function calcFertilityScore(pairings: Pairing[]): number {
  if (pairings.length === 0) return 0;
  const scores = pairings.map((p) => pairingFertilityScore(p));
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

function getLarvalGrowthChart(beetles: Beetle[], growthEntries: GrowthEntry[]) {
  const idsWithGrowth = new Set(growthEntries.map((entry) => entry.beetleId));
  const top3 = beetles
    .filter((b) => idsWithGrowth.has(b.id) || b.status === 'larva' || b.status === 'pupa')
    .slice(0, 3);

  if (top3.length === 0) {
    const adultTop3 = beetles.filter((b) => b.status === 'adult').slice(0, 3);
    return adultTop3.flatMap((b) =>
      growthEntries
        .filter((entry) => entry.beetleId === b.id)
        .map((entry) => ({
          date: entry.date.slice(5),
          weight: entry.weight,
          name: b.name,
        }))
    );
  }

  const data: Record<string, { date: string; [key: string]: string | number }> = {};
  top3.forEach((b) => {
    growthEntries
      .filter((entry) => entry.beetleId === b.id)
      .sort((a, b2) => a.date.localeCompare(b2.date))
      .forEach((entry) => {
        const key = entry.date.slice(5);
        if (!data[key]) data[key] = { date: key };
        data[key][b.name] = entry.weight;
      });
  });

  return Object.values(data).sort((a, b) => a.date.localeCompare(b.date));
}

const severityVariant = { low: 'warning' as const, medium: 'warning' as const, high: 'danger' as const };
const problemTypeLabel: Record<string, string> = {
  mites: 'Mites',
  mold: 'Mold',
  dryness: 'Dryness',
  'over-wet': 'Over-Wet',
  smell: 'Foul Smell',
  unknown: 'Unknown',
};

export function Dashboard({
  beetles,
  growthEntries,
  speciesInventory,
  pairings,
  pestRisks,
  onNavigate,
}: DashboardProps) {
  const { t } = useLanguage();
  const [speciesFilter, setSpeciesFilter] = useState(ALL_SPECIES_FILTER);

  const speciesOptions = useMemo(
    () => getBreedingSpeciesOptions(beetles, pairings),
    [beetles, pairings]
  );

  const filteredPairings = useMemo(
    () => filterPairingsBySpecies(pairings, beetles, speciesFilter),
    [pairings, beetles, speciesFilter]
  );

  const filteredBeetles = useMemo(() => {
    if (speciesFilter === ALL_SPECIES_FILTER) return beetles;
    return beetles.filter((beetle) => beetle.species === speciesFilter);
  }, [beetles, speciesFilter]);

  const filteredInventory = useMemo(() => {
    if (speciesFilter === ALL_SPECIES_FILTER) return speciesInventory;
    return speciesInventory.filter((row) => row.species === speciesFilter);
  }, [speciesInventory, speciesFilter]);

  const hasInventory = filteredInventory.length > 0;
  const totalPopulation = hasInventory
    ? totalPopulationInventory(filteredInventory)
    : filteredBeetles.length;
  const activeLarvae = hasInventory
    ? totalInstarLarvaeInventory(filteredInventory)
    : filteredBeetles.filter((b) => b.status === 'larva').length;
  const totalAdults = hasInventory
    ? totalAdultsInventory(filteredInventory)
    : filteredBeetles.filter((b) => b.status === 'adult').length;
  const avgHatchRate = calcAvgHatchRate(filteredPairings);
  const topPerformingSpecies = calcTopPerformingSpecies(beetles, filteredPairings);
  const avgFertility = calcFertilityScore(filteredPairings);
  const growthData = getLarvalGrowthChart(filteredBeetles, growthEntries);
  const fertilityData = getFertilityRanking(beetles, filteredPairings);
  const totalBeetlesTrend = hasInventory ? null : beetleCountTrend(filteredBeetles);
  const activeLarvaeTrend =
    hasInventory && activeLarvae === 0 && growthEntries.length === 0
      ? null
      : larvalActivityTrend(filteredBeetles, growthEntries);
  const openPestRisks = pestRisks.filter((pr) => pr.status === 'open');
  const recentPairings = [...filteredPairings]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  const topBeetleNames = filteredBeetles
    .filter(
      (b) =>
        growthEntries.some((entry) => entry.beetleId === b.id) ||
        b.status === 'larva' ||
        b.status === 'pupa'
    )
    .slice(0, 3)
    .map((b) => b.name);

  const useBarChart = topBeetleNames.length === 0;
  const chartBeetleNames = useBarChart
    ? filteredBeetles.filter((b) => b.status === 'adult').slice(0, 3).map((b) => b.name)
    : topBeetleNames;

  const chartColors = ['#0ea5e9', '#14b8a6', '#f59e0b'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-100">{t('pages.dashboardTitle')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('pages.dashboardSubtitle')}</p>
        </div>
        <FormField label="Species" className="w-full sm:w-64">
          <SelectInput
            value={speciesFilter}
            onChange={setSpeciesFilter}
            options={[
              { value: ALL_SPECIES_FILTER, label: 'All species' },
              ...speciesOptions.map((species) => ({ value: species, label: species })),
            ]}
          />
        </FormField>
      </div>

      {/* Pest Alert Banner */}
      {openPestRisks.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-400">
              {openPestRisks.length} Active Pest {openPestRisks.length === 1 ? 'Alert' : 'Alerts'}
            </p>
            <p className="text-xs text-red-400/70 mt-0.5">
              {openPestRisks.map((pr) => `${pr.bottleId}: ${problemTypeLabel[pr.problemType]}`).join(' | ')}
            </p>
          </div>
          <button
            onClick={() => onNavigate('pest-risk')}
            className="text-xs text-red-400 hover:text-red-300 font-medium flex items-center gap-1 flex-shrink-0"
          >
            View <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard
          label={hasInventory ? 'Total Population' : 'Total Beetles'}
          value={totalPopulation}
          icon={Bug}
          color="bg-sky-500/15 text-sky-400"
          trend={totalBeetlesTrend ?? undefined}
          onClick={() => onNavigate(hasInventory ? 'inventory' : 'add-beetle')}
        />
        <StatCard
          label="Active Larvae"
          value={activeLarvae}
          icon={Sprout}
          color="bg-emerald-500/15 text-emerald-400"
          trend={activeLarvaeTrend ?? undefined}
          onClick={() => onNavigate('larval-growth')}
        />
        <StatCard
          label="Avg Hatch Rate"
          value={avgHatchRate == null ? '--' : `${avgHatchRate}%`}
          icon={Egg}
          color="bg-amber-500/15 text-amber-400"
        />
        <StatCard
          label="Top Performing Species"
          value={topPerformingSpecies?.species ?? 'No data'}
          detail={
            topPerformingSpecies ? `${topPerformingSpecies.hatchRate}% Hatch Rate` : undefined
          }
          valueClassName={topPerformingSpecies ? 'text-base sm:text-lg' : undefined}
          icon={Trophy}
          color="bg-violet-500/15 text-violet-400"
        />
        <StatCard
          label={hasInventory ? 'Adults' : 'Avg Fertility'}
          value={hasInventory ? totalAdults : avgFertility}
          icon={Flame}
          color="bg-teal-500/15 text-teal-400"
          onClick={hasInventory ? () => onNavigate('inventory') : undefined}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Larval Growth Chart */}
        <Card>
          <CardHeader title="Larval Growth Tracking" subtitle="Weight over time (top beetles)" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              {useBarChart ? (
                <BarChart data={growthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111827',
                      border: '1px solid #1f2937',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="weight" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart data={growthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111827',
                      border: '1px solid #1f2937',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  {chartBeetleNames.map((name, i) => (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stroke={chartColors[i % chartColors.length]}
                      strokeWidth={2}
                      dot={{ r: 3, fill: chartColors[i % chartColors.length] }}
                    />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Fertility Ranking */}
        <Card>
          <CardHeader
            title="Fertility Ranking"
            subtitle={
              speciesFilter === ALL_SPECIES_FILTER
                ? 'Pairing performance score'
                : `Pairing performance for ${speciesFilter}`
            }
          />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fertilityData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  width={140}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    border: '1px solid #1f2937',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="score" fill="#14b8a6" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Pairings */}
        <Card className="lg:col-span-2">
          <CardHeader title="Recent Pairings" action={
            <button onClick={() => onNavigate('pairing')} className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1">
              All <ExternalLink className="w-3 h-3" />
            </button>
          } />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2 text-gray-500 font-medium">Pair</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Date</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Eggs</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Hatched</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Emerged</th>
                </tr>
              </thead>
              <tbody>
                {recentPairings.map((p) => (
                  <tr key={p.id} className="border-b border-gray-800/50">
                    <td className="py-2.5 text-gray-300">
                      {beetleLabel(beetles, p.maleBeetleId)} x {beetleLabel(beetles, p.femaleBeetleId)}
                    </td>
                    <td className="py-2.5 text-gray-500">{p.pairingDate}</td>
                    <td className="py-2.5 text-right text-gray-400">{p.eggsProduced}</td>
                    <td className="py-2.5 text-right text-gray-400">{p.hatched}</td>
                    <td className="py-2.5 text-right text-emerald-400 font-medium">{p.emerged}</td>
                  </tr>
                ))}
                {recentPairings.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-gray-600">No pairings recorded yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Pest Risk Inbox */}
        <Card>
          <CardHeader title="Pest Inbox" subtitle={`${openPestRisks.length} open`} action={
            <button onClick={() => onNavigate('pest-risk')} className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1">
              All <ExternalLink className="w-3 h-3" />
            </button>
          } />
          <div className="space-y-2.5">
            {pestRisks.slice(0, 5).map((pr) => (
              <div key={pr.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-800/50">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xs text-gray-300 font-medium truncate">{pr.bottleId}</span>
                  <Badge variant={severityVariant[pr.severity]}>{problemTypeLabel[pr.problemType]}</Badge>
                </div>
                <Badge variant={pr.status === 'open' ? 'danger' : 'success'}>
                  {pr.status}
                </Badge>
              </div>
            ))}
            {pestRisks.length === 0 && (
              <p className="text-xs text-gray-600 text-center py-4">No pest risks logged</p>
            )}
          </div>
        </Card>
      </div>

      {/* Quick Links */}
      <Card>
        <CardHeader title="Quick Actions" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(
            [
              { label: t('nav.addBeetle'), page: 'add-beetle' as const, icon: Bug },
              { label: 'Log Growth', page: 'larval-growth' as const, icon: Sprout },
              { label: 'New Pairing', page: 'pairing' as const, icon: HeartHandshake },
              { label: 'Report Pest', page: 'pest-risk' as const, icon: ShieldAlert },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.page}
                onClick={() => onNavigate(item.page)}
                className="flex flex-col items-center gap-2 p-4 rounded-lg bg-gray-800/50 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 transition-colors"
              >
                <Icon className="w-5 h-5 text-sky-400" />
                <span className="text-xs text-gray-400 font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
