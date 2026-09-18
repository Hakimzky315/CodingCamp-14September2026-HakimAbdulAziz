/* ============================================================
   Expense & Budget Visualizer — script.js
   ============================================================
   localStorage keys:
     ebv_transactions  — array
     ebv_budget        — number
     ebv_theme         — "light" | "dark"

   Legacy key migration:
     bukukas_transactions / expense_visualizer_transactions → ebv_transactions
     bukukas_budget / ebv_limit                            → ebv_budget
     bukukas_theme / ebv_theme                             → ebv_theme
   ============================================================ */

'use strict';

/* ── Storage Keys ─────────────────────────────────────────── */
const KEY_TX    = 'ebv_transactions';
const KEY_BUD   = 'ebv_budget';
const KEY_THEME = 'ebv_theme';

/* ── Legacy Migration ─────────────────────────────────────── */
(function migrate() {
  const mv = (from, to) => {
    if (!localStorage.getItem(to) && localStorage.getItem(from))
      localStorage.setItem(to, localStorage.getItem(from));
  };
  mv('expense_visualizer_transactions', KEY_TX);
  mv('bukukas_transactions',            KEY_TX);
  mv('bukukas_budget',                  KEY_BUD);
  mv('ebv_limit',                       KEY_BUD);
  mv('bukukas_theme',                   KEY_THEME);
})();

/* ── Category Config ──────────────────────────────────────── */
const CATS = {
  // Pengeluaran
  Makanan:      { icon: '🍔', color: '#f59e0b', type: 'expense' },
  Transportasi: { icon: '🚗', color: '#3b82f6', type: 'expense' },
  Hiburan:      { icon: '🎬', color: '#8b5cf6', type: 'expense' },
  Tagihan:      { icon: '💡', color: '#ef4444', type: 'expense' },
  Kesehatan:    { icon: '💊', color: '#10b981', type: 'expense' },
  Belanja:      { icon: '🛍️', color: '#ec4899', type: 'expense' },
  Pendidikan:   { icon: '📚', color: '#0ea5e9', type: 'expense' },
  // Pemasukan
  Gaji:         { icon: '💼', color: '#16a34a', type: 'income'  },
  Bonus:        { icon: '🎁', color: '#f97316', type: 'income'  },
  Investasi:    { icon: '📈', color: '#06b6d4', type: 'income'  },
  Lainnya:      { icon: '📦', color: '#6b7280', type: 'income'  },
};

/* Palet warna unik sebagai fallback untuk kategori di luar CATS */
const COLOR_PALETTE = [
  '#f59e0b','#3b82f6','#8b5cf6','#ef4444','#10b981',
  '#ec4899','#0ea5e9','#16a34a','#f97316','#06b6d4','#6b7280',
];

function getCat(name) {
  return CATS[name] || {
    icon:  '🏷️',
    color: COLOR_PALETTE[name.length % COLOR_PALETTE.length],
    type:  'expense',
  };
}

const EXPENSE_CATS = Object.entries(CATS)
  .filter(([, v]) => v.type === 'expense')
  .map(([k, v]) => ({ value: k, ...v }));

const INCOME_CATS = Object.entries(CATS)
  .filter(([, v]) => v.type === 'income')
  .map(([k, v]) => ({ value: k, ...v }));

/* ── Helpers ──────────────────────────────────────────────── */
function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}

