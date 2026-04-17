export interface EmailAddress {
  name?: string
  email: string
}

export interface SendEmailParams {
  to: EmailAddress | EmailAddress[]
  subject: string
  html: string
  text?: string
  from?: EmailAddress
}

export interface IEmailProvider {
  send(params: SendEmailParams): Promise<void>
}
