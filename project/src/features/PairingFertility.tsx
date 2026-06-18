import { useState, useMemo } from 'react';
import { Save, Calculator } from 'lucide-react';
import { Card, CardHeader } from '../components/ui/Card';
import { FormField, TextInput, NumberInput } from '../components/ui/FormField';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import type { Beetle, Pairing } from '../types';
import { beetleLabel, pairingEmergeRate, pairingFertilityScore, pairingHatchRate } from '../types';

interface PairingFertilityProps {
  beetles: Beetle[];
  pairings: Pairing[];
  onAdd: (pairing: Pairing) => void;
}

const emptyForm = {
  maleBeetleId: '',
  femaleBeetleId: '',
  pairingDate: '',
  eggsProduced: 0,
  hatched: 0,
  emerged: 0,
};

export function PairingFertility({ beetles, pairings, onAdd }: PairingFertilityProps) {
  const [form, setForm] = useState(emptyForm);
  const [saved, setSaved] = useState(false);

  const nextId = `P-${String(pairings.length + 1).padStart(3, '0')}`;

  const males = beetles.filter((b) => b.sex === 'male');
  const females = beetles.filter((b) => b.sex === 'female');

  const calculations = useMemo(() => {
    const hatchRate = pairingHatchRate({
      id: '',
      maleBeetleId: '',
      femaleBeetleId: '',
      pairingDate: '',
      eggsProduced: form.eggsProduced,
      hatched: form.hatched,
      emerged: form.emerged,
      createdAt: '',
    });
    const emergeRate = pairingEmergeRate({
      id: '',
      maleBeetleId: '',
      femaleBeetleId: '',
      pairingDate: '',
      eggsProduced: form.eggsProduced,
      hatched: form.hatched,
      emerged: form.emerged,
      createdAt: '',
    });
    const fertilityScore = pairingFertilityScore({
      id: '',
      maleBeetleId: '',
      femaleBeetleId: '',
      pairingDate: '',
      eggsProduced: form.eggsProduced,
      hatched: form.hatched,
      emerged: form.emerged,
      createdAt: '',
    });
    return { hatchRate, emergeRate, fertilityScore };
  }, [form.eggsProduced, form.hatched, form.emerged]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pairing: Pairing = {
      id: nextId,
      maleBeetleId: form.maleBeetleId,
      femaleBeetleId: form.femaleBeetleId,
      pairingDate: form.pairingDate,
      eggsProduced: form.eggsProduced,
      hatched: form.hatched,
      emerged: form.emerged,
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
        <p className="text-sm text-gray-500 mt-0.5">Track breeding pairs and lineage outcomes</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader title="Pairing Record" subtitle={`Record ID: ${nextId}`} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Male" required>
              <select
                value={form.maleBeetleId}
                onChange={(e) => update('maleBeetleId', e.target.value)}
                required
                className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-sky-500/50 transition-colors appearance-none"
              >
                <option value="" disabled>Select male</option>
                {males.map((b) => (
                  <option key={b.id} value={b.id}>
                    {beetleLabel(beetles, b.id)}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Female" required>
              <select
                value={form.femaleBeetleId}
                onChange={(e) => update('femaleBeetleId', e.target.value)}
                required
                className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-sky-500/50 transition-colors appearance-none"
              >
                <option value="" disabled>Select female</option>
                {females.map((b) => (
                  <option key={b.id} value={b.id}>
                    {beetleLabel(beetles, b.id)}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Pairing Date">
              <TextInput type="date" value={form.pairingDate} onChange={(v) => update('pairingDate', v)} />
            </FormField>

            <div className="md:col-span-2 border-t border-gray-800 pt-4 mt-1">
              <div className="flex items-center gap-2 mb-4">
                <Calculator className="w-4 h-4 text-teal-400" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Outcomes</span>
              </div>
            </div>

            <FormField label="Eggs Produced">
              <NumberInput value={form.eggsProduced} onChange={(v) => update('eggsProduced', v)} min={0} />
            </FormField>

            <FormField label="Hatched">
              <NumberInput value={form.hatched} onChange={(v) => update('hatched', v)} min={0} />
            </FormField>

            <FormField label="Emerged">
              <NumberInput value={form.emerged} onChange={(v) => update('emerged', v)} min={0} />
            </FormField>
          </div>

          {(form.eggsProduced > 0 || form.hatched > 0) && (
            <div className="mt-6 p-4 rounded-lg bg-gray-800/50 border border-gray-700/50">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 uppercase mb-1">Hatch Rate</p>
                  <p className="text-lg font-bold text-sky-400">{calculations.hatchRate}%</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 uppercase mb-1">Emerge Rate</p>
                  <p className="text-lg font-bold text-emerald-400">{calculations.emergeRate}%</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 uppercase mb-1">Fertility</p>
                  <Badge variant={scoreVariant(calculations.fertilityScore)} className="text-base px-3 py-1">
                    {calculations.fertilityScore}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800">
            <div>{saved && <Badge variant="success">Pairing saved!</Badge>}</div>
            <Button type="submit" variant="primary">
              <Save className="w-4 h-4" />
              Save Pairing
            </Button>
          </div>
        </Card>
      </form>

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
                  <th className="text-right py-2 text-gray-500 font-medium">Hatched</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Emerged</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {pairings.slice(-10).reverse().map((p) => {
                  const score = pairingFertilityScore(p);
                  return (
                    <tr key={p.id} className="border-b border-gray-800/50">
                      <td className="py-2 text-gray-300">
                        {beetleLabel(beetles, p.maleBeetleId)} × {beetleLabel(beetles, p.femaleBeetleId)}
                      </td>
                      <td className="py-2 text-gray-500">{p.pairingDate}</td>
                      <td className="py-2 text-right text-gray-400">{p.eggsProduced}</td>
                      <td className="py-2 text-right text-gray-400">{p.hatched}</td>
                      <td className="py-2 text-right text-emerald-400 font-medium">{p.emerged}</td>
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
