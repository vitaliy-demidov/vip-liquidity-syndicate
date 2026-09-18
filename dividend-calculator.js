/**
 * VIP Liquidity Syndicate - Dividend & Risk Calculator Engine
 * Pure Modern JavaScript (Vanilla ES6+)
 * 
 * Specialization: Small-Market Arbitrage, Statistical Outliers & Prop-Liquidity Modeling
 * Focus: Fouls, Throw-ins, Shots on Target, Tennis Challengers/ITF vs Restrictive Limits
 * 
 * Features:
 * - Reactive state management for VIP Bookmakers (Stake, Sportsbet, Roobet, Winline VIP, Fonbet VIP)
 * - Dynamic order limits ($10k-$100k) & Monthly Trading Sessions
 * - 60fps requestAnimationFrame easing counter animations for smooth number transitions
 * - Dynamic glowing gradient slider track synchronization
 * - Institutional risk & dividend formulas (Bankroll scaling, EV session yield, 30% Whale Split, $0.00 Downside Risk)
 * - Dual compatibility with both Amber-Gold luxury and Cyan fintech design languages
 * - Seamless modal data transfer
 */

(function(window) {
  'use strict';

  // VIP Bookmaker configurations & risk parameters (Small-Market Liquidity Focus)
  const BOOKMAKERS = {
    'Stake': {
      id: 'Stake',
      name: 'Stake.com',
      tag: 'Platinum IV–Diamond',
      tier: 'Platinum IV–Diamond',
      badge: 'MAX LIMITS',
      bankrollMultiplier: 2.0,
      poolRange: '$25k – $50k+',
      roiPerSession: 0.10, // Консервативный ROI ~10% от пула аллокации за 60-мин сессию
      accentColor: '#D4AF37',
      liquidityFocus: 'Смолл-маркеты / Фолы / Челленджеры'
    },
    'Sportsbet': {
      id: 'Sportsbet',
      name: 'Sportsbet.io',
      tag: 'Clubhouse Legend',
      tier: 'Clubhouse Legend',
      badge: 'CLUBHOUSE LEGEND',
      bankrollMultiplier: 2.2,
      poolRange: '$35k – $70k+',
      roiPerSession: 0.10,
      accentColor: '#10B981',
      liquidityFocus: 'Ауты / Желтые карточки / ITF'
    },
    'Roobet': {
      id: 'Roobet',
      name: 'Roobet',
      tag: 'King Whale',
      tier: 'King Whale',
      badge: 'KING WHALE',
      bankrollMultiplier: 1.8,
      poolRange: '$20k – $45k+',
      roiPerSession: 0.10,
      accentColor: '#F59E0B',
      liquidityFocus: 'VIP Lounge / Смолл-маркеты'
    },
    'Winline': {
      id: 'Winline',
      name: 'Winline VIP',
      tag: 'Локальный VIP / Смолл-маркеты',
      tier: 'Локальный VIP',
      badge: 'LOCAL VIP',
      bankrollMultiplier: 2.0,
      poolRange: '₽2,000,000 – ₽5,000,000+ ($20k–$50k)',
      roiPerSession: 0.10,
      accentColor: '#FF5C00',
      liquidityFocus: 'Статистика РПЛ / Удары в створ / Фолы'
    },
    'Fonbet': {
      id: 'Fonbet',
      name: 'Fonbet VIP',
      tag: 'Премиум статус / Фолы и ауты',
      tier: 'Премиум статус',
      badge: 'PREMIUM VIP',
      bankrollMultiplier: 2.2,
      poolRange: '₽2,500,000 – ₽6,000,000+ ($25k–$60k)',
      roiPerSession: 0.10,
      accentColor: '#E11D48',
      liquidityFocus: 'Фолы и ауты / Челленджеры / Роспись'
    }
  };

  // Backwards-compatible aliases and flexible keys
  BOOKMAKERS['Stake.com'] = BOOKMAKERS['Stake'];
  BOOKMAKERS['Sportsbet.io'] = BOOKMAKERS['Sportsbet'];
  BOOKMAKERS['Winline VIP'] = BOOKMAKERS['Winline'];
  BOOKMAKERS['Fonbet VIP'] = BOOKMAKERS['Fonbet'];
  BOOKMAKERS['BC.Game'] = {
    id: 'BCGame',
    name: 'BC.Game',
    tag: 'SVIP 55+ Elite',
    tier: 'SVIP 55+',
    badge: 'SVIP 55+',
    bankrollMultiplier: 2.4,
    poolRange: '$50k – $120k+',
    roiPerSession: 0.10,
    accentColor: '#8B5CF6',
    liquidityFocus: 'Высокий Crypto Turnover'
  };
  BOOKMAKERS['BCGame'] = BOOKMAKERS['BC.Game'];

  // Active state
  const state = {
    selectedBK: 'Stake',
    confirmedLimit: 25000,
    monthlySessions: 8,
    whaleSplitRate: 0.30, // Strict 30% Whale Dividend
    sessionDurationMin: 60, // 60-минутная торговая сессия
    computed: {
      bankroll: 50000,
      sessionNetProfit: 5000,
      sessionWhaleDividend: 1500,
      monthlyWhaleDividend: 12000,
      downsideRisk: 0.00
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
   * Uses cubic ease-out to smoothly glide from current rendered number to target value.
   * Adaptive duration: instant/low-latency (45ms) during continuous dragging, smooth 380ms on release/presets.
   */
  function animateNumber(elementId, targetValue, options = {}) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const duration = options.duration !== undefined ? options.duration : 380;
    const prefix = options.prefix !== undefined ? options.prefix : '$';
    const suffix = options.suffix !== undefined ? options.suffix : '';
    const decimals = options.decimals || 0;

    if (activeRafs[elementId]) {
      caf(activeRafs[elementId]);
      delete activeRafs[elementId];
    }

    // Determine start value from dataset or text
    let startValue = 0;
    if (el.dataset.currentVal !== undefined) {
      startValue = parseFloat(el.dataset.currentVal) || 0;
    } else {
      const cleaned = el.innerText.replace(/[^0-9.-]/g, '');
      startValue = parseFloat(cleaned) || 0;
    }

    if (duration <= 0 || Math.abs(startValue - targetValue) < 0.001) {
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
      // Cubic ease-out: snappy start with soft deceleration
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

    slider.style.setProperty('--slider-pct', `${pct}%`);
    if (sliderId.includes('session')) {
      slider.style.background = `linear-gradient(to right, #10B981 0%, #059669 ${pct}%, #181B22 ${pct}%, #181B22 100%)`;
    } else {
      slider.style.background = `linear-gradient(to right, #D4AF37 0%, #F59E0B ${pct}%, #181B22 ${pct}%, #181B22 100%)`;
    }
  }

  /**
   * Recalculates all dependent financial outputs
   * @param {boolean} isScrubbing - true when called during continuous slider drag
   */
  function recalculate(isScrubbing = false) {
    const bk = BOOKMAKERS[state.selectedBK] || BOOKMAKERS['Stake'];
    const limit = state.confirmedLimit;
    const sessions = state.monthlySessions;

    // 1. Syndicate Bankroll Allocated = limit * bankrollMultiplier (rounded to $500)
    const rawBankroll = limit * bk.bankrollMultiplier;
    state.computed.bankroll = Math.round(rawBankroll / 500) * 500;

    // 2. Expected Net Profit per 60-min Session = Bankroll * conservative 10% ROI (rounded to $50)
    // Small-market inefficiency edge consistently generates ~8-12% net EV per 60m session
    const rawSessionProfit = state.computed.bankroll * (bk.roiPerSession || 0.10);
    state.computed.sessionNetProfit = Math.round(rawSessionProfit / 50) * 50;

    // 3. Whale Dividend (Strict 30% Split in USDT)
    state.computed.sessionWhaleDividend = Math.round(state.computed.sessionNetProfit * state.whaleSplitRate);
    state.computed.monthlyWhaleDividend = state.computed.sessionWhaleDividend * sessions;

    // 4. Downside Risk to Whale is strictly $0.00
    // Mathematical Proof: Whale personal balance is zeroed ($0.00) before start.
    // Syndicate deposits 100% of trading liquidity. Drawdown exposure = 0.
    state.computed.downsideRisk = 0.00;

    renderOutputs(isScrubbing);
  }

  /**
   * Renders calculated outputs with animated counters and contextual badges
   * @param {boolean} isScrubbing - true when called during continuous slider drag
   */
  function renderOutputs(isScrubbing = false) {
    const bk = BOOKMAKERS[state.selectedBK] || BOOKMAKERS['Stake'];
    const animDuration = isScrubbing ? 45 : 380;

    // Limit ceiling display (supports both standard and demo IDs)
    animateNumber('limit-val-display', state.confirmedLimit, { prefix: '$', suffix: '', duration: animDuration });
    const altLimitDisplay = document.getElementById('display-limit');
    if (altLimitDisplay && altLimitDisplay.id !== 'limit-val-display') {
      animateNumber('display-limit', state.confirmedLimit, { prefix: '$', suffix: '', duration: animDuration });
    }
    
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

    // Sessions display (supports both standard and demo IDs)
    const sessionsDisplay = document.getElementById('sessions-val-display');
    if (sessionsDisplay) {
      sessionsDisplay.innerText = `${state.monthlySessions} ${getRussianSessionPlural(state.monthlySessions)}`;
    }
    const altSessionsDisplay = document.getElementById('display-sessions');
    if (altSessionsDisplay) {
      altSessionsDisplay.innerText = `${state.monthlySessions} ${getRussianSessionPlural(state.monthlySessions)}`;
    }

    const sessionsCadence = document.getElementById('sessions-cadence-label');
    if (sessionsCadence) {
      const timesPerWeek = (state.monthlySessions / 4).toFixed(1).replace('.0', '');
      sessionsCadence.innerText = `~${timesPerWeek}x в неделю`;
    }

    // Bankroll ratio badge: Multiplier & Pool Range
    const ratioBadge = document.getElementById('bankroll-ratio-badge');
    if (ratioBadge) {
      ratioBadge.innerText = `x${bk.bankrollMultiplier.toFixed(1)} ордера (${bk.poolRange})`;
    }

    // Session Yield ROI badge
    const evBadge = document.getElementById('ev-edge-badge');
    if (evBadge) {
      evBadge.innerText = `ROI ~${((bk.roiPerSession || 0.10) * 100).toFixed(0)}% от пула`;
    }

    // 1. Syndicate Bankroll Output
    animateNumber('res-bankroll', state.computed.bankroll, { prefix: '$', suffix: ' USDT', duration: animDuration });

    // 2. Expected Net Profit per 60-min Session
    animateNumber('res-session-profit', state.computed.sessionNetProfit, { prefix: '$', suffix: ' USDT', duration: animDuration });

    // 3. Whale Dividend (30% Split) - Hero Monthly Output
    animateNumber('res-whale-dividend', state.computed.monthlyWhaleDividend, { prefix: '$', suffix: ' USDT', duration: animDuration });

    // Whale Dividend Breakdown - Per 60-min Session
    animateNumber('res-session-dividend', state.computed.sessionWhaleDividend, { prefix: '+$', suffix: ' USDT', duration: animDuration });

    // 4. Downside Risk to Whale ($0.00 Guaranteed Zero Exposure)
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
    const bk = BOOKMAKERS[bkName];
    const canonicalKey = bk.id || bkName;
    state.selectedBK = canonicalKey;

    // Update label
    const labelEl = document.getElementById('selected-bk-label');
    if (labelEl) {
      labelEl.innerText = `${bk.name} (${bk.tag})`;
    }

    // Update UI card classes across all rendered bookmakers (supports both themes)
    const buttons = document.querySelectorAll('.bk-card');
    buttons.forEach(btn => {
      const btnId = btn.id || '';
      const onclickAttr = btn.getAttribute('onclick') || '';
      const isMatch = btnId === `bk-btn-${canonicalKey}` ||
                      btnId === `bk-btn-${bkName}` ||
                      btnId === `bk-btn-${canonicalKey.replace('.', '')}` ||
                      btnId === `bk-btn-${canonicalKey.replace('.io', '')}` ||
                      btnId === `bk-btn-${bk.name}` ||
                      onclickAttr.includes(`'${canonicalKey}'`) ||
                      onclickAttr.includes(`'${bkName}'`) ||
                      onclickAttr.includes(`'${bk.name}'`);
      
      const dot = btn.querySelector('.rounded-full');
      const isAmber = btn.classList.contains('border-amber-400') ||
                      btn.classList.contains('bg-amber-500/10') ||
                      document.querySelector('.gold-foil-text') ||
                      btn.closest('#bookmaker-selector')?.classList.contains('amber-theme');

      if (isMatch) {
        if (isAmber) {
          btn.className = 'bk-card active text-left p-3.5 rounded-xl border transition-all relative flex flex-col justify-between h-24 bg-amber-500/10 border-amber-400 shadow-[0_0_20px_rgba(212,175,55,0.25)] ring-1 ring-amber-400/50';
          if (dot) dot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-pulse';
        } else {
          btn.className = 'bk-card active text-left p-3.5 rounded-xl border transition-all relative flex flex-col justify-between h-24 bg-brand-surfaceLight border-brand-cyan shadow-[0_0_20px_rgba(0,240,255,0.25)] ring-1 ring-brand-cyan/50';
          if (dot) dot.className = 'w-2 h-2 rounded-full bg-brand-cyan animate-pulse';
        }
      } else {
        if (isAmber) {
          btn.className = 'bk-card text-left p-3.5 rounded-xl border transition-all relative flex flex-col justify-between h-24 bg-white/[0.02] border-white/[0.08] hover:border-amber-400/40';
          if (dot) dot.className = 'w-2 h-2 rounded-full bg-slate-600';
        } else {
          btn.className = 'bk-card text-left p-3.5 rounded-xl border transition-all relative flex flex-col justify-between h-24 bg-brand-surface border-brand-surfaceBorder hover:border-brand-muted/50';
          if (dot) dot.className = 'w-2 h-2 rounded-full bg-slate-600';
        }
      }
    });

    if (window.SyndicateAudio && typeof window.SyndicateAudio.playMechanicalSwitch === 'function') {
      window.SyndicateAudio.playMechanicalSwitch();
    }

    recalculate();
  }

  /**
   * Action: Handle Limit Slider Input (Continuous drag)
   */
  function handleLimitSlider(val) {
    state.confirmedLimit = parseInt(val, 10);
    ['limit-slider', 'calc-limit-slider'].forEach(id => {
      const el = document.getElementById(id);
      if (el && parseInt(el.value, 10) !== state.confirmedLimit) {
        el.value = state.confirmedLimit;
      }
      updateSliderGlow(id);
    });
    updatePresetHighlight();
    recalculate(true);
  }

  /**
   * Action: Handle Limit Slider Change (Release of slider thumb)
   */
  function handleLimitSliderChange() {
    recalculate(false);
  }

  /**
   * Action: Set Limit via Preset Chip
   */
  function setLimitPreset(val) {
    state.confirmedLimit = parseInt(val, 10);
    ['limit-slider', 'calc-limit-slider'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.value = state.confirmedLimit;
        updateSliderGlow(id);
      }
    });
    updatePresetHighlight();
    if (window.SyndicateAudio && typeof window.SyndicateAudio.playHapticClick === 'function') {
      window.SyndicateAudio.playHapticClick({ pitch: 1.2 });
    }
    recalculate(false);
  }

  function updatePresetHighlight() {
    const buttons = document.querySelectorAll('.limit-preset-btn, [onclick*="setLimitPreset"]');
    buttons.forEach(btn => {
      let btnVal = parseInt(btn.dataset.val, 10);
      if (isNaN(btnVal)) {
        const match = btn.getAttribute('onclick')?.match(/setLimitPreset\((\d+)\)/);
        if (match) btnVal = parseInt(match[1], 10);
      }
      if (isNaN(btnVal)) return;

      const isAmber = btn.classList.contains('hover:border-amber-400/50') ||
                      document.querySelector('.gold-foil-text');

      if (btnVal === state.confirmedLimit) {
        if (isAmber) {
          btn.className = 'limit-preset-btn active px-2.5 py-1 rounded bg-amber-500/20 border border-amber-400 text-[11px] font-mono font-features-tabular text-amber-200 font-bold shadow-[0_0_10px_rgba(212,175,55,0.25)] transition-colors';
        } else {
          btn.className = 'limit-preset-btn active px-2.5 py-1 rounded bg-brand-cyan/20 border border-brand-cyan text-xs font-mono text-brand-cyan font-bold shadow-[0_0_10px_rgba(0,240,255,0.2)] transition-colors';
        }
      } else {
        if (isAmber) {
          btn.className = 'limit-preset-btn px-2.5 py-1 rounded bg-white/[0.04] border border-white/[0.08] hover:border-amber-400/50 hover:text-amber-200 text-[11px] font-mono font-features-tabular text-white transition-colors';
        } else {
          btn.className = 'limit-preset-btn px-2.5 py-1 rounded bg-brand-surfaceLight hover:bg-brand-surfaceBorder border border-brand-surfaceBorder text-xs font-mono text-brand-muted hover:text-white transition-colors';
        }
      }
    });
  }

  /**
   * Action: Handle Sessions Slider Input (Continuous drag)
   */
  function handleSessionsSlider(val) {
    state.monthlySessions = parseInt(val, 10);
    ['sessions-slider', 'calc-sessions-slider'].forEach(id => {
      const el = document.getElementById(id);
      if (el && parseInt(el.value, 10) !== state.monthlySessions) {
        el.value = state.monthlySessions;
      }
      updateSliderGlow(id);
    });
    updateSessionPresetHighlight();
    recalculate(true);
  }

  /**
   * Action: Handle Sessions Slider Change (Release)
   */
  function handleSessionsSliderChange() {
    recalculate(false);
  }

  /**
   * Action: Set Sessions via Preset Chip
   */
  function setSessionsPreset(val) {
    state.monthlySessions = parseInt(val, 10);
    ['sessions-slider', 'calc-sessions-slider'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.value = state.monthlySessions;
        updateSliderGlow(id);
      }
    });
    updateSessionPresetHighlight();
    if (window.SyndicateAudio && typeof window.SyndicateAudio.playHapticClick === 'function') {
      window.SyndicateAudio.playHapticClick({ pitch: 1.1 });
    }
    recalculate(false);
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
      let btnVal = parseInt(btn.dataset.sessions, 10);
      if (isNaN(btnVal)) {
        const match = btn.getAttribute('onclick')?.match(/setSessionsPreset\((\d+)\)/);
        if (match) btnVal = parseInt(match[1], 10);
      }
      if (isNaN(btnVal)) return;

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
        limit: limitFormatted,
        pool: bankrollFormatted,
        dividend: dividendFormatted
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
      summaryRisk.innerText = '$0.00 (Zero Exposure: 100% депозит синдиката)';
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
    ['limit-slider', 'calc-limit-slider', 'sessions-slider', 'calc-sessions-slider'].forEach(updateSliderGlow);
    selectBookmaker(state.selectedBK);
    updatePresetHighlight();
    updateSessionPresetHighlight();
    recalculate(false);

    // Dynamic event binding for calc- prefixed elements if not bound inline
    const calcLimit = document.getElementById('calc-limit-slider');
    if (calcLimit && !calcLimit.dataset.calcBound) {
      calcLimit.dataset.calcBound = 'true';
      calcLimit.addEventListener('input', (e) => handleLimitSlider(e.target.value));
      calcLimit.addEventListener('change', () => handleLimitSliderChange());
    }

    const calcSessions = document.getElementById('calc-sessions-slider');
    if (calcSessions && !calcSessions.dataset.calcBound) {
      calcSessions.dataset.calcBound = 'true';
      calcSessions.addEventListener('input', (e) => handleSessionsSlider(e.target.value));
      calcSessions.addEventListener('change', () => handleSessionsSliderChange());
    }
  }

  // Export public API to window
  const DividendCalculator = {
    BOOKMAKERS,
    getState: () => ({ ...state, computed: { ...state.computed } }),
    selectBookmaker,
    handleLimitSlider,
    handleLimitSliderChange,
    setLimitPreset,
    handleSessionsSlider,
    handleSessionsSliderChange,
    setSessionsPreset,
    adjustSessions,
    transferCalculatorToModal,
    updateSliderGlow,
    recalculate,
    init
  };

  window.DividendCalculator = DividendCalculator;
  window.DIVIDEND_CALCULATOR = DividendCalculator;

  // Make globally available for inline onclick handlers
  window.selectBookmaker = selectBookmaker;
  window.handleLimitSlider = handleLimitSlider;
  window.handleLimitSliderChange = handleLimitSliderChange;
  window.setLimitPreset = setLimitPreset;
  window.handleSessionsSlider = handleSessionsSlider;
  window.handleSessionsSliderChange = handleSessionsSliderChange;
  window.setSessionsPreset = setSessionsPreset;
  window.adjustSessions = adjustSessions;
  window.transferCalculatorToModal = transferCalculatorToModal;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window);
