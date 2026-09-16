// جلب البيانات المحاسبية من قسم التنظيف (zuhaclean) — واجهته مفتوحة بلا مصادقة أصلاً
// (تحقّقنا من ذلك في الكود المصدري)، فلا حاجة لأي مفتاح هنا، فقط عنوان الموقع.
export async function fetchZuhacleanData() {
  const base = process.env.ZUHACLEAN_API_BASE;
  if (!base) throw new Error('ZUHACLEAN_API_BASE غير مضبوط');
  const root = base.replace(/\/$/, '');
  const endpoints = {
    invoices: '/api/invoices',
    expenses: '/api/expenses',
    appointments: '/api/appointments',
    assets: '/api/assets',
    profiles: '/api/profiles',
    custodyInvoices: '/api/custody-invoices',
  };
  const entries = Object.entries(endpoints);
  const responses = await Promise.all(entries.map(([, path]) => fetch(`${root}${path}`)));
  const out = {};
  for (let i = 0; i < entries.length; i++) {
    const [key] = entries[i];
    const res = responses[i];
    if (!res.ok) throw new Error(`تعذّر جلب ${key} من zuhaclean (حالة ${res.status})`);
    out[key] = await res.json();
  }
  return out;
}
