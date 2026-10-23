import './components.css'

export type WizardStep = 1 | 2 | 3

const steps: { id: WizardStep; title: string; description: string }[] = [
  { id: 1, title: 'Consumer & DISCOM', description: 'Consumer and utility details' },
  { id: 2, title: 'Site & Consumption', description: 'Roof and electricity use' },
  { id: 3, title: 'Subsidy & Verification', description: 'Estimate and review' },
]

export default function ProgressBar({ activeStep }: { activeStep: WizardStep }) {
  return <nav className="wizard-progress" aria-label="Application progress">
    <ol className="wizard-progress-list">
      {steps.map((step) => {
        const state = step.id < activeStep ? 'completed' : step.id === activeStep ? 'active' : 'pending'
        return <li className={`wizard-step wizard-step-${state}`} key={step.id} aria-current={state === 'active' ? 'step' : undefined}>
          <span className="wizard-step-marker" aria-hidden="true">{state === 'completed' ? '✓' : step.id}</span>
          <span className="wizard-step-copy"><strong>Step {step.id}: {step.title}</strong><small>{step.description}</small></span>
        </li>
      })}
    </ol>
  </nav>
}
