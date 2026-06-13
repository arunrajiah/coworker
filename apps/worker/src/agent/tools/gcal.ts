import { tool } from 'ai'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { gcalConnections } from '@coworker/db'
import type { DbClient } from '@coworker/db'

async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json() as { access_token?: string; error_description?: string; error?: string }
  if (!res.ok || !data.access_token) throw new Error(data.error_description ?? 'Auth failed')
  return data.access_token
}

async function gcalGet(token: string, path: string) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(err.error?.message ?? `GCal ${res.status}`)
  }
  return res.json() as Promise<Record<string, unknown>>
}

async function gcalPost(token: string, path: string, body: unknown) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(err.error?.message ?? `GCal ${res.status}`)
  }
  return res.json() as Promise<Record<string, unknown>>
}

async function gcalPatch(token: string, path: string, body: unknown) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(err.error?.message ?? `GCal ${res.status}`)
  }
  return res.json() as Promise<Record<string, unknown>>
}

async function gcalDelete(token: string, path: string) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok && res.status !== 204) {
    throw new Error(`GCal DELETE ${res.status}`)
  }
}

async function getConn(db: DbClient, workspaceId: string, connectionId?: string) {
  return connectionId
    ? db.query.gcalConnections.findFirst({
        where: (t, { and, eq }) => and(eq(t.id, connectionId), eq(t.workspaceId, workspaceId)),
      })
    : db.query.gcalConnections.findFirst({
        where: eq(gcalConnections.workspaceId, workspaceId),
      })
}

function formatEvent(e: Record<string, unknown>) {
  return {
    id: e.id,
    summary: e.summary,
    description: e.description,
    start: (e.start as { dateTime?: string; date?: string } | undefined)?.dateTime ?? (e.start as { date?: string } | undefined)?.date,
    end: (e.end as { dateTime?: string; date?: string } | undefined)?.dateTime ?? (e.end as { date?: string } | undefined)?.date,
    location: e.location,
    attendees: (e.attendees as { email: string; responseStatus?: string }[] | undefined)?.map((a) => ({
      email: a.email,
      status: a.responseStatus,
    })),
    htmlLink: e.htmlLink,
    status: e.status,
  }
}

export function listGcalConnectionsTool(db: DbClient, workspaceId: string) {
  return tool({
    description: 'List connected Google Calendar accounts.',
    parameters: z.object({}),
    execute: async () => {
      const rows = await db.query.gcalConnections.findMany({
        where: eq(gcalConnections.workspaceId, workspaceId),
        columns: { clientSecret: false, refreshToken: false },
      })
      return rows.length > 0 ? rows : { message: 'No Google Calendar connections configured.' }
    },
  })
}

export function listCalendarsTool(db: DbClient, workspaceId: string) {
  return tool({
    description: 'List all calendars in the connected Google account.',
    parameters: z.object({
      connectionId: z.string().optional().describe('GCal connection ID; omit to use the first connection'),
    }),
    execute: async ({ connectionId }) => {
      const conn = await getConn(db, workspaceId, connectionId)
      if (!conn) return { error: 'No Google Calendar connection found' }
      const token = await getAccessToken(conn.clientId, conn.clientSecret, conn.refreshToken)
      const data = await gcalGet(token, '/users/me/calendarList') as {
        items: { id: string; summary: string; primary?: boolean; accessRole: string }[]
      }
      return data.items.map((c) => ({
        id: c.id,
        name: c.summary,
        primary: c.primary ?? false,
        accessRole: c.accessRole,
      }))
    },
  })
}

export function listEventsTool(db: DbClient, workspaceId: string) {
  return tool({
    description: 'List upcoming events from a Google Calendar.',
    parameters: z.object({
      calendarId: z.string().default('primary').describe('Calendar ID (use "primary" for the main calendar)'),
      timeMin: z.string().optional().describe('Start time ISO8601 (default: now)'),
      timeMax: z.string().optional().describe('End time ISO8601'),
      maxResults: z.number().int().min(1).max(50).default(10),
      query: z.string().optional().describe('Free-text search query'),
      connectionId: z.string().optional(),
    }),
    execute: async ({ calendarId, timeMin, timeMax, maxResults, query, connectionId }) => {
      const conn = await getConn(db, workspaceId, connectionId)
      if (!conn) return { error: 'No Google Calendar connection found' }
      const token = await getAccessToken(conn.clientId, conn.clientSecret, conn.refreshToken)

      const params = new URLSearchParams({
        maxResults: String(maxResults),
        singleEvents: 'true',
        orderBy: 'startTime',
        timeMin: timeMin ?? new Date().toISOString(),
      })
      if (timeMax) params.set('timeMax', timeMax)
      if (query) params.set('q', query)

      const data = await gcalGet(token, `/calendars/${encodeURIComponent(calendarId)}/events?${params}`) as {
        items: Record<string, unknown>[]
      }
      return data.items.map(formatEvent)
    },
  })
}

