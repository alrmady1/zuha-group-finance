// يحوّل بيانات كل قسم الخام (من reports-feed لقسم المقاولات، ومن واجهة
// zuhaclean المفتوحة لقسم التنظيف) إلى شكل مُوحَّد واحد (DivisionFinancialInputs)
// يفهمه محرك lib/financialStatements.js — حتى يُحسَب القسمان بنفس المنطق
// تماماً رغم اختلاف نموذج بياناتهما الأصلي.

function netAmount(e) {
  return Number(e.amountBeforeTax ?? e.amount) || 0;
}

// -------- قسم المقاولات (zuhcontract) --------
const CONTRACTING_COGS_PROJECT_TYPES = ["دفعة مشتريات", "مصروف مواد", "مصروف عمال"];
const CONTRACTING_COGS_GENERAL_CATEGORIES = ["مواد", "رواتب", "مواد التشغيل والنظافة"];

export function normalizeContracting(raw) {
  const accProjects = raw.accProjects || [];
  const accGeneral = raw.accGeneral || [];
  const vehicles = raw.vehicles || [];
  const users = raw.users || [];
  const custodies = raw.custodies || [];

  const revenueEntries = accProjects
    .filter(e => e.type === "إيراد مشروع" || e.type === "فاتورة ضريبية")
    .map(e => ({ date: e.date, amount: netAmount(e) }));

  const advanceEntries = accGeneral.filter(e => e.category === "سلفية");
  const nonAdvanceGeneral = accGeneral.filter(e => e.category !== "سلفية");

  const costOfSalesEntries = [
    ...accProjects.filter(e => CONTRACTING_COGS_PROJECT_TYPES.includes(e.type)).map(e => ({ date: e.date, amount: netAmount(e) })),
    ...nonAdvanceGeneral.filter(e => CONTRACTING_COGS_GENERAL_CATEGORIES.includes(e.category)).map(e => ({ date: e.date, amount: netAmount(e) })),
  ];

  const custodySpendEntries = [];
  for (const c of custodies) {
    for (const t of c.transactions || []) {
      if (t.type === "صرف") custodySpendEntries.push({ date: t.date, amount: Number(t.amount) || 0 });
    }
  }

  const adminExpenseEntries = [
    ...accProjects.filter(e => e.type === "مصروف نثرية").map(e => ({ date: e.date, amount: netAmount(e) })),
    ...nonAdvanceGeneral.filter(e => !CONTRACTING_COGS_GENERAL_CATEGORIES.includes(e.category)).map(e => ({ date: e.date, amount: netAmount(e) })),
    ...custodySpendEntries,
  ];

  const custodyGivenEntries = [
    ...advanceEntries.map(e => ({ date: e.date, amount: netAmount(e) })),
    ...custodies.flatMap(c => (c.transactions || []).filter(t => t.type === "إيداع").map(t => ({ date: t.date, amount: Number(t.amount) || 0 }))),
  ];
  const custodySettledEntries = [
    ...advanceEntries.filter(e => e.settled).map(e => ({ date: e.date, amount: netAmount(e) })),
    ...custodySpendEntries,
  ];

  const assets = vehicles
    .filter(v => v.ownership === "ملكية الشركة" && Number(v.purchasePrice) > 0 && v.purchaseDate)
    .map(v => ({ purchasePrice: v.purchasePrice, purchaseDate: v.purchaseDate, usefulLifeYears: v.usefulLifeYears, salvageValue: v.salvageValue, status: 'active' }));

  const employees = users.map(u => ({
    isActive: u.status !== "منتهي الخدمة",
    hireDate: u.hireDate,
    terminationDate: u.terminationDate,
    monthlySalary: u.baseSalary,
  }));

  return {
    revenueEntries,
    cashCollectedEntries: revenueEntries,
    costOfSalesEntries,
    adminExpenseEntries,
    otherIncomeEntries: [],
    capitalInjectionEntries: [],
    custodyGivenEntries,
    custodySettledEntries,
    assets,
    employees,
    receivablesAsOf: null,
  };
}

