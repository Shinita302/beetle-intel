import { Brain, AlertTriangle } from 'lucide-react';
import { FormField, TextInput, NumberInput } from '../ui/FormField';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { SubstrateTypeField } from '../forms/SubstrateTypeField';
import { parseSubstrateType, resolveSubstrateType } from '../../constants/substrate';
import { PEST_RISK_LEVEL_LABEL, type PestPredictionResult } from '../../utils/pestPrediction';
import type { PestRiskLevel } from '../../types';

export interface PestPredictionFormState {
  substrateSelection: string;
  substrateCustom: string;
  temperature: number;
  humidity: number;
  foodType: string;
}

interface PestPredictionPanelProps {
  form: PestPredictionFormState;
  onChange: <K extends keyof PestPredictionFormState>(key: K, value: PestPredictionFormState[K]) => void;
  result: PestPredictionResult | null;
  onRunPrediction: () => void;
  loading?: boolean;
}

const levelVariant: Record<PestRiskLevel, 'success' | 'warning' | 'danger'> = {
  low: 'success',
  moderate: 'warning',
  high: 'danger',
};

export function PestPredictionPanel({
  form,
  onChange,
  result,
  onRunPrediction,
  loading = false,
}: PestPredictionPanelProps) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <SubstrateTypeField
            selection={form.substrateSelection}
            customValue={form.substrateCustom}
            onSelectionChange={(v) => onChange('substrateSelection', v)}
            onCustomChange={(v) => onChange('substrateCustom', v)}
            hint="Substrate moisture profile affects mold and mite risk."
          />
        </div>

        <FormField label="Temperature (°C)">
          <NumberInput
            value={form.temperature}
            onChange={(v) => onChange('temperature', v)}
            step={0.5}
            min={0}
            max={45}
          />
        </FormField>

        <FormField label="Humidity (%)">
          <NumberInput
            value={form.humidity}
            onChange={(v) => onChange('humidity', v)}
            step={1}
            min={0}
            max={100}
          />
        </FormField>

        <FormField label="Type of Food Fed" className="md:col-span-2">
          <TextInput
            value={form.foodType}
            onChange={(v) => onChange('foodType', v)}
            placeholder="e.g. Flake soil protein, banana, kinshi"
          />
        </FormField>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="primary" onClick={onRunPrediction} disabled={loading}>
          <Brain className="w-4 h-4" />
          {loading ? 'Analyzing…' : 'Assess Pest Risk'}
        </Button>
        <span className="text-[11px] text-gray-500">
          Uses placeholder logic until AI is connected
        </span>
      </div>

      {result && (
        <div className="rounded-lg border border-gray-700/80 bg-gray-800/40 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
              Risk Assessment
            </span>
          </div>

          <div className="space-y-2">
            <Badge variant={levelVariant[result.level]} className="text-sm px-3 py-1">
              {PEST_RISK_LEVEL_LABEL[result.level]}
            </Badge>
            <p className="text-sm text-gray-300">{result.summary}</p>
          </div>

          <div>
            <p className="text-[10px] text-gray-500 uppercase mb-2">Risk Factors</p>
            <ul className="space-y-1.5">
              {result.factors.map((factor) => (
                <li key={factor} className="text-xs text-gray-400 flex gap-2">
                  <span className="text-sky-500/80">•</span>
                  {factor}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[10px] text-gray-600 font-mono border-t border-gray-800 pt-2">
            AI payload ready · {result.aiPayload.modelVersion}
          </p>
        </div>
      )}
    </div>
  );
}

export function getResolvedSubstrateFromPredictionForm(form: PestPredictionFormState): string {
  return resolveSubstrateType(form.substrateSelection, form.substrateCustom);
}

export function createPredictionFormFromSubstrate(stored?: string): PestPredictionFormState {
  const parsed = parseSubstrateType(stored ?? '');
  return {
    substrateSelection: parsed.selection,
    substrateCustom: parsed.customValue,
    temperature: 24,
    humidity: 70,
    foodType: '',
  };
}
