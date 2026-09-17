/* =========================================================
   قوائم الشركة الرئيسية — تقارير مالية موحّدة لقسمي المقاولات والتنظيف
   ========================================================= */

const STORAGE_PREFIX = "zgf_";

function getAuthToken() { return localStorage.getItem(STORAGE_PREFIX + "authToken"); }
function setAuthToken(token) {
  if (token) localStorage.setItem(STORAGE_PREFIX + "authToken", token);
  else localStorage.removeItem(STORAGE_PREFIX + "authToken");
}
function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem(STORAGE_PREFIX + "user") || "null"); } catch (e) { return null; }
}
function setCurrentUser(u) {
  if (u) localStorage.setItem(STORAGE_PREFIX + "user", JSON.stringify(u));
  else localStorage.removeItem(STORAGE_PREFIX + "user");
}
function authHeader() {
  const t = getAuthToken();
  return t ? { Authorization: "Bearer " + t } : {};
}

function fmtMoney(n) {
  return (Number(n) || 0).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ر.س";
}

let TOAST_TIMER = null;
function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(TOAST_TIMER);
  TOAST_TIMER = setTimeout(() => el.classList.remove("show"), 2600);
}

function openModalShellNote() { /* لا نوافذ منبثقة في هذه المرحلة — محجوزة للتوسّع لاحقاً */ }

/* ---------- الإعداد الأول / تسجيل الدخول ---------- */
async function boot() {
  const root = document.getElementById("root");
  root.innerHTML = `<div class="login-wrap"><div class="login-card"><p class="sub">جارٍ التحميل...</p></div></div>`;

  let needsSetup = false;
  try {
    const res = await fetch("/api/setup");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || ("http " + res.status));
    needsSetup = !!data.needsSetup;
  } catch (e) {
    root.innerHTML = `<div class="login-wrap"><div class="login-card"><h1>تعذّر الاتصال بالخادم</h1><p class="sub">تحقق من إعداد قاعدة البيانات (Postgres) في Vercel ثم أعد المحاولة.</p><p class="text-muted" style="font-size:11.5px">${e.message}</p><button class="btn primary block" id="retryBtn">إعادة المحاولة</button></div></div>`;
    document.getElementById("retryBtn").onclick = boot;
    return;
  }

  if (needsSetup) return renderSetup();
  if (getAuthToken() && getCurrentUser()) return renderDashboard();
  return renderLogin();
}

function renderSetup() {
  const root = document.getElementById("root");
  root.innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <div class="login-logo">ق</div>
        <h1>الإعداد الأول</h1>
        <p class="sub">لا يوجد أي حساب بعد على هذا الموقع — أنشئ أول حساب (لصاحب الشركتين أو المحاسب) للبدء.</p>
        <div id="setupError" class="login-error"></div>
        <div class="field"><label>الاسم الكامل</label><input id="su_name"></div>
        <div class="field"><label>اسم المستخدم</label><input id="su_username" autocomplete="off"></div>
        <div class="field"><label>كلمة السر</label><input type="password" id="su_password"></div>
        <button class="btn primary block" id="su_save">إنشاء الحساب والدخول</button>
      </div>
    </div>
  `;
  document.getElementById("su_save").onclick = async () => {
    const name = document.getElementById("su_name").value.trim();
    const username = document.getElementById("su_username").value.trim();
    const password = document.getElementById("su_password").value;
    const errBox = document.getElementById("setupError");
    errBox.textContent = "";
    if (!name || !username || !password) { errBox.textContent = "يرجى تعبئة جميع الحقول"; return; }
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, password }),
      });
      const data = await res.json();
      if (!res.ok) { errBox.textContent = data.error || "تعذّر إنشاء الحساب"; return; }
      // تسجيل دخول تلقائي بعد الإنشاء مباشرة
      const loginRes = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok) { errBox.textContent = "تم إنشاء الحساب، يرجى تسجيل الدخول يدوياً"; return renderLogin(); }
      setAuthToken(loginData.token);
      setCurrentUser(loginData.user);
      renderDashboard();
    } catch (e) {
      errBox.textContent = "تعذّر الاتصال بالخادم";
    }
  };
}

function renderLogin() {
  const root = document.getElementById("root");
  root.innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <div class="login-logo">ق</div>
        <h1>قوائم الشركة الرئيسية</h1>
        <p class="sub">تقارير مالية موحّدة لقسمي المقاولات والتنظيف</p>
        <div id="loginError" class="login-error"></div>
        <div class="field"><label>اسم المستخدم</label><input id="lg_username" autocomplete="off"></div>
        <div class="field"><label>كلمة السر</label><input type="password" id="lg_password"></div>
        <button class="btn primary block" id="lg_save">تسجيل الدخول</button>
      </div>
    </div>
  `;
  const doLogin = async () => {
    const username = document.getElementById("lg_username").value.trim();
    const password = document.getElementById("lg_password").value;
    const errBox = document.getElementById("loginError");
    errBox.textContent = "";
    if (!username || !password) { errBox.textContent = "يرجى إدخال اسم المستخدم وكلمة السر"; return; }
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) { errBox.textContent = data.error || "تعذّر تسجيل الدخول"; return; }
      setAuthToken(data.token);
      setCurrentUser(data.user);
      renderDashboard();
    } catch (e) {
      errBox.textContent = "تعذّر الاتصال بالخادم";
    }
  };
  document.getElementById("lg_save").onclick = doLogin;
  document.getElementById("lg_password").onkeydown = (e) => { if (e.key === "Enter") doLogin(); };
}

