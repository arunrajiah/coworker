import { SignJWT, jwtVerify } from 'jose'
import { getEnv } from '@coworker/config'
import { nanoid } from 'nanoid'

export interface JwtPayload {
  sub: string       // user id
  email: string
  workspaceId?: string
  sessionId: string
}

function getSecret() {
  return new TextEncoder().encode(getEnv().AUTH_SECRET)
}

export async function signToken(payload: Omit<JwtPayload, 'sessionId'>): Promise<string> {
  return new SignJWT({ ...payload, sessionId: nanoid() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecret())
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, getSecret())
  return payload as unknown as JwtPayload
}

export function generateMagicToken(): string {
  return nanoid(48)
}
