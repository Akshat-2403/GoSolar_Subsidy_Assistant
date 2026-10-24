import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import DashboardSummary from './components/DashboardSummary'
import BillUpload from './components/BillUpload'
import FinancialPlan from './components/FinancialPlan'
import MockDiscomPortalModal, { type MockPortalConsumer } from './components/MockDiscomPortalModal'
import ProgressBar, { type WizardStep } from './components/ProgressBar'
import RoofVisualizer from './components/RoofVisualizer'
import SubsidyGuideModal from './components/SubsidyGuideModal'
import SubsidySelector from './components/SubsidySelector'
import VendorSelector from './components/VendorSelector'
import ApplicationLifecycleTracker from './components/ApplicationLifecycleTracker'
import discoms from './data/discoms.json'
import { applySolarPriceOverrides, calculateSolarFinancials, type LoanTenureYears, type PurchaseMode } from './utils/calculations'
import type { BillExtraction } from './utils/billParser'
import type { SubsidyItem, TrackingRecord, VendorItem } from './types/journey'
import { openFeasibilityProposal } from './utils/proposalExport'
import { validateConsumerNumber, validateMobile, validatePincode, validatePositiveNumber, validateSanctionedLoad } from './utils/validation'
import './App.css'
import './journey.css'

const API_URL = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const PORTAL_URL = import.meta.env.VITE_PORTAL_URL?.trim() || ''
const BILL_OCR_URL = import.meta.env.VITE_BILL_OCR_URL || `${API_URL}/api/bills/parse`

type EventItem = { node: string; status: string; message: string; timestamp: string }
type Evidence = { evidence_id: string; rule_applied: string; source_title: string; verbatim_snippet: string; rule: string; outcome: string; excerpt: string; checked_at: string; source_url: string | null }
type Workflow = {
  workflow_id: string; state: string; can_proceed: boolean; human_approval_required: boolean
  issues: string[]; missing_documents: string[]; application_parameters: Record<string, unknown>
  evidence_log: Evidence[]; events: EventItem[]; financial_summary: null | {
    estimated_subsidy_inr: number; estimated_annual_generation_kwh: number; estimated_annual_savings_inr: number; estimated_payback_years: number
  }; application_id: string | null; policy_assessment: string | null
}
type Intake = {
  applicant_name: string; state: string; applicant_type: 'owner' | 'tenant'; consumer_number: string
  discom_code: string; sanctioned_load_kw: number | ''; proposed_capacity_kw: number | ''; owns_rooftop: boolean
  has_grid_connection: boolean; roof_shadow_clearance_declared: boolean; installer_id: string; installer_empanelled: boolean; landlord_noc_uploaded: boolean
  required_documents: string; uploaded_documents: string; tariff_inr_per_kwh: number | ''
  monthly_units: number | ''; roof_area_sqft: number | ''; pincode: string; mobile: string; address: string
}
const fallbackSchemes: SubsidyItem[] = [
  { id: 'pm-surya-ghar', name: 'PM Surya Ghar: Muft Bijli Yojana', provider: 'Central Government', kind: 'residential', eligibility: ['Residential Only'], perks: ['Central rooftop assistance', 'Net-metering pathway'], estimated_subsidy_inr: 0, illustrative: false },
  { id: 'state-top-up', name: 'State Solar Incentive (illustrative)', provider: 'State / DISCOM', kind: 'residential', eligibility: ['Selected states', 'Residential'], perks: ['Potential state top-up'], estimated_subsidy_inr: 0, illustrative: true },
  { id: 'pm-kusum', name: 'PM-KUSUM Components A/C (illustrative)', provider: 'Central + State', kind: 'agricultural', eligibility: ['Agrarian feeder'], perks: ['Agricultural solar support'], estimated_subsidy_inr: 0, illustrative: true },
  { id: 'rwa-aggregate', name: 'Housing Society Common Facilities (illustrative)', provider: 'Central / State programs', kind: 'rwa', eligibility: ['RWA Compatible'], perks: ['Aggregated capacity assessment'], estimated_subsidy_inr: 0, illustrative: true },
]
const fallbackVendors: VendorItem[] = [
  { id: 'tata-cleanmax', name: 'Tata Power Solar / CleanMax Premier', tier: 'Tier 1 Certified', price_per_kw: 58000, rating: 4.9, installs: '1,200+ rooftop installs', specs: 'Tier-1 bifacial N-Type panels, micro-inverters, 10-year free O&M, 25-year panel warranty', turnaround_days: 14 },
  { id: 'waaree-eco', name: 'Waaree Energies Eco-Smart', tier: 'Value / Standard', price_per_kw: 48000, rating: 4.7, installs: '850+ installs', specs: 'Mono-PERC modules, string inverter, 5-year free O&M, 25-year performance warranty', turnaround_days: 20 },
  { id: 'adani-loom-fast', name: 'Adani Solar Express / Loom Solar Fast-Track', tier: 'Speed & Budget Pick', price_per_kw: 44000, rating: 4.5, installs: '600+ installs', specs: 'Grid-tie inverter, standard panels, 2-year warranty, DISCOM liaison', turnaround_days: 10 },
]
class BackendUnavailableError extends Error {}

async function readApiJson(response: Response): Promise<Record<string, unknown>> {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('json')) throw new BackendUnavailableError('The API endpoint is unavailable on this deployment.')
  try {
    return await response.json() as Record<string, unknown>
  } catch {
    throw new BackendUnavailableError('The API returned an unreadable response.')
  }
}

