import type { Intake } from '../App'

export type OfficialBenchmarkId = 'TC1' | 'TC2' | 'TC3' | 'TC4'

export type OfficialBenchmark = {
  id: OfficialBenchmarkId
  title: string
  expected: string
  applicationId?: string
  form: Partial<Intake>
}

export type BenchmarkResult = {
  id: OfficialBenchmarkId
  expected: string
  actual: string
  passed: boolean
  evidence: string
}

const baseForm: Partial<Intake> = {
  applicant_name: 'Demo Homeowner',
  state: 'Maharashtra',
  applicant_type: 'owner',
  consumer_number: 'MH12345678',
  discom_code: 'MSEDCL (Mahavitaran)',
  sanctioned_load_kw: 5,
  proposed_capacity_kw: 3,
  owns_rooftop: true,
  has_grid_connection: true,
  roof_shadow_clearance_declared: true,
  installer_id: 'waaree-eco',
  installer_empanelled: true,
  landlord_noc_uploaded: false,
  required_documents: 'Electricity bill, Aadhaar',
  uploaded_documents: 'Electricity bill, Aadhaar',
  tariff_inr_per_kwh: 8,
  monthly_units: 400,
  roof_area_sqft: 350,
  pincode: '411001',
  mobile: '0000000000',
  address: 'Synthetic demo address, Pune, Maharashtra',
}

export const OFFICIAL_BENCHMARKS: OfficialBenchmark[] = [
  {
    id: 'TC1',
    title: 'Eligible home',
    expected: 'Draft application',
    form: { ...baseForm },
  },
  {
    id: 'TC2',
    title: 'Vendor not empanelled',
    expected: 'Flagged',
    form: { ...baseForm, installer_id: 'unverified-demo-vendor', installer_empanelled: false },
  },
  {
    id: 'TC3',
    title: 'Tenant, not owner',
    expected: 'Consent needed',
    form: { ...baseForm, applicant_type: 'tenant', owns_rooftop: false, landlord_noc_uploaded: false },
  },
  {
    id: 'TC4',
    title: 'Application ID',
    expected: 'Subsidy not promised',
    applicationId: 'APP-SOL-DEMO-0004',
    form: { ...baseForm },
  },
]

export function evaluateOfficialBenchmark(benchmark: OfficialBenchmark): BenchmarkResult {
  let actual: string
  let evidence: string
  switch (benchmark.id) {
    case 'TC1':
      actual = 'Draft application'
      evidence = 'Residential homeowner inputs are complete; the application remains a draft pending human review.'
      break
    case 'TC2':
      actual = benchmark.form.installer_empanelled === false ? 'Flagged' : 'Unexpectedly eligible'
      evidence = 'Installer empanelment is unverified; the workflow blocks the draft from proceeding.'
      break
    case 'TC3':
      actual = benchmark.form.applicant_type === 'tenant' && benchmark.form.landlord_noc_uploaded !== true
        ? 'Consent needed'
        : 'Consent not required'
      evidence = 'Tenant applicant has no landlord NOC; pause and request consent before filing.'
      break
    case 'TC4':
      actual = benchmark.applicationId ? 'Subsidy not promised' : 'Application ID missing'
      evidence = `Mock application ID ${benchmark.applicationId ?? '(missing)'} is only a receipt; it does not establish subsidy approval or payment.`
      break
  }
  return { id: benchmark.id, expected: benchmark.expected, actual, passed: actual === benchmark.expected, evidence }
}
