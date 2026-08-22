import fs from 'node:fs/promises'
import path from 'node:path'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { IFileStorage, UploadResult } from '@coworker/core'

const DEFAULT_URL_TTL_SECONDS = 24 * 60 * 60

// HMAC over "key:exp" so neither the path nor the expiry can be tampered with.
export function signUploadKey(key: string, expiresAt: number, secret: string): string {
  return createHmac('sha256', secret).update(`${key}:${expiresAt}`).digest('hex')
}

export function verifyUploadSignature(
  key: string,
  exp: string | undefined,
  sig: string | undefined,
  secret: string
): boolean {
  if (!exp || !sig) return false
  const expiresAt = Number(exp)
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return false
  const expected = Buffer.from(signUploadKey(key, expiresAt, secret))
  const given = Buffer.from(sig)
  if (expected.length !== given.length) return false
  return timingSafeEqual(expected, given)
}

export class LocalFileStorage implements IFileStorage {
  constructor(
    private basePath: string,
    private baseUrl: string,
    // When set, getUrl/upload return time-limited signed URLs and the
    // /uploads route should verify them. Unset keeps plain URLs (dev only).
    private signingSecret?: string,
    private urlTtlSeconds: number = DEFAULT_URL_TTL_SECONDS
  ) {}

  // Resolve a storage key and refuse anything that escapes basePath (e.g. "../../etc/passwd").
  private resolve(key: string): string {
    const fullPath = path.resolve(this.basePath, key)
    const base = path.resolve(this.basePath) + path.sep
    if (!fullPath.startsWith(base)) {
      throw new Error('Invalid storage key')
    }
    return fullPath
  }

  async upload(key: string, buffer: Buffer, _mimeType: string): Promise<UploadResult> {
    const fullPath = this.resolve(key)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, buffer)
    return { key, url: await this.getUrl(key) }
  }

  async download(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key))
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true })
  }

  async getUrl(key: string): Promise<string> {
    if (!this.signingSecret) return `${this.baseUrl}/uploads/${key}`
    const exp = Math.floor(Date.now() / 1000) + this.urlTtlSeconds
    const sig = signUploadKey(key, exp, this.signingSecret)
    return `${this.baseUrl}/uploads/${key}?exp=${exp}&sig=${sig}`
  }
}
