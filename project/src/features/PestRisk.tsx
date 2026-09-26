import { useState } from 'react';
import { ShieldAlert, Save, Lock } from 'lucide-react';
import { Card, CardHeader } from '../components/ui/Card';
import { FormField, TextInput, SelectInput } from '../components/ui/FormField';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PremiumPaywall } from '../components/ui/PremiumPaywall';
import {
  PestPredictionPanel,
  createPredictionFormFromSubstrate,
  getResolvedSubstrateFromPredictionForm,
  type PestPredictionFormState,
} from '../components/pest/PestPredictionPanel';
import {
  PEST_RISK_LEVEL_LABEL,
  predictPestOutbreak,
  type PestPredictionResult,
} from '../utils/pestPrediction';
import type { PestRisk, PestProblem, PestRiskLevel, Severity, PestStatus } from '../types';
import { useLanguage } from '@/contexts/LanguageContext';

interface PestRiskProps {
  pestRisks: PestRisk[];
  onAdd: (risk: PestRisk) => void;
  onUpdate: (risk: PestRisk) => void;
}

const problemLabelKeys: Record<PestProblem, string> = {
  mites: 'pest.mites',
  mold: 'pest.mold',
  dryness: 'pest.dryness',
  'over-wet': 'pest.overWet',
  smell: 'pest.smell',
  unknown: 'pest.unknown',
};

const problemValues: PestProblem[] = ['mites', 'mold', 'dryness', 'over-wet', 'smell', 'unknown'];

const severityLabelKeys: Record<Severity, string> = {
  low: 'pest.low',
  medium: 'pest.medium',
  high: 'pest.high',
};

const severityValues: Severity[] = ['low', 'medium', 'high'];

const severityVariant: Record<Severity, 'warning' | 'danger'> = {
  low: 'warning',
  medium: 'warning',
  high: 'danger',
};

const riskLevelVariant: Record<PestRiskLevel, 'success' | 'warning' | 'danger'> = {
  low: 'success',
  moderate: 'warning',
  high: 'danger',
};

const emptyReportForm = {
  bottleId: '',
  problemType: 'mites' as PestProblem,
  severity: 'low' as Severity,
  dateNoticed: new Date().toISOString().slice(0, 10),
  actionTaken: '',
  status: 'open' as PestStatus,
};

