import type { ShipmentStatus } from "@/backend/repositories/shipment.repository"

// ─── Provider Interface ──────────────────────────────────────────────────────

export interface TrackingResult {
  /** Our normalized shipment status */
  status: ShipmentStatus
  /** Human-readable description from the provider */
  description: string
  /** Current location (city / hub name) */
  location?: string
  /** When this status event occurred (provider-reported time) */
  eventTime: Date
  /** Raw response from the provider API, preserved for audit */
  rawPayload: unknown
  /** Whether the tracking number was found */
  found: boolean
  /** If not found, the reason */
  reason?: string
}

export interface ShipmentProvider {
  /** Provider code (matches ShipmentProviderCode enum) */
  readonly code: string
  /** Human-readable provider name */
  readonly name: string

  /**
   * Fetch current tracking status from the logistics provider.
   * Returns the LATEST status event. To get full history, providers
   * should implement getTrackingHistory().
   */
  trackShipment(trackingNumber: string, apiKey?: string): Promise<TrackingResult>

  /**
   * Fetch full tracking history from the logistics provider.
   * Optional — some providers only give current status.
   */
  getTrackingHistory?(trackingNumber: string, apiKey?: string): Promise<TrackingResult[]>

  /**
   * Map a raw provider status string to our normalized ShipmentStatus.
   * Each provider has different status strings (e.g. JNE: "ON PROCESS",
   * TIKI: "MANIFESTED"). This handles the mapping.
   */
  mapStatus(rawStatus: string): ShipmentStatus
}
