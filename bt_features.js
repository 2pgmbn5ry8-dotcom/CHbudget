// ============================================================
// BT_FEATURES.JS — Budget Tracker UI Feature Modules
// All tab rendering & interactions
// ============================================================

const BTUI = (() => {

  let _plan = null;  // cached plan
  let _activeTab = 'bycheck';
  let _activeSetupTab = 'bills';
  let _byCheckIndex = 0;  // which paycheck is shown

  function getPlan(force = false) {
    if (!_plan || force) _plan = BT.buildPlan();
    return _plan;
  }

  function refresh() {
    _plan = null;
    renderApp();
  }

  // ══════════════════════════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════════════════════════
  function renderApp() {
    const root = document.getElementById('app');
    if (!root) return;

    const tabs = [
      { id: 'bycheck',   icon: '💳', label: 'By Check' },
      { id: 'overview',  icon: '📋', label: 'Overview'  },
      { id: 'debt',      icon: '⛓',  label: 'Debt'      },
      { id: 'savings',   icon: '🏦', label: 'Savings'   },
      { id: 'spending',  icon: '🛒', label: 'Spending'  },
      { id: 'impulse',   icon: '🚫', label: 'Impulse'   },
      { id: 'streaks',   icon: '🔥', label: 'Streaks'   },
      { id: 'stats',     icon: '📊', label: 'Stats'     },
      { id: 'setup',     icon: '⚙️', label: 'Setup'     },
    ];

    root.innerHTML = `
      <header class="app-header">
        <div class="header-inner">
          <span class="logo">💰 BudgetTrack</span>
          <span class="today">${new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
        </div>
      </header>
      <nav class="tab-nav" id="tabNav">
        ${tabs.map(t => `
          <button class="tab-btn ${t.id === _activeTab ? 'active' : ''}" data-tab="${t.id}">
            <span class="tab-icon">${t.icon}</span>
            <span class="tab-label">${t.label}</span>
          </button>`).join('')}
      </nav>
      <main class="tab-content" id="tabContent">
        ${renderTab(_activeTab)}
      </main>
    `;

    bindTabNav();
    bindTabEvents(_activeTab);
  }

  function renderTab(tab) {
    switch(tab) {
      case 'bycheck':  return renderByCheck();
      case 'overview': return renderOverview();
      case 'debt':     return renderDebt();
      case 'savings':  return renderSavings();
      case 'spending': return renderSpending();
      case 'impulse':  return renderImpulse();
      case 'streaks':  return renderStreaks();
      case 'stats':    return renderStats();
      case 'setup':    return renderSetup();
      default:         return '<p>Coming soon</p>';
    }
  }

  function bindTabNav() {
    document.getElementById('tabNav').addEventListener('click', e => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      _activeTab = btn.dataset.tab;
      if (_activeTab === 'bycheck') _byCheckIndex = findNextUpcomingCheckIndex();
      refresh();
      // Scroll tab into view
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  }

  function bindTabEvents(tab) {
    switch(tab) {
      case 'bycheck':  bindByCheck();  break;
      case 'overview': bindOverview(); break;
      case 'debt':     bindDebt();     break;
      case 'savings':  bindSavings();  break;
      case 'spending': bindSpending(); break;
      case 'impulse':  bindImpulse();  break;
      case 'streaks':  bindStreaks();  break;
      case 'stats':    bindStats();    break;
      case 'setup':    bindSetup();    break;
    }
  }

  function findNextUpcomingCheckIndex() {
    const { checks } = getPlan();
    const today = BT.fmtDate(new Date());
    const idx = checks.findIndex(c => c.date >= today);
    return idx >= 0 ? idx : 0;
  }

  // ══════════════════════════════════════════════════════════
  // BY CHECK TAB
  // ══════════════════════════════════════════════════════════
  function renderByCheck() {
    const { checks, cfg } = getPlan();
    if (!checks.length) return '<p class="empty">No paychecks generated.</p>';

    if (_byCheckIndex >= checks.length) _byCheckIndex = 0;
    const c = checks[_byCheckIndex];
    const surplus    = c.surplus;
    const totalBills = c.bills.reduce((s, b) => s + b.amount, 0);
    const paidTotal  = c.bills.filter(b => b.paid).reduce((s, b) => s + b.amount, 0);
    const threshold  = cfg.settings.surplusWarningThreshold;
    const isPrimary  = c.isPrimary !== false;

    // Balance suggestion
    let suggestionHtml = '';
    if (surplus < threshold) {
      const moveable = c.bills
        .filter(b => !b.paid && b.dueDate > c.date)
        .sort((a, b) => b.amount - a.amount);
      if (moveable.length) {
        suggestionHtml = `
          <div class="suggestion-box">
            ⚠️ Surplus below $${threshold}. Consider moving:
            ${moveable.slice(0,2).map(b =>
              `<strong>${b.name}</strong> (${BT.fmtMoney(b.amount)})`).join(', ')}
          </div>`;
      } else {
        suggestionHtml = `<div class="suggestion-box warning">⚠️ Surplus below $${threshold} — tight check.</div>`;
      }
    }

    return `
      <div class="bycheck-wrap">
        <!-- Navigation -->
        <div class="check-nav">
          <button class="nav-btn" id="prevCheck" ${_byCheckIndex === 0 ? 'disabled' : ''}>‹</button>
          <div class="check-header-info">
            <div class="check-date">${BT.fmtDateShort(c.date)}</div>
            <div class="check-income-name">
              ${c.incomeName}
              <span class="check-type-badge ${isPrimary ? 'badge-primary' : 'badge-extra'}">
                ${isPrimary ? 'Primary' : 'Extra'}
              </span>
            </div>
            <div class="check-counter">${_byCheckIndex + 1} / ${checks.length}</div>
          </div>
          <button class="nav-btn" id="nextCheck" ${_byCheckIndex >= checks.length - 1 ? 'disabled' : ''}>›</button>
        </div>

        <!-- Jump to check -->
        <div class="jump-bar">
          <select id="jumpSelect" class="form-select small">
            ${checks.map((ch, i) => `<option value="${i}" ${i===_byCheckIndex?'selected':''}>${BT.fmtDateShort(ch.date)} — ${ch.incomeName}${ch.isPrimary === false ? ' ★' : ''}</option>`).join('')}
          </select>
        </div>

        ${!isPrimary ? `<div class="extra-check-notice">⭐ Extra check — no living expenses assigned. Bills shown here were shifted from a tight primary check.</div>` : ''}

        ${suggestionHtml}

        <!-- Income Summary -->
        <div class="check-summary-grid">
          <div class="sum-card green">
            <div class="sum-label">Income</div>
            <div class="sum-val">${BT.fmtMoney(c.grossIncome + c.extraIncome)}</div>
          </div>
          <div class="sum-card red">
            <div class="sum-label">Bills</div>
            <div class="sum-val">${BT.fmtMoney(totalBills)}</div>
          </div>
          ${isPrimary
            ? `<div class="sum-card orange">
                <div class="sum-label">Living</div>
                <div class="sum-val">${BT.fmtMoney(c.living)}</div>
               </div>`
            : `<div class="sum-card dim">
                <div class="sum-label">Living</div>
                <div class="sum-val dim-val">—</div>
               </div>`
          }
          <div class="sum-card ${surplus >= 0 ? 'teal' : 'red'}">
            <div class="sum-label">Surplus</div>
            <div class="sum-val">${BT.fmtMoney(surplus)}</div>
          </div>
        </div>

        <!-- Paid progress -->
        <div class="paid-progress-wrap">
          <div class="paid-bar-label">
            <span>Bills Paid</span>
            <span>${BT.fmtMoney(paidTotal)} / ${BT.fmtMoney(totalBills)}</span>
          </div>
          <div class="paid-bar">
            <div class="paid-fill" style="width:${totalBills > 0 ? Math.min(100,(paidTotal/totalBills)*100) : 0}%"></div>
          </div>
        </div>

        <!-- Bills List -->
        <div class="section-title">Bills Due This Check</div>
        ${c.bills.length === 0
          ? '<div class="empty-state">No bills due this paycheck 🎉</div>'
          : `<div class="bills-list" id="billsList">
              ${c.bills.map(b => `
                <div class="bill-row ${b.paid ? 'paid' : ''}" data-occ="${b.occId}">
                  <div class="bill-check-wrap">
                    <input type="checkbox" class="bill-checkbox" data-check="${c.id}" data-occ="${b.occId}" ${b.paid ? 'checked' : ''}>
                  </div>
                  <div class="bill-info">
                    <div class="bill-name">${b.name}</div>
                    <div class="bill-meta">${b.type} · Due ${BT.fmtDateShort(b.dueDate)}</div>
                  </div>
                  <div class="bill-amount ${b.paid ? 'paid-amount' : ''}">${BT.fmtMoney(b.amount)}</div>
                  <button class="move-btn" data-occ="${b.occId}" title="Move to different check">↕</button>
                </div>`).join('')}
            </div>`
        }

        <!-- Move bill modal placeholder -->
        <div id="moveBillModal" class="modal hidden">
          <div class="modal-box">
            <div class="modal-title">Move Bill To Check</div>
            <div id="moveBillOptions"></div>
            <button class="btn-secondary" id="closeMoveModal">Cancel</button>
          </div>
        </div>

        <!-- Extra Income -->
        <div class="section-title">Log Extra Income</div>
        <div class="extra-income-row">
          <input type="number" id="extraIncomeAmt" class="form-input" placeholder="Amount" min="0" step="0.01">
          <button class="btn-primary" id="logExtraBtn">+ Add</button>
        </div>
        ${c.extraIncome > 0 ? `<div class="extra-badge">+${BT.fmtMoney(c.extraIncome)} extra logged</div>` : ''}

        <!-- Notes -->
        <div class="section-title">Notes</div>
        <textarea id="checkNotes" class="form-textarea" placeholder="Notes for this check...">${c.notes || ''}</textarea>
        <button class="btn-secondary" id="saveNotesBtn">Save Notes</button>
      </div>
    `;
  }

  function bindByCheck() {
    const { checks } = getPlan();
    const c = checks[_byCheckIndex];
    if (!c) return;

    document.getElementById('prevCheck')?.addEventListener('click', () => {
      if (_byCheckIndex > 0) { _byCheckIndex--; refresh(); }
    });
    document.getElementById('nextCheck')?.addEventListener('click', () => {
      if (_byCheckIndex < checks.length - 1) { _byCheckIndex++; refresh(); }
    });
    document.getElementById('jumpSelect')?.addEventListener('change', e => {
      _byCheckIndex = parseInt(e.target.value);
      refresh();
    });

    // Bill checkboxes
    document.querySelectorAll('.bill-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        BT.toggleBillPaid(cb.dataset.check, cb.dataset.occ);
        refresh();
      });
    });

    // Move bill buttons
    document.querySelectorAll('.move-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const occId = btn.dataset.occ;
        const modal = document.getElementById('moveBillModal');
        const opts  = document.getElementById('moveBillOptions');
        const nearby = checks.slice(Math.max(0, _byCheckIndex - 3), _byCheckIndex + 6)
                             .filter((_, i) => i !== _byCheckIndex);
        opts.innerHTML = nearby.map(ch =>
          `<button class="btn-move-option" data-occ="${occId}" data-cid="${ch.id}">${BT.fmtDateShort(ch.date)} — ${ch.incomeName}</button>`
        ).join('');
        modal.classList.remove('hidden');

        opts.querySelectorAll('.btn-move-option').forEach(ob => {
          ob.addEventListener('click', () => {
            BT.moveBill(ob.dataset.occ, ob.dataset.cid);
            modal.classList.add('hidden');
            refresh();
          });
        });
      });
    });

    document.getElementById('closeMoveModal')?.addEventListener('click', () => {
      document.getElementById('moveBillModal').classList.add('hidden');
    });

    document.getElementById('logExtraBtn')?.addEventListener('click', () => {
      const amt = parseFloat(document.getElementById('extraIncomeAmt').value);
      if (amt > 0) { BT.logExtraIncome(c.id, amt); refresh(); }
    });

    document.getElementById('saveNotesBtn')?.addEventListener('click', () => {
      const notes = document.getElementById('checkNotes').value;
      const stored = BT.load(BT.KEYS.checks, {});
      if (!stored[c.id]) stored[c.id] = { paidBills: [] };
      stored[c.id].notes = notes;
      BT.save(BT.KEYS.checks, stored);
      showToast('Notes saved');
    });
  }

  // ══════════════════════════════════════════════════════════
  // OVERVIEW TAB
  // ══════════════════════════════════════════════════════════
  function renderOverview() {
    const { checks } = getPlan();
    const today = BT.fmtDate(new Date());

    // Group by month
    const byMonth = {};
    checks.forEach(c => {
      const mo = c.date.substring(0, 7);
      if (!byMonth[mo]) byMonth[mo] = [];
      byMonth[mo].push(c);
    });

    return `
      <div class="overview-wrap">
        <div class="section-title">All Paychecks <span class="badge">${checks.length}</span></div>
        <div class="overview-table-wrap">
          <table class="overview-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Source</th>
                <th>Income</th>
                <th>Bills</th>
                <th>Living</th>
                <th>Surplus</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(byMonth).map(([mo, mChecks]) => {
                const moTotal = mChecks.reduce((s,c) => s + c.surplus, 0);
                return `
                  <tr class="month-row">
                    <td colspan="5">${formatMonth(mo)}</td>
                    <td class="${moTotal >= 0 ? 'pos' : 'neg'}">${BT.fmtMoney(moTotal)}</td>
                  </tr>
                  ${mChecks.map(c => {
                    const bills = c.bills.reduce((s,b) => s+b.amount, 0);
                    return `<tr class="check-row ${c.date === today ? 'today-row' : ''}" data-idx="${checks.indexOf(c)}">
                      <td>${BT.fmtDateShort(c.date)}</td>
                      <td>${c.incomeName}</td>
                      <td class="pos">${BT.fmtMoney(c.grossIncome)}</td>
                      <td class="neg">${BT.fmtMoney(bills)}</td>
                      <td>${BT.fmtMoney(c.living)}</td>
                      <td class="${c.surplus >= 0 ? 'pos' : 'neg'}">${BT.fmtMoney(c.surplus)}</td>
                    </tr>`;
                  }).join('')}`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function bindOverview() {
    document.querySelectorAll('.check-row').forEach(row => {
      row.addEventListener('click', () => {
        _byCheckIndex = parseInt(row.dataset.idx);
        _activeTab = 'bycheck';
        refresh();
      });
    });
  }

  function formatMonth(moStr) {
    const [y, m] = moStr.split('-');
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  // ══════════════════════════════════════════════════════════
  // DEBT TAB
  // ══════════════════════════════════════════════════════════
  function renderDebt() {
    const { cfg } = getPlan();
    const cards = cfg.creditCards;
    const totalDebt = cards.reduce((s, c) => s + c.balance, 0);

    return `
      <div class="debt-wrap">
        <div class="section-title">Credit Cards</div>
        <div class="debt-cards">
          ${cards.map(c => {
            const pct = Math.min(100, (c.balance / (totalDebt || 1)) * 100);
            return `
              <div class="debt-card">
                <div class="debt-card-header">
                  <span class="debt-name">${c.name}</span>
                  <span class="debt-apr">${c.apr}% APR</span>
                </div>
                <div class="debt-balance">${BT.fmtMoney(c.balance)}</div>
                <div class="debt-bar"><div class="debt-fill" style="width:${pct}%"></div></div>
                <div class="debt-min">Min: ${BT.fmtMoney(c.minPayment)} · Due day ${c.dueDay}</div>
              </div>`;
          }).join('')}
        </div>

        <div class="total-debt-badge">Total Debt: ${BT.fmtMoney(totalDebt)}</div>

        <div class="section-title">Payoff Strategy</div>
        <div class="strategy-row">
          <label class="radio-label">
            <input type="radio" name="strategy" value="avalanche" checked> 
            <span>Avalanche <small>(highest APR first)</small></span>
          </label>
          <label class="radio-label">
            <input type="radio" name="strategy" value="snowball">
            <span>Snowball <small>(lowest balance first)</small></span>
          </label>
        </div>

        <div class="extra-payment-row">
          <label class="form-label">Extra Monthly Payment</label>
          <div class="input-row">
            <input type="number" id="extraDebtPayment" class="form-input" value="0" min="0" step="5">
            <button class="btn-primary" id="calcDebtBtn">Calculate</button>
          </div>
        </div>

        <div id="debtResults"></div>
      </div>
    `;
  }

  function bindDebt() {
    document.getElementById('calcDebtBtn')?.addEventListener('click', () => {
      const strategy = document.querySelector('input[name="strategy"]:checked')?.value || 'avalanche';
      const extra    = parseFloat(document.getElementById('extraDebtPayment').value) || 0;
      const { cfg }  = getPlan();
      const result   = BT.calcDebtPayoff(cfg.creditCards, strategy, extra);
      renderDebtResults(result, strategy);
    });

    // Auto-calc on load
    const { cfg } = getPlan();
    const result = BT.calcDebtPayoff(cfg.creditCards, 'avalanche', 0);
    renderDebtResults(result, 'avalanche');
  }

  function renderDebtResults(result, strategy) {
    const container = document.getElementById('debtResults');
    if (!container) return;

    const freeDate = BT.fmtDateShort(result.debtFreeDate);
    container.innerHTML = `
      <div class="debt-result-box">
        <div class="debt-result-title">📅 Debt-Free Date</div>
        <div class="debt-result-big">${freeDate}</div>
        <div class="debt-result-sub">${result.months} months · ${strategy} strategy</div>
      </div>
      <div class="section-title">Balance Over Time</div>
      <div class="debt-chart-wrap">
        ${renderDebtChart(result.history)}
      </div>
    `;
  }

  function renderDebtChart(history) {
    if (!history.length) return '';
    const maxBal = history[0].totalBalance;
    const step = Math.max(1, Math.floor(history.length / 24));
    const points = history.filter((_, i) => i % step === 0 || i === history.length - 1);

    return `
      <div class="mini-chart">
        ${points.map(p => {
          const h = Math.max(2, (p.totalBalance / maxBal) * 100);
          return `<div class="chart-bar" style="height:${h}%" title="Mo ${p.month}: ${BT.fmtMoney(p.totalBalance)}"></div>`;
        }).join('')}
      </div>
      <div class="chart-labels">
        <span>Now</span><span>${BT.fmtMoney(maxBal)}</span>
        <span style="margin-left:auto">Debt-Free</span>
      </div>
    `;
  }

  // ══════════════════════════════════════════════════════════
  // SAVINGS TAB
  // ══════════════════════════════════════════════════════════
  function renderSavings() {
    const { cfg } = getPlan();
    const goal  = cfg.savings.goalAmount;
    const cur   = cfg.savings.currentBalance;
    const monthly = cfg.savings.monthlyContribution;
    const remaining = Math.max(0, goal - cur);
    const months = monthly > 0 ? Math.ceil(remaining / monthly) : Infinity;
    const pct = goal > 0 ? Math.min(100, (cur / goal) * 100) : 0;
    const log = BT.getSavingsLog();

    const targetDate = new Date();
    if (isFinite(months)) targetDate.setMonth(targetDate.getMonth() + months);

    return `
      <div class="savings-wrap">
        <div class="section-title">Savings Goal</div>
        <div class="savings-goal-card">
          <div class="goal-amounts">
            <span class="goal-cur">${BT.fmtMoney(cur)}</span>
            <span class="goal-sep">of</span>
            <span class="goal-total">${BT.fmtMoney(goal)}</span>
          </div>
          <div class="savings-bar">
            <div class="savings-fill" style="width:${pct}%"></div>
          </div>
          <div class="savings-stats">
            <span>${pct.toFixed(1)}% complete</span>
            <span>${isFinite(months) ? months + ' months to go' : '—'}</span>
          </div>
          ${isFinite(months) ? `<div class="savings-target-date">Target: ${targetDate.toLocaleDateString('en-US',{month:'long',year:'numeric'})}</div>` : ''}
        </div>

        <div class="section-title">Log Actual Deposit</div>
        <div class="savings-log-form">
          <input type="number" id="savingsActual" class="form-input" placeholder="Amount deposited" min="0" step="0.01">
          <input type="text"   id="savingsNote"   class="form-input" placeholder="Note (optional)">
          <button class="btn-primary" id="logSavingsBtn">+ Log</button>
        </div>

        <div class="section-title">History</div>
        ${log.length === 0
          ? '<div class="empty-state">No entries yet.</div>'
          : `<div class="savings-log">
              ${log.map(e => `
                <div class="log-entry">
                  <div>
                    <div class="log-date">${BT.fmtDateShort(e.date)}</div>
                    ${e.note ? `<div class="log-note">${e.note}</div>` : ''}
                  </div>
                  <div class="log-amount pos">${BT.fmtMoney(e.amount)}</div>
                </div>`).join('')}
            </div>`
        }
      </div>
    `;
  }

  function bindSavings() {
    document.getElementById('logSavingsBtn')?.addEventListener('click', () => {
      const amt  = parseFloat(document.getElementById('savingsActual').value);
      const note = document.getElementById('savingsNote').value.trim();
      if (!amt || amt <= 0) return;

      // Update current balance in config
      const cfg = BT.getConfig();
      cfg.savings.currentBalance = (cfg.savings.currentBalance || 0) + amt;
      BT.saveConfig(cfg);

      BT.logSavings({ amount: amt, note });
      refresh();
    });
  }

  // ══════════════════════════════════════════════════════════
  // SPENDING TAB
  // ══════════════════════════════════════════════════════════
  function renderSpending() {
    const { checks } = getPlan();
    const today = BT.fmtDate(new Date());
    const idx = checks.findIndex(c => c.date >= today);
    const checkIdx = idx >= 0 ? idx : checks.length - 1;
    const c = checks[checkIdx];
    if (!c) return '<div class="empty-state">No checks available.</div>';

    const spending = BT.getSpending(c.id);
    const total = spending.reduce((s, e) => s + e.amount, 0);
    const surplus = c.surplus;

    return `
      <div class="spending-wrap">
        <div class="section-title">Spending — ${BT.fmtDateShort(c.date)} Check</div>

        <div class="check-nav mini">
          <select id="spendingCheckSelect" class="form-select small">
            ${checks.map((ch, i) => `<option value="${ch.id}" ${ch.id === c.id ? 'selected' : ''}>${BT.fmtDateShort(ch.date)} — ${ch.incomeName}</option>`).join('')}
          </select>
        </div>

        <div class="spending-summary">
          <div class="sum-card orange">
            <div class="sum-label">Unplanned</div>
            <div class="sum-val">${BT.fmtMoney(total)}</div>
          </div>
          <div class="sum-card ${surplus - total >= 0 ? 'teal' : 'red'}">
            <div class="sum-label">Remaining</div>
            <div class="sum-val">${BT.fmtMoney(surplus - total)}</div>
          </div>
        </div>

        <div class="section-title">Log Purchase</div>
        <div class="spending-form">
          <input type="text"   id="spendDesc"   class="form-input" placeholder="Description">
          <input type="number" id="spendAmt"    class="form-input" placeholder="Amount" min="0" step="0.01">
          <select id="spendCat" class="form-select">
            <option>Food</option><option>Clothing</option><option>Entertainment</option>
            <option>Personal Care</option><option>Home</option><option>Other</option>
          </select>
          <button class="btn-primary" id="logSpendBtn">+ Log</button>
        </div>

        <div class="section-title">This Check's Purchases</div>
        <div id="spendingList">
          ${spending.length === 0
            ? '<div class="empty-state">No purchases logged.</div>'
            : spending.map(e => `
                <div class="spend-entry">
                  <div>
                    <div class="spend-desc">${e.desc}</div>
                    <div class="spend-meta">${e.category} · ${BT.fmtDateShort(e.date || c.date)}</div>
                  </div>
                  <div class="spend-right">
                    <span class="spend-amt neg">${BT.fmtMoney(e.amount)}</span>
                    <button class="del-btn" data-spend-id="${e.id}">✕</button>
                  </div>
                </div>`).join('')
          }
        </div>
      </div>
    `;
  }

  function bindSpending() {
    const { checks } = getPlan();
    let currentCheckId = document.getElementById('spendingCheckSelect')?.value;

    document.getElementById('spendingCheckSelect')?.addEventListener('change', e => {
      currentCheckId = e.target.value;
      // re-render spending list
      const spending = BT.getSpending(currentCheckId);
      const total = spending.reduce((s, e) => s + e.amount, 0);
      const c = checks.find(ch => ch.id === currentCheckId);
      const surplus = c ? c.surplus : 0;

      document.querySelector('.sum-card.orange .sum-val').textContent = BT.fmtMoney(total);
      const remCard = document.querySelectorAll('.sum-card')[1];
      const rem = surplus - total;
      remCard.querySelector('.sum-val').textContent = BT.fmtMoney(rem);
      remCard.className = `sum-card ${rem >= 0 ? 'teal' : 'red'}`;

      document.getElementById('spendingList').innerHTML = spending.length === 0
        ? '<div class="empty-state">No purchases logged.</div>'
        : spending.map(e => `
            <div class="spend-entry">
              <div>
                <div class="spend-desc">${e.desc}</div>
                <div class="spend-meta">${e.category}</div>
              </div>
              <div class="spend-right">
                <span class="spend-amt neg">${BT.fmtMoney(e.amount)}</span>
                <button class="del-btn" data-spend-id="${e.id}">✕</button>
              </div>
            </div>`).join('');
      bindDeleteSpend(currentCheckId);
    });

    document.getElementById('logSpendBtn')?.addEventListener('click', () => {
      const desc = document.getElementById('spendDesc').value.trim();
      const amt  = parseFloat(document.getElementById('spendAmt').value);
      const cat  = document.getElementById('spendCat').value;
      if (!desc || !amt) return;
      BT.addSpending(currentCheckId, { desc, amount: amt, category: cat, date: BT.fmtDate(new Date()) });
      refresh();
    });

    bindDeleteSpend(currentCheckId);
  }

  function bindDeleteSpend(checkId) {
    document.querySelectorAll('.del-btn[data-spend-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        BT.deleteSpending(checkId, parseInt(btn.dataset.spendId));
        refresh();
      });
    });
  }

  // ══════════════════════════════════════════════════════════
  // IMPULSE LOG TAB
  // ══════════════════════════════════════════════════════════
  function renderImpulse() {
    const entries = BT.getImpulse();
    const totalSaved = entries.reduce((s, e) => s + e.amount, 0);

    return `
      <div class="impulse-wrap">
        <div class="section-title">Impulse Log 🚫</div>
        <div class="impulse-intro">Track purchases you resisted — every entry is money you kept!</div>

        <div class="impulse-saved-badge">
          💪 Total Avoided: <strong>${BT.fmtMoney(totalSaved)}</strong>
        </div>

        <div class="section-title">Log Resisted Purchase</div>
        <div class="impulse-form">
          <input type="text"   id="impulseItem"   class="form-input" placeholder="What was it?">
          <input type="number" id="impulseAmt"    class="form-input" placeholder="Price" min="0" step="0.01">
          <input type="text"   id="impulseReason" class="form-input" placeholder="Why you resisted (optional)">
          <button class="btn-primary" id="addImpulseBtn">+ Log Resistance</button>
        </div>

        <div class="section-title">Resisted Purchases</div>
        ${entries.length === 0
          ? '<div class="empty-state">Nothing logged yet. Stay strong! 💪</div>'
          : `<div class="impulse-list">
              ${entries.map(e => `
                <div class="impulse-entry">
                  <div class="impulse-main">
                    <div class="impulse-item">${e.item}</div>
                    <div class="impulse-meta">${BT.fmtDateShort(e.date)}${e.reason ? ' · ' + e.reason : ''}</div>
                  </div>
                  <div class="impulse-right">
                    <span class="impulse-amt">${BT.fmtMoney(e.amount)}</span>
                    <button class="del-btn" data-imp-id="${e.id}">✕</button>
                  </div>
                </div>`).join('')}
            </div>`
        }
      </div>
    `;
  }

  function bindImpulse() {
    document.getElementById('addImpulseBtn')?.addEventListener('click', () => {
      const item   = document.getElementById('impulseItem').value.trim();
      const amt    = parseFloat(document.getElementById('impulseAmt').value);
      const reason = document.getElementById('impulseReason').value.trim();
      if (!item || !amt) return;
      BT.addImpulse({ item, amount: amt, reason });
      refresh();
    });

    document.querySelectorAll('.del-btn[data-imp-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        BT.deleteImpulse(parseInt(btn.dataset.impId));
        refresh();
      });
    });
  }

  // ══════════════════════════════════════════════════════════
  // STREAKS TAB
  // ══════════════════════════════════════════════════════════
  function renderStreaks() {
    const noSpend = BT.getNoSpendDays();
    const streak  = BT.computeStreak(noSpend);
    const today   = BT.fmtDate(new Date());

    // Build last 2 months of calendar
    const calMonths = [];
    for (let m = -1; m <= 0; m++) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() + m);
      calMonths.push(d);
    }

    return `
      <div class="streaks-wrap">
        <div class="streak-hero">
          <div class="streak-flame">🔥</div>
          <div class="streak-count">${streak}</div>
          <div class="streak-label">Day Streak</div>
        </div>

        <div class="streak-tip">Tap any day to mark it as a no-spend day</div>

        ${calMonths.map(mo => renderCalendar(mo, noSpend, today)).join('')}

        <div class="streak-stats">
          <div class="stat-pill">
            <span class="sp-label">Total No-Spend Days</span>
            <span class="sp-val">${noSpend.size}</span>
          </div>
          <div class="stat-pill">
            <span class="sp-label">This Month</span>
            <span class="sp-val">${countThisMonth(noSpend)}</span>
          </div>
        </div>
      </div>
    `;
  }

  function renderCalendar(monthDate, noSpend, today) {
    const y  = monthDate.getFullYear();
    const m  = monthDate.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const firstDow = new Date(y, m, 1).getDay();
    const label = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    let cells = '';
    // Empty cells for start
    for (let i = 0; i < firstDow; i++) cells += '<div class="cal-cell empty"></div>';

    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isNS    = noSpend.has(ds);
      const isToday = ds === today;
      const isFuture = ds > today;
      cells += `<div class="cal-cell ${isNS ? 'no-spend' : ''} ${isToday ? 'cal-today' : ''} ${isFuture ? 'future' : ''}"
                     data-date="${ds}">${d}</div>`;
    }

    return `
      <div class="cal-month">
        <div class="cal-month-label">${label}</div>
        <div class="cal-dow-row">
          ${['S','M','T','W','T','F','S'].map(d => `<div class="cal-dow">${d}</div>`).join('')}
        </div>
        <div class="cal-grid">${cells}</div>
      </div>
    `;
  }

  function countThisMonth(noSpend) {
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    return [...noSpend].filter(d => d.startsWith(prefix)).length;
  }

  function bindStreaks() {
    document.querySelectorAll('.cal-cell[data-date]').forEach(cell => {
      if (cell.classList.contains('future')) return;
      cell.addEventListener('click', () => {
        BT.toggleNoSpend(cell.dataset.date);
        refresh();
      });
    });
  }

  // ══════════════════════════════════════════════════════════
  // STATS TAB
  // ══════════════════════════════════════════════════════════
  function renderStats() {
    const { checks } = getPlan();
    const stats = BT.computeStats(checks);
    const totalIncome = checks.reduce((s, c) => s + c.grossIncome + c.extraIncome, 0);
    const totalBills  = checks.reduce((s, c) => s + c.bills.reduce((x,b)=>x+b.amount,0), 0);
    const totalLiving = checks.reduce((s, c) => s + c.living, 0);

    // Monthly surplus chart
    const byMonth = {};
    checks.forEach(c => {
      const mo = c.date.substring(0, 7);
      byMonth[mo] = (byMonth[mo] || 0) + c.surplus;
    });
    const months = Object.entries(byMonth).slice(0, 24);
    const maxAbs = Math.max(...months.map(([,v]) => Math.abs(v)), 1);

    return `
      <div class="stats-wrap">
        <div class="section-title">Plan Summary</div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-lbl">Total Income</div>
            <div class="stat-val pos">${BT.fmtMoney(totalIncome)}</div>
            <div class="stat-sub">${checks.length} checks</div>
          </div>
          <div class="stat-card">
            <div class="stat-lbl">Total Bills</div>
            <div class="stat-val neg">${BT.fmtMoney(totalBills)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-lbl">Total Living</div>
            <div class="stat-val neg">${BT.fmtMoney(totalLiving)}</div>
          </div>
          <div class="stat-card ${stats.netBalance >= 0 ? 'green-card' : 'red-card'}">
            <div class="stat-lbl">Net Balance</div>
            <div class="stat-val">${BT.fmtMoney(stats.netBalance)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-lbl">Avg Surplus/Check</div>
            <div class="stat-val ${stats.avgSurplus >= 0 ? 'pos' : 'neg'}">${BT.fmtMoney(stats.avgSurplus)}</div>
          </div>
          <div class="stat-card red-card">
            <div class="stat-lbl">Deficit Checks</div>
            <div class="stat-val">${stats.negCount} / ${stats.total}</div>
          </div>
        </div>

        <div class="stats-highlights">
          <div class="highlight-card best">
            <div class="hl-label">🏆 Best Check</div>
            <div class="hl-date">${stats.best ? BT.fmtDateShort(stats.best.date) : '—'}</div>
            <div class="hl-val pos">${stats.best ? BT.fmtMoney(stats.best.surplus) : '—'}</div>
          </div>
          <div class="highlight-card worst">
            <div class="hl-label">💔 Worst Check</div>
            <div class="hl-date">${stats.worst ? BT.fmtDateShort(stats.worst.date) : '—'}</div>
            <div class="hl-val neg">${stats.worst ? BT.fmtMoney(stats.worst.surplus) : '—'}</div>
          </div>
        </div>

        <div class="section-title">Monthly Surplus <small>(first 24 mo)</small></div>
        <div class="monthly-chart">
          ${months.map(([mo, val]) => {
            const pct = Math.max(2, (Math.abs(val) / maxAbs) * 100);
            return `
              <div class="mc-col">
                <div class="mc-bar-wrap">
                  <div class="mc-bar ${val >= 0 ? 'mc-pos' : 'mc-neg'}" style="height:${pct}%"
                       title="${formatMonth(mo)}: ${BT.fmtMoney(val)}"></div>
                </div>
                <div class="mc-label">${mo.substring(5)}</div>
              </div>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  function bindStats() {}

  // ══════════════════════════════════════════════════════════
  // SETUP TAB
  // ══════════════════════════════════════════════════════════
  function renderSetup() {
    const subtabs = [
      { id: 'bills',   label: '📋 Bills'    },
      { id: 'cards',   label: '💳 Cards'    },
      { id: 'income',  label: '💵 Income'   },
      { id: 'settings',label: '⚙️ Settings' },
    ];

    return `
      <div class="setup-wrap">
        <div class="setup-subtab-nav">
          ${subtabs.map(st => `
            <button class="setup-subtab-btn ${st.id === _activeSetupTab ? 'active' : ''}" data-sub="${st.id}">
              ${st.label}
            </button>`).join('')}
        </div>
        <div id="setupSubContent">
          ${renderSetupSub(_activeSetupTab)}
        </div>
      </div>
    `;
  }

  function renderSetupSub(sub) {
    const cfg = BT.getConfig();
    switch(sub) {
      case 'bills':    return renderSetupBills(cfg);
      case 'cards':    return renderSetupCards(cfg);
      case 'income':   return renderSetupIncome(cfg);
      case 'settings': return renderSetupSettings(cfg);
      default: return '';
    }
  }

  function renderSetupBills(cfg) {
    return `
      <div class="setup-section">
        <div class="section-title">Recurring Bills</div>
        <div class="setup-list" id="billSetupList">
          ${cfg.bills.map(b => `
            <div class="setup-item" data-id="${b.id}">
              <div class="setup-item-info">
                <span class="setup-name">${b.name}</span>
                <span class="setup-meta">${BT.fmtMoney(b.amount)} · Day ${b.dueDay} · ${b.type}</span>
              </div>
              <div class="setup-actions">
                <button class="icon-btn edit-bill-btn" data-id="${b.id}">✏️</button>
                <button class="icon-btn del-bill-btn"  data-id="${b.id}">🗑</button>
              </div>
            </div>`).join('')}
        </div>

        <div class="section-title">Add Bill</div>
        <div class="setup-form" id="billForm">
          <input  type="text"   id="billName"    class="form-input" placeholder="Name">
          <input  type="number" id="billAmount"  class="form-input" placeholder="Amount" min="0" step="0.01">
          <input  type="number" id="billDueDay"  class="form-input" placeholder="Due Day (1-31)" min="1" max="31">
          <select id="billType" class="form-select">
            <option>Subscription</option><option>Phone</option><option>Medical</option>
            <option>Gym</option><option>Insurance</option><option>Utilities</option><option>Other</option>
          </select>
          <input  type="date"   id="billStart"   class="form-input">
          <button class="btn-primary" id="addBillBtn">+ Add Bill</button>
        </div>
      </div>
    `;
  }

  function renderSetupCards(cfg) {
    return `
      <div class="setup-section">
        <div class="section-title">Credit Cards</div>
        <div class="setup-list">
          ${cfg.creditCards.map(c => `
            <div class="setup-item" data-id="${c.id}">
              <div class="setup-item-info">
                <span class="setup-name">${c.name}</span>
                <span class="setup-meta">${BT.fmtMoney(c.balance)} bal · ${BT.fmtMoney(c.minPayment)} min · ${c.apr}% APR · Day ${c.dueDay}</span>
              </div>
              <div class="setup-actions">
                <button class="icon-btn edit-cc-btn" data-id="${c.id}">✏️</button>
                <button class="icon-btn del-cc-btn"  data-id="${c.id}">🗑</button>
              </div>
            </div>`).join('')}
        </div>

        <div class="section-title">Add Credit Card</div>
        <div class="setup-form">
          <input type="text"   id="ccName"    class="form-input" placeholder="Card Name">
          <input type="number" id="ccBalance" class="form-input" placeholder="Balance" min="0" step="0.01">
          <input type="number" id="ccMin"     class="form-input" placeholder="Min Payment" min="0" step="0.01">
          <input type="number" id="ccApr"     class="form-input" placeholder="APR %" min="0" step="0.01">
          <input type="number" id="ccDueDay"  class="form-input" placeholder="Due Day (1-31)" min="1" max="31">
          <button class="btn-primary" id="addCCBtn">+ Add Card</button>
        </div>
      </div>
    `;
  }

  function renderSetupIncome(cfg) {
    return `
      <div class="setup-section">
        <div class="section-title">Income Sources</div>
        <div class="income-type-note">
          Primary checks carry living expenses and get bills first. Extra checks receive overflow bills only when it improves your surplus balance.
        </div>
        <div class="setup-list">
          ${cfg.incomes.map(inc => `
            <div class="setup-item" data-id="${inc.id}">
              <div class="setup-item-info">
                <span class="setup-name">${inc.name}
                  <span class="check-type-badge ${inc.isPrimary !== false ? 'badge-primary' : 'badge-extra'}">
                    ${inc.isPrimary !== false ? 'Primary' : 'Extra'}
                  </span>
                </span>
                <span class="setup-meta">${BT.fmtMoney(inc.amount)} · ${inc.frequency} · Next: ${BT.fmtDateShort(inc.nextDate)}</span>
              </div>
              <div class="setup-actions">
                <button class="icon-btn toggle-primary-btn" data-id="${inc.id}" title="Toggle primary/extra">
                  ${inc.isPrimary !== false ? '⭐' : '☆'}
                </button>
                <button class="icon-btn edit-inc-btn" data-id="${inc.id}">✏️</button>
              </div>
            </div>`).join('')}
        </div>

        <div class="section-title">Living Expenses / Check</div>
        <div class="setup-form">
          <label class="form-label">Groceries</label>
          <input type="number" id="leGroceries" class="form-input" value="${cfg.livingExpenses.groceries}" min="0" step="1">
          <label class="form-label">Eating Out</label>
          <input type="number" id="leEating"    class="form-input" value="${cfg.livingExpenses.eatingOut}" min="0" step="1">
          <label class="form-label">Gas</label>
          <input type="number" id="leGas"       class="form-input" value="${cfg.livingExpenses.gas}" min="0" step="1">
          <label class="form-label">Misc</label>
          <input type="number" id="leMisc"      class="form-input" value="${cfg.livingExpenses.misc}" min="0" step="1">
          <button class="btn-primary" id="saveLivingBtn">Save Living Expenses</button>
        </div>

        <div class="section-title">Savings Goal</div>
        <div class="setup-form">
          <label class="form-label">Goal Amount</label>
          <input type="number" id="savGoal"    class="form-input" value="${cfg.savings.goalAmount}" min="0" step="1">
          <label class="form-label">Monthly Contribution</label>
          <input type="number" id="savMonthly" class="form-input" value="${cfg.savings.monthlyContribution}" min="0" step="1">
          <label class="form-label">Current Balance</label>
          <input type="number" id="savCurrent" class="form-input" value="${cfg.savings.currentBalance}" min="0" step="0.01">
          <button class="btn-primary" id="saveSavingsBtn">Save Goal</button>
        </div>
      </div>
    `;
  }

  function renderSetupSettings(cfg) {
    return `
      <div class="setup-section">
        <div class="section-title">Settings</div>
        <div class="setup-form">
          <label class="form-label">Surplus Warning Threshold ($)</label>
          <input type="number" id="surplusThreshold" class="form-input" value="${cfg.settings.surplusWarningThreshold}" min="0">
          <label class="form-label">Plan End Date</label>
          <input type="date" id="planEndDate" class="form-input" value="${cfg.settings.planEndDate}">
          <button class="btn-primary" id="saveSettingsBtn">Save Settings</button>
        </div>

        <div class="section-title danger-zone">Danger Zone</div>
        <button class="btn-danger" id="resetDataBtn">🗑 Reset All Data</button>
        <p class="danger-note">This will delete all your saved data and cannot be undone.</p>
      </div>
    `;
  }

  function bindSetup() {
    // Sub-tab nav
    document.querySelectorAll('.setup-subtab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _activeSetupTab = btn.dataset.sub;
        document.querySelectorAll('.setup-subtab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('setupSubContent').innerHTML = renderSetupSub(_activeSetupTab);
        bindSetupSubEvents(_activeSetupTab);
      });
    });
    bindSetupSubEvents(_activeSetupTab);
  }

  function bindSetupSubEvents(sub) {
    switch(sub) {
      case 'bills':    bindSetupBills();    break;
      case 'cards':    bindSetupCards();    break;
      case 'income':   bindSetupIncome();   break;
      case 'settings': bindSetupSettings(); break;
    }
  }

  function bindSetupBills() {
    document.getElementById('addBillBtn')?.addEventListener('click', () => {
      const name   = document.getElementById('billName').value.trim();
      const amount = parseFloat(document.getElementById('billAmount').value);
      const dueDay = parseInt(document.getElementById('billDueDay').value);
      const type   = document.getElementById('billType').value;
      const start  = document.getElementById('billStart').value || BT.fmtDate(new Date());
      if (!name || !amount || !dueDay) return;

      const cfg = BT.getConfig();
      cfg.bills.push({ id: 'b' + Date.now(), name, amount, dueDay, type, ongoing: true, startDate: start, endDate: null });
      BT.saveConfig(cfg);
      refresh();
    });

    document.querySelectorAll('.del-bill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm(`Delete this bill?`)) return;
        const cfg = BT.getConfig();
        cfg.bills = cfg.bills.filter(b => b.id !== btn.dataset.id);
        BT.saveConfig(cfg);
        refresh();
      });
    });

    document.querySelectorAll('.edit-bill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cfg  = BT.getConfig();
        const bill = cfg.bills.find(b => b.id === btn.dataset.id);
        if (!bill) return;
        const newAmt = parseFloat(prompt(`New amount for ${bill.name}:`, bill.amount));
        if (!isNaN(newAmt) && newAmt > 0) {
          bill.amount = newAmt;
          BT.saveConfig(cfg);
          refresh();
        }
      });
    });
  }

  function bindSetupCards() {
    document.getElementById('addCCBtn')?.addEventListener('click', () => {
      const name    = document.getElementById('ccName').value.trim();
      const balance = parseFloat(document.getElementById('ccBalance').value);
      const min     = parseFloat(document.getElementById('ccMin').value);
      const apr     = parseFloat(document.getElementById('ccApr').value);
      const dueDay  = parseInt(document.getElementById('ccDueDay').value);
      if (!name || isNaN(balance) || isNaN(min) || isNaN(apr) || isNaN(dueDay)) return;

      const cfg = BT.getConfig();
      cfg.creditCards.push({ id: 'cc' + Date.now(), name, balance, minPayment: min, apr, dueDay });
      BT.saveConfig(cfg);
      refresh();
    });

    document.querySelectorAll('.del-cc-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('Delete this card?')) return;
        const cfg = BT.getConfig();
        cfg.creditCards = cfg.creditCards.filter(c => c.id !== btn.dataset.id);
        BT.saveConfig(cfg);
        refresh();
      });
    });

    document.querySelectorAll('.edit-cc-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cfg  = BT.getConfig();
        const card = cfg.creditCards.find(c => c.id === btn.dataset.id);
        if (!card) return;
        const newBal = parseFloat(prompt(`New balance for ${card.name}:`, card.balance));
        if (!isNaN(newBal) && newBal >= 0) {
          card.balance = newBal;
          BT.saveConfig(cfg);
          refresh();
        }
      });
    });
  }

  function bindSetupIncome() {
    document.getElementById('saveLivingBtn')?.addEventListener('click', () => {
      const cfg = BT.getConfig();
      cfg.livingExpenses.groceries = parseFloat(document.getElementById('leGroceries').value) || 0;
      cfg.livingExpenses.eatingOut = parseFloat(document.getElementById('leEating').value)    || 0;
      cfg.livingExpenses.gas       = parseFloat(document.getElementById('leGas').value)       || 0;
      cfg.livingExpenses.misc      = parseFloat(document.getElementById('leMisc').value)      || 0;
      BT.saveConfig(cfg);
      showToast('Living expenses saved');
      refresh();
    });

    document.getElementById('saveSavingsBtn')?.addEventListener('click', () => {
      const cfg = BT.getConfig();
      cfg.savings.goalAmount           = parseFloat(document.getElementById('savGoal').value)    || 0;
      cfg.savings.monthlyContribution  = parseFloat(document.getElementById('savMonthly').value) || 0;
      cfg.savings.currentBalance       = parseFloat(document.getElementById('savCurrent').value) || 0;
      BT.saveConfig(cfg);
      showToast('Savings goal saved');
      refresh();
    });

    document.querySelectorAll('.toggle-primary-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cfg = BT.getConfig();
        const inc = cfg.incomes.find(i => i.id === btn.dataset.id);
        if (!inc) return;
        // Must keep at least one primary
        const primaryCount = cfg.incomes.filter(i => i.isPrimary !== false).length;
        if (inc.isPrimary !== false && primaryCount <= 1) {
          alert('At least one income source must be Primary.');
          return;
        }
        inc.isPrimary = !(inc.isPrimary !== false);
        BT.saveConfig(cfg);
        refresh();
      });
    });

    document.querySelectorAll('.edit-inc-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cfg = BT.getConfig();
        const inc = cfg.incomes.find(i => i.id === btn.dataset.id);
        if (!inc) return;
        const newAmt = parseFloat(prompt(`New amount for ${inc.name}:`, inc.amount));
        if (!isNaN(newAmt) && newAmt > 0) {
          inc.amount = newAmt;
          BT.saveConfig(cfg);
          refresh();
        }
      });
    });
  }

  function bindSetupSettings() {
    document.getElementById('saveSettingsBtn')?.addEventListener('click', () => {
      const cfg = BT.getConfig();
      cfg.settings.surplusWarningThreshold = parseFloat(document.getElementById('surplusThreshold').value) || 0;
      cfg.settings.planEndDate = document.getElementById('planEndDate').value || cfg.settings.planEndDate;
      BT.saveConfig(cfg);
      showToast('Settings saved');
      refresh();
    });

    document.getElementById('resetDataBtn')?.addEventListener('click', () => {
      if (confirm('Are you sure? This will erase ALL your budget data and cannot be undone.')) {
        BT.resetAll();
        showToast('All data reset');
        refresh();
      }
    });
  }

  // ══════════════════════════════════════════════════════════
  // TOAST NOTIFICATION
  // ══════════════════════════════════════════════════════════
  function showToast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('show'), 50);
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2500);
  }

  // ══════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════
  return { renderApp, refresh };

})();

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  BTUI.renderApp();
});
