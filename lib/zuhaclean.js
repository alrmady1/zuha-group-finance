// جلب البيانات المحاسبية من قسم التنظيف (zuhaclean) — واجهته مفتوحة بلا مصادقة أصلاً
// (تحقّقنا من ذلك في الكود المصدري)، فلا حاجة لأي مفتاح هنا، فقط عنوان الموقع.
export async function fetchZuhacleanData() {
  const base = process.env.ZUHACLEAN_API_BASE;
  if (!base) throw new Error('ZUHACLEAN_API_BASE غير مضبوط');
  const root = base.replace(/\/$/, '');
  const [invoicesRes, expensesRes] = await Promise.all([
    fetch(`${root}/api/invoices`),
    fetch(`${root}/api/expenses`),
  ]);
  if (!invoicesRes.ok) throw new Error('تعذّر جلب فواتير zuhaclean (حالة ' + invoicesRes.status + ')');
  if (!expensesRes.ok) throw new Error('تعذّر جلب مصاريف zuhaclean (حالة ' + expensesRes.status + ')');
  const [invoices, expenses] = await Promise.all([invoicesRes.json(), expensesRes.json()]);
  return { invoices, expenses };
}