/* ---------- الصفحة الرئيسية: الضريبة الربعية الموحّدة ---------- */
let VAT_YEAR = new Date().getFullYear();
let VAT_QUARTER = Math.ceil((new Date().getMonth() + 1) / 3);
let MAIN_PAGE = "vat"; // vat | statements

function renderDashboard() {
  const user = getCurrentUser();
  const root = document.getElementById("root");
  root.innerHTML = `
    <div class="topbar">
      <div class="brand"><span class="dot"></span> قوائم الشركة الرئيسية</div>
      <div class="flex gap center">
        <span class="text-muted" style="font-size:13px">${user ? user.name : ""}</span>
        <button class="btn sm" id="logoutBtn">تسجيل الخروج</button>
      </div>
    </div>
    <div class="content">
      <div class="tabs" style="margin-bottom:18px">
        <div class="tab-btn ${MAIN_PAGE === "vat" ? "active" : ""}" data-mainpage="vat">الضريبة الربعية</div>
        <div class="tab-btn ${MAIN_PAGE === "statements" ? "active" : ""}" data-mainpage="statements">القوائم المالية</div>
      </div>
      <div id="content"></div>
    </div>
  `;
  document.getElementById("logoutBtn").onclick = () => {
    setAuthToken(null);
    setCurrentUser(null);
    renderLogin();
  };
  document.querySelectorAll("[data-mainpage]").forEach(t => t.onclick = () => { MAIN_PAGE = t.dataset.mainpage; renderDashboard(); });

  const content = document.getElementById("content");
  if (MAIN_PAGE === "statements") renderStatementsPage(content);
  else renderVatPage(content);
}

async function renderVatPage(el) {
  el.innerHTML = `
    <div class="section-title-row">
      <div><h2>الضريبة الربعية الموحّدة</h2><p>القسمان على حساب ضريبي واحد لدى ZATCA — رقم "الإجمالي" أدناه هو الرقم الفعلي للإقرار</p></div>
    </div>
    <div class="card">
      <div class="flex gap wrap" style="align-items:flex-end">
        <div class="field" style="margin-bottom:0"><label>السنة</label><input type="number" id="vatYear" value="${VAT_YEAR}" style="width:110px"></div>
        <div class="field" style="margin-bottom:0"><label>الربع</label>
          <select id="vatQuarter" style="width:180px">
            ${[1, 2, 3, 4].map(q => `<option value="${q}" ${q === VAT_QUARTER ? "selected" : ""}>الربع ${q} (${["يناير-مارس", "أبريل-يونيو", "يوليو-سبتمبر", "أكتوبر-ديسمبر"][q - 1]})</option>`).join("")}
          </select>
        </div>
        <button class="btn primary" id="vatGo">عرض</button>
      </div>
    </div>
    <div id="vatResult"><div class="card"><p class="text-muted">جارٍ التحميل...</p></div></div>
  `;
  document.getElementById("vatGo").onclick = () => {
    VAT_YEAR = Number(document.getElementById("vatYear").value) || VAT_YEAR;
    VAT_QUARTER = Number(document.getElementById("vatQuarter").value) || VAT_QUARTER;
    loadVat(el);
  };
  loadVat(el);
}

