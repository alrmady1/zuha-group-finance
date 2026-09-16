import { ensureSchema, getSessionUserId, getBearerToken } from '../lib/db.js';
import { fetchZuhcontractData } from '../lib/zuhcontract.js';
import { fetchZuhacleanData } from '../lib/zuhaclean.js';
import { normalizeContracting, normalizeCleaning } from '../lib/normalize.js';
import { computeIncomeStatement, computeBalanceSheet, computeEquityChanges, computeCashFlowStatement, combineStatements } from '../lib/financialStatements.js';

function computeAll(inputs, from, to, asOfDate) {
  return {
    income: computeIncomeStatement(inputs, from, to),
    balance: computeBalanceSheet(inputs, asOfDate),
    equity: computeEquityChanges(inputs, from, to),
    cashFlow: computeCashFlowStatement(inputs, from, to),
  };
}

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const userId = await getSessionUserId(getBearerToken(req));
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const now = new Date();
    const to = req.query.to || now.toISOString().slice(0, 10);
    const from = req.query.from || `${now.getFullYear()}-01-01`;
    const asOfDate = req.query.asOfDate || to;

    const [contractingRaw, cleaningRaw] = await Promise.all([
      fetchZuhcontractData().then(d => ({ data: d })).catch(e => ({ error: e.message })),
      fetchZuhacleanData().then(d => ({ data: d })).catch(e => ({ error: e.message })),
    ]);

    const contracting = contractingRaw.data ? computeAll(normalizeContracting(contractingRaw.data), from, to, asOfDate) : null;
    const cleaning = cleaningRaw.data ? computeAll(normalizeCleaning(cleaningRaw.data), from, to, asOfDate) : null;

    // القوائم "الرسمية" للكيان الواحد — لا تُحسَب إلا عند نجاح قراءة القسمين معاً،
    // تماماً كنفس القاعدة المُطبَّقة على "الإجمالي" في صفحة الضريبة الموحّدة.
    const combined = (contracting && cleaning) ? {
      income: combineStatements(contracting.income, cleaning.income),
      balance: combineStatements(contracting.balance, cleaning.balance),
      equity: combineStatements(contracting.equity, cleaning.equity),
      cashFlow: combineStatements(contracting.cashFlow, cleaning.cashFlow),
    } : null;

    return res.status(200).json({
      from, to, asOfDate,
      contracting, contractingError: contractingRaw.error || null,
      cleaning, cleaningError: cleaningRaw.error || null,
      combined,
    });
  } catch (e) {
    console.error('statements api error', e);
    res.status(500).json({ error: 'server error' });
  }
}
