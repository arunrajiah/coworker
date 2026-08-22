import fs from 'node:fs/promises'
import path from 'node:path'
import type { IFileStorage, UploadResult } from '@coworker/core'

export class LocalFileStorage implements IFileStorage {
  constructor(
    private basePath: string,
    private baseUrl: string
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
    return { key, url: `${this.baseUrl}/uploads/${key}` }
  }

  async download(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key))
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true })
  }

  async getUrl(key: string): Promise<string> {
    return `${this.baseUrl}/uploads/${key}`
  }
}
