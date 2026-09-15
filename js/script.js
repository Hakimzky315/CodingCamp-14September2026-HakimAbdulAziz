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
  mv('ebv_transactions',                KEY_TX); // same key, no-op
  mv('bukukas_budget',                  KEY_BUD);
  mv('ebv_limit',                       KEY_BUD);
  mv('bukukas_theme',                   KEY_THEME);
})();

/* ── Category Config ──────────────────────────────────────── */
const CATS = {
  Makanan:      { icon: '🍔', color: '#f59e0b' },
  Transportasi: { icon: '🚗', color: '#3b82f6' },
  Hiburan:      { icon: '🎬', color: '#8b5cf6' },
  Tagihan:      { icon: '💡', color: '#ef4444' },
  Kesehatan:    { icon: '💊', color: '#10b981' },
  Lainnya:      { icon: '📦', color: '#6b7280' },
};

function getCat(name) {
  return CATS[name] || { icon: '🏷️', color: '#6b7280' };
}

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

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── State ────────────────────────────────────────────────── */
let transactions = load(KEY_TX,    []);
let budget       = load(KEY_BUD,   0);
let sortOrder    = 'newest';
let chart        = null;

/* ── DOM ──────────────────────────────────────────────────── */
const $  = id => document.getElementById(id);
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

// Validation fields
const fldName   = $('fldName');
const fldAmount = $('fldAmount');
const fldCat    = $('fldCat');
const fldType   = $('fldType');
const errName   = $('errName');
const errAmount = $('errAmount');
const errCat    = $('errCat');
const errType   = $('errType');

/* ── Toast ────────────────────────────────────────────────── */
let toastTimer;
function showToast(msg, type = 'info') {
  clearTimeout(toastTimer);
  elToast.textContent = msg;
  elToast.className = `toast ${type}`;
  requestAnimationFrame(() => requestAnimationFrame(() =>
    elToast.classList.add('show')
  ));
  toastTimer = setTimeout(() => elToast.classList.remove('show'), 3000);
}

/* ── Theme ────────────────────────────────────────────────── */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const dark = theme === 'dark';
  elIconMoon.style.display = dark ? 'none'  : 'block';
  elIconSun.style.display  = dark ? 'block' : 'none';
  // Update chart colors if it exists
  if (chart) {
    chart.data.datasets[0].borderColor =
      dark ? '#182219' : '#ffffff';
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
  if (!name)              { fieldErr(fldName,   errName,   'Nama item wajib diisi.');       ok = false; }
  if (!amount || amount <= 0) { fieldErr(fldAmount, errAmount, 'Masukkan jumlah yang valid.'); ok = false; }
  if (!cat)               { fieldErr(fldCat,    errCat,    'Pilih satu kategori.');          ok = false; }
  if (!type)              { fieldErr(fldType,   errType,   'Pilih tipe transaksi.');          ok = false; }
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
  const name = transactions[idx].name;
  transactions.splice(idx, 1);
  save(KEY_TX, transactions);
  render();
  showToast(`"${name}" dihapus.`, 'info');
}

function clearAll() {
  if (!transactions.length) { showToast('Tidak ada transaksi.', 'error'); return; }
  if (!confirm('Hapus SEMUA transaksi?')) return;
  transactions = [];
  save(KEY_TX, transactions);
  render();
  showToast('Semua transaksi dihapus.', 'info');
}

