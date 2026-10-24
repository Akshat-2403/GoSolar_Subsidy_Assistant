import './components.css'

export type WizardStep = 1 | 2 | 3 | 4 | 5

const steps: { id: WizardStep; title: string; description: string }[] = [
  { id: 1, title: 'Feasibility & Documents', description: 'Consumer connection and site details' },
  { id: 2, title: 'Subsidy Selection', description: 'Compare eligible schemes' },
  { id: 3, title: 'Vendor Marketplace', description: 'Choose an installer' },
  { id: 4, title: 'Verification & Portal Review', description: 'Audit and review submission' },
  { id: 5, title: 'Application Tracking', description: 'Follow application milestones' },
]

export default function ProgressBar({ activeStep }: { activeStep: WizardStep }) {
  return <nav className="wizard-progress wizard-progress-vertical" aria-label="Application progress">
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