function save(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

const fmtRp = n =>
  'Rp\u00a0' + Number(n).toLocaleString('id-ID');

const fmtDate = iso =>
  new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

const genId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// B1+B2 FIX: esc() sekarang juga meng-escape single quote untuk keamanan
// di atribut value="..." dan innerHTML
function esc(s) {
  return String(s)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

/* ── State ────────────────────────────────────────────────── */
let transactions = load(KEY_TX,  []);
let budget       = load(KEY_BUD, 0);
let sortOrder    = 'newest';
let chart        = null;
let chartMode    = 'expense';

/* ── DOM Refs ─────────────────────────────────────────────── */
const $  = id  => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

const elBalance    = $('totalBalance');
const elIncome     = $('totalIncome');
const elExpense    = $('totalExpense');
const elForm       = $('txForm');
const elName       = $('txName');
const elAmount     = $('txAmount');
const elTxList     = $('txList');
const elTxEmpty    = $('txEmpty');
const elSortSel    = $('sortSelect');
const elClearAll   = $('clearAll');
const elBudgetIn   = $('budgetInput');
const elBudgetWrap = $('budgetBarWrap');
const elBudgetFill = $('budgetFill');
const elBudgetBar  = $('budgetBar');
const elBudgetStat = $('budgetStatus');
const elChartCvs   = $('expenseChart');
const elLegend     = $('chartLegend');
const elThemeBtn   = $('themeToggle');
const elFabBtn     = $('btnFab');
const elToast      = $('toast');
const elIconMoon   = $('iconMoon');
const elIconSun    = $('iconSun');
const elCatGroup   = $('catGroup');
const elTabExp     = $('tabExpense');
const elTabInc     = $('tabIncome');

const fldName   = $('fldName');
const fldAmount = $('fldAmount');
const fldCat    = $('fldCat');
const fldType   = $('fldType');
const errName   = $('errName');
const errAmount = $('errAmount');
const errCat    = $('errCat');
const errType   = $('errType');

/* ── Build Category Pills ─────────────────────────────────── */
// B1+B2 FIX: Semua nilai di-escape via esc() sebelum masuk innerHTML
function buildCatGroup(type) {
  const cats = type === 'income' ? INCOME_CATS : EXPENSE_CATS;

  elCatGroup.innerHTML = cats.map(c => `
    <label class="cat-btn">
      <input type="radio" name="txCat" value="${esc(c.value)}" />
      <span>${c.icon} ${esc(c.value)}</span>
    </label>
  `).join('');

  elCatGroup.querySelectorAll('input[name="txCat"]').forEach(r =>
    r.addEventListener('change', () => {
      fldCat.classList.remove('has-error');
      errCat.textContent = '';
    })
  );
}

/* ── Toast ────────────────────────────────────────────────── */
let toastTimer;
function showToast(msg, type = 'info') {
  clearTimeout(toastTimer);
  elToast.textContent = msg;
  elToast.className   = `toast ${type}`;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => elToast.classList.add('show'))
  );
  toastTimer = setTimeout(() => elToast.classList.remove('show'), 3000);
}

/* ── Theme ────────────────────────────────────────────────── */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const dark = theme === 'dark';
  elIconMoon.style.display = dark ? 'none'  : 'block';
  elIconSun.style.display  = dark ? 'block' : 'none';

  if (chart) {
    // B4 FIX: Update border DAN warna placeholder abu-abu saat toggle tema
    const hasData = chart.data.labels[0] !== 'Kosong';
    chart.data.datasets[0].borderColor = dark ? '#182219' : '#ffffff';
    if (!hasData) {
      chart.data.datasets[0].backgroundColor = [dark ? '#2a3d2e' : '#e5e7eb'];
    }
    chart.update('none');
  }
}

function toggleTheme() {
  const cur  = document.documentElement.getAttribute('data-theme') || 'light';
  const next = cur === 'dark' ? 'light' : 'dark';
  save(KEY_THEME, next);
  applyTheme(next);
}

/* ── Validation ───────────────────────────────────────────── */
function clearErrors() {
  [fldName, fldAmount, fldCat, fldType].forEach(f => f.classList.remove('has-error'));
  [errName, errAmount, errCat, errType].forEach(e => (e.textContent = ''));
}

function fieldErr(fld, err, msg) {
  fld.classList.add('has-error');
  err.textContent = msg;
}

function validate(name, amount, cat, type) {
  clearErrors();
  let ok = true;
  if (!name)                  { fieldErr(fldName,   errName,   'Nama item wajib diisi.');            ok = false; }
  if (!amount || amount <= 0) { fieldErr(fldAmount, errAmount, 'Masukkan jumlah yang valid (> 0).'); ok = false; }
  if (!cat)                   { fieldErr(fldCat,    errCat,    'Pilih satu kategori.');              ok = false; }
  if (!type)                  { fieldErr(fldType,   errType,   'Pilih tipe transaksi.');             ok = false; }
  return ok;
}

