// محرك القوائم المالية الأربع (دخل شامل، مركز مالي، تغيرات حقوق الملكية،
// تدفقات نقدية) — منطق منقول ومعمَّم من src/shared/financialStatements.ts
// في قسم التنظيف (zuhaclean)، ليعمل على شكل مُوحَّد من المدخلات
// (DivisionFinancialInputs) يُنتجه محوِّل كل قسم على حدة (انظر
// lib/normalize.js)، فيُحسَب بنفس المنطق تماماً لكلا القسمين ثم يُجمَّعان.
//
// كل بند StatementLine يحمل مصدره صراحة تماماً كالمصدر الأصلي:
//  - 'auto'     : محتسَب بالكامل من بيانات النظام (دقيق، لا حاجة لتدخل).
//  - 'estimate' : محتسَب من بيانات النظام لكن بافتراض مبسَّط يستحق المراجعة.
//  - 'manual'   : غير مُتتبَّع في أي من النظامين — قيمته صفر افتراضياً،
//                 يحتاج إدخالاً يدوياً قبل الاعتماد النهائي.
import { computeAssetDepreciation } from './depreciation.js';

function line(value, source = 'auto', note) {
  return { value: Math.round((value || 0) * 100) / 100, source, note };
}
function manual(note) {
  return { value: 0, source: 'manual', note };
}

function sumInRange(entries, from, to) {
  return (entries || []).reduce((s, e) => (e.date >= from && e.date <= to ? s + (Number(e.amount) || 0) : s), 0);
}
function sumUpTo(entries, asOfDate) {
  return (entries || []).reduce((s, e) => (e.date <= asOfDate ? s + (Number(e.amount) || 0) : s), 0);
}

