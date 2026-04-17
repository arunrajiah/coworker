import fs from 'node:fs/promises'
import path from 'node:path'
import type { IFileStorage, UploadResult } from '@coworker/core'

export class LocalFileStorage implements IFileStorage {
  constructor(
    private basePath: string,
    private baseUrl: string
  ) {}

  async upload(key: string, buffer: Buffer, _mimeType: string): Promise<UploadResult> {
    const fullPath = path.join(this.basePath, key)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, buffer)
    return { key, url: `${this.baseUrl}/uploads/${key}` }
  }

  async download(key: string): Promise<Buffer> {
    const fullPath = path.join(this.basePath, key)
    return fs.readFile(fullPath)
  }

  async delete(key: string): Promise<void> {
    const fullPath = path.join(this.basePath, key)
    await fs.rm(fullPath, { force: true })
  }

  async getUrl(key: string): Promise<string> {
    return `${this.baseUrl}/uploads/${key}`
  }
}