async function loadVat(el) {
  const resultBox = document.getElementById("vatResult");
  resultBox.innerHTML = `<div class="card"><p class="text-muted">جارٍ الحساب...</p></div>`;
  try {
    const res = await fetch(`/api/vat?year=${VAT_YEAR}&quarter=${VAT_QUARTER}`, { headers: authHeader() });
    if (res.status === 401) { setAuthToken(null); setCurrentUser(null); renderLogin(); return; }
    const data = await res.json();
    if (!res.ok) { resultBox.innerHTML = `<div class="card"><p class="text-muted" style="color:var(--danger)">${data.error || "تعذّر جلب البيانات"}</p></div>`; return; }
    renderVatResult(resultBox, data);
  } catch (e) {
    resultBox.innerHTML = `<div class="card"><p class="text-muted" style="color:var(--danger)">تعذّر الاتصال بالخادم</p></div>`;
  }
}

function divisionCardHtml(title, part, error) {
  if (error) {
    return `<div class="card"><h3>${title}</h3><p class="text-muted" style="color:var(--danger)">تعذّر الاتصال — ${error}</p></div>`;
  }
  if (!part) return `<div class="card"><h3>${title}</h3><p class="text-muted">لا توجد بيانات</p></div>`;
  return `
    <div class="card">
      <h3>${title}</h3>
      <div class="kv-row"><span class="k">إجمالي المبيعات الخاضعة</span><span class="v">${fmtMoney(part.outputSales)}</span></div>
      <div class="kv-row"><span class="k">ضريبة المخرجات</span><span class="v">${fmtMoney(part.outputVat)}</span></div>
      <div class="kv-row"><span class="k">إجمالي المشتريات الخاضعة</span><span class="v">${fmtMoney(part.inputPurchases)}</span></div>
      <div class="kv-row"><span class="k">ضريبة المدخلات</span><span class="v">${fmtMoney(part.inputVat)}</span></div>
      <div class="kv-row"><span class="k">صافي مساهمة القسم</span><span class="v" style="color:${part.net >= 0 ? "var(--danger)" : "var(--success)"}">${fmtMoney(part.net)}</span></div>
    </div>
  `;
}

function renderVatResult(el, data) {
  const combined = data.combined;
  el.innerHTML = `
    ${combined ? `
    <div class="stat-card" style="margin-bottom:18px">
      <div class="label">الإجمالي — الرقم المستخدم للإقرار الضريبي لدى ZATCA</div>
      <div class="value big ${combined.net >= 0 ? "danger" : "success"}">${fmtMoney(combined.net)}</div>
      <div class="text-muted" style="font-size:12px;margin-top:6px">${combined.net >= 0 ? "ضريبة مستحقة الدفع" : "ضريبة قابلة للاسترداد"} — ضريبة مخرجات ${fmtMoney(combined.outputVat)} − ضريبة مدخلات ${fmtMoney(combined.inputVat)}</div>
    </div>
    ` : `<div class="card"><p class="text-muted" style="color:var(--danger)">تعذّر حساب الإجمالي — تحقق من اتصال القسمين أدناه</p></div>`}

    <div class="grid cols-2">
      ${divisionCardHtml("قسم المقاولات (zuhcontract)", data.contracting, data.contractingError)}
      ${divisionCardHtml("قسم التنظيف (zuhaclean)", data.cleaning, data.cleaningError)}
    </div>
  `;
}

/* ---------- القوائم المالية الموحّدة ---------- */
// الهوية القانونية للكيان الواحد (قسما المقاولات والتنظيف تحت نفس السجل التجاري
// والرقم الضريبي) — نفس القيم المُعتمَدة فعلياً في qawaem بقسم التنظيف.
const COMPANY_LEGAL_NAME = "شركة زهى الاعمال";
const COMPANY_VAT_NUMBER = "314739292200003";
const COMPANY_CR_NUMBER = "";

const SOURCE_BADGE = {
  auto: "",
  estimate: `<span class="badge orange">تقدير</span>`,
  manual: `<span class="badge gray">يدوي</span>`,
};
const SOURCE_LABEL = { auto: "تلقائي", estimate: "تقديري", manual: "يدوي — يُملأ هنا" };

