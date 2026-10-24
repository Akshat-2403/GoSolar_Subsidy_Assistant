export type SubsidyItem = {
  id: string; name: string; provider: string; kind: string; eligibility: string[]; perks: string[];
  estimated_subsidy_inr: number; illustrative: boolean; net_effective_cost_note?: string;
}
export type VendorItem = {
  id: string; name: string; tier: string; price_per_kw: number; rating: number;
  installs: string; specs: string; turnaround_days: number;
}
export type TrackingRecord = {
  tracking_id: string; application_id: string | null; status: string; current_stage: number;
  submitted_at: string; updated_at: string;
  milestones: { title: string; status: string; timestamp: string | null }[];
  agent_validation_logs: { timestamp: string; stage: string; message: string; status: string }[];
  application: { applicant_name: string; state: string; consumer_number: string; discom_code: string; address: string; system_size_kw: number; sanctioned_load_kw: number; subsidy: { id: string; name: string; estimated_inr: number }; vendor: { id: string; name: string; price_per_kw: number } };
}
