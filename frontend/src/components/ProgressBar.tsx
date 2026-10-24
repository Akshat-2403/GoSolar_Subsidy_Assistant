import './components.css'

export type WizardStep = 1 | 2 | 3 | 4 | 5

const steps: { id: WizardStep; title: string; description: string }[] = [
  { id: 1, title: 'Intake & Feasibility', description: 'Consumer, roof and usage' },
  { id: 2, title: 'Site & Subsidy', description: 'Feasibility and scheme choice' },
  { id: 3, title: 'Vendor & Finance', description: 'Select installer and plan' },
  { id: 4, title: 'Portal Submission', description: 'Review and submit' },
  { id: 5, title: 'Application Status', description: 'Track lifecycle milestones' },
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
