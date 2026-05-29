// ============================================================
// BT_CORE.JS — Budget Tracker Core Engine
// Handles: data definitions, paycheck generation, localStorage
// ============================================================

const BT = (() => {

  // ── Default Configuration (pre-filled with user data) ──────
  const DEFAULT_CONFIG = {
    version: 3,
    incomes: [
      {
        id: 'inc1',
        name: 'Biweekly Job',
        amount: 1134.00,
        frequency: 'biweekly',
        nextDate: '2026-06-12',
        active: true,
        isPrimary: true   // primary = carries living expenses, preferred for bills
      },
      {
        id: 'inc2',
        name: 'Weekly Job',
        amount: 366.00,
        frequency: 'weekly',
        nextDate: '2026-06-04',
        active: true,
        isPrimary: false  // secondary = "extra" check, no living expenses
      }
    ],
    bills: [
      { id: 'b1', name: 'Netflix',  amount: 26.00,  dueDay: 25, type: 'Subscription', ongoing: true,  startDate: '2026-06-25', endDate: null },
      { id: 'b2', name: 'Verizon',  amount: 196.00, dueDay: 5,  type: 'Phone',        ongoing: true,  startDate: '2026-06-05', endDate: null },
      { id: 'b3', name: 'Braces',   amount: 104.00, dueDay: 28, type: 'Medical',       ongoing: true,  startDate: '2026-06-28', endDate: null },
      { id: 'b4', name: 'Hotworx',  amount: 79.00,  dueDay: 1,  type: 'Gym',          ongoing: true,  startDate: '2026-06-01', endDate: null }
    ],
    creditCards: [
      { id: 'cc1', name: 'Apple',       balance: 253.00,   minPayment: 20.00, apr: 25.49, dueDay: 28 },
      { id: 'cc2', name: 'Capital One', balance: 573.34,   minPayment: 25.00, apr: 28.49, dueDay: 9  },
      { id: 'cc3', name: 'Discover',    balance: 449.18,   minPayment: 20.00, apr: 26.99, dueDay: 1  }
    ],
    livingExpenses: {
      groceries: 150,
      eatingOut: 100,
      gas: 120,
      misc: 100
    },
    savings: {
      goalAmount: 2400,
      monthlyContribution: 200,
      currentBalance: 0
    },
    settings: {
      surplusWarningThreshold: 100,
      planEndDate: '2027-12-31',
      timezone: 'America/Chicago'
    }
  };

  // ── Storage Keys ────────────────────────────────────────────
  const KEYS = {
    config:      'bt_config',
    checks:      'bt_checks',
    spending:    'bt_spending',
    impulse:     'bt_impulse',
    noSpend:     'bt_nospend',
    savingsLog:  'bt_savingslog',
    extraIncome: 'bt_extraincome',
    billMoved:   'bt_billmoved',
  };

  // ── Persistence ─────────────────────────────────────────────
  function load(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch(e) { return fallback; }
  }

  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
  }

  // ── Config ───────────────────────────────────────────────────
  function getConfig() {
    const stored = load(KEYS.config);
    if (!stored) return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    return deepMergeDefaults(DEFAULT_CONFIG, stored);
  }

  function saveConfig(cfg) { save(KEYS.config, cfg); }

  function deepMergeDefaults(defaults, stored) {
    const out = JSON.parse(JSON.stringify(stored));
    if (!out.incomes)        out.incomes        = defaults.incomes;
    if (!out.bills)          out.bills          = defaults.bills;
    if (!out.creditCards)    out.creditCards    = defaults.creditCards;
    if (!out.livingExpenses) out.livingExpenses = defaults.livingExpenses;
    if (!out.savings)        out.savings        = defaults.savings;
    if (!out.settings)       out.settings       = defaults.settings;
    // Backfill isPrimary if missing (biweekly = primary by default)
    for (const inc of out.incomes) {
      if (inc.isPrimary === undefined) {
        inc.isPrimary = (inc.frequency === 'biweekly' || inc.frequency === 'monthly');
      }
    }
    return out;
  }

  // ── Date Utilities ───────────────────────────────────────────
  function parseDate(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function fmtDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function fmtDateShort(str) {
    const d = parseDate(str);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  }

  function fmtMoney(n) {
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function addMonths(date, n) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + n);
    return d;
  }

  function monthsBetween(d1, d2) {
    return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
  }

  // ── Generate All Paycheck Dates ──────────────────────────────
  function generatePaycheckDates(cfg) {
    const endDate = parseDate(cfg.settings.planEndDate);
    const dates = [];

    for (const inc of cfg.incomes) {
      if (!inc.active) continue;
      let cur = parseDate(inc.nextDate);
      while (cur <= endDate) {
        dates.push({
          date: fmtDate(cur),
          incomeId: inc.id,
          amount: inc.amount,
          name: inc.name,
          isPrimary: inc.isPrimary !== false // default true if not set
        });
        if (inc.frequency === 'weekly')        cur = addDays(cur, 7);
        else if (inc.frequency === 'biweekly') cur = addDays(cur, 14);
        else if (inc.frequency === 'monthly')  cur = addMonths(cur, 1);
        else break;
      }
    }

    // Sort chronologically; on same date, primary first
    dates.sort((a, b) => {
      const dc = a.date.localeCompare(b.date);
      if (dc !== 0) return dc;
      return (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0);
    });
    return dates;
  }

  // ══════════════════════════════════════════════════════════════
  // SMART BILL ASSIGNMENT
  // ──────────────────────────────────────────────────────────────
  // Rules:
  //  1. Primary (biweekly) checks carry living expenses; secondary (weekly) do NOT.
  //  2. Every bill/CC first tries the nearest PRIMARY check on or before its due date.
  //  3. If that primary check's projected surplus (after all already-assigned bills +
  //     living) would fall below the surplus warning threshold, we look for a SECONDARY
  //     check that also falls on or before the due date and is AFTER the primary check.
  //     If assigning the bill there keeps BOTH checks above threshold (or improves the
  //     situation overall), we use the secondary check instead.
  //  4. Savings contribution goes on primary checks only (first primary on/after 1st).
  //  5. User manual overrides (billMoved) always win.
  // ══════════════════════════════════════════════════════════════
  function assignBillsToChecks(checkDates, cfg) {
    const movedMap    = load(KEYS.billMoved, {});
    const livingTotal = cfg.livingExpenses.groceries + cfg.livingExpenses.eatingOut +
                        cfg.livingExpenses.gas + cfg.livingExpenses.misc;
    const threshold   = cfg.settings.surplusWarningThreshold || 100;

    // Build check objects — living expenses ONLY on primary checks
    const checks = checkDates.map((c, idx) => ({
      id:          `${c.date}_${c.incomeId}`,
      idx,
      date:        c.date,
      incomeId:    c.incomeId,
      incomeName:  c.name,
      grossIncome: c.amount,
      isPrimary:   c.isPrimary,
      bills:       [],
      living:      c.isPrimary ? livingTotal : 0,   // <-- KEY CHANGE
      savings:     0,
      extraIncome: 0
    }));

    const checkById = {};
    checks.forEach(c => { checkById[c.id] = c; });

    // ── Helpers ──────────────────────────────────────────────

    // Last PRIMARY check whose date <= dueDateStr
    function findPrimaryCheckForDue(dueDateStr) {
      let best = null;
      for (const c of checks) {
        if (c.date > dueDateStr) break;
        if (c.isPrimary) best = c;
      }
      return best;
    }

    // Last check (any) whose date <= dueDateStr
    function findAnyCheckForDue(dueDateStr) {
      let best = null;
      for (const c of checks) {
        if (c.date > dueDateStr) break;
        best = c;
      }
      return best;
    }

    // Secondary checks that fall AFTER primaryCheck and ON OR BEFORE due date
    function secondaryChecksBetween(primaryCheck, dueDateStr) {
      return checks.filter(c =>
        !c.isPrimary &&
        c.date > primaryCheck.date &&
        c.date <= dueDateStr
      );
    }

    // Projected surplus for a check given its current state + optional extra bill amount
    function projectedSurplus(check, extraBillAmount = 0) {
      const billsTotal = check.bills.reduce((s, b) => s + b.amount, 0);
      return check.grossIncome - billsTotal - check.living - check.savings - extraBillAmount;
    }

    // ── Decide which check a bill goes to ────────────────────
    function chooseBestCheck(dueDateStr, billAmount, occId) {
      // 1. Manual override wins always
      for (const [cid, movedBills] of Object.entries(movedMap)) {
        if (movedBills.find(m => m.occId === occId)) {
          return checkById[cid] || null;
        }
      }

      const primaryCheck = findPrimaryCheckForDue(dueDateStr);

      // No primary check before due date — fall back to any check
      if (!primaryCheck) return findAnyCheckForDue(dueDateStr);

      // Surplus on primary if we add this bill
      const primarySurplusAfter = projectedSurplus(primaryCheck, billAmount);

      // Primary is fine — use it
      if (primarySurplusAfter >= threshold) return primaryCheck;

      // Primary would be tight. Look for a secondary check between primary and due date
      // that gives a better balance across both checks.
      const secondaries = secondaryChecksBetween(primaryCheck, dueDateStr);

      let bestSecondary = null;
      let bestScore = -Infinity;

      for (const sec of secondaries) {
        const secSurplusAfter     = projectedSurplus(sec, billAmount);
        const primarySurplusKept  = projectedSurplus(primaryCheck, 0); // without the bill

        // Both checks should stay >= threshold; maximize min surplus (fairest)
        const minSurplus = Math.min(secSurplusAfter, primarySurplusKept);
        const improves   = minSurplus > Math.min(primarySurplusAfter, projectedSurplus(sec, 0));

        if (improves && minSurplus > bestScore) {
          bestScore     = minSurplus;
          bestSecondary = sec;
        }
      }

      // If a secondary genuinely improves the situation, use it
      if (bestSecondary) return bestSecondary;

      // No better option — keep it on primary (user can manually move if desired)
      return primaryCheck;
    }

    // ── Generate occurrences ─────────────────────────────────
    const endDate   = parseDate(cfg.settings.planEndDate);
    const startDate = checkDates.length ? parseDate(checkDates[0].date) : new Date();

    // Regular bills
    for (const bill of cfg.bills) {
      let cur = parseDate(bill.startDate);
      while (cur < startDate) cur = addMonths(cur, 1);

      while (cur <= endDate) {
        const dueDateStr = fmtDate(cur);
        const occId      = `${bill.id}_${dueDateStr}`;
        const target     = chooseBestCheck(dueDateStr, bill.amount, occId);

        if (target) {
          target.bills.push({
            billId:      bill.id,
            occId,
            name:        bill.name,
            amount:      bill.amount,
            dueDate:     dueDateStr,
            type:        bill.type,
            isCreditCard: false
          });
        }
        cur = addMonths(cur, 1);
      }
    }

    // Credit cards
    for (const cc of cfg.creditCards) {
      let cur = new Date(startDate.getFullYear(), startDate.getMonth(), cc.dueDay);
      if (cur < startDate) cur = addMonths(cur, 1);

      while (cur <= endDate) {
        const dueDateStr = fmtDate(cur);
        const occId      = `cc_${cc.id}_${dueDateStr}`;
        const target     = chooseBestCheck(dueDateStr, cc.minPayment, occId);

        if (target) {
          target.bills.push({
            billId:      cc.id,
            occId,
            name:        cc.name + ' (CC)',
            amount:      cc.minPayment,
            dueDate:     dueDateStr,
            type:        'Credit Card',
            isCreditCard: true
          });
        }
        cur = addMonths(cur, 1);
      }
    }

    // Savings — always on primary checks (1st of month → nearest primary on/after)
    const monthlySavings = cfg.savings.monthlyContribution;
    if (monthlySavings > 0) {
      let cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      if (cur < startDate) cur = addMonths(cur, 1);
      while (cur <= endDate) {
        // Find the first PRIMARY check on or after the 1st
        const ds = fmtDate(cur);
        const target = checks.find(c => c.isPrimary && c.date >= ds);
        if (target) target.savings += monthlySavings;
        cur = addMonths(cur, 1);
      }
    }

    return checks;
  }

  // ── Overlay persisted check data ─────────────────────────────
  function overlayCheckData(checks) {
    const stored   = load(KEYS.checks, {});
    const extraInc = load(KEYS.extraIncome, {});

    return checks.map(c => {
      const over = stored[c.id] || {};
      const paid = over.paidBills || [];
      return {
        ...c,
        paidBills:   paid,
        notes:       over.notes || '',
        extraIncome: extraInc[c.id] || 0,
        bills: c.bills.map(b => ({
          ...b,
          paid: paid.includes(b.occId)
        }))
      };
    });
  }

  // ── Compute surplus/deficit ───────────────────────────────────
  function computeSurplus(check) {
    const totalBills = check.bills.reduce((s, b) => s + b.amount, 0);
    return check.grossIncome + check.extraIncome - totalBills - check.living - check.savings;
  }

  // ── Full plan build ───────────────────────────────────────────
  function buildPlan() {
    const cfg = getConfig();
    const dates = generatePaycheckDates(cfg);
    let checks = assignBillsToChecks(dates, cfg);
    checks = overlayCheckData(checks);
    checks.forEach(c => { c.surplus = computeSurplus(c); });
    return { cfg, checks };
  }

  // ── Mark bill paid/unpaid ────────────────────────────────────
  function toggleBillPaid(checkId, occId) {
    const stored = load(KEYS.checks, {});
    if (!stored[checkId]) stored[checkId] = { paidBills: [] };
    const arr = stored[checkId].paidBills || [];
    const idx = arr.indexOf(occId);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(occId);
    stored[checkId].paidBills = arr;
    save(KEYS.checks, stored);
  }

  // ── Move bill to different check ─────────────────────────────
  function moveBill(occId, targetCheckId) {
    const moved = load(KEYS.billMoved, {});
    for (const cid of Object.keys(moved)) {
      moved[cid] = moved[cid].filter(m => m.occId !== occId);
    }
    if (!moved[targetCheckId]) moved[targetCheckId] = [];
    moved[targetCheckId].push({ occId });
    save(KEYS.billMoved, moved);
  }

  // ── Log extra income ─────────────────────────────────────────
  function logExtraIncome(checkId, amount) {
    const map = load(KEYS.extraIncome, {});
    map[checkId] = (map[checkId] || 0) + Number(amount);
    save(KEYS.extraIncome, map);
  }

  // ── Spending log ─────────────────────────────────────────────
  function getSpending(checkId) { return load(KEYS.spending, {})[checkId] || []; }
  function addSpending(checkId, item) {
    const all = load(KEYS.spending, {});
    if (!all[checkId]) all[checkId] = [];
    all[checkId].push({ id: Date.now(), ...item });
    save(KEYS.spending, all);
  }
  function deleteSpending(checkId, id) {
    const all = load(KEYS.spending, {});
    if (all[checkId]) all[checkId] = all[checkId].filter(s => s.id !== id);
    save(KEYS.spending, all);
  }

  // ── Impulse log ──────────────────────────────────────────────
  function getImpulse() { return load(KEYS.impulse, []); }
  function addImpulse(item) {
    const arr = load(KEYS.impulse, []);
    arr.unshift({ id: Date.now(), date: fmtDate(new Date()), ...item });
    save(KEYS.impulse, arr);
  }
  function deleteImpulse(id) {
    save(KEYS.impulse, load(KEYS.impulse, []).filter(i => i.id !== id));
  }

  // ── No-spend days ────────────────────────────────────────────
  function getNoSpendDays() { return new Set(load(KEYS.noSpend, [])); }
  function toggleNoSpend(dateStr) {
    const s = getNoSpendDays();
    s.has(dateStr) ? s.delete(dateStr) : s.add(dateStr);
    save(KEYS.noSpend, [...s]);
  }

  // ── Savings log ──────────────────────────────────────────────
  function getSavingsLog() { return load(KEYS.savingsLog, []); }
  function logSavings(entry) {
    const arr = load(KEYS.savingsLog, []);
    arr.unshift({ id: Date.now(), date: fmtDate(new Date()), ...entry });
    save(KEYS.savingsLog, arr);
  }

  // ── Debt Calculator ──────────────────────────────────────────
  function calcDebtPayoff(cards, strategy = 'avalanche', extraPayment = 0) {
    let debts = cards.map(c => ({
      name: c.name,
      balance: c.balance,
      minPayment: c.minPayment,
      apr: c.apr,
      monthlyRate: c.apr / 100 / 12
    })).filter(d => d.balance > 0);

    if (strategy === 'avalanche') debts.sort((a, b) => b.apr - a.apr);
    else debts.sort((a, b) => a.balance - b.balance);

    const history = [];
    let month = 0;
    const maxMonths = 240;

    while (debts.some(d => d.balance > 0) && month < maxMonths) {
      month++;
      const snapshot = { month, debts: [] };
      let extra = extraPayment;

      for (const d of debts) {
        if (d.balance <= 0) continue;
        d.balance += d.balance * d.monthlyRate;
        let pay = Math.min(d.minPayment, d.balance);
        d.balance -= pay;
        if (d.balance < 0.01) d.balance = 0;
      }

      for (const d of debts) {
        if (d.balance <= 0 || extra <= 0) continue;
        const apply = Math.min(extra, d.balance);
        d.balance -= apply;
        extra -= apply;
        if (d.balance < 0.01) d.balance = 0;
      }

      snapshot.debts = debts.map(d => ({ name: d.name, balance: Math.max(0, d.balance) }));
      snapshot.totalBalance = snapshot.debts.reduce((s, d) => s + d.balance, 0);
      history.push(snapshot);
    }

    const debtFreeDate = new Date();
    debtFreeDate.setMonth(debtFreeDate.getMonth() + month);

    return { months: month, debtFreeDate: fmtDate(debtFreeDate), history };
  }

  // ── Stats ────────────────────────────────────────────────────
  function computeStats(checks) {
    const withSurplus = checks.map(c => ({ ...c, surplus: computeSurplus(c) }));
    const best  = withSurplus.reduce((a, b) => b.surplus > a.surplus ? b : a, withSurplus[0]);
    const worst = withSurplus.reduce((a, b) => b.surplus < a.surplus ? b : a, withSurplus[0]);
    const netBalance = withSurplus.reduce((s, c) => s + c.surplus, 0);
    const avgSurplus = netBalance / (withSurplus.length || 1);
    const negCount = withSurplus.filter(c => c.surplus < 0).length;
    return { best, worst, netBalance, avgSurplus, negCount, total: withSurplus.length };
  }

  // ── No-spend streak ──────────────────────────────────────────
  function computeStreak(noSpendSet) {
    let streak = 0;
    let cur = new Date();
    while (noSpendSet.has(fmtDate(cur))) {
      streak++;
      cur = addDays(cur, -1);
    }
    return streak;
  }

  // ── Reset all data ───────────────────────────────────────────
  function resetAll() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  }

  // ── Public API ───────────────────────────────────────────────
  return {
    KEYS, DEFAULT_CONFIG,
    load, save, getConfig, saveConfig,
    parseDate, fmtDate, fmtDateShort, fmtMoney, addDays, addMonths, monthsBetween,
    buildPlan,
    toggleBillPaid, moveBill, logExtraIncome,
    getSpending, addSpending, deleteSpending,
    getImpulse, addImpulse, deleteImpulse,
    getNoSpendDays, toggleNoSpend,
    getSavingsLog, logSavings,
    calcDebtPayoff, computeStats, computeStreak,
    resetAll
  };
})();
