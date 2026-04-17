export interface UploadResult {
  key: string
  url: string
}

export interface IFileStorage {
  upload(key: string, buffer: Buffer, mimeType: string): Promise<UploadResult>
  download(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
  getUrl(key: string): Promise<string>
}