// نفس بنود وترتيب وتسميات النموذج الرسمي المُعتمَد لتعبئة "برنامج قوائم"
// التابع للمركز السعودي للتنافسية والأعمال (qawaem.bc.gov.sa) — مطابقة حرفياً
// لصفحة القوائم المالية في قسم التنظيف (src/client/pages/FinancialStatements.tsx).
const INCOME_ROWS = [
  { key: "revenue", label: "مبيعات / الإيرادات", bold: true, highlight: true },
  { key: "costOfSales", label: "تكلفة المبيعات" },
  { key: "grossProfit", label: "مجمل الربح", bold: true },
  { key: "generalAdminExpenses", label: "مصاريف إدارية وعمومية" },
  { key: "sellingDistributionExpenses", label: "مصاريف بيع وتوزيع" },
  { key: "otherExpenses", label: "مصاريف أخرى" },
  { key: "otherIncome", label: "دخل آخر" },
  { key: "netProfitBeforeTax", label: "صافي ربح الفترة قبل ضريبة الدخل", bold: true },
  { key: "financeCost", label: "تكلفة مصروف التمويل" },
  { key: "zakat", label: "الزكاة" },
  { key: "incomeTax", label: "ضريبة الدخل" },
  { key: "netProfitForPeriod", label: "صافي ربح الفترة", bold: true, highlight: true },
  { key: "otherComprehensiveIncome", label: "الدخل الشامل الآخر" },
  { key: "totalComprehensiveIncome", label: "إجمالي الربح الشامل للفترة", bold: true },
];
const BALANCE_ROWS = [
  { key: "propertyPlantEquipment", label: "ممتلكات وآلات ومعدات" },
  { key: "intangibleAssets", label: "موجودات غير ملموسة باستثناء الشهرة" },
  { key: "investmentProperty", label: "العقارات الاستثمارية" },
  { key: "equityMethodInvestments", label: "الاستثمارات المحتسبة بطريقة حقوق الملكية" },
  { key: "otherNonCurrentAssets", label: "موجودات غير متداولة أخرى" },
  { key: "totalNonCurrentAssets", label: "إجمالي الموجودات غير المتداولة", bold: true },
  { key: "prepaidAndOtherDebitBalances", label: "مصاريف مدفوعة مقدماً وأرصدة مدينة أخرى (عهد وسلف الموظفين)" },
  { key: "tradeReceivables", label: "ذمم مدينة تجارية" },
  { key: "cashAndEquivalents", label: "نقد وما في حكمه" },
  { key: "inventory", label: "مخزون" },
  { key: "fvInvestments", label: "استثمارات القيمة العادلة من خلال الأرباح والخسائر" },
  { key: "otherCurrentAssets", label: "أصول متداولة أخرى" },
  { key: "dueFromRelatedParties", label: "مطلوب من أطراف ذات علاقة" },
  { key: "totalCurrentAssets", label: "إجمالي الموجودات المتداولة", bold: true },
  { key: "totalAssets", label: "إجمالي الموجودات", bold: true, highlight: true },
  { key: "capital", label: "رأس المال" },
  { key: "statutoryReserve", label: "احتياطي نظامي" },
  { key: "retainedEarnings", label: "أرباح مبقاة (خسائر متراكمة)" },
  { key: "otherEquityItems", label: "عناصر أخرى لحقوق الملكية" },
  { key: "parentEquity", label: "حقوق الملكية المتعلقة بملاك الشركة" },
  { key: "nonControllingInterest", label: "حقوق الملكية غير المسيطرة" },
  { key: "totalEquity", label: "إجمالي حقوق الملكية", bold: true },
  { key: "employeeBenefitsObligation", label: "التزام منافع الموظفين" },
  { key: "longTermDebt", label: "سندات دين وقروض لأجل، غير متداولة" },
  { key: "deferredTaxLiabilities", label: "مطلوبات ضريبية مؤجلة" },
  { key: "otherNonCurrentLiabilities", label: "مطلوبات غير متداولة أخرى" },
  { key: "totalNonCurrentLiabilities", label: "إجمالي المطلوبات غير المتداولة", bold: true },
  { key: "currentDebt", label: "سندات دين وقروض لأجل، متداولة" },
  { key: "zakatPayable", label: "الزكاة مستحقة الدفع" },
  { key: "taxesPayable", label: "الضرائب مستحقة الدفع" },
  { key: "dueToRelatedParties", label: "مطلوب إلى أطراف ذات علاقة" },
  { key: "tradeAndOtherPayables", label: "المبالغ المستحقة للموردين والبائعين" },
  { key: "accruedExpenses", label: "مصاريف مستحقة وأرصدة دائنة أخرى" },
  { key: "otherCurrentLiabilities", label: "مطلوبات متداولة أخرى" },
  { key: "totalCurrentLiabilities", label: "إجمالي المطلوبات المتداولة", bold: true },
  { key: "totalLiabilities", label: "إجمالي المطلوبات", bold: true },
  { key: "totalEquityAndLiabilities", label: "إجمالي حقوق الملكية والمطلوبات", bold: true, highlight: true },
];
const EQUITY_ROWS = [
  { key: "openingCapital", label: "رأس المال — رصيد أول الفترة" },
  { key: "openingReserve", label: "الاحتياطي — رصيد أول الفترة" },
  { key: "openingRetainedEarnings", label: "الأرباح المبقاة — رصيد أول الفترة" },
  { key: "openingTotal", label: "الإجمالي — أول الفترة", bold: true },
  { key: "capitalAdded", label: "زيادة رأس المال خلال الفترة" },
  { key: "netIncomeForPeriod", label: "صافي ربح الفترة" },
  { key: "closingCapital", label: "رأس المال — رصيد آخر الفترة" },
  { key: "closingReserve", label: "الاحتياطي — رصيد آخر الفترة" },
  { key: "closingRetainedEarnings", label: "الأرباح المبقاة — رصيد آخر الفترة" },
  { key: "closingTotal", label: "الإجمالي — آخر الفترة", bold: true, highlight: true },
];
const CASHFLOW_ROWS = [
  { key: "netProfitBeforeTax", label: "صافي ربح الفترة قبل ضريبة الدخل" },
  { key: "depreciationAddback", label: "استهلاك ممتلكات وآلات ومعدات (بند غير نقدي)" },
  { key: "eosProvisionMovement", label: "التغيّر في مخصص التزامات منافع الموظفين" },
  { key: "changeInReceivablesAndPrepaid", label: "التغيّر في الذمم المدينة والمصاريف المدفوعة مقدماً" },
  { key: "changeInPayables", label: "التغيّر في المطلوبات المتداولة" },
  { key: "netCashFromOperating", label: "صافي النقد الناتج من الأنشطة التشغيلية", bold: true },
  { key: "ppeAdditions", label: "إضافة ممتلكات وآلات ومعدات" },
  { key: "netCashUsedInInvesting", label: "صافي النقد المستخدم في الأنشطة الاستثمارية", bold: true },
  { key: "capitalAdditions", label: "إضافة رأس المال" },
  { key: "netCashFromFinancing", label: "صافي النقد الناتج من الأنشطة التمويلية", bold: true },
  { key: "netChangeInCash", label: "صافي التغيّر في النقد وما في حكمه", bold: true },
  { key: "cashAtStart", label: "النقد وما في حكمه في بداية الفترة" },
  { key: "cashAtEnd", label: "النقد وما في حكمه في نهاية الفترة", bold: true, highlight: true },
];
const STMT_ROWS = { income: INCOME_ROWS, balance: BALANCE_ROWS, equity: EQUITY_ROWS, cashFlow: CASHFLOW_ROWS };
const STMT_TABS = [
  { key: "income", title: "قائمة الدخل الشامل" },
  { key: "balance", title: "المركز المالي" },
  { key: "equity", title: "التغيرات في حقوق الملكية" },
  { key: "cashFlow", title: "التدفقات النقدية" },
];

