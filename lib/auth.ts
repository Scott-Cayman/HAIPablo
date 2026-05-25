import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-in-production'
);

const COOKIE_NAME = 'auth_token';
const TOKEN_EXPIRY = '7d';

export interface TokenPayload {
  userId: string;
  username: string;
  role: string;
}

function isSecureCookie(request: NextRequest): boolean {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const protocol = forwardedProto || request.nextUrl.protocol.replace(':', '');
  return protocol === 'https';
}

export async function createToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export function getCookieOptions(request: NextRequest): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  path: string;
  maxAge: number;
} {
  const secure = isSecureCookie(request);
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  };
}

export async function setAuthCookie(
  request: NextRequest,
  token: string
): Promise<void> {
  const cookieStore = await cookies();
  const options = getCookieOptions(request);
  cookieStore.set(COOKIE_NAME, token, options);
}

export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  return cookie?.value || null;
}

export async function getCurrentUser(): Promise<TokenPayload | null> {
  const token = await getAuthToken();
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAuth(): Promise<TokenPayload> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

export function isLegacyPasswordHash(password: string): boolean {
  const base64Pattern = /^[A-Za-z0-9+/]+=*$/;
  return base64Pattern.test(password) && password.length >= 4;
}

export function verifyLegacyPassword(
  inputPassword: string,
  storedPassword: string
): boolean {
  const encoded = Buffer.from(inputPassword).toString('base64');
  return encoded === storedPassword;
}

export function encodeLegacyPassword(password: string): string {
  return Buffer.from(password).toString('base64');
}
