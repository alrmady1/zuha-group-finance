// منطق حساب الضريبة لكل قسم — منقول حرفياً من النظامين الأصليين (وليس إعادة اختراع)
// حتى تتطابق الأرقام هنا تماماً مع ما يظهر داخل كل نظام على حدة.

function quarterOfDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return { year: d.getFullYear(), quarter: Math.ceil((d.getMonth() + 1) / 3) };
}
function inQuarter(dateStr, year, quarter) {
  const q = quarterOfDate(dateStr);
  return !!q && q.year === year && q.quarter === quarter;
}

// -------- قسم المقاولات (zuhcontract) — منقول من renderAccVat في js/accounting.js --------
export function computeContractingVat({ accProjects = [], accGeneral = [] }, year, quarter) {
  const PURCHASE_TYPES = ["دفعة مشتريات", "مصروف مواد", "مصروف عمال", "مصروف نثرية"];
  const projEntries = accProjects.filter(e => e.vatApplicable && inQuarter(e.date, year, quarter));
  const genEntries = accGeneral.filter(e => e.vatApplicable && inQuarter(e.date, year, quarter));

  const salesEntries = projEntries.filter(e => e.type === "إيراد مشروع" || e.type === "فاتورة ضريبية");
  const purchaseEntries = projEntries.filter(e => PURCHASE_TYPES.includes(e.type));

  const outputSales = salesEntries.reduce((s, e) => s + Number(e.amountBeforeTax ?? e.amount ?? 0), 0);
  const outputVat = salesEntries.reduce((s, e) => s + Number(e.vatAmount || 0), 0);
  const inputPurchases = purchaseEntries.reduce((s, e) => s + Number(e.amount || 0), 0)
    + genEntries.reduce((s, e) => s + Number(e.amount || 0), 0);
  const inputVat = purchaseEntries.reduce((s, e) => s + Number(e.vatAmount || 0), 0)
    + genEntries.reduce((s, e) => s + Number(e.vatAmount || 0), 0);

  return { division: "contracting", outputSales, outputVat, inputPurchases, inputVat, net: outputVat - inputVat };
}

// -------- قسم التنظيف (zuhaclean) — منقول من src/client/pages/Tax.tsx --------
export function computeCleaningVat({ invoices = [], expenses = [] }, year, quarter) {
  const salesInvoices = invoices.filter(i => inQuarter(i.issue_date, year, quarter));
  const expenseInvoices = expenses.filter(e => e.is_tax_invoice && inQuarter(e.date, year, quarter));

  const outputSales = salesInvoices.reduce((s, i) => s + Number(i.subtotal ?? ((i.total || 0) - (i.vat_amount || 0))), 0);
  const outputVat = salesInvoices.reduce((s, i) => s + Number(i.vat_amount || 0), 0);
  const inputPurchases = expenseInvoices.reduce((s, e) => s + Number((e.amount || 0) - (e.tax_amount || 0)), 0);
  const inputVat = expenseInvoices.reduce((s, e) => s + Number(e.tax_amount || 0), 0);

  return { division: "cleaning", outputSales, outputVat, inputPurchases, inputVat, net: outputVat - inputVat };
}

export function combineVat(parts) {
  const sum = (key) => parts.reduce((s, p) => s + Number(p[key] || 0), 0);
  const outputVat = sum("outputVat");
  const inputVat = sum("inputVat");
  return { outputSales: sum("outputSales"), outputVat, inputPurchases: sum("inputPurchases"), inputVat, net: outputVat - inputVat };
}
