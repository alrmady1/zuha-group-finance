// إهلاك بطريقة القسط الثابت — نفس المعادلة المستخدمة حرفياً في كل من قسم
// المقاولات (computeAssetDepreciation في js/accounting.js) وقسم التنظيف
// (src/shared/depreciation.ts) حتى تتطابق الأرقام هنا مع كلا النظامين تماماً.
export function computeAssetDepreciation(purchasePrice, purchaseDate, usefulLifeYears, salvageValue, asOfDate) {
  asOfDate = asOfDate || new Date();
  const depreciableBase = Math.max((Number(purchasePrice) || 0) - (Number(salvageValue) || 0), 0);
  const totalMonths = Math.max(Math.round((Number(usefulLifeYears) || 0) * 12), 1);
  const annual = usefulLifeYears > 0 ? depreciableBase / usefulLifeYears : 0;
  const monthly = annual / 12;

  const purchase = new Date(purchaseDate);
  let monthsElapsed = 0;
  if (!isNaN(purchase.getTime())) {
    monthsElapsed = (asOfDate.getFullYear() - purchase.getFullYear()) * 12 + (asOfDate.getMonth() - purchase.getMonth());
    if (asOfDate.getDate() < purchase.getDate()) monthsElapsed -= 1;
    monthsElapsed = Math.min(Math.max(monthsElapsed, 0), totalMonths);
  }

  const accumulated = Math.round(monthly * monthsElapsed * 100) / 100;
  const bookValue = Math.max(Math.round(((Number(purchasePrice) || 0) - accumulated) * 100) / 100, Number(salvageValue) || 0);

  return {
    annualDepreciation: Math.round(annual * 100) / 100,
    monthlyDepreciation: Math.round(monthly * 100) / 100,
    monthsElapsed,
    accumulatedDepreciation: accumulated,
    bookValue,
  };
}
