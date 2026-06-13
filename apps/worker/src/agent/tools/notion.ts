import { tool } from 'ai'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { notionConnections } from '@coworker/db'
import type { DbClient } from '@coworker/db'

async function notionGet(token: string, path: string) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
    },
  })
  if (!res.ok) throw new Error(`Notion API ${res.status}`)
  return res.json() as Promise<Record<string, unknown>>
}

async function notionPost(token: string, path: string, body: unknown) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message ?? `Notion API ${res.status}`)
  }
  return res.json() as Promise<Record<string, unknown>>
}

async function notionPatch(token: string, path: string, body: unknown) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message ?? `Notion API ${res.status}`)
  }
  return res.json() as Promise<Record<string, unknown>>
}

async function getToken(db: DbClient, workspaceId: string, connectionId?: string): Promise<string | null> {
  const conn = connectionId
    ? await db.query.notionConnections.findFirst({
        where: (t, { and, eq }) => and(eq(t.id, connectionId), eq(t.workspaceId, workspaceId)),
      })
    : await db.query.notionConnections.findFirst({
        where: eq(notionConnections.workspaceId, workspaceId),
      })
  return conn?.accessToken ?? null
}

function extractRichText(richText: unknown[]): string {
  return richText.map((t: unknown) => (t as { plain_text?: string }).plain_text ?? '').join('')
}

function pageTitle(page: Record<string, unknown>): string {
  const props = page.properties as Record<string, unknown> | undefined
  if (!props) return page.id as string
  for (const key of ['Name', 'Title', 'title']) {
    const p = props[key] as { title?: unknown[] } | undefined
    if (p?.title) return extractRichText(p.title)
  }
  return page.id as string
}

export function listNotionConnectionsTool(db: DbClient, workspaceId: string) {
  return tool({
    description: 'List connected Notion workspaces.',
    parameters: z.object({}),
    execute: async () => {
      const rows = await db.query.notionConnections.findMany({
        where: eq(notionConnections.workspaceId, workspaceId),
        columns: { accessToken: false },
      })
      return rows.length > 0 ? rows : { message: 'No Notion connections configured.' }
    },
  })
}

export function searchNotionTool(db: DbClient, workspaceId: string) {
  return tool({
    description: 'Search pages and databases in the connected Notion workspace.',
    parameters: z.object({
      query: z.string().describe('Search text'),
      filter: z.enum(['page', 'database', 'all']).default('all'),
      limit: z.number().int().min(1).max(20).default(10),
      connectionId: z.string().optional().describe('Notion connection ID; omit to use the first connection'),
    }),
    execute: async ({ query, filter, limit, connectionId }) => {
      const token = await getToken(db, workspaceId, connectionId)
      if (!token) return { error: 'No Notion connection found' }

      const body: Record<string, unknown> = { query, page_size: limit }
      if (filter !== 'all') body.filter = { value: filter, property: 'object' }

      const data = await notionPost(token, '/search', body) as {
        results: Record<string, unknown>[]
      }
      return data.results.map((r) => ({
        id: r.id,
        type: r.object,
        title: pageTitle(r),
        url: r.url,
        lastEdited: r.last_edited_time,
      }))
    },
  })
}

export function readNotionPageTool(db: DbClient, workspaceId: string) {
  return tool({
    description: 'Read the content of a Notion page by its ID.',
    parameters: z.object({
      pageId: z.string().describe('Notion page ID (from search_notion)'),
      connectionId: z.string().optional(),
    }),
    execute: async ({ pageId, connectionId }) => {
      const token = await getToken(db, workspaceId, connectionId)
      if (!token) return { error: 'No Notion connection found' }

      const [page, blocks] = await Promise.all([
        notionGet(token, `/pages/${pageId}`),
        notionGet(token, `/blocks/${pageId}/children?page_size=100`),
      ])

      const content = (blocks.results as Record<string, unknown>[])
        .map((b) => {
          const type = b.type as string
          const block = b[type] as { rich_text?: unknown[] } | undefined
          if (block?.rich_text) return extractRichText(block.rich_text)
          return null
        })
        .filter(Boolean)
        .join('\n')

      return {
        id: page.id,
        title: pageTitle(page),
        url: page.url,
        lastEdited: page.last_edited_time,
        content,
      }
    },
  })
}

