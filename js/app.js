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
    <div class="content" id="content"></div>
  `;
  document.getElementById("logoutBtn").onclick = () => {
    setAuthToken(null);
    setCurrentUser(null);
    renderLogin();
  };
  renderVatPage(document.getElementById("content"));
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

document.addEventListener("DOMContentLoaded", boot);
