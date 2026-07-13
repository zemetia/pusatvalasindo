import prisma from "@/lib/prisma"
import type { Prisma } from "@src/generated/prisma/client"

// ─── Types ───────────────────────────────────────────────────────────────────

export type ShipmentStatus =
  | "PENDING"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "FAILED"
  | "RETURNED"
  | "CANCELLED"

export type ShipmentProviderCode =
  | "JNE"
  | "TIKI"
  | "POS_INDONESIA"
  | "DHL"
  | "FEDEX"
  | "CUSTOM"

export interface ShipmentProviderRow {
  id: string
  name: string
  code: ShipmentProviderCode
  apiBaseUrl: string | null
  apiKey: string | null
  webhookSecret: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ShipmentRow {
  id: string
  trackingNumber: string
  providerId: string
  status: ShipmentStatus
  origin: string | null
  destination: string | null
  recipientName: string | null
  recipientPhone: string | null
  referenceType: string | null
  referenceId: string | null
  notes: string | null
  estimatedDelivery: string | null
  createdAt: string
  updatedAt: string
  // Joined fields
  providerName?: string
  providerCode?: string
  latestEventStatus?: string
  latestEventLocation?: string
  latestEventTime?: string
}

export interface ShipmentStatusEventRow {
  id: string
  shipmentId: string
  status: ShipmentStatus
  description: string | null
  location: string | null
  eventTime: string
  rawPayload: unknown
  createdAt: string
}

export interface CreateShipmentInput {
  trackingNumber: string
  providerId: string
  origin?: string | null
  destination?: string | null
  recipientName?: string | null
  recipientPhone?: string | null
  referenceType?: string | null
  referenceId?: string | null
  notes?: string | null
  estimatedDelivery?: Date | null
}

export interface UpdateShipmentInput {
  origin?: string | null
  destination?: string | null
  recipientName?: string | null
  recipientPhone?: string | null
  referenceType?: string | null
  referenceId?: string | null
  notes?: string | null
  estimatedDelivery?: Date | null
}

export interface ShipmentListParams {
  status?: ShipmentStatus
  providerId?: string
  referenceType?: string
  referenceId?: string
  search?: string
  limit?: number
  offset?: number
}

// ─── Repository ──────────────────────────────────────────────────────────────

const SHIPMENT_SELECT = `
  s.id,
  s.tracking_number,
  s.provider_id,
  s.status,
  s.origin,
  s.destination,
  s.recipient_name,
  s.recipient_phone,
  s.reference_type,
  s.reference_id,
  s.notes,
  s.estimated_delivery,
  s.created_at,
  s.updated_at,
  sp.name AS provider_name,
  sp.code AS provider_code,
  (
    SELECT sse.status::text
    FROM "ShipmentStatusEvent" sse
    WHERE sse.shipment_id = s.id
    ORDER BY sse.event_time DESC
    LIMIT 1
  ) AS latest_event_status,
  (
    SELECT sse.location
    FROM "ShipmentStatusEvent" sse
    WHERE sse.shipment_id = s.id
    ORDER BY sse.event_time DESC
    LIMIT 1
  ) AS latest_event_location,
  (
    SELECT sse.event_time::text
    FROM "ShipmentStatusEvent" sse
    WHERE sse.shipment_id = s.id
    ORDER BY sse.event_time DESC
    LIMIT 1
  ) AS latest_event_time
`

function toCamelCase(row: Record<string, unknown>): ShipmentRow {
  return {
    id: row.id as string,
    trackingNumber: row.tracking_number as string,
    providerId: row.provider_id as string,
    status: row.status as ShipmentStatus,
    origin: row.origin as string | null,
    destination: row.destination as string | null,
    recipientName: row.recipient_name as string | null,
    recipientPhone: row.recipient_phone as string | null,
    referenceType: row.reference_type as string | null,
    referenceId: row.reference_id as string | null,
    notes: row.notes as string | null,
    estimatedDelivery: row.estimated_delivery as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    providerName: row.provider_name as string | undefined,
    providerCode: row.provider_code as string | undefined,
    latestEventStatus: row.latest_event_status as string | undefined,
    latestEventLocation: row.latest_event_location as string | undefined,
    latestEventTime: row.latest_event_time as string | undefined,
  }
}

function eventToCamelCase(row: Record<string, unknown>): ShipmentStatusEventRow {
  return {
    id: row.id as string,
    shipmentId: row.shipment_id as string,
    status: row.status as ShipmentStatus,
    description: row.description as string | null,
    location: row.location as string | null,
    eventTime: row.event_time as string,
    rawPayload: row.raw_payload,
    createdAt: row.created_at as string,
  }
}

export const shipmentRepository = {
  // ─── Shipments ───────────────────────────────────────────────────────────

  async findAll(params: ShipmentListParams = {}): Promise<ShipmentRow[]> {
    const { status, providerId, referenceType, referenceId, search, limit = 50, offset = 0 } = params

    const conditions: string[] = []
    const values: unknown[] = []
    let paramIdx = 1

    if (status) {
      conditions.push(`s.status = $${paramIdx}::"ShipmentStatus"`)
      values.push(status)
      paramIdx++
    }
    if (providerId) {
      conditions.push(`s.provider_id = $${paramIdx}`)
      values.push(providerId)
      paramIdx++
    }
    if (referenceType && referenceId) {
      conditions.push(`s.reference_type = $${paramIdx}`)
      values.push(referenceType)
      paramIdx++
      conditions.push(`s.reference_id = $${paramIdx}`)
      values.push(referenceId)
      paramIdx++
    }
    if (search) {
      conditions.push(`(s.tracking_number ILIKE $${paramIdx} OR s.recipient_name ILIKE $${paramIdx} OR s.destination ILIKE $${paramIdx})`)
      values.push(`%${search}%`)
      paramIdx++
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

    const query = `
      SELECT ${SHIPMENT_SELECT}
      FROM "Shipment" s
      JOIN "ShipmentProvider" sp ON sp.id = s.provider_id
      ${where}
      ORDER BY s.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `
    values.push(limit, offset)

    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(query, ...values)
    return rows.map(toCamelCase)
  },

  async findById(id: string): Promise<ShipmentRow | null> {
    const query = `
      SELECT ${SHIPMENT_SELECT}
      FROM "Shipment" s
      JOIN "ShipmentProvider" sp ON sp.id = s.provider_id
      WHERE s.id = $1
    `
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(query, id)
    return rows.length > 0 ? toCamelCase(rows[0]) : null
  },

  async findByTrackingNumber(trackingNumber: string, providerId: string): Promise<ShipmentRow | null> {
    const query = `
      SELECT ${SHIPMENT_SELECT}
      FROM "Shipment" s
      JOIN "ShipmentProvider" sp ON sp.id = s.provider_id
      WHERE s.tracking_number = $1 AND s.provider_id = $2
    `
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(query, trackingNumber, providerId)
    return rows.length > 0 ? toCamelCase(rows[0]) : null
  },

  async create(input: CreateShipmentInput): Promise<ShipmentRow> {
    const query = `
      INSERT INTO "Shipment" (
        id, tracking_number, provider_id, status, origin, destination,
        recipient_name, recipient_phone, reference_type, reference_id,
        notes, estimated_delivery, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, 'PENDING', $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
      )
      RETURNING id
    `
    const result = await prisma.$queryRawUnsafe<{ id: string }[]>(
      query,
      input.trackingNumber,
      input.providerId,
      input.origin ?? null,
      input.destination ?? null,
      input.recipientName ?? null,
      input.recipientPhone ?? null,
      input.referenceType ?? null,
      input.referenceId ?? null,
      input.notes ?? null,
      input.estimatedDelivery ?? null,
    )
    return (await this.findById(result[0].id))!
  },

  async update(id: string, input: UpdateShipmentInput): Promise<ShipmentRow | null> {
    const sets: string[] = []
    const values: unknown[] = [id]
    let paramIdx = 2

    if (input.origin !== undefined) { sets.push(`origin = $${paramIdx++}`); values.push(input.origin) }
    if (input.destination !== undefined) { sets.push(`destination = $${paramIdx++}`); values.push(input.destination) }
    if (input.recipientName !== undefined) { sets.push(`recipient_name = $${paramIdx++}`); values.push(input.recipientName) }
    if (input.recipientPhone !== undefined) { sets.push(`recipient_phone = $${paramIdx++}`); values.push(input.recipientPhone) }
    if (input.referenceType !== undefined) { sets.push(`reference_type = $${paramIdx++}`); values.push(input.referenceType) }
    if (input.referenceId !== undefined) { sets.push(`reference_id = $${paramIdx++}`); values.push(input.referenceId) }
    if (input.notes !== undefined) { sets.push(`notes = $${paramIdx++}`); values.push(input.notes) }
    if (input.estimatedDelivery !== undefined) { sets.push(`estimated_delivery = $${paramIdx++}`); values.push(input.estimatedDelivery) }

    if (sets.length === 0) return this.findById(id)

    sets.push("updated_at = NOW()")
    const query = `
      UPDATE "Shipment" SET ${sets.join(", ")} WHERE id = $1
    `
    await prisma.$executeRawUnsafe(query, ...values)
    return this.findById(id)
  },

  async updateStatus(id: string, status: ShipmentStatus): Promise<ShipmentRow | null> {
    await prisma.$executeRawUnsafe(
      `UPDATE "Shipment" SET status = $1::"ShipmentStatus", updated_at = NOW() WHERE id = $2`,
      status,
      id,
    )
    return this.findById(id)
  },

  async delete(id: string): Promise<void> {
    await prisma.$executeRawUnsafe(`DELETE FROM "Shipment" WHERE id = $1`, id)
  },

  // ─── Status Events ──────────────────────────────────────────────────────

  async findStatusEvents(shipmentId: string): Promise<ShipmentStatusEventRow[]> {
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM "ShipmentStatusEvent" WHERE shipment_id = $1 ORDER BY event_time DESC`,
      shipmentId,
    )
    return rows.map(eventToCamelCase)
  },

  async createStatusEvent(event: {
    shipmentId: string
    status: ShipmentStatus
    description?: string | null
    location?: string | null
    eventTime?: Date
    rawPayload?: unknown
  }): Promise<ShipmentStatusEventRow> {
    const query = `
      INSERT INTO "ShipmentStatusEvent" (
        id, shipment_id, status, description, location, event_time, raw_payload, created_at
      ) VALUES (
        gen_random_uuid(), $1, $2::"ShipmentStatus", $3, $4, $5, $6, NOW()
      )
      RETURNING *
    `
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      query,
      event.shipmentId,
      event.status,
      event.description ?? null,
      event.location ?? null,
      event.eventTime ?? new Date(),
      event.rawPayload ? JSON.stringify(event.rawPayload) : null,
    )
    return eventToCamelCase(rows[0])
  },

  // ─── Providers ──────────────────────────────────────────────────────────

  async findAllProviders(activeOnly = true): Promise<ShipmentProviderRow[]> {
    const where = activeOnly ? `WHERE is_active = true` : ""
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM "ShipmentProvider" ${where} ORDER BY name`
    )
    return rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      code: r.code as ShipmentProviderCode,
      apiBaseUrl: r.api_base_url as string | null,
      apiKey: r.api_key as string | null,
      webhookSecret: r.webhook_secret as string | null,
      isActive: r.is_active as boolean,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    }))
  },

  async findProviderByCode(code: ShipmentProviderCode): Promise<ShipmentProviderRow | null> {
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM "ShipmentProvider" WHERE code = $1::"ShipmentProviderCode"`,
      code,
    )
    if (rows.length === 0) return null
    const r = rows[0]
    return {
      id: r.id as string,
      name: r.name as string,
      code: r.code as ShipmentProviderCode,
      apiBaseUrl: r.api_base_url as string | null,
      apiKey: r.api_key as string | null,
      webhookSecret: r.webhook_secret as string | null,
      isActive: r.is_active as boolean,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    }
  },

  async createProvider(input: {
    name: string
    code: ShipmentProviderCode
    apiBaseUrl?: string | null
    apiKey?: string | null
    webhookSecret?: string | null
  }): Promise<ShipmentProviderRow> {
    const query = `
      INSERT INTO "ShipmentProvider" (
        id, name, code, api_base_url, api_key, webhook_secret, is_active, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2::"ShipmentProviderCode", $3, $4, $5, true, NOW(), NOW()
      )
      RETURNING *
    `
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      query,
      input.name,
      input.code,
      input.apiBaseUrl ?? null,
      input.apiKey ?? null,
      input.webhookSecret ?? null,
    )
    const r = rows[0]
    return {
      id: r.id as string,
      name: r.name as string,
      code: r.code as ShipmentProviderCode,
      apiBaseUrl: r.api_base_url as string | null,
      apiKey: r.api_key as string | null,
      webhookSecret: r.webhook_secret as string | null,
      isActive: r.is_active as boolean,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    }
  },
}