export function createNotionPageTool(db: DbClient, workspaceId: string) {
  return tool({
    description: 'Create a new Notion page. Requires a parent page or database ID.',
    parameters: z.object({
      parentId: z.string().describe('Parent page ID or database ID to create the page under'),
      parentType: z.enum(['page', 'database']).default('page'),
      title: z.string().describe('Page title'),
      content: z.string().optional().describe('Plain text content for the page body'),
      connectionId: z.string().optional(),
    }),
    execute: async ({ parentId, parentType, title, content, connectionId }) => {
      const token = await getToken(db, workspaceId, connectionId)
      if (!token) return { error: 'No Notion connection found' }

      const parent =
        parentType === 'database'
          ? { database_id: parentId }
          : { page_id: parentId }

      const children = content
        ? content.split('\n').filter(Boolean).map((line) => ({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: line } }],
            },
          }))
        : []

      const data = await notionPost(token, '/pages', {
        parent,
        properties: {
          title: { title: [{ type: 'text', text: { content: title } }] },
        },
        children,
      })

      return { id: data.id, url: data.url, title }
    },
  })
}

export function appendNotionPageTool(db: DbClient, workspaceId: string) {
  return tool({
    description: 'Append text content to an existing Notion page.',
    parameters: z.object({
      pageId: z.string().describe('Notion page ID to append to'),
      content: z.string().describe('Text to append (use \\n to separate paragraphs)'),
      connectionId: z.string().optional(),
    }),
    execute: async ({ pageId, content, connectionId }) => {
      const token = await getToken(db, workspaceId, connectionId)
      if (!token) return { error: 'No Notion connection found' }

      const children = content.split('\n').filter(Boolean).map((line) => ({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: line } }],
        },
      }))

      await notionPatch(token, `/blocks/${pageId}/children`, { children })
      return { ok: true, pageId }
    },
  })
}

export function queryNotionDatabaseTool(db: DbClient, workspaceId: string) {
  return tool({
    description: 'Query rows from a Notion database.',
    parameters: z.object({
      databaseId: z.string().describe('Notion database ID (from search_notion with filter=database)'),
      filter: z.string().optional().describe('JSON string of a Notion filter object'),
      sorts: z.string().optional().describe('JSON string of a Notion sorts array'),
      limit: z.number().int().min(1).max(50).default(20),
      connectionId: z.string().optional(),
    }),
    execute: async ({ databaseId, filter, sorts, limit, connectionId }) => {
      const token = await getToken(db, workspaceId, connectionId)
      if (!token) return { error: 'No Notion connection found' }

      const body: Record<string, unknown> = { page_size: limit }
      if (filter) {
        try { body.filter = JSON.parse(filter) } catch { /* ignore invalid filter */ }
      }
      if (sorts) {
        try { body.sorts = JSON.parse(sorts) } catch { /* ignore invalid sorts */ }
      }

      const data = await notionPost(token, `/databases/${databaseId}/query`, body) as {
        results: Record<string, unknown>[]
      }

      return data.results.map((r) => ({
        id: r.id,
        title: pageTitle(r),
        url: r.url,
        lastEdited: r.last_edited_time,
        properties: Object.entries((r.properties as Record<string, Record<string, unknown>>) ?? {}).reduce(
          (acc, [key, val]) => {
            const type = val.type as string
            if (type === 'title') acc[key] = extractRichText(val.title as unknown[])
            else if (type === 'rich_text') acc[key] = extractRichText(val.rich_text as unknown[])
            else if (type === 'select') acc[key] = (val.select as { name?: string } | null)?.name ?? null
            else if (type === 'multi_select') acc[key] = (val.multi_select as { name: string }[]).map((s) => s.name)
            else if (type === 'checkbox') acc[key] = val.checkbox
            else if (type === 'number') acc[key] = val.number
            else if (type === 'date') acc[key] = (val.date as { start?: string } | null)?.start ?? null
            else if (type === 'url') acc[key] = val.url
            else if (type === 'email') acc[key] = val.email
            else acc[key] = type
            return acc
          },
          {} as Record<string, unknown>
        ),
      }))
    },
  })
}