function statementTableHtml(kind, statement) {
  if (!statement) return `<p class="text-muted">لا توجد بيانات</p>`;
  const rows = STMT_ROWS[kind].map(spec => {
    const l = statement[spec.key];
    if (!l) return "";
    const noteHtml = l.note ? `<div class="text-muted" style="font-size:11px;margin-top:2px">${l.note}</div>` : "";
    return `
      <tr class="${spec.bold ? "stmt-total" : "stmt-sub"}">
        <td class="stmt-label">${spec.label} ${SOURCE_BADGE[l.source] || ""}${noteHtml}</td>
        <td class="stmt-value" style="color:${l.value < 0 ? "var(--danger)" : "inherit"}">${fmtMoney(l.value)}</td>
      </tr>`;
  }).join("");
  return `<table class="stmt-table"><tbody>${rows}</tbody></table>`;
}

function divisionStatementCardHtml(title, kind, statementSet, error) {
  if (error) return `<div class="card"><h3>${title}</h3><p class="text-muted" style="color:var(--danger)">تعذّر الاتصال — ${error}</p></div>`;
  if (!statementSet) return `<div class="card"><h3>${title}</h3><p class="text-muted">لا توجد بيانات</p></div>`;
  return `<div class="card"><h3>${title}</h3>${statementTableHtml(kind, statementSet[kind])}</div>`;
}

