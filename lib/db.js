import { sql } from '@vercel/postgres';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

let schemaReady = false;

// ينشئ الجداول إن لم تكن موجودة بعد — استدعاء آمن ورخيص التكرار من أي دالة خادم
export async function ensureSchema() {
  if (schemaReady) return;
  await sql`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  // الموازنة: خطة مالية لكل قسم (أو "combined")، تصنيف محاسبي، وفترة (سنة + ربع اختياري لموازنة ربعية، أو سنوية كاملة إن تُرك فارغاً)
  await sql`CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    division TEXT NOT NULL,
    classification TEXT NOT NULL,
    year INTEGER NOT NULL,
    quarter INTEGER,
    planned_amount NUMERIC NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  schemaReady = true;
}

/* ---------- المستخدمون وتسجيل الدخول ----------
   كلمة السر مُخزَّنة كـ scrypt hash (لا مكتبات خارجية) — على عكس بقية أنظمة
   المجموعة التي أبقت كلمة سر نصية لتوافق تاريخي، هذا تطبيق جديد بالكامل
   يحمل بيانات مالية حسّاسة لكلا القسمين فلا داعي لأي تنازل هنا. */
function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = (stored || '').split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export async function createUser(id, username, name, password) {
  const password_hash = hashPassword(password);
  await sql`INSERT INTO users (id, username, name, password_hash) VALUES (${id}, ${username}, ${name}, ${password_hash})`;
}

export async function findUserByUsername(username) {
  const { rows } = await sql`SELECT id, username, name, password_hash FROM users WHERE username = ${username}`;
  return rows[0] || null;
}

export async function verifyLogin(username, password) {
  const user = await findUserByUsername(username);
  if (!user) return null;
  if (!verifyPassword(password, user.password_hash)) return null;
  return { id: user.id, username: user.username, name: user.name };
}

export async function usersCount() {
  const { rows } = await sql`SELECT count(*)::int AS n FROM users`;
  return rows[0].n;
}

export async function createSession(userId) {
  const token = randomBytes(32).toString('hex');
  await sql`INSERT INTO sessions (token, user_id) VALUES (${token}, ${userId})`;
  return token;
}

// صلاحية الجلسة: 30 يوماً (نفس نمط بقية أنظمة المجموعة)
export async function getSessionUserId(token) {
  if (!token) return null;
  const { rows } = await sql`
    SELECT user_id FROM sessions
    WHERE token = ${token} AND created_at > now() - interval '30 days'
  `;
  return rows.length ? rows[0].user_id : null;
}

export function getBearerToken(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/* ---------- الموازنة ---------- */
export async function listBudgets() {
  const { rows } = await sql`SELECT * FROM budgets ORDER BY year DESC, quarter NULLS FIRST, division, classification`;
  return rows;
}

export async function upsertBudget({ id, division, classification, year, quarter, planned_amount, notes }) {
  await sql`
    INSERT INTO budgets (id, division, classification, year, quarter, planned_amount, notes, updated_at)
    VALUES (${id}, ${division}, ${classification}, ${year}, ${quarter}, ${planned_amount}, ${notes || ''}, now())
    ON CONFLICT (id) DO UPDATE SET
      division = EXCLUDED.division, classification = EXCLUDED.classification,
      year = EXCLUDED.year, quarter = EXCLUDED.quarter,
      planned_amount = EXCLUDED.planned_amount, notes = EXCLUDED.notes, updated_at = now()
  `;
}

export async function deleteBudget(id) {
  await sql`DELETE FROM budgets WHERE id = ${id}`;
}