/* ── CRUD ─────────────────────────────────────────────────── */
function addTx(name, amount, cat, type) {
  const tx = {
    id:       genId(),
    name:     name.trim(),
    amount:   Math.abs(Number(amount)),
    category: cat,
    type,
    date:     new Date().toISOString(),
  };
  transactions.push(tx);
  save(KEY_TX, transactions);
  render();
  showToast(`"${tx.name}" ditambahkan.`, 'success');
}

function delTx(id) {
  const idx = transactions.findIndex(t => t.id === id);
  if (idx === -1) return;
  const { name } = transactions[idx];
  transactions.splice(idx, 1);
  save(KEY_TX, transactions);
  render();
  showToast(`"${name}" dihapus.`, 'info');
}

function clearAll() {
  if (!transactions.length) { showToast('Tidak ada transaksi.', 'error'); return; }
  if (!confirm('Hapus SEMUA transaksi? Tindakan ini tidak dapat dibatalkan.')) return;
  transactions = [];
  save(KEY_TX, transactions);
  render();
  showToast('Semua transaksi dihapus.', 'info');
}

/* ── Sorting ──────────────────────────────────────────────── */
function getSorted() {
  const list = [...transactions];
  switch (sortOrder) {
    case 'newest':  return list.sort((a, b) => new Date(b.date) - new Date(a.date));
    case 'oldest':  return list.sort((a, b) => new Date(a.date) - new Date(b.date));
    case 'highest': return list.sort((a, b) => b.amount - a.amount);
    case 'lowest':  return list.sort((a, b) => a.amount - b.amount);
    case 'cat':     return list.sort((a, b) => a.category.localeCompare(b.category, 'id'));
    default:        return list;
  }
}

/* ── Render: Balance ──────────────────────────────────────── */
function renderBalance() {
  const inc = transactions
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);
  const exp = transactions
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);
  const net = inc - exp;

  elBalance.textContent = fmtRp(net);
  elIncome.textContent  = fmtRp(inc);
  elExpense.textContent = fmtRp(exp);
}

/* ── Render: Transaction List ─────────────────────────────── */
function renderList() {
  elTxList.querySelectorAll('.tx-item').forEach(el => el.remove());

  const list = getSorted();
  if (!list.length) { elTxEmpty.style.display = 'flex'; return; }
  elTxEmpty.style.display = 'none';

  const totalExp = transactions
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  // B3 FIX: over-limit hanya untuk item expense, bukan income
  const budgetExceeded = budget > 0 && totalExp > budget;

  list.forEach(tx => {
    const cat      = getCat(tx.category);
    const isIncome = tx.type === 'income';
    const sign     = isIncome ? '+' : '−';
    const isOver   = budgetExceeded && !isIncome;

    const li = document.createElement('li');
    li.className  = `tx-item${isOver ? ' over-limit' : ''}`;
    li.dataset.id = tx.id;

    li.innerHTML = `
      <div class="tx-icon" style="background:${cat.color}22" aria-hidden="true">${cat.icon}</div>
      <div class="tx-body">
        <div class="tx-name">${esc(tx.name)}</div>
        <div class="tx-meta">
          <span class="tx-cat-badge">${esc(tx.category)}</span>
          · ${fmtDate(tx.date)}
        </div>
      </div>
      <span class="tx-amount ${tx.type}">${sign} ${fmtRp(tx.amount)}</span>
      <button class="tx-del" type="button" aria-label="Hapus ${esc(tx.name)}">
        <svg viewBox="0 0 24 24">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
        </svg>
      </button>
    `;

    li.querySelector('.tx-del').addEventListener('click', () => delTx(tx.id));
    elTxList.appendChild(li);
  });
}