/* ---------- نافذة منبثقة عامة للطباعة/PDF ---------- */
function openPrintModal(title, bodyHtml) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-box-head no-print">
        <h3 style="margin:0;font-size:14px">${title}</h3>
        <div class="flex gap">
          <button class="btn primary sm" id="pm_print">طباعة / تصدير PDF</button>
          <button class="btn sm" id="pm_close">إغلاق</button>
        </div>
      </div>
      <div class="modal-box-body print-area">${bodyHtml}</div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector("#pm_close").onclick = () => overlay.remove();
  overlay.querySelector("#pm_print").onclick = () => window.print();
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
}

function companyHeaderHtml(subtitle, from, to) {
  return `
    <div style="text-align:center;border-bottom:1px dashed #ccc;padding-bottom:14px;margin-bottom:16px">
      <div style="font-size:17px;font-weight:800">${COMPANY_LEGAL_NAME}</div>
      <div style="font-size:12px;color:#666">الرقم الضريبي: ${COMPANY_VAT_NUMBER}${COMPANY_CR_NUMBER ? " — س.ت: " + COMPANY_CR_NUMBER : ""}</div>
      <div style="font-size:13px;font-weight:700;color:var(--primary);margin-top:4px">${subtitle}</div>
      ${from && to ? `<div style="font-size:12px;color:#888" dir="ltr">${from} — ${to}</div>` : ""}
    </div>
  `;
}

function printStatementsDocument(data) {
  if (!data.combined) { toast("تعذّر إنشاء المستند — لم يُحسَب الإجمالي (تحقق من اتصال القسمين)"); return; }
  const { income, balance, cashFlow } = data.combined;
  const body = `
    ${companyHeaderHtml("القوائم المالية الموحّدة (الكيان بالكامل)", data.from, data.to)}
    <div class="card"><h3 class="mt-0">قائمة الدخل الشامل</h3>${statementTableHtml("income", income)}</div>
    <div class="card"><h3 class="mt-0">قائمة المركز المالي</h3>${statementTableHtml("balance", balance)}</div>
    <div class="card"><h3 class="mt-0">قائمة التدفقات النقدية</h3>${statementTableHtml("cashFlow", cashFlow)}</div>
    <p class="text-muted" style="font-size:11px">البنود الموسومة "تقدير" مبنية على افتراضات مبسَّطة، والبنود الموسومة "يدوي" غير مُتتبَّعة في أي من النظامين (قيمتها صفر) — يُنصح بمراجعتها قبل الإيداع الرسمي.</p>
  `;
  openPrintModal("القوائم المالية", body);
}

function printAuditorExemptionDeclaration(fiscalYearEnd) {
  const body = `
    <h1 style="text-align:center;font-size:15px">إقرار سنوي بعدم سريان متطلب تعيين مراجع حسابات للشركة لكونها متناهية الصغر أو صغيرة</h1>
    <div style="font-size:13.5px;line-height:2">
      <p>بهذا أنا (رئيس مجلس الادارة / مدير / رئيس مجلس مديرين / رئيس الشركة) <span style="display:inline-block;min-width:160px;border-bottom:1px dotted #999">&nbsp;</span></p>
      <p>شركة <strong>${COMPANY_LEGAL_NAME}</strong></p>
      <p>سجل تجاري <span style="display:inline-block;min-width:140px;border-bottom:1px dotted #999">${COMPANY_CR_NUMBER || ""}&nbsp;</span> أقر بالتالي:</p>
      <ul style="padding-inline-start:20px">
        <li>أن الشركة بنهاية العام المالي المنتهي في <strong dir="ltr">${fiscalYearEnd}</strong> هي شركة متناهية الصغر أو صغيرة وفقاً لنص المادة (التاسعة عشرة) من نظام الشركات، والمادة (السابعة) من اللائحة التنفيذية لنظام الشركات بعد تحقق معيارين على الأقل مما يلي (يتعيَّن تحديد معيارين على الأقل):
          <ol>
            <li>عدم تجاوز مجموع إيراداتها السنوية مبلغ عشرة ملايين ريال سعودي.</li>
            <li>عدم تجاوز مجموع أصولها مبلغ عشرة ملايين ريال سعودي.</li>
            <li>عدم تجاوز مجموع موظفيها عدد تسعة وأربعين موظفاً.</li>
          </ol>
        </li>
        <li>عدم انطباق الاستثناءات الواردة في الفقرة -1- من المادة (التاسعة عشرة) من نظام الشركات على الشركة.</li>
        <li>عدم تقدم أي شريك أو مساهم أو أكثر ممن يمثلون النسبة المقررة الواردة في نص الفقرة -3- من المادة (التاسعة عشرة) من نظام الشركات، بطلب تعيين مراجع حسابات وفقاً للضوابط المنصوص عليها في المادة (الثامنة) من اللائحة التنفيذية لنظام الشركات.</li>
      </ul>
      <p>وبناءً على ما سبق، لا يسري على الشركة متطلب تعيين مراجع حسابات للسنة المالية المذكورة أعلاه، وأتعهد بصحة البيانات والإقرارات الواردة أعلاه، وأتحمل كافة المسؤولية والتبعات النظامية حال ثبوت خلاف ذلك.</p>
      <div style="margin-top:40px;text-align:center">
        <p style="font-weight:700">(رئيس مجلس الادارة / مدير / رئيس مجلس مديرين / رئيس الشركة)</p>
        <p style="margin-top:24px">الإسم: <span style="display:inline-block;min-width:220px;border-bottom:1px dotted #999">&nbsp;</span></p>
        <p>التوقيع: <span style="display:inline-block;min-width:220px;border-bottom:1px dotted #999">&nbsp;</span></p>
      </div>
    </div>
  `;
  openPrintModal("إقرار الإعفاء من مراجع الحسابات", body);
}

