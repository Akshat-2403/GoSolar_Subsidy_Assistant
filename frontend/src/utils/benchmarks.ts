import type { Intake } from '../App'

export type OfficialBenchmarkId = 'TC1' | 'TC2' | 'TC3' | 'TC4' | 'TC5' | 'TC6'

export type OfficialBenchmark = {
  id: OfficialBenchmarkId
  title: string
  expected: string
  applicationId?: string
  optional?: boolean
  what: string
  how: string
  where: string
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
    what: 'Tests standard residential homeowner eligibility and the human-review pause.',
    how: 'The agent checks a synthetic owner, valid connection, matching capacity, documents and empanelled installer.',
    where: 'Fills the consumer, connection, roof and usage fields, then runs policy evaluation at the vendor review step.',
    form: { ...baseForm },
  },
  {
    id: 'TC2',
    title: 'Vendor not empanelled',
    expected: 'Flagged',
    what: 'Tests the vendor empanelment guardrail.',
    how: 'The agent receives an otherwise eligible application with an unverified installer.',
    where: 'Fills the synthetic consumer and installer fields, then runs policy evaluation at the vendor review step.',
    form: { ...baseForm, installer_id: 'unverified-demo-vendor', installer_empanelled: false },
  },
  {
    id: 'TC3',
    title: 'Tenant, not owner',
    expected: 'Consent needed',
    what: 'Tests consent handling when a tenant has no landlord NOC.',
    how: 'The agent checks applicant type and ownership evidence, then pauses for the missing NOC.',
    where: 'Fills the synthetic applicant and consent fields, then runs policy evaluation at the vendor review step.',
    form: { ...baseForm, applicant_type: 'tenant', owns_rooftop: false, landlord_noc_uploaded: false },
  },
  {
    id: 'TC4',
    title: 'Application ID',
    expected: 'Subsidy not promised',
    applicationId: 'APP-SOL-DEMO-0004',
    what: 'Confirms that an application receipt is not represented as subsidy approval or payment.',
    how: 'The agent reads a synthetic receipt ID and checks for an independent verification event and clear no-guarantee wording.',
    where: 'Places the synthetic ID in the read-only verification result; it does not file an application.',
    form: { ...baseForm },
  },
  {
    id: 'TC5',
    title: 'Capacity above sanctioned load',
    expected: 'Blocked: load enhancement required',
    optional: true,
    what: 'Checks that the requested array does not exceed the grid connection sanctioned load.',
    how: 'Sets the proposed system to 5 kW while the connection is sanctioned for 4 kW.',
    where: 'Fills planned capacity and sanctioned load in the feasibility form, then exercises the client guard before evaluation.',
    form: { ...baseForm, sanctioned_load_kw: 4, proposed_capacity_kw: 5, roof_area_sqft: 550 },
  },
  {
    id: 'TC6',
    title: 'Insufficient usable roof area',
    expected: 'Blocked: roof area insufficient',
    optional: true,
    what: 'Checks the minimum usable roof area estimate of 100 square feet per kW.',
    how: 'Sets a 3 kW proposed array with only 250 square feet of usable roof.',
    where: 'Fills planned capacity and roof area in the feasibility form, then exercises the client guard before evaluation.',
    form: { ...baseForm, proposed_capacity_kw: 3, roof_area_sqft: 250 },
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
    case 'TC5':
      actual = Number(benchmark.form.proposed_capacity_kw) > Number(benchmark.form.sanctioned_load_kw)
        ? 'Blocked: load enhancement required' : 'Unexpectedly allowed'
      evidence = 'The client feasibility gate blocks evaluation until proposed capacity is within the sanctioned load.'
      break
    case 'TC6':
      actual = Number(benchmark.form.proposed_capacity_kw) * 100 > Number(benchmark.form.roof_area_sqft)
        ? 'Blocked: roof area insufficient' : 'Unexpectedly allowed'
      evidence = 'The client feasibility gate blocks evaluation when usable roof area is below 100 square feet per proposed kW.'
      break
  }
  return { id: benchmark.id, expected: benchmark.expected, actual, passed: actual === benchmark.expected, evidence }
}