/* ── Chart.js Center-Text Plugin ──────────────────────────── */
const centerLabelPlugin = {
  id: 'centerLabel',
  afterDraw(ch) {
    const { ctx, chartArea: { left, top, width, height } } = ch;
    const cx = left + width / 2;
    const cy = top  + height / 2;

    const filtered = transactions.filter(t => t.type === chartMode);
    const mutedC   = getComputedStyle(document.documentElement)
                       .getPropertyValue('--text-3').trim() || '#6b7280';
    const mainC    = getComputedStyle(document.documentElement)
                       .getPropertyValue('--text').trim()   || '#111827';

    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    if (!filtered.length) {
      ctx.fillStyle = mutedC;
      ctx.font      = '500 12px Inter, system-ui, sans-serif';
      const typeLabel = chartMode === 'expense' ? 'pengeluaran' : 'pemasukan';
      ctx.fillText('Belum ada',  cx, cy - 8);
      ctx.fillText(typeLabel,    cx, cy + 8);
    } else {
      const total = filtered.reduce((s, t) => s + t.amount, 0);
      ctx.fillStyle = mutedC;
      ctx.font      = '500 10px Inter, system-ui, sans-serif';
      ctx.fillText('Total', cx, cy - 10);
      ctx.fillStyle = mainC;
      ctx.font      = '700 13px Space Grotesk, system-ui, sans-serif';
      ctx.fillText(fmtRp(total), cx, cy + 6);
    }

    ctx.restore();
  },
};

/* ── Render: Chart ────────────────────────────────────────── */
function renderChart() {
  const isDark  = document.documentElement.getAttribute('data-theme') === 'dark';
  const borderC = isDark ? '#182219' : '#ffffff';

  const filtered = transactions.filter(t => t.type === chartMode);
  const totals   = {};
  filtered.forEach(t => { totals[t.category] = (totals[t.category] || 0) + t.amount; });

  const hasData = filtered.length > 0;
  const labels  = hasData ? Object.keys(totals)  : ['Kosong'];
  const data    = hasData ? Object.values(totals) : [1];
  const colors  = hasData
    ? labels.map((l, i) => getCat(l).color || COLOR_PALETTE[i % COLOR_PALETTE.length])
    : [isDark ? '#2a3d2e' : '#e5e7eb'];

  elLegend.innerHTML = hasData ? labels.map((label, i) => {
    const tot = data.reduce((s, v) => s + v, 0);
    const pct = tot ? ((data[i] / tot) * 100).toFixed(0) : 0;
    return `
      <li class="legend-item">
        <span class="legend-dot" style="background:${colors[i]}"></span>
        ${esc(label)} — ${fmtRp(data[i])} <strong>(${pct}%)</strong>
      </li>
    `;
  }).join('') : '';

  // Selalu destroy sebelum recreate
  if (chart) { chart.destroy(); chart = null; }

  chart = new Chart(elChartCvs, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor:     borderC,
        borderWidth:     3,
        hoverOffset:     hasData ? 10 : 0,
      }],
    },
    options: {
      responsive: false,
      cutout:     '62%',
      animation:  { duration: 400 },
      plugins: {
        legend:  { display: false },
        tooltip: {
          enabled: hasData,
          callbacks: {
            label(ctx) {
              const tot = ctx.dataset.data.reduce((s, v) => s + v, 0);
              const pct = ((ctx.parsed / tot) * 100).toFixed(1);
              return ` ${ctx.label}: ${fmtRp(ctx.parsed)} (${pct}%)`;
            },
          },
        },
        centerLabel: {},
      },
    },
    plugins: [centerLabelPlugin],
  });
}

