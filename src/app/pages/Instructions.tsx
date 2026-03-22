import { BookOpen, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router';
import { BreadcrumbInline } from '../components/BreadcrumbInline';
import { AppCard } from '../components/ui/app-card';
import { SectionHeader } from '../components/ui/section-header';
import { PrimaryButton, SecondaryButton } from '../components/ui/app-buttons';
import { InlineWarningCallout } from '../components/ui/inline-warning-callout';
import { useBudget } from '../context/BudgetContext';
import {
  getOnboardingProgress,
  getOnboardingSteps,
  getOnboardingSuggestions,
  getOnboardingTips,
  getNextBestStep,
} from '../utils/onboarding';

export function Instructions() {
  const { state } = useBudget();
  const steps = getOnboardingSteps(state);
  const progress = getOnboardingProgress(steps);
  const nextStep = getNextBestStep(steps);
  const suggestions = getOnboardingSuggestions(steps);
  const tips = getOnboardingTips(steps);

  const statusLabel = (status: string) => {
    if (status === 'completed') return 'Completed';
    if (status === 'in_progress') return 'In progress';
    if (status === 'needs_review') return 'Needs review';
    if (status === 'unavailable') return 'Unavailable';
    return 'Not started';
  };

  const statusClass = (status: string) => {
    if (status === 'completed') return 'bg-emerald-100 text-emerald-800';
    if (status === 'in_progress') return 'bg-blue-100 text-blue-800';
    if (status === 'needs_review') return 'bg-amber-100 text-amber-800';
    if (status === 'unavailable') return 'bg-gray-100 text-gray-700';
    return 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-emerald-600" />
              <h1 className="text-3xl font-bold text-gray-900">
                Getting Started
                <BreadcrumbInline />
              </h1>
            </div>
            <p className="text-gray-600 mt-2">
              Complete the core steps to unlock more accurate planning, cash flow, and wealth insights.
            </p>
          </div>
          {progress.completed === progress.total && (
            <div className="hidden md:flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
              Core setup complete
            </div>
          )}
        </div>
      </div>

      <AppCard className="space-y-4">
        <SectionHeader
          title="Progress Overview"
          subtitle={`You have completed ${progress.completed} of ${progress.total} setup steps.`}
        />
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Progress</span>
            <span className="font-medium text-gray-900">{progress.percent}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          {nextStep && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-50 px-4 py-3">
              <div>
                <div className="text-xs text-gray-500">Next best step</div>
                <div className="text-sm font-medium text-gray-900">{nextStep.title}</div>
                <div className="text-xs text-gray-500">{nextStep.description}</div>
              </div>
              <Link to={nextStep.path}>
                <PrimaryButton className="whitespace-nowrap">{nextStep.ctaLabel}</PrimaryButton>
              </Link>
            </div>
          )}
        </div>
      </AppCard>

      <AppCard className="space-y-4">
        <SectionHeader
          title="Onboarding Checklist"
          subtitle="Complete each step to activate the full product experience."
        />
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className="flex flex-col gap-3 rounded-lg border border-gray-100 bg-white p-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Step {index + 1}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusClass(step.status)}`}>
                    {statusLabel(step.status)}
                  </span>
                </div>
                <div className="text-sm font-semibold text-gray-900">{step.title}</div>
                <div className="text-xs text-gray-500">{step.description}</div>
                {step.helperText && (
                  <div className="text-xs text-amber-600">{step.helperText}</div>
                )}
              </div>
              <Link to={step.path}>
                <SecondaryButton className="whitespace-nowrap">{step.ctaLabel}</SecondaryButton>
              </Link>
            </div>
          ))}
        </div>
      </AppCard>

      <AppCard className="space-y-4">
        <SectionHeader
          title="Suggested Next Actions"
          subtitle="Based on your current setup."
        />
        <div className="space-y-3">
          {suggestions.map(suggestion => (
            <div key={suggestion.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-50 px-4 py-3">
              <div>
                <div className="text-sm font-medium text-gray-900">{suggestion.title}</div>
                <div className="text-xs text-gray-500">{suggestion.description}</div>
              </div>
              <Link to={suggestion.path}>
                <SecondaryButton className="whitespace-nowrap">{suggestion.ctaLabel}</SecondaryButton>
              </Link>
            </div>
          ))}
          {suggestions.length === 0 && (
            <InlineWarningCallout>
              You are fully onboarded. Use the sidebar to explore deeper analysis tools.
            </InlineWarningCallout>
          )}
        </div>
      </AppCard>

      <AppCard className="space-y-4">
        <SectionHeader
          title="Tips & Best Practices"
          subtitle="Short guidance based on your current data."
        />
        <div className="space-y-2 text-sm text-gray-600">
          {tips.map(tip => (
            <div key={tip.id} className="rounded-lg bg-gray-50 px-3 py-2">
              {tip.text}
            </div>
          ))}
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            Review monthly results regularly to keep your plan realistic and up to date.
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            Keep recurring items accurate to reduce manual adjustments.
          </div>
        </div>
      </AppCard>

      <AppCard className="space-y-3">
        <SectionHeader
          title="Color Legend"
          subtitle="Quick reminder for status colors used across the app."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-500 rounded"></div>
            <span>Under budget / Positive balance</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-rose-500 rounded"></div>
            <span>Over budget / Negative balance</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-amber-500 rounded"></div>
            <span>Warning / Close to limit</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>Income / Assets</span>
          </div>
        </div>
      </AppCard>
    </div>
  );
}
