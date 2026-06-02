import type { OutbreakRiskLevel, PestProblem } from '../types';

export interface PestPredictionInput {
  substrateType: string;
  temperature: number;
  humidity: number;
  foodType: string;
  problemType?: PestProblem;
}

export interface PestPredictionResult {
  score: number;
  level: OutbreakRiskLevel;
  summary: string;
  factors: string[];
  /** Shape ready to send to an AI API later */
  aiPayload: PestPredictionInput & { modelVersion: string };
}

function scoreToLevel(score: number): OutbreakRiskLevel {
  if (score >= 75) return 'critical';
  if (score >= 55) return 'high';
  if (score >= 35) return 'moderate';
  return 'low';
}

/**
 * Placeholder heuristic until an AI model is connected.
 * Replace `predictPestOutbreak` implementation with API call when ready.
 */
export function predictPestOutbreak(input: PestPredictionInput): PestPredictionResult {
  const factors: string[] = [];
  let score = 18;

  const substrate = input.substrateType.toLowerCase();
  const food = input.foodType.toLowerCase();

  if (input.humidity >= 82) {
    score += 28;
    factors.push('Very high humidity increases mold and mite risk.');
  } else if (input.humidity >= 70) {
    score += 14;
    factors.push('Elevated humidity may encourage mold growth.');
  } else if (input.humidity > 0 && input.humidity < 45) {
    score += 12;
    factors.push('Low humidity can stress larvae and worsen dryness issues.');
  }

  if (input.temperature >= 30) {
    score += 18;
    factors.push('High temperature accelerates substrate decomposition and pests.');
  } else if (input.temperature > 0 && input.temperature < 20) {
    score += 8;
    factors.push('Cool temperatures slow metabolism but can trap moisture locally.');
  }

  if (substrate.includes('kinshi') && input.humidity >= 75) {
    score += 16;
    factors.push('Kinshi-based substrate with high humidity is a common mite hotspot.');
  }

  if (substrate.includes('flake') && input.humidity >= 78) {
    score += 10;
    factors.push('Flake soil stays wet longer at high humidity.');
  }

  if (
    (food.includes('banana') || food.includes('fruit') || food.includes('protein')) &&
    input.humidity >= 72
  ) {
    score += 14;
    factors.push('Protein or fruit diets spoil faster in humid containers.');
  }

  if (input.problemType === 'mites') {
    score += 12;
    factors.push('Mites already reported — reinfestation risk is elevated.');
  } else if (input.problemType === 'mold') {
    score += 10;
    factors.push('Existing mold issue suggests microclimate imbalance.');
  } else if (input.problemType === 'over-wet') {
    score += 15;
    factors.push('Over-wet conditions strongly correlate with outbreaks.');
  }

  if (!input.foodType.trim()) {
    score += 4;
    factors.push('Food type not specified — prediction uses conservative defaults.');
  }

  score = Math.min(95, Math.max(5, Math.round(score)));
  const level = scoreToLevel(score);

  const summaryByLevel: Record<OutbreakRiskLevel, string> = {
    low: 'Conditions look relatively stable. Continue routine checks.',
    moderate: 'Some risk factors detected. Adjust humidity or substrate soon.',
    high: 'Several risk signals align. Inspect bottles and refresh substrate within 48h.',
    critical: 'High outbreak likelihood. Isolate affected bottles and correct environment immediately.',
  };

  return {
    score,
    level,
    summary: summaryByLevel[level],
    factors: factors.length > 0 ? factors : ['No major risk flags from current inputs.'],
    aiPayload: {
      ...input,
      modelVersion: 'placeholder-heuristic-v1',
    },
  };
}
