import { ensureSchema, usersCount, createUser } from '../lib/db.js';
import { randomBytes } from 'crypto';

// إعداد أول مرة فقط: يسمح بإنشاء أول حساب طالما لا يوجد أي مستخدم بعد — يُغلق تلقائياً بعد ذلك
export default async function handler(req, res) {
  try {
    await ensureSchema();

    if (req.method === 'GET') {
      const n = await usersCount();
      return res.status(200).json({ needsSetup: n === 0 });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

    const count = await usersCount();
    if (count > 0) return res.status(403).json({ error: 'تم الإعداد الأول مسبقاً — أضف حسابات جديدة من داخل النظام لاحقاً' });

    const { username, name, password } = req.body || {};
    if (!username || !name || !password) return res.status(400).json({ error: 'بيانات ناقصة' });
    if (password.length < 6) return res.status(400).json({ error: 'كلمة السر قصيرة جداً (٦ أحرف على الأقل)' });

    await createUser(randomBytes(8).toString('hex'), username.trim(), name.trim(), password);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('setup api error', e);
    res.status(500).json({ error: 'server error' });
  }
}
