export interface BillExtraction {
  consumerNumber?: string
  sanctionedLoadKw?: number
  monthlyUnits?: number
  source: 'backend' | 'sample'
  message: string
}

function pick(record: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) if (record[key] !== undefined && record[key] !== null) return record[key]
  return undefined
}

function numberValue(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined
  const parsed = Number(String(value).replace(/[^\d.]/g, ''))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function normalizeBackendResponse(payload: unknown): BillExtraction | null {
  if (!payload || typeof payload !== 'object') return null
  const outer = payload as Record<string, unknown>
  const nested = outer.extracted_data ?? outer.extracted ?? outer.data
  const record = nested && typeof nested === 'object' ? nested as Record<string, unknown> : outer
  const consumer = pick(record, 'consumer_number', 'consumerNumber', 'ca_number', 'account_number')
  const consumerNumber = typeof consumer === 'string' && /^[A-Za-z0-9]{8,15}$/.test(consumer.trim()) ? consumer.trim().toUpperCase() : undefined
  const sanctionedLoadKw = numberValue(pick(record, 'sanctioned_load_kw', 'sanctionedLoadKw', 'sanctioned_load', 'load_kw'))
  const monthlyUnits = numberValue(pick(record, 'monthly_units', 'monthlyUnits', 'last_month_consumption_kwh', 'consumption_kwh', 'units_consumed'))
  if (!consumerNumber && !sanctionedLoadKw && !monthlyUnits) return null
  return { consumerNumber, sanctionedLoadKw, monthlyUnits, source: 'backend', message: 'Auto-filled from bill OCR. Please verify the values against your bill.' }
}

function sampleExtraction(fileName: string): BillExtraction {
  const consumerFromName = fileName.match(/(?:consumer|ca)[-_ ]?([A-Z0-9]{8,15})/i)?.[1]?.toUpperCase()
  const loadFromName = numberValue(fileName.match(/(?:load)[-_ ]?(\d+(?:\.\d+)?)/i)?.[1])
  const unitsFromName = numberValue(fileName.match(/(?:units|consumption)[-_ ]?(\d+(?:\.\d+)?)/i)?.[1])
  return {
    consumerNumber: consumerFromName || 'DEMO12345678',
    sanctionedLoadKw: loadFromName || 3.5,
    monthlyUnits: unitsFromName || 400,
    source: 'sample',
    message: 'Sample values filled for preview. Verify every value against your bill before continuing.',
  }
}

export async function parseBill(file: File, endpoint: string): Promise<BillExtraction> {
  const allowed = /\.(pdf|png|jpe?g)$/i.test(file.name) || ['application/pdf', 'image/png', 'image/jpeg'].includes(file.type)
  if (!allowed) throw new Error('Upload a PDF, PNG, or JPG electricity bill.')
  if (file.size > 15 * 1024 * 1024) throw new Error('The bill file must be smaller than 15 MB.')

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 8_000)
  try {
    const body = new FormData()
    body.append('file', file)
    const response = await fetch(endpoint, { method: 'POST', body, signal: controller.signal })
    if (response.ok) {
      const extraction = normalizeBackendResponse(await response.json())
      if (extraction) return extraction
    }
  } catch {
    // OCR is optional: use the labeled preview extraction while the worker is offline.
  } finally {
    window.clearTimeout(timeout)
  }
  return sampleExtraction(file.name)
}
