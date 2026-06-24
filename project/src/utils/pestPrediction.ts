import type { PestProblem, PestRiskLevel } from '../types';

export interface PestPredictionInput {
  substrateType: string;
  temperature: number;
  humidity: number;
  foodType: string;
  problemType?: PestProblem;
}

export interface PestPredictionResult {
  level: PestRiskLevel;
  summary: string;
  factors: string[];
  /** Shape ready to send to an AI API later */
  aiPayload: PestPredictionInput & { modelVersion: string };
}

export const PEST_RISK_LEVEL_LABEL: Record<PestRiskLevel, string> = {
  low: 'Low Risk',
  moderate: 'Moderate Risk',
  high: 'High Risk',
};

type RiskSignalWeight = 'minor' | 'major';

interface RiskSignal {
  weight: RiskSignalWeight;
  message: string;
}

function collectRiskSignals(input: PestPredictionInput): RiskSignal[] {
  const signals: RiskSignal[] = [];
  const substrate = input.substrateType.toLowerCase();
  const food = input.foodType.toLowerCase();

  if (input.humidity >= 82) {
    signals.push({
      weight: 'major',
      message: 'Very high humidity increases mold and mite risk.',
    });
  } else if (input.humidity >= 70) {
    signals.push({
      weight: 'minor',
      message: 'Elevated humidity may encourage mold growth.',
    });
  } else if (input.humidity > 0 && input.humidity < 45) {
    signals.push({
      weight: 'minor',
      message: 'Low humidity can stress larvae and worsen dryness issues.',
    });
  }

  if (input.temperature >= 30) {
    signals.push({
      weight: 'major',
      message: 'High temperature accelerates substrate decomposition and pests.',
    });
  } else if (input.temperature > 0 && input.temperature < 20) {
    signals.push({
      weight: 'minor',
      message: 'Cool temperatures slow metabolism but can trap moisture locally.',
    });
  }

  if (substrate.includes('kinshi') && input.humidity >= 75) {
    signals.push({
      weight: 'major',
      message: 'Kinshi-based substrate with high humidity is a common mite hotspot.',
    });
  }

  if (substrate.includes('flake') && input.humidity >= 78) {
    signals.push({
      weight: 'minor',
      message: 'Flake soil stays wet longer at high humidity.',
    });
  }

  if (
    (food.includes('banana') || food.includes('fruit') || food.includes('protein')) &&
    input.humidity >= 72
  ) {
    signals.push({
      weight: 'minor',
      message: 'Protein or fruit diets spoil faster in humid containers.',
    });
  }

  if (input.problemType === 'mites') {
    signals.push({
      weight: 'minor',
      message: 'Mites already reported — reinfestation risk is elevated.',
    });
  } else if (input.problemType === 'mold') {
    signals.push({
      weight: 'minor',
      message: 'Existing mold issue suggests microclimate imbalance.',
    });
  } else if (input.problemType === 'over-wet') {
    signals.push({
      weight: 'major',
      message: 'Over-wet conditions strongly correlate with pest problems.',
    });
  }

  if (!input.foodType.trim()) {
    signals.push({
      weight: 'minor',
      message: 'Food type not specified — prediction uses conservative defaults.',
    });
  }

  return signals;
}

function levelFromSignals(signals: RiskSignal[]): PestRiskLevel {
  const majorCount = signals.filter((signal) => signal.weight === 'major').length;
  const minorCount = signals.filter((signal) => signal.weight === 'minor').length;

  if (majorCount >= 2 || (majorCount >= 1 && minorCount >= 2)) return 'high';
  if (majorCount >= 1 || minorCount >= 2) return 'moderate';
  return 'low';
}

const summaryByLevel: Record<PestRiskLevel, string> = {
  low: 'Conditions look relatively stable. Continue routine checks.',
  moderate: 'Some risk factors detected. Adjust humidity or substrate soon.',
  high: 'Several risk signals align. Inspect bottles and refresh substrate within 48h.',
};

/**
 * Placeholder heuristic until an AI model is connected.
 * Replace `predictPestOutbreak` implementation with API call when ready.
 */
export function predictPestOutbreak(input: PestPredictionInput): PestPredictionResult {
  const signals = collectRiskSignals(input);
  const level = levelFromSignals(signals);
  const factors =
    signals.length > 0
      ? signals.map((signal) => signal.message)
      : ['No major risk flags from current inputs.'];

  return {
    level,
    summary: summaryByLevel[level],
    factors,
    aiPayload: {
      ...input,
      modelVersion: 'placeholder-heuristic-v1',
    },
  };
}
