import { useState, useMemo } from 'react';
import { Save, Calculator } from 'lucide-react';
import { Card, CardHeader } from '../components/ui/Card';
import { FormField, TextInput, NumberInput } from '../components/ui/FormField';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import type { Beetle, Pairing } from '../types';

interface PairingFertilityProps {
  beetles: Beetle[];
  pairings: Pairing[];
  onAdd: (pairing: Pairing) => void;
}

const emptyForm = {
  maleBeetleId: '',
  femaleBeetleId: '',
  pairingDate: '',
  eggLayingSetupDate: '',
  totalEggsLaid: 0,
  hatchedEggs: 0,
  pupatedLarvae: 0,
  emergedAdults: 0,
  notes: '',
};

export function PairingFertility({ beetles, pairings, onAdd }: PairingFertilityProps) {
  const [form, setForm] = useState(emptyForm);
  const [saved, setSaved] = useState(false);

  const nextId = `P-${String(pairings.length + 1).padStart(3, '0')}`;

  const males = beetles.filter((b) => b.sex === 'male');
  const females = beetles.filter((b) => b.sex === 'female');

  const maleName = beetles.find((b) => b.id === form.maleBeetleId)?.name || '';
  const femaleName = beetles.find((b) => b.id === form.femaleBeetleId)?.name || '';

  const calculations = useMemo(() => {
    const eggSR = form.totalEggsLaid > 0 ? form.hatchedEggs / form.totalEggsLaid : 0;
    const larvalSR = form.hatchedEggs > 0 ? form.pupatedLarvae / form.hatchedEggs : 0;
    const pupalSR = form.pupatedLarvae > 0 ? form.emergedAdults / form.pupatedLarvae : 0;
    const overall = eggSR * larvalSR * pupalSR;
    const fertilityScore = Math.round(overall * 100);
    return {
      eggSR: Math.round(eggSR * 100),
      larvalSR: Math.round(larvalSR * 100),
      pupalSR: Math.round(pupalSR * 100),
      overallSR: Math.round(overall * 100),
      fertilityScore,
    };
  }, [form.totalEggsLaid, form.hatchedEggs, form.pupatedLarvae, form.emergedAdults]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pairing: Pairing = {
      id: nextId,
      maleBeetleId: form.maleBeetleId,
      maleBeetleName: maleName,
      femaleBeetleId: form.femaleBeetleId,
      femaleBeetleName: femaleName,
      pairingDate: form.pairingDate,
      eggLayingSetupDate: form.eggLayingSetupDate,
      totalEggsLaid: form.totalEggsLaid,
      hatchedEggs: form.hatchedEggs,
      pupatedLarvae: form.pupatedLarvae,
      emergedAdults: form.emergedAdults,
      notes: form.notes,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    onAdd(pairing);
    setForm(emptyForm);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const scoreVariant = (score: number) => {
    if (score >= 60) return 'success' as const;
    if (score >= 30) return 'warning' as const;
    return 'danger' as const;
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-gray-100">Pairing & Fertility</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track breeding pairs and calculate survival metrics</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader title="Pairing Entry" subtitle={`Record ID: ${nextId}`} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Male Beetle" required>
              <select
                value={form.maleBeetleId}
                onChange={(e) => update('maleBeetleId', e.target.value)}
                required
                className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-sky-500/50 focus:border-sky-500/50 transition-colors appearance-none"
              >
                <option value="" disabled>Select male</option>
                {males.map((b) => (
                  <option key={b.id} value={b.id}>{b.id} - {b.name} ({b.species})</option>
                ))}
              </select>
            </FormField>

            <FormField label="Female Beetle" required>
              <select
                value={form.femaleBeetleId}
                onChange={(e) => update('femaleBeetleId', e.target.value)}
                required
                className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-sky-500/50 focus:border-sky-500/50 transition-colors appearance-none"
              >
                <option value="" disabled>Select female</option>
                {females.map((b) => (
                  <option key={b.id} value={b.id}>{b.id} - {b.name} ({b.species})</option>
                ))}
              </select>
            </FormField>

            <FormField label="Pairing Date">
              <TextInput type="date" value={form.pairingDate} onChange={(v) => update('pairingDate', v)} />
            </FormField>

            <FormField label="Egg-Laying Setup Date">
              <TextInput type="date" value={form.eggLayingSetupDate} onChange={(v) => update('eggLayingSetupDate', v)} />
            </FormField>

            <div className="md:col-span-2 border-t border-gray-800 pt-4 mt-1">
              <div className="flex items-center gap-2 mb-4">
                <Calculator className="w-4 h-4 text-teal-400" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Egg & Larval Data</span>
              </div>
            </div>

            <FormField label="Total Eggs Laid">
              <NumberInput value={form.totalEggsLaid} onChange={(v) => update('totalEggsLaid', v)} min={0} />
            </FormField>

            <FormField label="Hatched Eggs">
              <NumberInput value={form.hatchedEggs} onChange={(v) => update('hatchedEggs', v)} min={0} />
            </FormField>

            <FormField label="Pupated Larvae">
              <NumberInput value={form.pupatedLarvae} onChange={(v) => update('pupatedLarvae', v)} min={0} />
            </FormField>

            <FormField label="Emerged Adults">
              <NumberInput value={form.emergedAdults} onChange={(v) => update('emergedAdults', v)} min={0} />
            </FormField>

            <FormField label="Notes" className="md:col-span-2">
              <textarea
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
                placeholder="Pairing observations..."
                rows={3}
                className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-sky-500/50 focus:border-sky-500/50 transition-colors resize-none"
              />
            </FormField>
          </div>

          {/* Auto-Calculated Survival Rates */}
          {(form.totalEggsLaid > 0 || form.hatchedEggs > 0) && (
            <div className="mt-6 p-4 rounded-lg bg-gray-800/50 border border-gray-700/50">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="w-4 h-4 text-teal-400" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Auto-Calculated Metrics</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 uppercase mb-1">Egg SR</p>
                  <p className="text-lg font-bold text-sky-400">{calculations.eggSR}%</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 uppercase mb-1">Larval SR</p>
                  <p className="text-lg font-bold text-emerald-400">{calculations.larvalSR}%</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 uppercase mb-1">Pupal SR</p>
                  <p className="text-lg font-bold text-amber-400">{calculations.pupalSR}%</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 uppercase mb-1">Overall SR</p>
                  <p className="text-lg font-bold text-gray-200">{calculations.overallSR}%</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 uppercase mb-1">Fertility</p>
                  <p className="text-lg font-bold">
                    <Badge variant={scoreVariant(calculations.fertilityScore)} className="text-base px-3 py-1">
                      {calculations.fertilityScore}
                    </Badge>
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800">
            <div>
              {saved && <Badge variant="success">Pairing saved!</Badge>}
            </div>
            <Button type="submit" variant="primary">
              <Save className="w-4 h-4" />
              Save Pairing
            </Button>
          </div>
        </Card>
      </form>

      {/* Historical Pairings */}
      {pairings.length > 0 && (
        <Card>
          <CardHeader title="Pairing History" subtitle={`${pairings.length} total`} />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2 text-gray-500 font-medium">Pair</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Date</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Eggs</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Hatch</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Pupated</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Emerged</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {pairings.slice(-10).reverse().map((p) => {
                  const eggSR = p.totalEggsLaid > 0 ? p.hatchedEggs / p.totalEggsLaid : 0;
                  const larvalSR = p.hatchedEggs > 0 ? p.pupatedLarvae / p.hatchedEggs : 0;
                  const pupalSR = p.pupatedLarvae > 0 ? p.emergedAdults / p.pupatedLarvae : 0;
                  const score = Math.round(eggSR * larvalSR * pupalSR * 100);
                  return (
                    <tr key={p.id} className="border-b border-gray-800/50">
                      <td className="py-2 text-gray-300">{p.maleBeetleName} x {p.femaleBeetleName}</td>
                      <td className="py-2 text-gray-500">{p.pairingDate}</td>
                      <td className="py-2 text-right text-gray-400">{p.totalEggsLaid}</td>
                      <td className="py-2 text-right text-gray-400">{p.hatchedEggs}</td>
                      <td className="py-2 text-right text-gray-400">{p.pupatedLarvae}</td>
                      <td className="py-2 text-right text-emerald-400 font-medium">{p.emergedAdults}</td>
                      <td className="py-2 text-right">
                        <Badge variant={scoreVariant(score)}>{score}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
