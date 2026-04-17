import nodemailer from 'nodemailer'
import type { IEmailProvider, SendEmailParams } from '@coworker/core'

export class NodemailerEmailProvider implements IEmailProvider {
  private transporter: nodemailer.Transporter
  private defaultFrom: string

  constructor(smtpUrl: string, defaultFrom: string) {
    this.defaultFrom = defaultFrom
    this.transporter = nodemailer.createTransport(smtpUrl)
  }

  async send(params: SendEmailParams): Promise<void> {
    const to = Array.isArray(params.to)
      ? params.to.map((a) => (a.name ? `"${a.name}" <${a.email}>` : a.email)).join(', ')
      : params.to.name
        ? `"${params.to.name}" <${params.to.email}>`
        : params.to.email

    const from = params.from
      ? params.from.name
        ? `"${params.from.name}" <${params.from.email}>`
        : params.from.email
      : this.defaultFrom

    await this.transporter.sendMail({ from, to, subject: params.subject, html: params.html, text: params.text })
  }
}

// Dev-mode provider: prints emails to stdout instead of sending
export class ConsoleEmailProvider implements IEmailProvider {
  async send(params: SendEmailParams): Promise<void> {
    const to = Array.isArray(params.to)
      ? params.to.map((a) => a.email).join(', ')
      : params.to.email
    console.log('\n📧 [EMAIL]')
    console.log(`To: ${to}`)
    console.log(`Subject: ${params.subject}`)
    console.log(`\n${params.text ?? params.html}\n`)
  }
}
