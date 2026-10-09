import type { ReactNode } from "react";

const STEP_LABELS = ["Essentials", "Optional details", "Review"] as const;

interface EntryWizardProps {
  title: string;
  step: number;
  saving: boolean;
  saveLabel: string;
  error: string;
  onBack: () => void;
  onNext: () => void;
  onCancel: () => void;
  children: ReactNode;
}

export default function EntryWizard({
  title,
  step,
  saving,
  saveLabel,
  error,
  onBack,
  onNext,
  onCancel,
  children,
}: EntryWizardProps) {
  const currentStep = STEP_LABELS[step] ?? STEP_LABELS[0];

  return (
    <div className="min-w-0 w-full max-w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted">Step {step + 1} of {STEP_LABELS.length} · {currentStep}</p>
        </div>
        <button type="button" onClick={onCancel} className="min-h-11 rounded-xl px-3 text-sm font-medium text-muted hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">Cancel</button>
      </div>

      <div className="mt-4 flex gap-2" role="progressbar" aria-label="Entry progress" aria-valuemin={1} aria-valuemax={STEP_LABELS.length} aria-valuenow={step + 1} aria-valuetext={`Step ${step + 1} of ${STEP_LABELS.length}: ${currentStep}`}>
        {STEP_LABELS.map((label, index) => (
          <span key={label} className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-accent" : "bg-border"}`} />
        ))}
      </div>

      <div className="mt-6 min-h-44 min-w-0">{children}</div>
      {error && <p role="alert" className="mt-4 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        {step > 0 ? (
          <button type="button" onClick={onBack} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Back</button>
        ) : <span />}
        {step < STEP_LABELS.length - 1 ? (
          <button type="button" onClick={onNext} className="min-h-11 min-w-28 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Next</button>
        ) : (
          <button type="submit" disabled={saving} className="min-h-11 min-w-36 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            {saving ? "Saving…" : saveLabel}
          </button>
        )}
      </div>
    </div>
  );
}