// إهلاك الأصول الثابتة خلال فترة [from, to] — الفرق بين الإهلاك المتراكم
// في نهاية الفترة وبدايتها لكل أصل غير مشطوب قبل بداية الفترة.
function depreciationForPeriod(assets, from, to) {
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T23:59:59`);
  let total = 0;
  for (const asset of assets || []) {
    const purchase = new Date(`${asset.purchaseDate}T00:00:00`);
    if (purchase > toDate) continue;
    if (asset.scrappedAt && new Date(asset.scrappedAt) < fromDate) continue;
    const depAtEnd = computeAssetDepreciation(asset.purchasePrice, asset.purchaseDate, asset.usefulLifeYears, asset.salvageValue, toDate).accumulatedDepreciation;
    const depAtStart = computeAssetDepreciation(
      asset.purchasePrice, asset.purchaseDate, asset.usefulLifeYears, asset.salvageValue,
      new Date(fromDate.getTime() - 1),
    ).accumulatedDepreciation;
    total += Math.max(depAtEnd - depAtStart, 0);
  }
  return total;
}

// تقدير مخصص مكافأة نهاية الخدمة — نفس صيغة المادة ٨٤ من نظام العمل
// السعودي (نصف شهر عن كل سنة من أول ٥ سنوات، شهر كامل عمّا بعدها) كأن كل
// موظف نشط أُنهيَ عقده اليوم — مخصص محاسبي تقديري وليس مبلغاً مستحقاً فعلاً.
function estimateEndOfServiceProvision(employees, asOfDate) {
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  let total = 0;
  for (const p of employees || []) {
    if (!p.isActive || p.terminationDate || !p.hireDate || !p.monthlySalary) continue;
    const years = Math.max(0, (asOfDate.getTime() - new Date(p.hireDate).getTime()) / msPerYear);
    const first5 = Math.min(years, 5);
    const beyond5 = Math.max(years - 5, 0);
    total += (first5 * 0.5 + beyond5 * 1) * p.monthlySalary;
  }
  return total;
}

// --------------------------------------------------------------------------
// قائمة الدخل الشامل — لفترة [from, to] (YYYY-MM-DD شاملة الطرفين)
// --------------------------------------------------------------------------
export function computeIncomeStatement(inputs, from, to) {
  const revenue = sumInRange(inputs.revenueEntries, from, to);
  const costOfSales = sumInRange(inputs.costOfSalesEntries, from, to);
  const adminExpenses = sumInRange(inputs.adminExpenseEntries, from, to);
  const otherIncomeTotal = sumInRange(inputs.otherIncomeEntries, from, to);
  const depreciation = depreciationForPeriod(inputs.assets, from, to);

  const grossProfit = revenue - costOfSales;
  const netProfitBeforeTax = grossProfit - adminExpenses - depreciation + otherIncomeTotal;

  return {
    revenue: line(revenue, 'auto', 'الإيراد المُحتسَب على أساس الاستحقاق ضمن الفترة'),
    costOfSales: line(costOfSales, 'auto', 'مواد ومشتريات مباشرة + أجور عمالة مباشرة/عامة (افتراض مبسَّط لشركة خدمات/مقاولات)'),
    grossProfit: line(grossProfit),
    generalAdminExpenses: line(adminExpenses + depreciation, 'auto', 'مصاريف عمومية وإدارية وتشغيلية ومرافق + إهلاك الأصول الثابتة للفترة'),
    sellingDistributionExpenses: manual('غير مُتتبَّعة كبند مستقل في أي من النظامين'),
    otherExpenses: manual(),
    otherIncome: line(otherIncomeTotal, 'auto'),
    netProfitBeforeTax: line(netProfitBeforeTax),
    financeCost: manual('لا توجد قروض/تمويل مُتتبَّع'),
    zakat: manual('يحتاج احتساباً متخصصاً وفق أنظمة هيئة الزكاة والضريبة والجمارك (زكاتي)'),
    incomeTax: manual(),
    netProfitForPeriod: line(netProfitBeforeTax),
    otherComprehensiveIncome: line(0),
    totalComprehensiveIncome: line(netProfitBeforeTax),
  };
}

// --------------------------------------------------------------------------
// قائمة المركز المالي — كما في تاريخ معيَّن (asOfDate)
// --------------------------------------------------------------------------
export function computeBalanceSheet(inputs, asOfDate) {
  const asOf = new Date(`${asOfDate}T23:59:59`);

  const capitalInjected = sumUpTo(inputs.capitalInjectionEntries, asOfDate);
  const cashOutflows = sumUpTo(inputs.costOfSalesEntries, asOfDate) + sumUpTo(inputs.adminExpenseEntries, asOfDate) + sumUpTo(inputs.custodyGivenEntries, asOfDate);
  const cashCollected = sumUpTo(inputs.cashCollectedEntries, asOfDate);
  const otherIncomeAllTime = sumUpTo(inputs.otherIncomeEntries, asOfDate);

  let assetPurchasesFormal = 0;
  let ppeNetBookValue = 0;
  for (const asset of inputs.assets || []) {
    if (new Date(`${asset.purchaseDate}T00:00:00`) > asOf) continue;
    assetPurchasesFormal += Number(asset.purchasePrice) || 0;
    if (asset.status !== 'scrapped') {
      ppeNetBookValue += computeAssetDepreciation(
        asset.purchasePrice, asset.purchaseDate, asset.usefulLifeYears, asset.salvageValue,
        asset.scrappedAt ? new Date(asset.scrappedAt) : asOf,
      ).bookValue;
    }
  }

  const cashEstimate = capitalInjected + cashCollected + otherIncomeAllTime - cashOutflows - assetPurchasesFormal;
  const custodyGiven = sumUpTo(inputs.custodyGivenEntries, asOfDate);
  const custodySettled = sumUpTo(inputs.custodySettledEntries, asOfDate);
  const custodyBalance = Math.max(custodyGiven - custodySettled, 0);
  const receivables = inputs.receivablesAsOf ? inputs.receivablesAsOf(asOfDate) : 0;
  const eosProvision = estimateEndOfServiceProvision(inputs.employees, asOf);

  const totalNonCurrentAssets = ppeNetBookValue;
  const totalCurrentAssets = custodyBalance + receivables + cashEstimate;
  const totalAssets = totalNonCurrentAssets + totalCurrentAssets;

  const totalNonCurrentLiabilities = eosProvision;
  const totalCurrentLiabilities = 0;
  const totalLiabilities = totalNonCurrentLiabilities + totalCurrentLiabilities;

  const totalEquity = totalAssets - totalLiabilities;
  const retainedEarnings = totalEquity - capitalInjected;

  return {
    propertyPlantEquipment: line(ppeNetBookValue, 'auto', 'صافي القيمة الدفترية للأصول الثابتة المسجَّلة (المركبات المملوكة/وحدة الجرد)'),
    intangibleAssets: manual(),
    investmentProperty: manual(),
    equityMethodInvestments: manual(),
    otherNonCurrentAssets: manual(),
    totalNonCurrentAssets: line(totalNonCurrentAssets),
    prepaidAndOtherDebitBalances: line(custodyBalance, 'estimate', 'رصيد العهد والسلف غير المسدَّدة (تقدير من الحالة الحالية لا تاريخ التسوية الفعلي)'),
    tradeReceivables: line(receivables, inputs.receivablesAsOf ? 'auto' : 'manual', inputs.receivablesAsOf ? undefined : 'لا يتتبع النظام ذمماً مدينة صريحة لهذا القسم'),
    cashAndEquivalents: line(cashEstimate, 'estimate', 'تقدير آلي من حركة الإيرادات المحصَّلة والمصروفات المدفوعة — يُنصح بمطابقته مع كشف الحساب البنكي والصندوق الفعليين'),
    inventory: manual('لا يتتبع النظام مخزون المواد الاستهلاكية'),
    fvInvestments: manual(),
    otherCurrentAssets: manual(),
    dueFromRelatedParties: manual(),
    totalCurrentAssets: line(totalCurrentAssets),
    totalAssets: line(totalAssets),
    capital: line(capitalInjected, capitalInjected ? 'auto' : 'manual', capitalInjected ? undefined : 'لا توجد حركة رأس مال مسجَّلة كإيراد "زيادة رأس مال" — أدخله يدوياً إن لزم'),
    statutoryReserve: manual('يُحتسَب عادة كنسبة من صافي الربح السنوي وفق نظام الشركات — يحتاج مراجعة محاسب'),
    retainedEarnings: line(retainedEarnings, 'estimate', 'الفرق المتبقي لموازنة القائمة (إجمالي الموجودات − إجمالي المطلوبات − رأس المال)'),
    otherEquityItems: manual(),
    parentEquity: line(totalEquity),
    nonControllingInterest: line(0, 'auto', 'لا ينطبق — لا توجد شركات تابعة'),
    totalEquity: line(totalEquity),
    employeeBenefitsObligation: line(eosProvision, 'estimate', 'مخصص تقديري لمكافأة نهاية الخدمة لكل موظف نشط (كأن عقده أُنهي اليوم) وفق المادة ٨٤ من نظام العمل — تقدير مبسَّط'),
    longTermDebt: manual('لا توجد قروض مُتتبَّعة'),
    deferredTaxLiabilities: manual(),
    otherNonCurrentLiabilities: manual(),
    totalNonCurrentLiabilities: line(totalNonCurrentLiabilities),
    currentDebt: manual(),
    zakatPayable: manual('يحتاج احتساباً متخصصاً وفق أنظمة هيئة الزكاة والضريبة والجمارك (زكاتي)'),
    taxesPayable: manual(),
    dueToRelatedParties: manual(),
    tradeAndOtherPayables: manual('لا يتتبع أي من النظامين مبالغ مستحقة لموردين — كل مصروف يُسجَّل كمدفوع فوراً'),
    accruedExpenses: manual(),
    otherCurrentLiabilities: manual(),
    totalCurrentLiabilities: line(totalCurrentLiabilities),
    totalLiabilities: line(totalLiabilities),
    totalEquityAndLiabilities: line(totalEquity + totalLiabilities),
  };
}

// --------------------------------------------------------------------------
// قائمة التغيرات في حقوق الملكية — لفترة [from, to]
// --------------------------------------------------------------------------
export function computeEquityChanges(inputs, from, to) {
  const dayBeforeFrom = new Date(`${from}T00:00:00`);
  dayBeforeFrom.setDate(dayBeforeFrom.getDate() - 1);
  const openingDate = dayBeforeFrom.toISOString().slice(0, 10);

  const opening = computeBalanceSheet(inputs, openingDate);
  const closing = computeBalanceSheet(inputs, to);
  const periodIncome = computeIncomeStatement(inputs, from, to);

  const capitalAdded = closing.capital.value - opening.capital.value;

  return {
    openingCapital: line(opening.capital.value, opening.capital.source),
    openingReserve: manual(),
    openingRetainedEarnings: line(opening.retainedEarnings.value, 'estimate'),
    openingTotal: line(opening.totalEquity.value, 'estimate'),
    capitalAdded: line(capitalAdded, 'auto', 'زيادة رأس المال المسجَّلة خلال الفترة'),
    netIncomeForPeriod: line(periodIncome.netProfitForPeriod.value),
    closingCapital: line(closing.capital.value, closing.capital.source),
    closingReserve: manual(),
    closingRetainedEarnings: line(closing.retainedEarnings.value, 'estimate'),
    closingTotal: line(closing.totalEquity.value, 'estimate'),
  };
}

// --------------------------------------------------------------------------
// قائمة التدفقات النقدية — لفترة [from, to] (الطريقة غير المباشرة)
// --------------------------------------------------------------------------
export function computeCashFlowStatement(inputs, from, to) {
  const dayBeforeFrom = new Date(`${from}T00:00:00`);
  dayBeforeFrom.setDate(dayBeforeFrom.getDate() - 1);
  const openingDate = dayBeforeFrom.toISOString().slice(0, 10);

  const income = computeIncomeStatement(inputs, from, to);
  const opening = computeBalanceSheet(inputs, openingDate);
  const closing = computeBalanceSheet(inputs, to);
  const depreciation = depreciationForPeriod(inputs.assets, from, to);

  const eosMovement = closing.employeeBenefitsObligation.value - opening.employeeBenefitsObligation.value;
  const changeInReceivablesAndPrepaid =
    opening.tradeReceivables.value + opening.prepaidAndOtherDebitBalances.value -
    (closing.tradeReceivables.value + closing.prepaidAndOtherDebitBalances.value);
  const changeInPayables = 0;

  const netCashFromOperating = income.netProfitBeforeTax.value + depreciation + eosMovement + changeInReceivablesAndPrepaid + changeInPayables;

  const ppeAdditions = (inputs.assets || [])
    .filter(a => a.purchaseDate >= from && a.purchaseDate <= to)
    .reduce((s, a) => s + (Number(a.purchasePrice) || 0), 0);
  const netCashUsedInInvesting = -ppeAdditions;

  const capitalAdditions = closing.capital.value - opening.capital.value;
  const netCashFromFinancing = capitalAdditions;

  const netChangeInCash = netCashFromOperating + netCashUsedInInvesting + netCashFromFinancing;

  return {
    netProfitBeforeTax: line(income.netProfitBeforeTax.value),
    depreciationAddback: line(depreciation, 'auto', 'بند غير نقدي — يُضاف مجدداً لصافي الربح'),
    eosProvisionMovement: line(eosMovement, 'estimate'),
    changeInReceivablesAndPrepaid: line(changeInReceivablesAndPrepaid, 'estimate'),
    changeInPayables: line(changeInPayables, 'manual', 'لا مطلوبات متداولة مُتتبَّعة'),
    netCashFromOperating: line(netCashFromOperating, 'estimate'),
    ppeAdditions: line(-ppeAdditions, 'auto', 'مشتريات أصول ثابتة جديدة خلال الفترة'),
    netCashUsedInInvesting: line(netCashUsedInInvesting, 'auto'),
    capitalAdditions: line(capitalAdditions, 'auto'),
    netCashFromFinancing: line(netCashFromFinancing, 'auto'),
    netChangeInCash: line(netChangeInCash, 'estimate'),
    cashAtStart: line(opening.cashAndEquivalents.value, 'estimate'),
    cashAtEnd: line(closing.cashAndEquivalents.value, 'estimate'),
  };
}

// --------------------------------------------------------------------------
// دمج قائمتين (قسم المقاولات + قسم التنظيف) في قائمة واحدة للكيان بالكامل —
// جمع كل بند رقمياً، مع تنزيل المصدر إلى 'estimate' إن لم يكن كلا القسمين 'auto'.
// --------------------------------------------------------------------------
export function combineStatements(a, b) {
  const out = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const la = a[key], lb = b[key];
    if (!la || !lb || typeof la.value !== 'number') { out[key] = la || lb; continue; }
    const value = la.value + lb.value;
    const source = (la.source === 'auto' && lb.source === 'auto') ? 'auto' : 'estimate';
    out[key] = { value: Math.round(value * 100) / 100, source, note: 'مجموع القسمين' };
  }
  return out;
}