/* ── Sorting ──────────────────────────────────────────────── */
function getSorted() {
  const list = [...transactions];
  switch (sortOrder) {
    case 'newest':   return list.sort((a, b) => new Date(b.date) - new Date(a.date));
    case 'oldest':   return list.sort((a, b) => new Date(a.date) - new Date(b.date));
    case 'highest':  return list.sort((a, b) => b.amount - a.amount);
    case 'lowest':   return list.sort((a, b) => a.amount - b.amount);
    case 'cat':      return list.sort((a, b) => a.category.localeCompare(b.category));
    default:         return list;
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
  // remove old items
  elTxList.querySelectorAll('.tx-item').forEach(el => el.remove());

  const list = getSorted();

  if (!list.length) {
    elTxEmpty.style.display = 'flex';
    return;
  }
  elTxEmpty.style.display = 'none';

  // Budget threshold for highlight
  const totalExp = transactions
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  list.forEach(tx => {
    const cat      = getCat(tx.category);
    const isIncome = tx.type === 'income';
    const sign     = isIncome ? '+' : '−';

    // Highlight if this expense transaction pushes over budget
    const isOver = budget > 0 && !isIncome && totalExp > budget;

    const li = document.createElement('li');
    li.className = `tx-item${isOver ? ' over-limit' : ''}`;
    li.dataset.id = tx.id;

    li.innerHTML = `
      <div class="tx-icon" style="background:${cat.color}22">${cat.icon}</div>
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
    const expenses = transactions.filter(t => t.type === 'expense');

    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    if (!expenses.length) {
      ctx.fillStyle = getComputedStyle(document.documentElement)
                      .getPropertyValue('--text-3').trim() || '#9ca3af';
      ctx.font = '500 12px Inter, system-ui, sans-serif';
      ctx.fillText('Belum ada', cx, cy - 8);
      ctx.fillText('pengeluaran', cx, cy + 8);
    } else {
      const total = expenses.reduce((s, t) => s + t.amount, 0);
      ctx.fillStyle = getComputedStyle(document.documentElement)
                      .getPropertyValue('--text-3').trim() || '#6b7280';
      ctx.font = '500 10px Inter, system-ui, sans-serif';
      ctx.fillText('Total', cx, cy - 10);
      ctx.fillStyle = getComputedStyle(document.documentElement)
                      .getPropertyValue('--text').trim() || '#111827';
      ctx.font = '700 13px Space Grotesk, system-ui, sans-serif';
      ctx.fillText(fmtRp(total), cx, cy + 6);
    }

    ctx.restore();
  },
};

/* ── Render: Chart ────────────────────────────────────────── */
function renderChart() {
  const expenses = transactions.filter(t => t.type === 'expense');
  const isDark   = document.documentElement.getAttribute('data-theme') === 'dark';
  const borderC  = isDark ? '#182219' : '#ffffff';

  // Aggregate by category
  const totals = {};
  expenses.forEach(t => {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  });

  const hasData = expenses.length > 0;
  const labels  = hasData ? Object.keys(totals)  : ['Kosong'];
  const data    = hasData ? Object.values(totals) : [1];
  const colors  = hasData
    ? labels.map(l => getCat(l).color)
    : [isDark ? '#2a3d2e' : '#e5e7eb'];

  // Legend — only when has data
  elLegend.innerHTML = hasData ? labels.map((label, i) => {
    const total = data.reduce((s, v) => s + v, 0);
    const pct   = total ? ((data[i] / total) * 100).toFixed(0) : 0;
    return `
      <li class="legend-item">
        <span class="legend-dot" style="background:${colors[i]}"></span>
        ${esc(label)} <strong>${pct}%</strong>
      </li>
    `;
  }).join('') : '';

  if (chart) {
    chart.data.labels                      = labels;
    chart.data.datasets[0].data           = data;
    chart.data.datasets[0].backgroundColor = colors;
    chart.data.datasets[0].borderColor     = borderC;
    chart.options.plugins.tooltip.enabled  = hasData;
    chart.update();
    return;
  }

  chart = new Chart(elChartCvs, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: borderC,
        borderWidth: 3,
        hoverOffset: hasData ? 10 : 0,
      }],
    },
    options: {
      responsive: false,
      cutout: '62%',
      animation: { duration: 400 },
      plugins: {
        legend:     { display: false },
        tooltip: {
          enabled: hasData,
          callbacks: {
            label(ctx) {
              const total = ctx.dataset.data.reduce((s, v) => s + v, 0);
              const pct   = ((ctx.parsed / total) * 100).toFixed(1);
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
  if (!budget || budget <= 0) {
    elBudgetWrap.style.display = 'none';
    return;
  }

  const spent = transactions
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  const rawPct  = (spent / budget) * 100;
  const dispPct = Math.min(rawPct, 100).toFixed(0);
  const isOver  = spent > budget;
  const isWarn  = !isOver && rawPct >= 80;
  const remain  = budget - spent;

  elBudgetWrap.style.display = 'flex';
  elBudgetFill.style.width   = `${dispPct}%`;
  elBudgetBar.setAttribute('aria-valuenow', dispPct);

  elBudgetFill.className = 'budget-fill' + (isOver ? ' over' : isWarn ? ' warn' : '');

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
  const cat    = catEl?.value;
  const type   = typeEl?.value;

  if (!validate(name, amount, cat, type)) return;

  addTx(name, amount, cat, type);
  elForm.reset();
  clearErrors();
  // Restore default expense radio
  const defType = elForm.querySelector('input[name="txType"][value="expense"]');
  if (defType) defType.checked = true;
  elName.focus();
});

// Clear inline errors on user input
elName.addEventListener('input',   () => { fldName.classList.remove('has-error');   errName.textContent = ''; });
elAmount.addEventListener('input', () => { fldAmount.classList.remove('has-error'); errAmount.textContent = ''; });
$$('input[name="txCat"]').forEach(r =>
  r.addEventListener('change', () => { fldCat.classList.remove('has-error'); errCat.textContent = ''; })
);
$$('input[name="txType"]').forEach(r =>
  r.addEventListener('change', () => { fldType.classList.remove('has-error'); errType.textContent = ''; })
);

/* ── Sort ─────────────────────────────────────────────────── */
elSortSel.addEventListener('change', () => {
  sortOrder = elSortSel.value;
  renderList();
});

/* ── Clear All ────────────────────────────────────────────── */
elClearAll.addEventListener('click', clearAll);

/* ── Budget ───────────────────────────────────────────────── */
elBudgetIn.addEventListener('input', () => {
  budget = parseFloat(elBudgetIn.value) || 0;
  save(KEY_BUD, budget);
  renderBudget();
  renderList(); // refresh highlights
});

/* ── Theme ────────────────────────────────────────────────── */
elThemeBtn.addEventListener('click', toggleTheme);

/* ── FAB (mobile "Tambah") scrolls to form ────────────────── */
elFabBtn.addEventListener('click', () => {
  const formSection = $('formSection');
  if (formSection) {
    formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => elName.focus(), 350);
  }
});

/* ── Init ─────────────────────────────────────────────────── */
(function init() {
  applyTheme(load(KEY_THEME, 'light'));
  if (budget > 0) elBudgetIn.value = budget;
  render();
})();
