export type ApplicationStatus = 'SUBMITTED' | 'FEASIBILITY_APPROVED' | 'VENDOR_ASSIGNED' | 'METER_INSTALLED' | 'SUBSIDY_CREDITED'

export interface SolarApplication {
  trackingId: string
  createdAt: string
  applicantName: string
  consumerNumber: string
  state: string
  discom: string
  systemCapacityKw: number
  subsidyAmount: number
  status: ApplicationStatus
  activeStepIndex: number
  timeline: Array<{ label: string; date: string; status: 'completed' | 'in_progress' | 'pending' }>
}

const STORAGE_KEY = 'gosolar-applications'

export function listApplications(): SolarApplication[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(value) ? value as SolarApplication[] : []
  } catch { return [] }
}

export function getApplication(trackingId: string): SolarApplication | null {
  return listApplications().find((item) => item.trackingId === trackingId.trim().toUpperCase()) ?? null
}

export function saveApplication(application: SolarApplication): SolarApplication {
  const applications = listApplications().filter((item) => item.trackingId !== application.trackingId)
  applications.unshift(application)
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(applications)) } catch { /* Browser storage may be disabled. */ }
  return application
}

export function createTrackingId(): string {
  const existing = new Set(listApplications().map((item) => item.trackingId))
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const value = new Uint32Array(1)
    if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(value)
    else value[0] = Math.floor(Math.random() * 1_000_000_000)
    const id = `GS-${new Date().getFullYear()}-${String(value[0] % 100_000).padStart(5, '0')}`
    if (!existing.has(id)) return id
  }
  return `GS-${new Date().getFullYear()}-${String(Date.now() % 100_000).padStart(5, '0')}`
}