export function PestRiskPage({ pestRisks, onAdd, onUpdate }: PestRiskProps) {
  const { t } = useLanguage();
  const [reportForm, setReportForm] = useState(emptyReportForm);
  const [predictionForm, setPredictionForm] = useState<PestPredictionFormState>(
    createPredictionFormFromSubstrate()
  );
  const [predictionResult, setPredictionResult] = useState<PestPredictionResult | null>(null);
  const [saved, setSaved] = useState(false);

  const nextId = `PR-${String(pestRisks.length + 1).padStart(3, '0')}`;
  const problemLabel = (problem: PestProblem) => t(problemLabelKeys[problem] ?? 'pest.unknown');
  const problemOptions = problemValues.map((value) => ({ value, label: problemLabel(value) }));
  const severityOptions = severityValues.map((value) => ({ value, label: t(severityLabelKeys[value]) }));

  const updateReport = <K extends keyof typeof reportForm>(key: K, value: (typeof reportForm)[K]) => {
    setReportForm((prev) => ({ ...prev, [key]: value }));
  };

  const updatePrediction = <K extends keyof PestPredictionFormState>(
    key: K,
    value: PestPredictionFormState[K]
  ) => {
    setPredictionForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleRunPrediction = () => {
    const result = predictPestOutbreak({
      substrateType: getResolvedSubstrateFromPredictionForm(predictionForm),
      temperature: predictionForm.temperature,
      humidity: predictionForm.humidity,
      foodType: predictionForm.foodType,
      problemType: reportForm.problemType,
    });
    setPredictionResult(result);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const substrateType = getResolvedSubstrateFromPredictionForm(predictionForm);

    const risk: PestRisk = {
      id: nextId,
      ...reportForm,
      createdAt: new Date().toISOString().slice(0, 10),
      substrateType,
      temperature: predictionForm.temperature,
      humidity: predictionForm.humidity,
      foodType: predictionForm.foodType.trim(),
      ...(predictionResult && {
        riskLevel: predictionResult.level,
        predictionSummary: predictionResult.summary,
      }),
    };

    onAdd(risk);
    setReportForm(emptyReportForm);
    setPredictionForm(createPredictionFormFromSubstrate());
    setPredictionResult(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleResolve = (risk: PestRisk) => {
    onUpdate({ ...risk, status: 'resolved' });
  };

  const openRisks = pestRisks.filter((r) => r.status === 'open');
  const resolvedRisks = pestRisks.filter((r) => r.status === 'resolved');

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-100">{t('pages.pestTitle')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('pages.pestSubtitle')}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[10px] font-semibold text-amber-300 uppercase tracking-wide">
          <Lock className="w-3 h-3" />
          {t('pest.premiumTools')}
        </span>
      </div>

      {openRisks.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            <span className="text-sm font-semibold text-red-400">
              {openRisks.length} Open Alert{openRisks.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {openRisks.map((r) => (
              <Badge key={r.id} variant={severityVariant[r.severity]}>
                {r.bottleId}: {problemLabel(r.problemType)}
                {r.riskLevel != null && ` · ${PEST_RISK_LEVEL_LABEL[r.riskLevel]}`}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <PremiumPaywall
        title={t('pest.assessmentTitle')}
        subtitle={t('pest.assessmentSubtitle')}
        footer={t('pest.upgradeFooter')}
      >
        <PestPredictionPanel
          form={predictionForm}
          onChange={updatePrediction}
          result={predictionResult}
          onRunPrediction={handleRunPrediction}
        />
      </PremiumPaywall>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader title={t('pest.reportTitle')} subtitle={t('pest.caseId', { id: nextId })} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label={t('pest.bottleId')} required>
              <TextInput
                value={reportForm.bottleId}
                onChange={(v) => updateReport('bottleId', v)}
                placeholder={t('pest.bottlePlaceholder')}
                required
              />
            </FormField>

            <FormField label={t('pest.problemType')} required>
              <SelectInput
                value={reportForm.problemType}
                onChange={(v) => updateReport('problemType', v as PestProblem)}
                options={problemOptions}
              />
            </FormField>

            <FormField label={t('pest.severity')} required>
              <SelectInput
                value={reportForm.severity}
                onChange={(v) => updateReport('severity', v as Severity)}
                options={severityOptions}
              />
            </FormField>

            <FormField label={t('pest.dateNoticed')}>
              <TextInput type="date" value={reportForm.dateNoticed} onChange={(v) => updateReport('dateNoticed', v)} />
            </FormField>

            <FormField label={t('pest.actionTaken')} className="md:col-span-2">
              <textarea
                value={reportForm.actionTaken}
                onChange={(e) => updateReport('actionTaken', e.target.value)}
                placeholder={t('pest.actionPlaceholder')}
                rows={3}
                className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-sky-500/50 focus:border-sky-500/50 transition-colors resize-none"
              />
            </FormField>
          </div>

          <p className="text-[11px] text-gray-500 mt-4">
            {t('pest.saveNote')}
          </p>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800">
            <div>
              {saved && <Badge variant="success">Pest risk reported!</Badge>}
            </div>
            <Button type="submit" variant="primary">
              <Save className="w-4 h-4" />
              {t('pest.reportIssue')}
            </Button>
          </div>
        </Card>
      </form>

      {openRisks.length > 0 && (
        <Card>
          <CardHeader title="Open Issues" subtitle={`${openRisks.length} active`} />
          <div className="space-y-3">
            {openRisks.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50 border border-gray-800"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-300 font-medium">{r.bottleId}</span>
                    <Badge variant={severityVariant[r.severity]}>{problemLabel(r.problemType)}</Badge>
                    <Badge variant="danger">{r.severity}</Badge>
                    {r.riskLevel != null && (
                      <Badge variant={riskLevelVariant[r.riskLevel]}>
                        {PEST_RISK_LEVEL_LABEL[r.riskLevel]}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {r.dateNoticed} &middot; {r.actionTaken || 'No action yet'}
                  </p>
                  {(r.substrateType || r.foodType) && (
                    <p className="text-[10px] text-gray-600 mt-1">
                      {r.substrateType && <>Substrate: {r.substrateType}</>}
                      {r.substrateType && r.foodType && ' · '}
                      {r.foodType && <>Food: {r.foodType}</>}
                      {r.temperature != null && r.temperature > 0 && (
                        <> · {r.temperature}°C / {r.humidity}% RH</>
                      )}
                    </p>
                  )}
                  {r.predictionSummary && (
                    <p className="text-[10px] text-amber-400/80 mt-1">{r.predictionSummary}</p>
                  )}
                </div>
                <Button variant="secondary" size="sm" onClick={() => handleResolve(r)}>
                  Resolve
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {resolvedRisks.length > 0 && (
        <Card>
          <CardHeader title="Resolved" subtitle={`${resolvedRisks.length} closed`} />
          <div className="space-y-2">
            {resolvedRisks.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-gray-800/30 opacity-70"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-gray-400">{r.bottleId}</span>
                  <Badge variant="success">resolved</Badge>
                  <span className="text-[10px] text-gray-600 truncate">{problemLabel(r.problemType)}</span>
                </div>
                <span className="text-[10px] text-gray-600 flex-shrink-0">{r.dateNoticed}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