export function createEventTool(db: DbClient, workspaceId: string) {
  return tool({
    description: 'Create a new event in Google Calendar.',
    parameters: z.object({
      calendarId: z.string().default('primary'),
      summary: z.string().describe('Event title'),
      description: z.string().optional(),
      location: z.string().optional(),
      startDateTime: z.string().describe('Start as ISO8601 datetime, e.g. 2024-03-15T14:00:00'),
      endDateTime: z.string().describe('End as ISO8601 datetime'),
      timeZone: z.string().default('UTC').describe('IANA timezone, e.g. America/New_York'),
      attendeeEmails: z.array(z.string()).optional().describe('List of attendee email addresses'),
      connectionId: z.string().optional(),
    }),
    execute: async ({ calendarId, summary, description, location, startDateTime, endDateTime, timeZone, attendeeEmails, connectionId }) => {
      const conn = await getConn(db, workspaceId, connectionId)
      if (!conn) return { error: 'No Google Calendar connection found' }
      const token = await getAccessToken(conn.clientId, conn.clientSecret, conn.refreshToken)

      const event: Record<string, unknown> = {
        summary,
        description,
        location,
        start: { dateTime: startDateTime, timeZone },
        end: { dateTime: endDateTime, timeZone },
      }
      if (attendeeEmails?.length) {
        event.attendees = attendeeEmails.map((email) => ({ email }))
      }

      const data = await gcalPost(token, `/calendars/${encodeURIComponent(calendarId)}/events`, event)
      return formatEvent(data)
    },
  })
}

export function updateEventTool(db: DbClient, workspaceId: string) {
  return tool({
    description: 'Update an existing Google Calendar event.',
    parameters: z.object({
      calendarId: z.string().default('primary'),
      eventId: z.string().describe('Event ID from list_events'),
      summary: z.string().optional(),
      description: z.string().optional(),
      location: z.string().optional(),
      startDateTime: z.string().optional(),
      endDateTime: z.string().optional(),
      timeZone: z.string().optional(),
      connectionId: z.string().optional(),
    }),
    execute: async ({ calendarId, eventId, summary, description, location, startDateTime, endDateTime, timeZone, connectionId }) => {
      const conn = await getConn(db, workspaceId, connectionId)
      if (!conn) return { error: 'No Google Calendar connection found' }
      const token = await getAccessToken(conn.clientId, conn.clientSecret, conn.refreshToken)

      const patch: Record<string, unknown> = {}
      if (summary) patch.summary = summary
      if (description !== undefined) patch.description = description
      if (location !== undefined) patch.location = location
      if (startDateTime) patch.start = { dateTime: startDateTime, timeZone: timeZone ?? 'UTC' }
      if (endDateTime) patch.end = { dateTime: endDateTime, timeZone: timeZone ?? 'UTC' }

      const data = await gcalPatch(token, `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, patch)
      return formatEvent(data)
    },
  })
}

export function deleteEventTool(db: DbClient, workspaceId: string) {
  return tool({
    description: 'Delete a Google Calendar event.',
    parameters: z.object({
      calendarId: z.string().default('primary'),
      eventId: z.string().describe('Event ID from list_events'),
      connectionId: z.string().optional(),
    }),
    execute: async ({ calendarId, eventId, connectionId }) => {
      const conn = await getConn(db, workspaceId, connectionId)
      if (!conn) return { error: 'No Google Calendar connection found' }
      const token = await getAccessToken(conn.clientId, conn.clientSecret, conn.refreshToken)
      await gcalDelete(token, `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`)
      return { ok: true, eventId }
    },
  })
}

export function findFreeTool(db: DbClient, workspaceId: string) {
  return tool({
    description: 'Find free/busy times for calendars — useful for scheduling meetings.',
    parameters: z.object({
      calendarIds: z.array(z.string()).default(['primary']).describe('List of calendar IDs to check'),
      timeMin: z.string().describe('Start of range as ISO8601'),
      timeMax: z.string().describe('End of range as ISO8601'),
      connectionId: z.string().optional(),
    }),
    execute: async ({ calendarIds, timeMin, timeMax, connectionId }) => {
      const conn = await getConn(db, workspaceId, connectionId)
      if (!conn) return { error: 'No Google Calendar connection found' }
      const token = await getAccessToken(conn.clientId, conn.clientSecret, conn.refreshToken)

      const data = await gcalPost(token, '/freeBusy', {
        timeMin,
        timeMax,
        items: calendarIds.map((id) => ({ id })),
      }) as {
        calendars: Record<string, { busy: { start: string; end: string }[] }>
      }

      return Object.entries(data.calendars).map(([id, info]) => ({
        calendarId: id,
        busySlots: info.busy,
      }))
    },
  })
}