const defaults: Intake = {
  applicant_name: '', state: '', applicant_type: 'owner', consumer_number: '', discom_code: '',
  sanctioned_load_kw: '', proposed_capacity_kw: '', owns_rooftop: true, has_grid_connection: true,
  installer_id: '', installer_empanelled: true, landlord_noc_uploaded: false,
  required_documents: 'Electricity bill, Aadhaar', uploaded_documents: '', tariff_inr_per_kwh: '',
  monthly_units: '', roof_area_sqft: '', pincode: '', mobile: '', address: '', roof_shadow_clearance_declared: false,
}
const demo: Intake = {
  ...defaults, applicant_name: 'Asha Sharma', state: 'Maharashtra', applicant_type: 'owner',
  consumer_number: 'MH12345678', discom_code: 'MSEDCL (Mahavitaran)', sanctioned_load_kw: 3.5,
  proposed_capacity_kw: 3, installer_id: 'DEMO-VENDOR-001', pincode: '411001', mobile: '9876543210',
  monthly_units: 400, roof_area_sqft: 350, tariff_inr_per_kwh: 8, uploaded_documents: 'Electricity bill, Aadhaar', address: 'Demo address, Pune, Maharashtra', roof_shadow_clearance_declared: true,
}
const workflowNodes = [
  ['validate_input', 'Validate intake schema', 'Required fields and numeric bounds'],
  ['policy_checks', 'Evaluate policy guardrails', 'Ownership, grid, vendor, capacity and documents'],
  ['policy_evidence', 'Retrieve policy evidence', 'Scheme and DISCOM guidance with cited excerpts'],
  ['financial_calculation', 'Calculate estimate', 'Subsidy slab, generation and payback'],
  ['human_review', 'Human approval gate', 'Review the payload before mock filing'],
  ['portal_submission', 'Submit to mock portal', 'Capture simulated application ID'],
]
const submissionChecks = ['Verify net-metering compatibility', 'Check roof and shadow-clearance declaration', 'Audit proposed capacity against sanctioned load']

function stateCode(state: string): string {
  const known: Record<string, string> = { Maharashtra: 'MH', Gujarat: 'GJ', Delhi: 'DL', Karnataka: 'KA', Rajasthan: 'RJ', 'Tamil Nadu': 'TN' }
  return known[state] || state.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'IN'
}
function makeLocalTracking(id: string, form: Intake, subsidy: SubsidyItem | undefined, vendor: VendorItem | undefined, size: number, now: string, logs: EventItem[]): TrackingRecord {
  const milestones = ['Application Submitted', 'DISCOM Technical Feasibility Approved', 'Vendor Site Inspection Scheduled', 'Net Meter Installed', 'Subsidy Disbursed to Bank Account']
  return {
    tracking_id: id, application_id: null, status: 'submitted', current_stage: 0, submitted_at: now, updated_at: now,
    milestones: milestones.map((title, index) => ({ title, status: index === 0 ? 'completed' : 'pending', timestamp: index === 0 ? now : null })),
    agent_validation_logs: logs.map((log) => ({ timestamp: log.timestamp, stage: log.node, message: log.message, status: log.status })),
    application: { applicant_name: form.applicant_name, state: form.state, consumer_number: form.consumer_number, discom_code: form.discom_code, address: form.address.trim().replace(/\s+/g, ' '), system_size_kw: size, sanctioned_load_kw: Number(form.sanctioned_load_kw), subsidy: { id: subsidy?.id || 'pm-surya-ghar', name: subsidy?.name || 'PM Surya Ghar', estimated_inr: subsidy?.estimated_subsidy_inr || 0 }, vendor: { id: vendor?.id || 'waaree-eco', name: vendor?.name || 'Waaree Energies Eco-Smart', price_per_kw: vendor?.price_per_kw || 48000 } },
  }
}
function saveLocalTracking(record: TrackingRecord) {
  try {
    const store = JSON.parse(localStorage.getItem('gosolar-tracking-records') || '{}') as Record<string, TrackingRecord>
    store[record.tracking_id] = record
    localStorage.setItem('gosolar-tracking-records', JSON.stringify(store))
  } catch { /* The server-side tracking store remains the source when local storage is unavailable. */ }
}