// تصدير إكسل — بنفس بنود وترتيب النموذج الرسمي بالضبط، جاهز للنسخ مباشرة إلى
// برنامج قوائم؛ البنود اليدوية (صفر) تُعدَّل هنا مباشرة قبل الاعتماد النهائي.
function exportStatementsExcel(data) {
  if (!window.XLSX) { toast("تعذّر تحميل مكتبة الإكسل — تحقق من الاتصال بالإنترنت"); return; }
  if (!data.combined) { toast("تعذّر التصدير — لم يُحسَب الإجمالي (تحقق من اتصال القسمين)"); return; }
  const { income, balance, cashFlow } = data.combined;
  const wb = XLSX.utils.book_new();

  function sheetFromRows(rows, statement) {
    const aoa = [["البند", "المصدر", "القيمة (ر.س)", "ملاحظة"]];
    rows.forEach(r => {
      const l = statement[r.key];
      if (!l) return;
      aoa.push([r.label, SOURCE_LABEL[l.source], l.value, l.note || ""]);
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 45 }, { wch: 16 }, { wch: 16 }, { wch: 60 }];
    return ws;
  }

  const summary = XLSX.utils.aoa_to_sheet([
    ["القوائم المالية — " + COMPANY_LEGAL_NAME],
    [`الفترة: ${data.from} إلى ${data.to}`],
    [""],
    ["الإيرادات", income.revenue.value],
    ["مجموع الموجودات", balance.totalAssets.value],
    [""],
    ["تنبيه: البنود الموسومة \"يدوي\" في كل ورقة قيمتها صفر افتراضياً — عدِّلها هنا مباشرة قبل نسخ الأرقام إلى برنامج قوائم."],
  ]);
  summary["!cols"] = [{ wch: 70 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, summary, "ملخص");
  XLSX.utils.book_append_sheet(wb, sheetFromRows(INCOME_ROWS, income), "قائمة الدخل الشامل");
  XLSX.utils.book_append_sheet(wb, sheetFromRows(BALANCE_ROWS, balance), "قائمة المركز المالي");
  XLSX.utils.book_append_sheet(wb, sheetFromRows(CASHFLOW_ROWS, cashFlow), "قائمة التدفقات النقدية");
  XLSX.writeFile(wb, `القوائم-المالية-${data.from}-${data.to}.xlsx`);
}

let STMT_TAB = "income";
let STMT_FROM = `${new Date().getFullYear()}-01-01`;
let STMT_TO = new Date().toISOString().slice(0, 10);
let STMT_ASOF = STMT_TO;
let STMT_DATA = null;

async function renderStatementsPage(el) {
  el.innerHTML = `
    <div class="section-title-row">
      <div><h2>القوائم المالية الموحّدة</h2><p>القوائم الرسمية للكيان بالكامل — تُحسَب فقط عند نجاح قراءة القسمين معاً</p></div>
      <div class="flex gap wrap">
        <button class="btn" id="stmtPrint">🖶 طباعة / PDF القوائم المالية</button>
        <button class="btn" id="stmtDeclaration">🖶 طباعة إقرار الإعفاء من مراجع الحسابات</button>
        <button class="btn primary" id="stmtExcel">⬇ تصدير إكسل (لبرنامج قوائم)</button>
      </div>
    </div>
    <div class="card">
      <div class="flex gap wrap" style="align-items:flex-end">
        <div class="field" style="margin-bottom:0"><label>من تاريخ</label><input type="date" id="stmtFrom" value="${STMT_FROM}"></div>
        <div class="field" style="margin-bottom:0"><label>إلى تاريخ</label><input type="date" id="stmtTo" value="${STMT_TO}"></div>
        <div class="field" style="margin-bottom:0"><label>المركز المالي كما في</label><input type="date" id="stmtAsOf" value="${STMT_ASOF}"></div>
        <button class="btn primary" id="stmtGo">عرض</button>
      </div>
    </div>
    <div class="subtabs">
      ${STMT_TABS.map(t => `<div class="pill ${STMT_TAB === t.key ? "active" : ""}" data-stmttab="${t.key}">${t.title}</div>`).join("")}
    </div>
    <div id="stmtResult"><div class="card"><p class="text-muted">جارٍ التحميل...</p></div></div>
  `;
  document.getElementById("stmtGo").onclick = () => {
    STMT_FROM = document.getElementById("stmtFrom").value || STMT_FROM;
    STMT_TO = document.getElementById("stmtTo").value || STMT_TO;
    STMT_ASOF = document.getElementById("stmtAsOf").value || STMT_TO;
    loadStatements(el);
  };
  document.getElementById("stmtPrint").onclick = () => { if (STMT_DATA) printStatementsDocument(STMT_DATA); else toast("انتظر انتهاء التحميل أولاً"); };
  document.getElementById("stmtDeclaration").onclick = () => printAuditorExemptionDeclaration(STMT_TO);
  document.getElementById("stmtExcel").onclick = () => { if (STMT_DATA) exportStatementsExcel(STMT_DATA); else toast("انتظر انتهاء التحميل أولاً"); };
  el.querySelectorAll("[data-stmttab]").forEach(p => p.onclick = () => {
    STMT_TAB = p.dataset.stmttab;
    el.querySelectorAll("[data-stmttab]").forEach(x => x.classList.toggle("active", x === p));
    if (STMT_DATA) renderStatementsResult(document.getElementById("stmtResult"), STMT_DATA);
  });
  loadStatements(el);
}

async function loadStatements(el) {
  const resultBox = document.getElementById("stmtResult");
  resultBox.innerHTML = `<div class="card"><p class="text-muted">جارٍ الحساب...</p></div>`;
  try {
    const res = await fetch(`/api/statements?from=${STMT_FROM}&to=${STMT_TO}&asOfDate=${STMT_ASOF}`, { headers: authHeader() });
    if (res.status === 401) { setAuthToken(null); setCurrentUser(null); renderLogin(); return; }
    const data = await res.json();
    if (!res.ok) { resultBox.innerHTML = `<div class="card"><p class="text-muted" style="color:var(--danger)">${data.error || "تعذّر جلب البيانات"}</p></div>`; return; }
    STMT_DATA = data;
    renderStatementsResult(resultBox, data);
  } catch (e) {
    resultBox.innerHTML = `<div class="card"><p class="text-muted" style="color:var(--danger)">تعذّر الاتصال بالخادم</p></div>`;
  }
}

function renderStatementsResult(el, data) {
  const kind = STMT_TAB;
  const combined = data.combined;
  el.innerHTML = `
    <div class="card">
      <h3 class="mt-0">${STMT_TABS.find(t => t.key === kind).title} — الكيان بالكامل</h3>
      ${combined ? statementTableHtml(kind, combined[kind]) : `<p class="text-muted" style="color:var(--danger)">تعذّر الحساب — تحقق من اتصال القسمين أدناه</p>`}
    </div>
    <div class="grid cols-2">
      ${divisionStatementCardHtml("قسم المقاولات (zuhcontract)", kind, data.contracting, data.contractingError)}
      ${divisionStatementCardHtml("قسم التنظيف (zuhaclean)", kind, data.cleaning, data.cleaningError)}
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", boot);