/* ── Render: Budget Bar ───────────────────────────────────── */
function renderBudget() {
  if (!budget || budget <= 0) { elBudgetWrap.style.display = 'none'; return; }

  const spent   = transactions
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);
  const remain  = budget - spent;
  const rawPct  = (spent / budget) * 100;
  const dispPct = Math.min(rawPct, 100).toFixed(0);
  const isOver  = spent > budget;
  const isWarn  = !isOver && rawPct >= 80;

  elBudgetWrap.style.display = 'flex';
  elBudgetFill.style.width   = `${dispPct}%`;
  elBudgetBar.setAttribute('aria-valuenow', dispPct);
  elBudgetFill.className     = 'budget-fill' + (isOver ? ' over' : isWarn ? ' warn' : '');

  if (isOver) {
    elBudgetStat.textContent = `⚠️ Budget terlampaui! Terpakai ${fmtRp(spent)} dari ${fmtRp(budget)} (${dispPct}%).`;
    elBudgetStat.className   = 'budget-status over';
  } else if (isWarn) {
    elBudgetStat.textContent = `Hampir habis! Terpakai ${dispPct}% — sisa ${fmtRp(remain)}.`;
    elBudgetStat.className   = 'budget-status warn';
  } else {
    elBudgetStat.textContent = `Terpakai ${fmtRp(spent)} dari ${fmtRp(budget)} — sisa ${fmtRp(remain)}.`;
    elBudgetStat.className   = 'budget-status';
  }
}

/* ── Master Render ────────────────────────────────────────── */
function render() {
  renderBalance();
  renderList();
  renderChart();
  renderBudget();
}

/* ── Form Submit ──────────────────────────────────────────── */
elForm.addEventListener('submit', e => {
  e.preventDefault();

  const name   = elName.value.trim();
  const amount = parseFloat(elAmount.value);
  const catEl  = elForm.querySelector('input[name="txCat"]:checked');
  const typeEl = elForm.querySelector('input[name="txType"]:checked');
  const cat    = catEl?.value  ?? '';
  const type   = typeEl?.value ?? '';

  if (!validate(name, amount, cat, type)) return;

  addTx(name, amount, cat, type);
  elForm.reset();
  clearErrors();
  const defType = elForm.querySelector('input[name="txType"][value="expense"]');
  if (defType) defType.checked = true;
  buildCatGroup('expense');
  elName.focus();
});

elName.addEventListener('input',   () => { fldName.classList.remove('has-error');   errName.textContent = ''; });
elAmount.addEventListener('input', () => { fldAmount.classList.remove('has-error'); errAmount.textContent = ''; });

$$('input[name="txType"]').forEach(r =>
  r.addEventListener('change', () => {
    fldType.classList.remove('has-error');
    errType.textContent = '';
    buildCatGroup(r.value);
  })
);

/* ── Chart Tabs ───────────────────────────────────────────── */
[elTabExp, elTabInc].forEach(btn =>
  btn.addEventListener('click', () => {
    chartMode = btn.dataset.chart;
    elTabExp.classList.toggle('active',        chartMode === 'expense');
    elTabInc.classList.toggle('active',        chartMode === 'income');
    elTabExp.setAttribute('aria-selected', String(chartMode === 'expense'));
    elTabInc.setAttribute('aria-selected', String(chartMode === 'income'));
    renderChart();
  })
);

/* ── Sort ─────────────────────────────────────────────────── */
elSortSel.addEventListener('change', () => { sortOrder = elSortSel.value; renderList(); });

/* ── Clear All ────────────────────────────────────────────── */
elClearAll.addEventListener('click', clearAll);

/* ── Budget ───────────────────────────────────────────────── */
elBudgetIn.addEventListener('input', () => {
  budget = parseFloat(elBudgetIn.value) || 0;
  save(KEY_BUD, budget);
  renderBudget();
  renderList();
});

/* ── Theme ────────────────────────────────────────────────── */
elThemeBtn.addEventListener('click', toggleTheme);

/* ── FAB ──────────────────────────────────────────────────── */
elFabBtn.addEventListener('click', () => {
  const sec = $('formSection');
  if (sec) {
    sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => elName.focus(), 350);
  }
});

/* ── Init ─────────────────────────────────────────────────── */
(function init() {
  applyTheme(load(KEY_THEME, 'light'));
  buildCatGroup('expense');
  if (budget > 0) elBudgetIn.value = budget;
  render();
})();
