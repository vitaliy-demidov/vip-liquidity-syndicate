/**
 * VIP Liquidity Syndicate - Dividend & Risk Calculator Engine
 * Pure Modern JavaScript (Vanilla ES6+)
 * 
 * Features:
 * - Reactive state management for VIP Bookmakers, Limits ($10k-$100k), and Monthly Sessions
 * - 60fps requestAnimationFrame easing counter animations for smooth number transitions
 * - Dynamic glowing gradient slider track synchronization
 * - Institutional risk & dividend formulas (Bankroll scaling, EV session yield, 30% Whale Split, $0.00 Downside Risk)
 * - Seamless modal data transfer
 */

(function(window) {
  'use strict';

  // Bookmaker configurations & risk parameters
  const BOOKMAKERS = {
    'Stake': {
      name: 'Stake',
      tag: 'Tier 1 Liquidity',
      tier: 'Plat IV – Diamond',
      badge: 'MAX LIMITS',
      bankrollMultiplier: 2.5,
      evMargin: 0.12, // 12% EV margin per session
      accentColor: '#00F0FF',
      liquidityFocus: 'Soft Football / NBA'
    },
    'Sportsbet.io': {
      name: 'Sportsbet.io',
      tag: 'Clubhouse VIP',
      tier: 'Whale Clubhouse',
      badge: 'CLUBHOUSE',
      bankrollMultiplier: 2.4,
      evMargin: 0.115, // 11.5% EV margin per session
      accentColor: '#10B981',
      liquidityFocus: 'EPL & Champions League'
    },
    'BC.Game': {
      name: 'BC.Game',
      tag: 'SVIP 50+ Elite',
      tier: 'SVIP Whale Elite',
      badge: 'SVIP 50+',
      bankrollMultiplier: 2.3,
      evMargin: 0.11, // 11% EV margin per session
      accentColor: '#A855F7',
      liquidityFocus: 'Высокий Crypto Turnover'
    },
    'Roobet': {
      name: 'Roobet',
      tag: 'Obsidian Desk',
      tier: 'Obsidian / High Roller',
      badge: 'OBSIDIAN',
      bankrollMultiplier: 2.2,
      evMargin: 0.105, // 10.5% EV margin per session
      accentColor: '#F59E0B',
      liquidityFocus: 'Private Sports Lounge'
    }
  };

  // Active state
  const state = {
    selectedBK: 'Stake',
    confirmedLimit: 25000,
    monthlySessions: 8,
    whaleSplitRate: 0.30, // Fixed 30% Whale Dividend
    computed: {
      bankroll: 62500,
      sessionNetProfit: 3000,
      sessionWhaleDividend: 900,
      monthlyWhaleDividend: 7200,
      downsideRisk: 0
    }
  };

  // Animation RAF storage to avoid animation conflicts
  const activeRafs = {};

  // Safe requestAnimationFrame & cancelAnimationFrame bindings
  const raf = (typeof window !== 'undefined' && window.requestAnimationFrame) 
    ? window.requestAnimationFrame.bind(window) 
    : ((cb) => setTimeout(cb, 16));
  const caf = (typeof window !== 'undefined' && window.cancelAnimationFrame) 
    ? window.cancelAnimationFrame.bind(window) 
    : ((id) => clearTimeout(id));

  /**
   * Smooth number counter animator
   * Uses cubic ease-out to smoothly glide from current rendered number to target value
   */
  function animateNumber(elementId, targetValue, options = {}) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const duration = options.duration || 450;
    const prefix = options.prefix !== undefined ? options.prefix : '$';
    const suffix = options.suffix !== undefined ? options.suffix : '';
    const decimals = options.decimals || 0;

    if (activeRafs[elementId]) {
      caf(activeRafs[elementId]);
    }

    // Determine start value from dataset or text
    let startValue = 0;
    if (el.dataset.currentVal !== undefined) {
      startValue = parseFloat(el.dataset.currentVal) || 0;
    } else {
      const cleaned = el.innerText.replace(/[^0-9.-]/g, '');
      startValue = parseFloat(cleaned) || 0;
    }

    if (startValue === targetValue) {
      const formatted = decimals > 0 
        ? targetValue.toFixed(decimals) 
        : targetValue.toLocaleString('en-US');
      el.innerText = `${prefix}${formatted}${suffix}`;
      el.dataset.currentVal = targetValue;
      return;
    }

    const startTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Cubic ease-out: fast start, soft landing
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (targetValue - startValue) * ease;

      const formatted = decimals > 0 
        ? current.toFixed(decimals) 
        : Math.round(current).toLocaleString('en-US');

      el.innerText = `${prefix}${formatted}${suffix}`;
      el.dataset.currentVal = current;

      if (progress < 1) {
        activeRafs[elementId] = raf(step);
      } else {
        const finalFormatted = decimals > 0 
          ? targetValue.toFixed(decimals) 
          : targetValue.toLocaleString('en-US');
        el.innerText = `${prefix}${finalFormatted}${suffix}`;
        el.dataset.currentVal = targetValue;
        delete activeRafs[elementId];
      }
    }

    activeRafs[elementId] = raf(step);
  }

  /**
   * Updates range slider glowing fill dynamically
   */
  function updateSliderGlow(sliderId) {
    const slider = document.getElementById(sliderId);
    if (!slider) return;

    const min = parseFloat(slider.min) || 0;
    const max = parseFloat(slider.max) || 100;
    const val = parseFloat(slider.value) || 0;
    const pct = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));

    slider.style.background = `linear-gradient(to right, #00F0FF 0%, #00F0FF ${pct}%, #1E2638 ${pct}%, #1E2638 100%)`;
  }

  /**
   * Recalculates all dependent financial outputs
   */
  function recalculate() {
    const bk = BOOKMAKERS[state.selectedBK] || BOOKMAKERS['Stake'];
    const limit = state.confirmedLimit;
    const sessions = state.monthlySessions;

    // 1. Syndicate Bankroll Allocated = limit * bankrollMultiplier (rounded to $500)
    const rawBankroll = limit * bk.bankrollMultiplier;
    state.computed.bankroll = Math.round(rawBankroll / 500) * 500;

    // 2. Expected Net Profit per Session = limit * EV margin (rounded to $50)
    const rawSessionProfit = limit * bk.evMargin;
    state.computed.sessionNetProfit = Math.round(rawSessionProfit / 50) * 50;

    // 3. Whale Dividend (30% Split in USDT)
    state.computed.sessionWhaleDividend = Math.round(state.computed.sessionNetProfit * state.whaleSplitRate);
    state.computed.monthlyWhaleDividend = state.computed.sessionWhaleDividend * sessions;

    // 4. Downside Risk to Whale is strictly $0.00
    state.computed.downsideRisk = 0.00;

    renderOutputs();
  }

  /**
   * Renders calculated outputs with animated counters
   */
  function renderOutputs() {
    const bk = BOOKMAKERS[state.selectedBK] || BOOKMAKERS['Stake'];

    // Limit ceiling display
    animateNumber('limit-val-display', state.confirmedLimit, { prefix: '$', suffix: '' });
    
    // Tier badge update
    const tierBadge = document.getElementById('tier-badge-display');
    if (tierBadge) {
      if (state.confirmedLimit >= 75000) {
        tierBadge.innerText = 'WHALE PRIME';
        tierBadge.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-brand-cyan/20 border border-brand-cyan text-brand-cyan font-bold shadow-[0_0_10px_rgba(0,240,255,0.3)] hidden sm:inline-block';
      } else if (state.confirmedLimit >= 40000) {
        tierBadge.innerText = 'HIGH-ROLLER';
        tierBadge.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-brand-cyan/10 border border-brand-cyan/40 text-brand-cyan hidden sm:inline-block';
      } else {
        tierBadge.innerText = 'VIP TIER 1';
        tierBadge.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 border border-brand-surfaceBorder text-brand-muted hidden sm:inline-block';
      }
    }

    // Sessions display
    const sessionsDisplay = document.getElementById('sessions-val-display');
    if (sessionsDisplay) {
      sessionsDisplay.innerText = `${state.monthlySessions} ${getRussianSessionPlural(state.monthlySessions)}`;
    }

    const sessionsCadence = document.getElementById('sessions-cadence-label');
    if (sessionsCadence) {
      const timesPerWeek = (state.monthlySessions / 4).toFixed(1).replace('.0', '');
      sessionsCadence.innerText = `~${timesPerWeek}x в неделю`;
    }

    // Bankroll ratio badge
    const ratioBadge = document.getElementById('bankroll-ratio-badge');
    if (ratioBadge) {
      ratioBadge.innerText = `${bk.bankrollMultiplier.toFixed(1)}x лимита`;
    }

    // EV Edge badge
    const evBadge = document.getElementById('ev-edge-badge');
    if (evBadge) {
      evBadge.innerText = `EV edge ~${(bk.evMargin * 100).toFixed(1)}%`;
    }

    // 1. Syndicate Bankroll Output
    animateNumber('res-bankroll', state.computed.bankroll, { prefix: '$', suffix: ' USDT' });

    // 2. Expected Net Profit per Session
    animateNumber('res-session-profit', state.computed.sessionNetProfit, { prefix: '$', suffix: ' USDT' });

    // 3. Whale Dividend (30% Split) - Hero Monthly
    animateNumber('res-whale-dividend', state.computed.monthlyWhaleDividend, { prefix: '$', suffix: ' USDT' });

    // Whale Dividend Breakdown - Per Session
    animateNumber('res-session-dividend', state.computed.sessionWhaleDividend, { prefix: '+$', suffix: ' USDT' });

    // 4. Downside Risk to Whale ($0.00)
    const riskEl = document.getElementById('res-downside-risk');
    if (riskEl) {
      riskEl.innerText = '$0.00';
    }
  }

  function getRussianSessionPlural(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 19) return 'сессий';
    if (mod10 === 1) return 'сессия';
    if (mod10 >= 2 && mod10 <= 4) return 'сессии';
    return 'сессий';
  }

  /**
   * Action: Select VIP Bookmaker
   */
  function selectBookmaker(bkName) {
    if (!BOOKMAKERS[bkName]) return;
    state.selectedBK = bkName;

    // Update label
    const labelEl = document.getElementById('selected-bk-label');
    if (labelEl) {
      labelEl.innerText = `${bkName} (${BOOKMAKERS[bkName].tag})`;
    }

    // Update UI card classes
    Object.keys(BOOKMAKERS).forEach(name => {
      const btn = document.getElementById(`bk-btn-${name}`);
      if (!btn) return;
      const dot = btn.querySelector('.rounded-full');

      if (name === bkName) {
        btn.className = 'bk-card active text-left p-3.5 rounded-xl border transition-all relative flex flex-col justify-between h-24 bg-brand-surfaceLight border-brand-cyan shadow-[0_0_20px_rgba(0,240,255,0.25)] ring-1 ring-brand-cyan/50';
        if (dot) {
          dot.className = 'w-2 h-2 rounded-full bg-brand-cyan animate-pulse';
        }
      } else {
        btn.className = 'bk-card text-left p-3.5 rounded-xl border transition-all relative flex flex-col justify-between h-24 bg-brand-surface border-brand-surfaceBorder hover:border-brand-muted/50';
        if (dot) {
          dot.className = 'w-2 h-2 rounded-full bg-slate-600';
        }
      }
    });

    recalculate();
  }

  /**
   * Action: Handle Limit Slider Input
   */
  function handleLimitSlider(val) {
    state.confirmedLimit = parseInt(val, 10);
    updateSliderGlow('limit-slider');
    updatePresetHighlight();
    recalculate();
  }

  /**
   * Action: Set Limit via Preset Chip
   */
  function setLimitPreset(val) {
    state.confirmedLimit = parseInt(val, 10);
    const slider = document.getElementById('limit-slider');
    if (slider) {
      slider.value = state.confirmedLimit;
    }
    updateSliderGlow('limit-slider');
    updatePresetHighlight();
    recalculate();
  }

  function updatePresetHighlight() {
    const buttons = document.querySelectorAll('.limit-preset-btn');
    buttons.forEach(btn => {
      const btnVal = parseInt(btn.dataset.val, 10);
      if (btnVal === state.confirmedLimit) {
        btn.className = 'limit-preset-btn active px-2.5 py-1 rounded bg-brand-cyan/20 border border-brand-cyan text-xs font-mono text-brand-cyan font-bold shadow-[0_0_10px_rgba(0,240,255,0.2)] transition-colors';
      } else {
        btn.className = 'limit-preset-btn px-2.5 py-1 rounded bg-brand-surfaceLight hover:bg-brand-surfaceBorder border border-brand-surfaceBorder text-xs font-mono text-brand-muted hover:text-white transition-colors';
      }
    });
  }

  /**
   * Action: Handle Sessions Slider Input
   */
  function handleSessionsSlider(val) {
    state.monthlySessions = parseInt(val, 10);
    updateSliderGlow('sessions-slider');
    updateSessionPresetHighlight();
    recalculate();
  }

  /**
   * Action: Set Sessions via Preset Chip
   */
  function setSessionsPreset(val) {
    state.monthlySessions = parseInt(val, 10);
    const slider = document.getElementById('sessions-slider');
    if (slider) {
      slider.value = state.monthlySessions;
    }
    updateSliderGlow('sessions-slider');
    updateSessionPresetHighlight();
    recalculate();
  }

  /**
   * Action: Adjust Sessions (+1 or -1)
   */
  function adjustSessions(delta) {
    let next = state.monthlySessions + delta;
    if (next < 2) next = 2;
    if (next > 24) next = 24;
    setSessionsPreset(next);
  }

  function updateSessionPresetHighlight() {
    const buttons = document.querySelectorAll('.session-preset-btn');
    buttons.forEach(btn => {
      const btnVal = parseInt(btn.dataset.sessions, 10);
      const title = btn.querySelector('.font-bold');
      const sub = btn.querySelector('div:last-child');
      if (btnVal === state.monthlySessions) {
        btn.className = 'session-preset-btn active px-2.5 py-2 rounded-lg border border-brand-cyan/60 bg-brand-cyan/15 text-xs font-mono text-brand-cyan text-center transition-all shadow-[0_0_15px_rgba(0,240,255,0.2)]';
        if (title) title.className = 'font-bold text-brand-cyan';
        if (sub) sub.className = 'text-[10px] text-brand-cyan/80';
      } else {
        btn.className = 'session-preset-btn px-2.5 py-2 rounded-lg border border-brand-surfaceBorder bg-brand-surface hover:border-brand-muted/50 text-xs font-mono text-brand-muted text-center transition-all';
        if (title) title.className = 'font-bold text-white';
        if (sub) sub.className = 'text-[10px] text-brand-muted';
      }
    });
  }

  /**
   * Action: 'Забронировать слот аллокации'
   * Passes computed parameters to modal and opens it
   */
  function transferCalculatorToModal() {
    if (window.SyndicateAudio) {
      window.SyndicateAudio.playPayoutConfirmation();
    }

    const bk = BOOKMAKERS[state.selectedBK] || BOOKMAKERS['Stake'];
    const limitFormatted = '$' + state.confirmedLimit.toLocaleString('en-US');
    const bankrollFormatted = '$' + state.computed.bankroll.toLocaleString('en-US') + ' USDT';
    const dividendFormatted = '$' + state.computed.monthlyWhaleDividend.toLocaleString('en-US') + ' USDT';
    const sessionDivFormatted = '+$' + state.computed.sessionWhaleDividend.toLocaleString('en-US') + ' USDT';

    // Check if institutional multi-step modal VIPConcierge is available
    if (typeof VIPConcierge !== 'undefined') {
      VIPConcierge.open({
        bk: state.selectedBK,
        tier: bk.tier,
        limit: limitFormatted
      });
      return;
    }

    // 1. Update traditional input fields in fallback modal form
    const bkInput = document.getElementById('modal-bk-input');
    if (bkInput) {
      bkInput.value = `${bk.name} (${bk.tier})`;
    }

    const limitInput = document.getElementById('modal-limit-input');
    if (limitInput) {
      limitInput.value = `${limitFormatted} (Банкролл: ${bankrollFormatted}, ${state.monthlySessions} сессий/мес)`;
    }

    // 2. Update dedicated Allocation Slot Summary in Modal (if present)
    const summaryBk = document.getElementById('modal-summary-bk');
    if (summaryBk) summaryBk.innerText = `${bk.name} • ${bk.badge}`;

    const summaryLimit = document.getElementById('modal-summary-limit');
    if (summaryLimit) summaryLimit.innerText = limitFormatted;

    const summaryBankroll = document.getElementById('modal-summary-bankroll');
    if (summaryBankroll) summaryBankroll.innerText = bankrollFormatted;

    const summarySessions = document.getElementById('modal-summary-sessions');
    if (summarySessions) {
      summarySessions.innerText = `${state.monthlySessions} сессий / месяц`;
    }

    const summaryDividend = document.getElementById('modal-summary-dividend');
    if (summaryDividend) {
      summaryDividend.innerText = `${dividendFormatted} / мес (${sessionDivFormatted}/сессия)`;
    }

    const summaryRisk = document.getElementById('modal-summary-risk');
    if (summaryRisk) {
      summaryRisk.innerText = '$0.00 (Zero Exposure)';
    }

    // 3. Open Fallback Modal
    if (typeof window.openAuditModal === 'function') {
      window.openAuditModal('calculator_slot_reservation');
    } else {
      const modal = document.getElementById('audit-modal');
      if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => modal.classList.remove('opacity-0'), 10);
      }
    }
  }

  /**
   * Initialize on DOM Ready
   */
  function init() {
    updateSliderGlow('limit-slider');
    updateSliderGlow('sessions-slider');
    selectBookmaker(state.selectedBK);
    updatePresetHighlight();
    updateSessionPresetHighlight();
    recalculate();
  }

  // Export public API to window
  const DividendCalculator = {
    BOOKMAKERS,
    getState: () => ({ ...state, computed: { ...state.computed } }),
    selectBookmaker,
    handleLimitSlider,
    setLimitPreset,
    handleSessionsSlider,
    setSessionsPreset,
    adjustSessions,
    transferCalculatorToModal,
    updateSliderGlow,
    recalculate,
    init
  };

  window.DividendCalculator = DividendCalculator;

  // Make globally available for inline onclick handlers
  window.selectBookmaker = selectBookmaker;
  window.handleLimitSlider = handleLimitSlider;
  window.setLimitPreset = setLimitPreset;
  window.handleSessionsSlider = handleSessionsSlider;
  window.setSessionsPreset = setSessionsPreset;
  window.adjustSessions = adjustSessions;
  window.transferCalculatorToModal = transferCalculatorToModal;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window);