// -------- قسم التنظيف (zuhaclean) --------
export function normalizeCleaning(raw) {
  const expenses = raw.expenses || [];
  const appointments = raw.appointments || [];
  const assetsRaw = raw.assets || [];
  const profiles = raw.profiles || [];

  const CUSTODY_CATEGORY_NAME = 'مصاريف عهدة';
  const ADVANCE_CATEGORY_NAME = 'سلفية';
  const CAPEX_CLASSIFICATIONS = ['fixed_assets', 'setup_short_lived_assets'];
  const COGS_CLASSIFICATIONS = ['raw_materials', 'employee_wages'];

  function isCustodyGiven(e) { return e.category === CUSTODY_CATEGORY_NAME && !e.paid_via_custody; }
  function isAdvanceGiven(e) { return e.category === ADVANCE_CATEGORY_NAME; }

  const revenueEntries = appointments
    .filter(a => a.status === 'completed')
    .map(a => ({ date: (a.scheduled_at || '').slice(0, 10), amount: Number(a.amount) || 0 }));

  const cashCollectedEntries = [];
  for (const a of appointments) {
    for (const p of a.payments || []) {
      cashCollectedEntries.push({ date: (p.recorded_at || '').slice(0, 10), amount: Number(p.amount) || 0 });
    }
  }

  const costOfSalesEntries = [];
  const adminExpenseEntries = [];
  const otherIncomeEntries = [];
  const capitalInjectionEntries = [];
  const custodyGivenEntries = [];
  const custodySettledEntries = [];

  for (const e of expenses) {
    const date = (e.date || '').slice(0, 10);
    const amount = Number(e.amount) || 0;
    if (isCustodyGiven(e)) { custodyGivenEntries.push({ date, amount }); continue; }
    if (isAdvanceGiven(e)) {
      custodyGivenEntries.push({ date, amount });
      if (Number(e.advance_settled_amount) > 0) custodySettledEntries.push({ date, amount: Number(e.advance_settled_amount) });
      continue;
    }
    if (CAPEX_CLASSIFICATIONS.includes(e.accounting_classification)) continue; // أصل رسمي منفصل عبر وحدة الجرد أو أصل قصير العمر — لا يدخل قائمة الدخل
    if (e.entry_type === 'income') {
      if (e.income_type === 'additional_capital') capitalInjectionEntries.push({ date, amount });
      else otherIncomeEntries.push({ date, amount });
      continue;
    }
    if (e.paid_via_custody) custodySettledEntries.push({ date, amount });
    if (COGS_CLASSIFICATIONS.includes(e.accounting_classification) || e.category === 'رواتب') costOfSalesEntries.push({ date, amount });
    else adminExpenseEntries.push({ date, amount });
  }

  const assets = assetsRaw.map(a => ({
    purchasePrice: a.purchase_price, purchaseDate: a.purchase_date,
    usefulLifeYears: a.useful_life_years, salvageValue: a.salvage_value,
    scrappedAt: a.scrapped_at, status: a.status,
  }));

  const employees = profiles.map(p => ({
    isActive: p.is_active, hireDate: p.hire_date, terminationDate: p.termination_date, monthlySalary: p.monthly_salary,
  }));

  function receivablesAsOf(asOfDate) {
    return appointments
      .filter(a => a.status !== 'cancelled' && (a.scheduled_at || '').slice(0, 10) <= asOfDate)
      .reduce((s, a) => s + (Number(a.remaining_amount) || 0), 0);
  }

  return {
    revenueEntries, cashCollectedEntries, costOfSalesEntries, adminExpenseEntries,
    otherIncomeEntries, capitalInjectionEntries, custodyGivenEntries, custodySettledEntries,
    assets, employees, receivablesAsOf,
  };
}
