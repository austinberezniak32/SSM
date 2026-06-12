// Passcode auth with signed HttpOnly session cookie.
// Single shared workspace today; structured so per-user accounts can be added later.
import crypto from 'crypto';

const COOKIE_NAME = 'ssm_session';
const SESSION_DAYS = 60;

function secret() {
  return process.env.SESSION_SECRET || process.env.APP_PASSCODE || 'ssm-dev-secret';
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function verify(token) {
  if (!token) return null;
  const idx = token.lastIndexOf('.');
  if (idx < 0) return null;
  const body = token.slice(0, idx);
  const mac = token.slice(idx + 1);
  const expect = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  if (mac.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expect))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function readCookie(req) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE_NAME) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function issueSession(res, name) {
  const token = sign({ name: name || 'crew', exp: Date.now() + SESSION_DAYS * 86400_000 });
  const isProd = !!process.env.DATABASE_URL;
  res.setHeader('Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${isProd ? '; Secure' : ''}`);
}

export function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export function checkPasscode(passcode) {
  const expected = process.env.APP_PASSCODE;
  if (!expected) return true; // no passcode configured — open access (dev)
  if (typeof passcode !== 'string') return false;
  const a = Buffer.from(passcode);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function requireAuth(req, res, next) {
  const session = verify(readCookie(req));
  if (!session) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  req.session = session;
  next();
}
