import { ensureSchema, getSessionUserId, getBearerToken } from '../lib/db.js';
import { fetchZuhcontractData } from '../lib/zuhcontract.js';
import { fetchZuhacleanData } from '../lib/zuhaclean.js';
import { computeContractingVat, computeCleaningVat, combineVat } from '../lib/vat.js';

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const userId = await getSessionUserId(getBearerToken(req));
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const now = new Date();
    const year = Number(req.query.year) || now.getFullYear();
    const quarter = Number(req.query.quarter) || Math.ceil((now.getMonth() + 1) / 3);

    const [contractingRaw, cleaningRaw] = await Promise.all([
      fetchZuhcontractData().then(d => ({ data: d })).catch(e => ({ error: e.message })),
      fetchZuhacleanData().then(d => ({ data: d })).catch(e => ({ error: e.message })),
    ]);

    const contracting = contractingRaw.data ? computeContractingVat(contractingRaw.data, year, quarter) : null;
    const cleaning = cleaningRaw.data ? computeCleaningVat(cleaningRaw.data, year, quarter) : null;
    const parts = [contracting, cleaning].filter(Boolean);
    const combined = parts.length ? combineVat(parts) : null;

    return res.status(200).json({
      year, quarter,
      contracting, contractingError: contractingRaw.error || null,
      cleaning, cleaningError: cleaningRaw.error || null,
      combined,
    });
  } catch (e) {
    console.error('vat api error', e);
    res.status(500).json({ error: 'server error' });
  }
}