function App() {
  const localWorkflowId = useId()
  const [form, setForm] = useState<Intake>(defaults)
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [events, setEvents] = useState<EventItem[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [guide, setGuide] = useState(false)
  const [activeStep, setActiveStep] = useState<WizardStep>(1)
  const [offlinePreview, setOfflinePreview] = useState(false)
  const [offlineAvailable, setOfflineAvailable] = useState(false)
  const [purchaseMode, setPurchaseMode] = useState<PurchaseMode>('cash')
  const [loanTenureYears, setLoanTenureYears] = useState<LoanTenureYears>(5)
  const [interestRatePct, setInterestRatePct] = useState(7)
  const [billUploadKey, setBillUploadKey] = useState(0)
  const [currentView, setCurrentView] = useState<'assessment' | 'tracking'>('assessment')
  const [portalOpen, setPortalOpen] = useState(false)
  const [consumerGroup, setConsumerGroup] = useState<'residential' | 'agricultural' | 'rwa'>('residential')
  const [subsidies, setSubsidies] = useState<SubsidyItem[]>(fallbackSchemes)
  const [vendors, setVendors] = useState<VendorItem[]>(fallbackVendors)
  const [selectedSubsidyId, setSelectedSubsidyId] = useState('pm-surya-ghar')
  const [selectedVendorId, setSelectedVendorId] = useState('waaree-eco')
  const [trackingRecord, setTrackingRecord] = useState<TrackingRecord | null>(null)
  const [trackingSearch, setTrackingSearch] = useState('')
  const [submissionCheckStep, setSubmissionCheckStep] = useState(0)
  const activeWorkflowId = workflow?.workflow_id
  const stateNames = Object.keys(discoms).sort()
  const discomOptions = form.state ? discoms[form.state as keyof typeof discoms] ?? [] : []
  const currentCapacity = Number(form.proposed_capacity_kw) || 0
  const activeSubsidies = subsidies.map((scheme) => {
    let amount = 0
    if (scheme.id === 'pm-surya-ghar' && consumerGroup === 'residential') amount = Math.round(Math.min(currentCapacity, 2) * 30000 + Math.min(Math.max(currentCapacity - 2, 0), 1) * 18000)
    if (scheme.id === 'state-top-up' && consumerGroup === 'residential' && currentCapacity >= 1) amount = form.state === 'Gujarat' ? 15000 : 10000
    if (scheme.id === 'pm-kusum' && consumerGroup === 'agricultural') amount = Math.round(currentCapacity * 36000)
    if (scheme.id === 'rwa-aggregate' && consumerGroup === 'rwa') amount = Math.round(Math.min(currentCapacity, 500) * 18000)
    return { ...scheme, estimated_subsidy_inr: amount }
  })
  const selectedSubsidy = activeSubsidies.find((scheme) => scheme.id === selectedSubsidyId)

  useEffect(() => {
    let cancelled = false
    const query = new URLSearchParams({ state: form.state, capacity_kw: String(Number(form.proposed_capacity_kw) || 1), consumer_group: consumerGroup })
    Promise.all([
      fetch(`${API_URL}/api/subsidies?${query}`).then((response) => response.ok ? response.json() as Promise<SubsidyItem[]> : null).catch(() => null),
      fetch(`${API_URL}/api/vendors`).then((response) => response.ok ? response.json() as Promise<VendorItem[]> : null).catch(() => null),
    ]).then(([schemeData, vendorData]) => {
      if (cancelled) return
      if (schemeData) setSubsidies(schemeData)
      if (vendorData) setVendors(vendorData)
    })
    return () => { cancelled = true }
  }, [form.state, form.proposed_capacity_kw, consumerGroup])

  useEffect(() => {
    if (!activeWorkflowId || offlinePreview) return
    const stream = new EventSource(`${API_URL}/api/workflows/${activeWorkflowId}/events`)
    stream.onmessage = (message) => {
      try {
        const item = JSON.parse(message.data) as EventItem
        setEvents((current) => current.some((event) => event.node === item.node && event.timestamp === item.timestamp) ? current : [...current, item])
      } catch { setError('Received an unreadable workflow event.') }
    }
    stream.addEventListener('complete', () => stream.close())
    stream.onerror = () => stream.close()
    return () => stream.close()
  }, [activeWorkflowId, offlinePreview])

  useEffect(() => {
    if (!busy || activeStep !== 4) return
    const timer = window.setInterval(() => setSubmissionCheckStep((step) => Math.min(step + 1, 2)), 850)
    return () => window.clearInterval(timer)
  }, [busy, activeStep])

  function update<K extends keyof Intake>(key: K, value: Intake[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    if (key === 'state') setForm((current) => ({ ...current, state: value as string, discom_code: '' }))
  }
  const validation = {
    name: form.applicant_name.trim().length >= 2 ? null : 'Enter the applicant name (at least 2 characters).',
    consumer: validateConsumerNumber(form.consumer_number),
    load: validateSanctionedLoad(form.sanctioned_load_kw),
    pin: validatePincode(form.pincode),
    mobile: validateMobile(form.mobile),
    monthly: validatePositiveNumber(form.monthly_units, 'Monthly units'),
    roof: validatePositiveNumber(form.roof_area_sqft, 'Roof area'),
    capacity: Number(form.proposed_capacity_kw) > Number(form.sanctioned_load_kw) ? 'Planned capacity cannot exceed the sanctioned load.' : validatePositiveNumber(form.proposed_capacity_kw, 'Planned capacity'),
    tariff: validatePositiveNumber(form.tariff_inr_per_kwh, 'Tariff'),
  }
  const stepOneValid = !validation.name && !validation.consumer && !validation.load && !validation.pin && !validation.mobile && !!form.state && !!form.discom_code
  const stepTwoValid = !validation.monthly && !validation.roof && !validation.capacity && !validation.tariff
  const baseFinancialEstimate = Number(form.monthly_units) > 0 && Number(form.sanctioned_load_kw) > 0 && Number(form.tariff_inr_per_kwh) > 0
    ? calculateSolarFinancials({ monthlyUnits: Number(form.monthly_units), sanctionedLoadKw: Number(form.sanctioned_load_kw), roofAreaSqft: Number(form.roof_area_sqft), proposedCapacityKw: Number(form.proposed_capacity_kw), tariffInrPerKwh: Number(form.tariff_inr_per_kwh) }, interestRatePct, loanTenureYears)
    : null
  const financialEstimate = applySolarPriceOverrides(baseFinancialEstimate, vendors.find((item) => item.id === selectedVendorId)?.price_per_kw ?? 60000, selectedSubsidy?.estimated_subsidy_inr ?? 0, interestRatePct, loanTenureYears)
  const estimatedSize = financialEstimate?.systemCapacityKw ?? 0
  const portalConsumer: MockPortalConsumer = {
    applicantName: form.applicant_name,
    consumerNumber: form.consumer_number,
    sanctionedLoadKw: form.sanctioned_load_kw,
    appliedCapacityKw: form.proposed_capacity_kw,
    state: form.state,
    discom: form.discom_code,
  }

  async function openMockPortal() {
    if (PORTAL_URL) {
      try {
        const portalUrl = new URL(PORTAL_URL, window.location.origin)
        if (/^https?:$/.test(portalUrl.protocol) && portalUrl.origin !== window.location.origin) {
          const portalWindow = window.open('about:blank', '_blank')
          if (!portalWindow) { setPortalOpen(true); return }
          portalWindow.opener = null
          const controller = new AbortController()
          const timeout = window.setTimeout(() => controller.abort(), 2500)
          try {
            await fetch(portalUrl.href, { method: 'HEAD', mode: 'no-cors', signal: controller.signal })
            portalWindow.location.replace(portalUrl.href)
            return
          } catch {
            portalWindow.close()
          } finally {
            window.clearTimeout(timeout)
          }
        }
      } catch {
        // Invalid or same-origin server routes use the static-friendly in-app portal.
      }
    }
    setPortalOpen(true)
  }

  function applyBillExtraction(data: BillExtraction) {
    setForm((current) => ({
      ...current,
      consumer_number: data.consumerNumber ?? current.consumer_number,
      sanctioned_load_kw: data.sanctionedLoadKw ?? current.sanctioned_load_kw,
      monthly_units: data.monthlyUnits ?? current.monthly_units,
    }))
  }

  function downloadProposal() {
    if (!financialEstimate) return
    const opened = openFeasibilityProposal({
      applicantName: form.applicant_name, consumerNumber: form.consumer_number,
      state: form.state, discom: form.discom_code, roofAreaSqft: Number(form.roof_area_sqft),
      estimate: financialEstimate, purchaseMode, loanTenureYears, interestRatePct,
    })
    if (!opened) setError('Your browser blocked the proposal window. Allow pop-ups for GoSolar and try again.')
  }

  function createOfflinePreview(): boolean {
    if (!financialEstimate) {
      setError('Complete the financial inputs before creating a local preview.')
      return false
    }
    const now = new Date().toISOString()
    const mockEvents: EventItem[] = [
      { node: 'validate_input', status: 'completed', message: 'Intake fields passed local preview checks.', timestamp: now },
      { node: 'policy_checks', status: 'completed', message: 'Preview only; policy services were not contacted.', timestamp: now },
      { node: 'financial_calculation', status: 'completed', message: 'Indicative estimate calculated locally.', timestamp: now },
      { node: 'human_review', status: 'waiting', message: 'Review the preview before simulated submission.', timestamp: now },
    ]
    setWorkflow({
      workflow_id: `LOCAL-${localWorkflowId}`, state: 'human_review_required', can_proceed: true,
      human_approval_required: true, issues: [], missing_documents: [], application_parameters: { ...form },
      evidence_log: [], events: mockEvents,
      financial_summary: {
        estimated_subsidy_inr: financialEstimate.subsidyInr,
        estimated_annual_generation_kwh: financialEstimate.annualGenerationKwh,
        estimated_annual_savings_inr: financialEstimate.annualBillSavingsInr,
        estimated_payback_years: financialEstimate.cashPaybackYears,
      },
      application_id: null, policy_assessment: 'Local preview estimate only. No backend, policy source, or portal was contacted.',
    })
    setEvents(mockEvents)
    setOfflinePreview(true)
    setOfflineAvailable(false)
    return true
  }

  async function evaluate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!stepOneValid || !stepTwoValid) { setError('Complete all required fields in Steps 1 and 2 before evaluating.'); return }
    setError(''); setBusy(true)
    if (offlinePreview) {
      createOfflinePreview()
      setBusy(false)
      return
    }
    const payload = {
      applicant_name: form.applicant_name.trim(), state: form.state, applicant_type: form.applicant_type,
      consumer_number: form.consumer_number.trim().toUpperCase(), discom_code: form.discom_code,
      sanctioned_load_kw: Number(form.sanctioned_load_kw), proposed_capacity_kw: Number(form.proposed_capacity_kw),
      owns_rooftop: form.owns_rooftop, has_grid_connection: form.has_grid_connection, roof_shadow_clearance_declared: form.roof_shadow_clearance_declared,
      installer_id: selectedVendorId, installer_empanelled: true,
      landlord_noc_uploaded: form.landlord_noc_uploaded,
      required_documents: form.required_documents.split(',').map((item) => item.trim()).filter(Boolean),
      uploaded_documents: form.uploaded_documents.split(',').map((item) => item.trim()).filter(Boolean),
      tariff_inr_per_kwh: Number(form.tariff_inr_per_kwh),
      monthly_avg_consumption_kwh: Number(form.monthly_units), rooftop_area_sqft: Number(form.roof_area_sqft),
    }
    try {
      const response = await fetch(`${API_URL}/api/workflows/evaluate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await readApiJson(response)
      if (!response.ok) {
        if ([502, 503, 504].includes(response.status)) throw new BackendUnavailableError('The backend service is temporarily unavailable.')
        throw new Error(typeof data.detail === 'string' ? data.detail : `Evaluation failed (${response.status})`)
      }
      setWorkflow(data as Workflow); setEvents(data.events as EventItem[])
    } catch (reason) {
      if (reason instanceof TypeError || reason instanceof BackendUnavailableError) {
        createOfflinePreview()
        setError('Backend agent service is unavailable. A local preview is ready; no application was sent.')
      } else {
        setError(reason instanceof Error ? reason.message : 'The backend could not complete the assessment.')
      }
    }
    finally { setBusy(false) }
  }
  async function approve() {
    if (!workflow) return
    setSubmissionCheckStep(0)
    if (offlinePreview) {
      const now = new Date().toISOString()
      const trackingId = `SOLAR-${stateCode(form.state)}-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900000) + 100000)}`
      const record = makeLocalTracking(trackingId, form, selectedSubsidy, vendors.find((item) => item.id === selectedVendorId), estimatedSize, now, events)
      saveLocalTracking(record); setTrackingRecord(record)
      setWorkflow({ ...workflow, state: 'submitted', human_approval_required: false, application_id: `LOCAL-DEMO-${Date.now().toString().slice(-6)}` }); setActiveStep(5)
      return
    }
    setBusy(true); setError('')
    try {
      const requestPayload = {
        applicant_name: form.applicant_name.trim(), state: form.state, applicant_type: form.applicant_type,
        consumer_number: form.consumer_number.trim().toUpperCase(), discom_code: form.discom_code,
        sanctioned_load_kw: Number(form.sanctioned_load_kw), proposed_capacity_kw: Number(form.proposed_capacity_kw),
        owns_rooftop: form.owns_rooftop, has_grid_connection: form.has_grid_connection, roof_shadow_clearance_declared: form.roof_shadow_clearance_declared,
        installer_id: selectedVendorId, installer_empanelled: true, landlord_noc_uploaded: form.landlord_noc_uploaded,
        required_documents: form.required_documents.split(',').map((item) => item.trim()).filter(Boolean),
        uploaded_documents: form.uploaded_documents.split(',').map((item) => item.trim()).filter(Boolean),
        tariff_inr_per_kwh: Number(form.tariff_inr_per_kwh), monthly_avg_consumption_kwh: Number(form.monthly_units),
        rooftop_area_sqft: Number(form.roof_area_sqft), address: form.address, consumer_group: consumerGroup,
        subsidy_id: selectedSubsidyId, vendor_id: selectedVendorId, workflow_id: workflow.workflow_id,
      }
      const response = await fetch(`${API_URL}/api/submit-application`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestPayload) })
      const data = await readApiJson(response)
      if (!response.ok) {
        if ([502, 503, 504].includes(response.status)) throw new BackendUnavailableError('The backend service is temporarily unavailable.')
        throw new Error(typeof data.detail === 'string' ? data.detail : `Submission failed (${response.status})`)
      }
      const record = data as unknown as TrackingRecord
      setTrackingRecord(record); saveLocalTracking(record)
      setWorkflow({ ...workflow, state: 'submitted', human_approval_required: false, application_id: record.application_id }); setEvents(record.agent_validation_logs.map((log) => ({ node: log.stage, status: log.status, message: log.message, timestamp: log.timestamp }))); setActiveStep(5)
    } catch (reason) {
      if (reason instanceof TypeError || reason instanceof BackendUnavailableError) {
        setOfflineAvailable(true)
        setOfflinePreview(true)
        setError('Backend service is unavailable. You can complete this assessment as a local preview; no portal submission was sent.')
      } else setError(reason instanceof Error ? reason.message : 'Could not submit to the mock portal.')
    }
    finally { setBusy(false) }
  }
  function useDemo() {
    setForm(demo); setWorkflow(null); setEvents([]); setError(''); setConsumerGroup('residential'); setSelectedSubsidyId('pm-surya-ghar'); setSelectedVendorId('waaree-eco')
    setActiveStep(1); setOfflinePreview(false); setOfflineAvailable(false); setBillUploadKey((key) => key + 1)
  }
  function startNew() {
    setForm(defaults); setWorkflow(null); setEvents([]); setError(''); setActiveStep(1); setOfflinePreview(false); setOfflineAvailable(false); setBillUploadKey((key) => key + 1); setTrackingRecord(null); setConsumerGroup('residential'); setSelectedSubsidyId('pm-surya-ghar'); setSelectedVendorId('waaree-eco')
  }
  function continueFromStepOne() { if (stepOneValid) { setError(''); setActiveStep(2) } else setError('Please resolve the highlighted Step 1 fields before continuing.') }
  function continueFromStepTwo() { if (stepTwoValid) { setError(''); setActiveStep(3) } else setError('Please complete the required site and consumption fields.') }
  async function lookupTracking() {
    const key = trackingSearch.trim().toUpperCase()
    if (!key) { setError('Enter your GoSolar tracking ID.'); return }
    setError('')
    try {
      const response = await fetch(`${API_URL}/api/track/${encodeURIComponent(key)}`)
      if (response.ok) { const record = await response.json() as TrackingRecord; setTrackingRecord(record); return }
    } catch { /* The local saved receipt is the offline fallback. */ }
    try {
      const records = JSON.parse(localStorage.getItem('gosolar-tracking-records') || '{}') as Record<string, TrackingRecord>
      if (records[key]) { setTrackingRecord(records[key]); return }
    } catch { /* Ignore an unreadable local receipt store. */ }
    setTrackingRecord(null); setError('Tracking ID was not found. Backend records are held by the demo service; local previews are available only in this browser.')
  }
  async function advanceTracking() {
    if (!trackingRecord) return
    try {
      const response = await fetch(`${API_URL}/api/track/${encodeURIComponent(trackingRecord.tracking_id)}/advance`, { method: 'POST' })
      if (response.ok) { const next = await response.json() as TrackingRecord; setTrackingRecord(next); saveLocalTracking(next); return }
    } catch { /* Local demo fallback below. */ }
    const nextIndex = Math.min(trackingRecord.current_stage + 1, trackingRecord.milestones.length - 1)
    const now = new Date().toISOString()
    const next = { ...trackingRecord, current_stage: nextIndex, status: nextIndex === trackingRecord.milestones.length - 1 ? 'completed' : 'in_progress', updated_at: now, milestones: trackingRecord.milestones.map((item, index) => index === nextIndex ? { ...item, status: 'completed', timestamp: now } : item), agent_validation_logs: [...trackingRecord.agent_validation_logs, { timestamp: now, stage: 'demo_stage_advance', message: `Demo lifecycle advanced to ${trackingRecord.milestones[nextIndex].title}.`, status: 'completed' }] }
    setTrackingRecord(next); saveLocalTracking(next)
  }
  async function rescheduleTracking() {
    if (!trackingRecord) return
    const requestedDate = window.prompt('Preferred site survey date (optional):')
    if (requestedDate === null) return
    try {
      const response = await fetch(`${API_URL}/api/track/${encodeURIComponent(trackingRecord.tracking_id)}/reschedule?requested_date=${encodeURIComponent(requestedDate)}`, { method: 'POST' })
      if (response.ok) { const next = await response.json() as TrackingRecord; setTrackingRecord(next); saveLocalTracking(next); return }
    } catch { /* Local demo fallback below. */ }
    const now = new Date().toISOString()
    const next = { ...trackingRecord, updated_at: now, agent_validation_logs: [...trackingRecord.agent_validation_logs, { timestamp: now, stage: 'site_survey_reschedule', message: `Demo reschedule request recorded${requestedDate ? ` for ${requestedDate}` : ''}; vendor confirmation is pending.`, status: 'waiting' }] }
    setTrackingRecord(next); saveLocalTracking(next)
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">☼</div><div><strong>GoSolar<span>.</span></strong><small>SUBSIDY ASSISTANT</small></div></div>
      <div className="workspace-label">YOUR APPLICATION</div>
      <nav className="nav-list"><button className={`nav-item ${currentView === 'assessment' ? 'selected' : ''}`} onClick={() => setCurrentView('assessment')}><span className="nav-icon">A</span>New assessment</button><button className={`nav-item ${currentView === 'tracking' ? 'selected' : ''}`} onClick={() => setCurrentView('tracking')}><span className="nav-icon">T</span>Track application</button><button className="nav-item" onClick={() => { startNew(); setCurrentView('assessment') }}><span className="nav-icon">R</span>Start over</button></nav>
      <div className="sidebar-bottom"><div className="system-card"><span className="status-dot" /><div><strong>Demo services</strong><small>Agent API · mock portal</small></div></div><div className="profile"><div className="avatar">GS</div><div><strong>GoSolar workspace</strong><small>Human approval enabled</small></div></div></div>
    </aside>
    <div className="main-area">
      <header className="topbar"><div className="breadcrumbs"><strong>GoSolar</strong><span>/</span>{currentView === 'assessment' ? 'New solar assessment' : 'Track application'}</div><div className="topbar-right"><div className="app-view-switcher" role="group" aria-label="GoSolar workspace view"><button type="button" aria-pressed={currentView === 'assessment'} className={currentView === 'assessment' ? 'active' : ''} onClick={() => setCurrentView('assessment')}>New Assessment</button><button type="button" aria-pressed={currentView === 'tracking'} className={currentView === 'tracking' ? 'active' : ''} onClick={() => setCurrentView('tracking')}>Track Application</button></div><div className="env-pill"><span className="status-dot" />{offlinePreview ? 'OFFLINE PREVIEW' : 'AGENT API'}</div><button className="button button-quiet" type="button" onClick={useDemo}>Try Demo</button><button className="button button-quiet" type="button" onClick={openMockPortal}>Open mock portal</button></div></header>
      <main className="page-content">
        {currentView === 'assessment' ? <>
        <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" />ROOFTOP SOLAR · PERSONALIZED ESTIMATE</div><h1>Plan your <span>solar journey</span></h1><p>Share a few details to explore your rooftop potential and available subsidy estimate.</p></div><button className="button button-outline" type="button" onClick={() => setGuide(true)}>Learn about subsidies</button></div>
        <ProgressBar activeStep={activeStep} />
        {error && <div className="notice notice-warning" role="alert"><span className="notice-symbol">!</span><span>{error}</span>{offlineAvailable && <button type="button" className="button button-quiet offline-action" onClick={() => { setOfflinePreview(true); setOfflineAvailable(false); setError('') }}>Continue in offline preview</button>}<button type="button" aria-label="Dismiss message" onClick={() => setError('')}>×</button></div>}
        {offlinePreview && <div className="offline-note" role="status">Offline preview is active. Estimates are local approximations; no policy checks or portal submissions will be made.</div>}
        {workflow?.issues.map((issue) => <div className="notice notice-warning" key={issue}><span className="notice-symbol">!</span>{issue}</div>)}
        {workflow?.state === 'submitted' && <div className="notice notice-success"><span className="notice-symbol">✓</span>{offlinePreview ? 'Offline preview completed. No application was sent to a portal.' : 'Mock portal accepted the filing. This is a demonstration receipt, not a government approval.'}</div>}
        <div className="wizard-layout">
          <section className="panel wizard-panel">
            {activeStep === 1 && <>
              <PanelHeading kicker="STEP 01 · CONSUMER & DISCOM" title="Your electricity connection" subtitle="Enter the details shown on your latest electricity bill." icon="01" />
              <BillUpload key={billUploadKey} endpoint={BILL_OCR_URL} onExtracted={applyBillExtraction} />
              <form onSubmit={(event) => { event.preventDefault(); continueFromStepOne() }} noValidate>
                <Field label="Applicant name"><input autoComplete="name" value={form.applicant_name} onChange={(event) => update('applicant_name', event.target.value)} placeholder="e.g. Asha Sharma" aria-invalid={!!validation.name} />{form.applicant_name && validation.name && <small className="field-error">{validation.name}</small>}</Field>
                <div className="form-grid">
                  <Field label="State"><select value={form.state} onChange={(event) => update('state', event.target.value)}><option value="">Select your state / UT</option>{stateNames.map((name) => <option key={name} value={name}>{name}</option>)}</select>{!form.state && <small>Select a state to see its DISCOMs.</small>}</Field>
                  <Field label="DISCOM / electricity provider"><select value={form.discom_code} onChange={(event) => update('discom_code', event.target.value)} disabled={!form.state}><option value="">Select your DISCOM</option>{discomOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select></Field>
                  <Field label="Consumer / CA number"><input autoComplete="off" value={form.consumer_number} onChange={(event) => update('consumer_number', event.target.value.replace(/\s/g, '').toUpperCase())} placeholder="8–15 letters or digits" aria-invalid={!!form.consumer_number && !!validation.consumer} />{form.consumer_number && validation.consumer && <small className="field-error">{validation.consumer}</small>}</Field>
                  <Field label="Sanctioned load (kW)"><input type="number" min="0.5" max="50" step="0.1" value={form.sanctioned_load_kw} onChange={(event) => update('sanctioned_load_kw', event.target.value === '' ? '' : Number(event.target.value))} aria-invalid={!!validation.load} />{validation.load && <small className="field-error">{validation.load}</small>}</Field>
                  <Field label="Pincode"><input inputMode="numeric" autoComplete="postal-code" maxLength={6} value={form.pincode} onChange={(event) => update('pincode', event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit PIN code" aria-invalid={!!form.pincode && !!validation.pin} />{form.pincode && validation.pin && <small className="field-error">{validation.pin}</small>}</Field>
                  <Field label="Mobile number"><input inputMode="numeric" autoComplete="tel-national" maxLength={10} value={form.mobile} onChange={(event) => update('mobile', event.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile number" aria-invalid={!!form.mobile && !!validation.mobile} />{form.mobile && validation.mobile && <small className="field-error">{validation.mobile}</small>}</Field>
                  <Field label="Installation address (for the demo record)"><input autoComplete="street-address" value={form.address} onChange={(event) => update('address', event.target.value)} placeholder="Street, locality, city" /></Field>
                </div>
                <div className="wizard-actions"><button className="button button-quiet" type="button" onClick={useDemo}>⚡ Try Demo / Pre-fill Data</button><button className="button button-primary" type="submit" disabled={!stepOneValid}>Continue to Step 2 →</button></div>
              </form>
            </>}
            {activeStep === 2 && <>
              <PanelHeading kicker="STEP 02 | SITE & SUBSIDY" title="Assess your rooftop and compare schemes" subtitle="Add usage, roof and connection details to view available subsidy options." icon="02" />
              <div className="form-grid">
                <Field label="Average monthly consumption (kWh)"><input type="number" min="1" step="1" value={form.monthly_units} onChange={(event) => update('monthly_units', event.target.value === '' ? '' : Number(event.target.value))} aria-invalid={!!validation.monthly} />{validation.monthly && <small className="field-error">{validation.monthly}</small>}</Field>
                <Field label="Usable roof area (sq. ft.)"><input type="number" min="1" step="1" value={form.roof_area_sqft} onChange={(event) => update('roof_area_sqft', event.target.value === '' ? '' : Number(event.target.value))} aria-invalid={!!validation.roof} />{validation.roof && <small className="field-error">{validation.roof}</small>}</Field>
                <Field label="Planned system capacity (kW)"><input type="number" min="0.1" step="0.1" value={form.proposed_capacity_kw} onChange={(event) => update('proposed_capacity_kw', event.target.value === '' ? '' : Number(event.target.value))} aria-invalid={!!validation.capacity} />{validation.capacity && <small className="field-error">{validation.capacity}</small>}</Field>
                <Field label="Electricity tariff (₹ / kWh)"><input type="number" min="0.1" step="0.1" value={form.tariff_inr_per_kwh} onChange={(event) => update('tariff_inr_per_kwh', event.target.value === '' ? '' : Number(event.target.value))} aria-invalid={!!validation.tariff} />{validation.tariff && <small className="field-error">{validation.tariff}</small>}</Field>
                <Field label="Applicant type"><select value={form.applicant_type} onChange={(event) => update('applicant_type', event.target.value as Intake['applicant_type'])}><option value="owner">Owner</option><option value="tenant">Tenant</option></select></Field>
                <Field label="Applicant / connection category"><select value={consumerGroup} onChange={(event) => setConsumerGroup(event.target.value as typeof consumerGroup)}><option value="residential">Individual residential</option><option value="agricultural">Agricultural feeder</option><option value="rwa">Housing society / RWA</option></select><small>Scheme availability depends on applicant and connection category.</small></Field>
              </div>
              <RoofVisualizer roofAreaSqft={form.roof_area_sqft} systemCapacityKw={estimatedSize} />
              <div className="form-section-title">PROJECT DETAILS</div>
              <label className="check-line"><input type="checkbox" checked={form.owns_rooftop} onChange={(event) => update('owns_rooftop', event.target.checked)} /> Rooftop ownership is established</label>
              <label className="check-line"><input type="checkbox" checked={form.has_grid_connection} onChange={(event) => update('has_grid_connection', event.target.checked)} /> Active grid connection</label>
              <label className="check-line"><input type="checkbox" checked={form.roof_shadow_clearance_declared} onChange={(event) => update('roof_shadow_clearance_declared', event.target.checked)} /> I declare that the usable roof has no significant shade obstruction (site survey still required)</label>
              {form.applicant_type === 'tenant' && <label className="check-line"><input type="checkbox" checked={form.landlord_noc_uploaded} onChange={(event) => update('landlord_noc_uploaded', event.target.checked)} /> Landlord NOC recorded</label>}
              <Field label="Documents required (comma separated)"><input value={form.required_documents} onChange={(event) => update('required_documents', event.target.value)} placeholder="Electricity bill, Aadhaar" /></Field>
              <Field label="Documents recorded as uploaded"><input value={form.uploaded_documents} onChange={(event) => update('uploaded_documents', event.target.value)} placeholder="Electricity bill" /></Field>
              <h3 className="journey-section-title">Compare eligible subsidy programs</h3>
              <SubsidySelector items={activeSubsidies} selectedId={selectedSubsidyId} onSelect={setSelectedSubsidyId} capacityKw={currentCapacity} consumerGroup={consumerGroup} />
              <div className="wizard-actions"><button className="button button-quiet" type="button" onClick={() => setActiveStep(1)}>← Back</button><button className="button button-primary" type="button" disabled={!stepTwoValid} onClick={continueFromStepTwo}>Continue to Step 3 →</button></div>
            </>}
            {activeStep === 3 && <>
              <PanelHeading kicker="STEP 03 | VENDOR & FINANCE" title="Compare installers and financing" subtitle="Select a vendor and financing plan; costs follow your chosen subsidy." icon="03" />
              <h3 className="journey-section-title">Choose an installer</h3><p className="journey-disclaimer">Demo marketplace profiles and pricing are illustrative. Confirm installer empanelment, scope and quote before contracting.</p>
              <VendorSelector vendors={vendors} selectedId={selectedVendorId} onSelect={(id) => { setSelectedVendorId(id); update('installer_id', id) }} capacityKw={currentCapacity} subsidy={selectedSubsidy} />
              <div className="review-details"><div><small>Applicant</small><strong>{form.applicant_name}</strong></div><div><small>State · DISCOM</small><strong>{form.state} · {form.discom_code}</strong></div><div><small>Consumer number</small><strong>{form.consumer_number}</strong></div><div><small>Usage · roof area</small><strong>{form.monthly_units} kWh/mo · {form.roof_area_sqft} sq. ft.</strong></div><div><small>Recommended system size</small><strong>{estimatedSize.toFixed(1)} kW</strong></div><div><small>Proposed capacity</small><strong>{form.proposed_capacity_kw} kW</strong></div></div>
              <FinancialPlan estimate={financialEstimate} mode={purchaseMode} tenureYears={loanTenureYears} interestRatePct={interestRatePct} onModeChange={setPurchaseMode} onTenureChange={setLoanTenureYears} onInterestRateChange={setInterestRatePct} />
              <button className="button button-primary proposal-download" type="button" disabled={!financialEstimate} onClick={downloadProposal}>📄 Download Feasibility Summary</button>
              <button className="button button-outline portal-step-launch" type="button" onClick={openMockPortal}>Open mock DISCOM portal</button>
              <div className="step-three-actions"><button className="button button-quiet" type="button" onClick={() => setActiveStep(2)}>← Back</button><button className="button button-primary" type="button" disabled={busy} onClick={() => { const formEl = document.getElementById('evaluate-form') as HTMLFormElement | null; formEl?.requestSubmit() }}>{busy ? 'Evaluating…' : offlinePreview ? 'Create offline preview' : workflow ? 'Re-evaluate application' : 'Run subsidy & verification check'}</button></div>
              <form id="evaluate-form" onSubmit={evaluate} />
              {workflow && <>
                <div className="workflow-result"><div className="live-pill live-active"><span />{workflow.state.replaceAll('_', ' ').toUpperCase()}</div><p>{workflow.policy_assessment || 'Assessment complete.'}</p>
                  {workflow.financial_summary && <div className="finance-foot"><div><span>Estimated subsidy</span><strong>₹{workflow.financial_summary.estimated_subsidy_inr.toLocaleString('en-IN')}</strong></div><div><span>Annual generation</span><strong>{workflow.financial_summary.estimated_annual_generation_kwh.toLocaleString('en-IN')} kWh</strong></div><div><span>Annual savings</span><strong>₹{workflow.financial_summary.estimated_annual_savings_inr.toLocaleString('en-IN')}</strong></div><div><span>Estimated payback</span><strong>{workflow.financial_summary.estimated_payback_years} years</strong></div></div>}
                </div>
                <section className="panel embedded-panel"><PanelHeading kicker="AGENT WORKFLOW" title="Evaluation progress" subtitle="Intake checks, policy evidence and human review." icon="AI" /><div className="workflow-list">{workflowNodes.map(([node, title, subtitle], index) => {
                  const event = events.find((item) => item.node === node)
                  const done = event?.status === 'completed' || event?.status === 'submitted'
                  const blocked = event?.status === 'blocked'
                  const active = event?.status === 'waiting'
                  return <div className={'workflow-node ' + (done ? 'done ' : '') + (active ? 'active ' : '') + (blocked ? 'blocked' : '')} key={node}><div className="node-rail"><div className="node-circle">{done ? '✓' : blocked ? '!' : index + 1}</div>{index < workflowNodes.length - 1 && <div className="node-line" />}</div><div className="node-content"><strong>{title}</strong><span>{event?.message || subtitle}</span></div><span className="node-state">{event?.status?.toUpperCase() || 'WAITING'}</span></div>
                })}</div></section>
                <section className="panel embedded-panel"><PanelHeading kicker="VERIFICATION TRAIL" title="Policy evidence" subtitle="Rule outcomes and stated basis." icon="✓" />{workflow.evidence_log.map((item, index) => <div className="evidence-item" key={item.rule + index}><span className="evidence-index">{String(index + 1).padStart(2, '0')}</span><span className="evidence-item-copy"><strong>{item.rule.replaceAll('_', ' ')}</strong><small>{item.outcome} · {item.source_title}</small><small>{item.verbatim_snippet || item.excerpt}</small>{item.source_url && <a href={item.source_url} target="_blank" rel="noreferrer">View source</a>}</span></div>)}</section>
                {workflow.can_proceed && <button className="button button-primary full-button" type="button" onClick={() => setActiveStep(4)}>Continue to portal submission</button>}
                {workflow.application_id && <p className="form-footnote">Mock portal receipt: {workflow.application_id}</p>}
              </>}
            </>}

            {activeStep === 4 && <>
              <PanelHeading kicker="STEP 04 | PORTAL SUBMISSION" title="Review the application payload" subtitle="The agent performs demo checks before dispatch to the mock portal." icon="04" />
              <div className="portal-review"><div><small>Applicant and connection</small><strong>{form.applicant_name} | {form.consumer_number}</strong><span>{form.state} | {form.discom_code}</span></div><div><small>System and selected program</small><strong>{form.proposed_capacity_kw} kW | {selectedSubsidy?.name}</strong><span>{vendors.find((item) => item.id === selectedVendorId)?.name}</span></div><div><small>Agent validation</small><strong>Net metering | Roof clearance | Sanctioned load</strong><span>LangGraph policy and feasibility simulation runs at submission.</span></div></div>
              {busy && <div className="submission-checks" role="status" aria-live="polite">{submissionChecks.map((check, index) => <div className={index < submissionCheckStep ? 'complete' : index === submissionCheckStep ? 'checking' : ''} key={check}><span>{index < submissionCheckStep ? '✓' : index === submissionCheckStep ? '…' : index + 1}</span>{check}</div>)}</div>}
              <div className="workflow-list">{workflow?.events.map((event, index) => <div className="workflow-node done" key={`${event.node}-${index}`}><div className="node-rail"><div className="node-circle">✓</div></div><div className="node-content"><strong>{event.node.replaceAll('_', ' ')}</strong><span>{event.message}</span></div><span className="node-state">{event.status}</span></div>)}</div>
              <p className="journey-disclaimer">Demo only: no government portal is contacted. Submission is recorded in GoSolar's mock application store.</p>
              <div className="step-three-actions"><button className="button button-quiet" type="button" onClick={() => setActiveStep(3)}>Back to vendor and finance</button><button className="button button-primary" type="button" disabled={busy || (!workflow?.can_proceed && !offlinePreview)} onClick={approve}>{busy ? 'Submitting...' : 'Submit to National Portal'}</button></div>
            </>}
            {activeStep === 5 && trackingRecord && <>
              <PanelHeading kicker="STEP 05 | APPLICATION STATUS" title="Your solar application journey" subtitle="Follow the demo milestones and keep the tracking ID for future lookup." icon="05" />
              <ApplicationLifecycleTracker record={trackingRecord} onAdvance={advanceTracking} onReschedule={rescheduleTracking} />
              <button className="button button-quiet" type="button" onClick={() => setActiveStep(4)}>Back to submission details</button>
            </>}
          </section>
          <div className="wizard-aside"><DashboardSummary monthlyUnits={form.monthly_units} tariffInrPerKwh={form.tariff_inr_per_kwh} sanctionedLoadKw={form.sanctioned_load_kw} roofAreaSqft={form.roof_area_sqft} proposedCapacityKw={form.proposed_capacity_kw} vendorPricePerKw={vendors.find((item) => item.id === selectedVendorId)?.price_per_kw ?? 60000} subsidyInr={selectedSubsidy?.estimated_subsidy_inr ?? 0} mode={purchaseMode} tenureYears={loanTenureYears} interestRatePct={interestRatePct} onModeChange={setPurchaseMode} onTenureChange={setLoanTenureYears} onInterestRateChange={setInterestRatePct} /><section className="panel guide-prompt"><PanelHeading kicker="KNOW BEFORE YOU GO" title="How subsidies work" subtitle="Understand central assistance, metering and required documents." icon="i" /><button className="button button-outline full-button" type="button" onClick={() => setGuide(true)}>Open the solar guide</button></section>
          </div>
        </div>
        <footer className="page-footer"><span>GoSolar · Demonstration only</span><span>Not a government service or eligibility determination</span></footer>
        </> : <section className="tracking-view"><PanelHeading kicker="APPLICATION TRACKING" title="Track your GoSolar application" subtitle="Enter the tracking ID from your submission acknowledgment." icon="T" /><form className="tracking-search" onSubmit={(event) => { event.preventDefault(); void lookupTracking() }}><input aria-label="Tracking ID" value={trackingSearch} onChange={(event) => setTrackingSearch(event.target.value.toUpperCase())} placeholder="SOLAR-MH-2026-894120" /><button className="button button-primary" type="submit">Find application</button></form>{error && <div className="notice notice-warning" role="alert">{error}</div>}{trackingRecord && <ApplicationLifecycleTracker record={trackingRecord} onAdvance={advanceTracking} onReschedule={rescheduleTracking} />}</section>}
      </main>
    </div>
    <SubsidyGuideModal open={guide} onClose={() => setGuide(false)} />
    {portalOpen && <MockDiscomPortalModal open={portalOpen} consumer={portalConsumer} onClose={() => setPortalOpen(false)} />}
  </div>
}

function PanelHeading({ kicker, title, subtitle, icon }: { kicker: string; title: string; subtitle: string; icon: string }) {
  return <div className="panel-heading"><div><div className="section-kicker">{kicker}</div><h2>{title}</h2><p>{subtitle}</p></div><div className="step-icon">{icon}</div></div>
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label> }
export default App
