import { ensureSchema, verifyLogin, createSession } from '../lib/db.js';

export default async function handler(req, res) {
  try {
    await ensureSchema();
    if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'بيانات ناقصة' });

    const user = await verifyLogin(username.trim(), password);
    if (!user) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });

    const token = await createSession(user.id);
    return res.status(200).json({ token, user });
  } catch (e) {
    console.error('login api error', e);
    res.status(500).json({ error: 'server error' });
  }
}
