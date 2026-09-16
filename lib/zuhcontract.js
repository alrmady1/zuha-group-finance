// جلب البيانات المحاسبية من قسم المقاولات (zuhcontract) عبر نقطة القراءة المحمية api/reports-feed.js
export async function fetchZuhcontractData() {
  const base = process.env.ZUHCONTRACT_API_BASE;
  const key = process.env.REPORTS_API_KEY;
  if (!base || !key) throw new Error('ZUHCONTRACT_API_BASE أو REPORTS_API_KEY غير مضبوطة');
  const res = await fetch(`${base.replace(/\/$/, '')}/api/reports-feed`, {
    headers: { 'X-Reports-Key': key },
  });
  if (!res.ok) throw new Error('تعذّر الاتصال بـ zuhcontract (حالة ' + res.status + ')');
  return res.json(); // { accProjects, accGeneral, contracts, projects, clients }
}
