/**
 * VIP Concierge Application & Audit Modal Engine
 * Multi-step Institutional Qualification Flow for Whales & High-Rollers
 * 
 * Steps:
 * 1. Bookmaker selection & current VIP Tier (Stake Platinum, Clubhouse, BC.Game SVIP)
 * 2. Limit confirmation (Prompt to check 1X2 limit on EPL/UCL)
 * 3. Physical Session Location / Format preference (VIP Lounge Moscow/Dubai or Secure Browser Session)
 * 4. Non-custodial wallet address or Telegram handle for private dispatch
 * 5. Instant Ticket Generation, Direct Telegram Link & Webhook Dispatch
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.VIPConcierge = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Configuration defaults
  const DEFAULT_CONFIG = {
    tgDeskUsername: 'syndicate_vip_desk',
    webhookUrl: '/api/audit-request',
    containerId: 'vip-concierge-modal-container',
    onComplete: null,
    onStepChange: null
  };

  // Bookmakers and their respective VIP tiers with estimated allocation pools
  const BOOKMAKER_DATA = {
    'Stake': {
      name: 'Stake.com',
      badge: 'STAKE PLATINUM / DIAMOND',
      iconColor: '#00F0FF',
      tiers: [
        { id: 'plat_1_3', name: 'Platinum I – III', pool: '$10,000 – $25,000', split: '30%' },
        { id: 'plat_4', name: 'Platinum IV', pool: '$25,000 – $50,000', split: '35%', recommended: true },
        { id: 'plat_5_6', name: 'Platinum V – VI', pool: '$50,000 – $80,000', split: '35%' },
        { id: 'diamond', name: 'Diamond I – V', pool: '$80,000 – $150,000+', split: '40%' },
        { id: 'obsidian', name: 'Obsidian Whale', pool: '$150,000+ Custom Desk', split: '40%' }
      ]
    },
    'Sportsbet': {
      name: 'Sportsbet.io',
      badge: 'CLUBHOUSE VIP',
      iconColor: '#10B981',
      tiers: [
        { id: 'sb_hero', name: 'Clubhouse Hero', pool: '$15,000 – $30,000', split: '30%' },
        { id: 'sb_legend', name: 'Clubhouse Legend', pool: '$35,000 – $70,000', split: '35%', recommended: true },
        { id: 'sb_master', name: 'Clubhouse Master', pool: '$70,000 – $150,000+', split: '40%' }
      ]
    },
    'BCGame': {
      name: 'BC.Game',
      badge: 'SVIP WHALE CLUB',
      iconColor: '#F59E0B',
      tiers: [
        { id: 'bc_svip1_30', name: 'SVIP 1 – 30', pool: '$10,000 – $25,000', split: '30%' },
        { id: 'bc_svip31_50', name: 'SVIP 31 – 50', pool: '$25,000 – $60,000', split: '35%', recommended: true },
        { id: 'bc_svip55_plus', name: 'SVIP 55+ Top Whale', pool: '$60,000 – $120,000+', split: '40%' }
      ]
    },
    'Roobet': {
      name: 'Roobet',
      badge: 'ROOBET VIP LOUNGE',
      iconColor: '#EC4899',
      tiers: [
        { id: 'roo_silver_gold', name: 'VIP Silver / Gold', pool: '$10,000 – $25,000', split: '30%' },
        { id: 'roo_platinum', name: 'VIP Platinum', pool: '$25,000 – $50,000', split: '35%', recommended: true },
        { id: 'roo_king', name: 'Roobet King Tier', pool: '$50,000 – $100,000+', split: '40%' }
      ]
    },
    'Cloudbet': {
      name: 'Cloudbet',
      badge: 'CRYPTO HIGH-ROLLER',
      iconColor: '#8B5CF6',
      tiers: [
        { id: 'cb_gold', name: 'VIP Gold / Emerald', pool: '$15,000 – $35,000', split: '30%' },
        { id: 'cb_diamond', name: 'Diamond / Ruby Club', pool: '$35,000 – $80,000+', split: '35%', recommended: true }
      ]
    },
    'Other': {
      name: 'Другой крипто-букмекер',
      badge: 'PRIVATE SYNDICATE DESK',
      iconColor: '#00F0FF',
      tiers: [
        { id: 'other_20k', name: 'High-Roller (Минус $20,000+)', pool: '$15,000 – $35,000', split: '30%' },
        { id: 'other_50k', name: 'Whale (Минус $50,000+)', pool: '$35,000 – $80,000', split: '35%', recommended: true },
        { id: 'other_100k', name: 'Institutional (-$100,000+)', pool: '$80,000 – $200,000+', split: '40%' }
      ]
    }
  };

  // Session formats
  const SESSION_FORMATS = [
    {
      id: 'dubai_lounge',
      name: 'VIP Lounge Dubai (DIFC / Downtown)',
      badge: '📍 DUBAI DIFC • НЕКАСТОДИАЛЬНЫЙ ПРОТОКОЛ',
      icon: 'map-pin',
      desc: 'Закрытый переговорный офис в Дубае (DIFC). Некастодиальный протокол: телефон за 60 минут ни разу не касается чужих рук. Институциональный пул $10,000–$50,000+, фиксация сплита 70/30 на месте.'
    },
    {
      id: 'moscow_lounge',
      name: 'VIP Lounge Москва (Москва-Сити)',
      badge: '📍 МОСКВА-СИТИ • ЗАКРЫТЫЙ ЛАУНЖ',
      icon: 'building-2',
      desc: 'Закрытый VIP-лаундж в Москва-Сити. Некастодиальный протокол: устройство строго в ваших руках, 0% персонального риска. Институциональный пул $10,000–$50,000+, фиксация сплита 70/30 на месте.'
    },
    {
      id: 'secure_browser',
      name: 'Аппаратная сессия (Hardware Enclave / Clean-Room)',
      badge: '🛡 SECURE ENCLAVE • СТРОГИЙ ЗАПРЕТ ANYDESK',
      icon: 'shield-check',
      desc: 'Аппаратная изоляция: сессия без AnyDesk/TeamViewer. Исключен риск троянов и кейлоггеров. Полный визуальный контроль, авторизация только по FaceID/TouchID владельца и моментальный вывод на Ledger/Trust Wallet.'
    },
    {
      id: 'isolated_profile',
      name: 'Изолированный сессионный профиль',
      badge: '🛡 НУЛЕВОЙ БАЛАНС • РЕЗИДЕНТСКИЙ IP',
      icon: 'shield-check',
      desc: 'Выделенный чистый профиль с резидентским IP и нулевым балансом ваших средств. Вы контролируете баланс со смартфона.'
    }
  ];

  class VIPConciergeModal {
    constructor(userConfig = {}) {
      this.config = Object.assign({}, DEFAULT_CONFIG, userConfig);
      this.currentStep = 1;
      this.isOpen = false;
      
      // Default state
      this.state = {
        bkKey: 'Stake',
        tierId: 'plat_4',
        customBkName: '',
        pnlConfirmed: true,
        limitAmount: '$25,000',
        limitFixture: 'EPL / UCL 1X2 Top Match',
        noHoldsConfirmed: true,
        antiInspectAcknowledged: true,
        attachedFileName: null,
        sessionFormatId: 'dubai_lounge',
        telegram: '',
        wallet: '',
        targetPool: '$25,000 – $50,000',
        zeroBalanceAgreed: true,
        ticketId: this.generateTicketId(),
        webhookSent: false,
        webhookSending: false,
        webhookError: null
      };

      this.init();
    }

    generateTicketId() {
      const rand = Math.floor(1000 + Math.random() * 9000);
      return `SYND-VIP-${rand}`;
    }

    init() {
      this.ensureStyles();
      this.injectContainer();
      this.attachGlobalListeners();
    }

    ensureStyles() {
      if (document.getElementById('vip-concierge-styles')) return;
      const style = document.createElement('style');
      style.id = 'vip-concierge-styles';
      style.textContent = `
        .vip-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 99999;
          background: rgba(4, 5, 8, 0.88);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          overflow-y: auto;
        }
        .vip-modal-backdrop.is-active {
          opacity: 1;
          pointer-events: auto;
        }
        .vip-modal-dialog {
          width: 100%;
          max-width: 680px;
          margin: auto;
          background: linear-gradient(180deg, rgba(21, 26, 36, 0.98) 0%, rgba(11, 14, 20, 0.99) 100%);
          border: 1px solid rgba(0, 240, 255, 0.25);
          box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.95), 0 0 45px rgba(0, 240, 255, 0.14);
          border-radius: 1.25rem;
          transform: scale(0.96) translateY(12px);
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          overflow: hidden;
          color: #E2E8F0;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }
        .vip-modal-backdrop.is-active .vip-modal-dialog {
          transform: scale(1) translateY(0);
        }
        .vip-step-pill {
          transition: all 0.2s ease;
        }
        .vip-step-pill.is-active {
          border-color: #00F0FF;
          background: rgba(0, 240, 255, 0.12);
          color: #00F0FF;
        }
        .vip-step-pill.is-done {
          border-color: rgba(16, 185, 129, 0.4);
          background: rgba(16, 185, 129, 0.1);
          color: #10B981;
        }
        .vip-radio-card {
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .vip-radio-card:hover {
          border-color: rgba(0, 240, 255, 0.4);
          transform: translateY(-1px);
        }
        .vip-radio-card.is-selected {
          border-color: #00F0FF;
          background: rgba(0, 240, 255, 0.08);
          box-shadow: 0 0 15px rgba(0, 240, 255, 0.15);
        }
        .vip-mono {
          font-family: 'JetBrains Mono', monospace, ui-monospace;
        }
        .vip-input-error {
          border-color: #EF4444 !important;
          box-shadow: 0 0 15px rgba(239, 68, 68, 0.35) !important;
        }
        .vip-input-success {
          border-color: #10B981 !important;
          box-shadow: 0 0 15px rgba(16, 185, 129, 0.25) !important;
        }
        @keyframes vipShake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .vip-shake {
          animation: vipShake 0.4s ease-in-out;
        }
        .vip-modal-body::-webkit-scrollbar {
          width: 6px;
        }
        .vip-modal-body::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
        }
        .vip-modal-body::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 3px;
        }
      `;
      document.head.appendChild(style);
    }

    injectContainer() {
      let container = document.getElementById(this.config.containerId);
      if (!container) {
        container = document.createElement('div');
        container.id = this.config.containerId;
        container.className = 'vip-modal-backdrop';
        container.setAttribute('role', 'dialog');
        container.setAttribute('aria-modal', 'true');
        document.body.appendChild(container);
      }
      this.container = container;
      this.render();
    }

    attachGlobalListeners() {
      this.container.addEventListener('click', (e) => {
        if (e.target === this.container) {
          this.close();
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.close();
        }
      });
    }

    open(initialData = {}) {
      if (initialData.bk) {
        const normalized = initialData.bk.toLowerCase();
        if (normalized.includes('stake')) this.state.bkKey = 'Stake';
        else if (normalized.includes('sportsbet')) this.state.bkKey = 'Sportsbet';
        else if (normalized.includes('bc')) this.state.bkKey = 'BCGame';
        else if (normalized.includes('roobet')) this.state.bkKey = 'Roobet';
        else if (normalized.includes('cloud')) this.state.bkKey = 'Cloudbet';
        else {
          this.state.bkKey = 'Other';
          this.state.customBkName = initialData.bk;
        }
        const tiers = BOOKMAKER_DATA[this.state.bkKey].tiers;
        const rec = tiers.find(t => t.recommended) || tiers[0];
        this.state.tierId = rec.id;
      }

      if (initialData.tier) {
        const tiers = BOOKMAKER_DATA[this.state.bkKey].tiers;
        const matched = tiers.find(t => t.name.toLowerCase().includes(initialData.tier.toLowerCase()));
        if (matched) this.state.tierId = matched.id;
      }

      if (initialData.limit) {
        this.state.limitAmount = initialData.limit;
      }

      if (initialData.telegram) {
        this.state.telegram = initialData.telegram;
      }

      this.currentStep = 1;
      this.isOpen = true;
      this.container.classList.add('is-active');
      document.body.style.overflow = 'hidden';
      this.render();
    }

    close() {
      this.isOpen = false;
      this.container.classList.remove('is-active');
      document.body.style.overflow = '';
    }

    goToStep(step) {
      if (step < 1 || step > 5) return;
      this.currentStep = step;
      this.render();
      if (typeof this.config.onStepChange === 'function') {
        this.config.onStepChange(step, this.state);
      }
    }

    getSelectedBk() {
      return BOOKMAKER_DATA[this.state.bkKey] || BOOKMAKER_DATA['Stake'];
    }

    getSelectedTier() {
      const bk = this.getSelectedBk();
      return bk.tiers.find(t => t.id === this.state.tierId) || bk.tiers[0];
    }

    getSelectedFormat() {
      return SESSION_FORMATS.find(f => f.id === this.state.sessionFormatId) || SESSION_FORMATS[0];
    }

    validateTelegram(raw) {
      const clean = (raw || '').trim().replace(/^@+/, '').replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '').replace(/\/+$/, '');
      if (!clean) {
        return {
          valid: false,
          message: 'Укажите ваш Telegram username (@username) для связи со старшим риск-консьержем.'
        };
      }
      if (clean.length < 5) {
        return {
          valid: false,
          message: `Telegram username слишком короткий (минимум 5 символов, сейчас: ${clean.length}).`
        };
      }
      if (clean.length > 32) {
        return {
          valid: false,
          message: `Telegram username не может превышать 32 символа (сейчас: ${clean.length}).`
        };
      }
      if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
        return {
          valid: false,
          message: 'Username может содержать только латинские буквы (a-z), цифры и символ _ (дефис не поддерживается Telegram).'
        };
      }
      return {
        valid: true,
        clean: clean
      };
    }

    validateWallet(raw, allowEmpty = true) {
      const w = (raw || '').trim();
      if (!w) {
        if (allowEmpty) {
          return {
            valid: true,
            type: 'deferred',
            display: 'Будет согласован в закрытом чате',
            message: 'Кошелек не указан (согласование в личном диалоге)'
          };
        }
        return {
          valid: false,
          message: 'Укажите кошелек USDT в сети TRC-20 или ERC-20.'
        };
      }

      // TRC-20 Check (Starts with T, 34 chars, Base58)
      if (w.startsWith('T')) {
        if (w.length === 34 && /^T[1-9A-HJ-NP-za-km-z]{33}$/.test(w)) {
          return {
            valid: true,
            type: 'TRC-20',
            display: w,
            message: '✓ Валидный некастодиальный адрес USDT TRC-20 (Tron Network)'
          };
        }
        if (w.length === 34 && /^T[a-zA-Z0-9]{33}$/.test(w)) {
          return {
            valid: true,
            type: 'TRC-20',
            display: w,
            message: '✓ Валидный некастодиальный адрес USDT TRC-20 (Tron Network)'
          };
        }
        if (w.length !== 34) {
          return {
            valid: false,
            type: 'TRC-20',
            message: `Адрес TRC-20 должен содержать ровно 34 символа (сейчас: ${w.length}).`
          };
        }
        return {
          valid: false,
          type: 'TRC-20',
          message: 'Адрес TRC-20 содержит недопустимые Base58 символы.'
        };
      }

      // ERC-20 Check (Starts with 0x, 42 chars, Hex)
      if (w.toLowerCase().startsWith('0x')) {
        if (w.length === 42 && /^0x[a-fA-F0-9]{40}$/i.test(w)) {
          return {
            valid: true,
            type: 'ERC-20',
            display: w,
            message: '✓ Валидный некастодиальный адрес USDT ERC-20 (Ethereum / EVM)'
          };
        }
        if (w.length !== 42) {
          return {
            valid: false,
            type: 'ERC-20',
            message: `Адрес ERC-20 должен содержать ровно 42 hex-символа (сейчас: ${w.length}).`
          };
        }
        return {
          valid: false,
          type: 'ERC-20',
          message: 'Адрес ERC-20 содержит недопустимые символы (только hex: 0-9, a-f).'
        };
      }

      return {
        valid: false,
        message: 'Неверный формат адреса. Адрес TRC-20 начинается с "T" (34 симв.), ERC-20 — с "0x" (42 симв.).'
      };
    }

    buildTicketText() {
      const bk = this.getSelectedBk();
      const bkName = this.state.bkKey === 'Other' && this.state.customBkName ? this.state.customBkName : bk.name;
      const tier = this.getSelectedTier();
      const format = this.getSelectedFormat();
      const cleanTg = (this.state.telegram || '').trim().replace(/^@+/, '').replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '');
      const walletVal = (this.state.wallet || '').trim();
      const walletCheck = this.validateWallet(walletVal, true);
      const walletDisplay = (walletVal && walletCheck.valid && walletCheck.type !== 'deferred')
        ? `${walletVal} [${walletCheck.type}]`
        : (walletVal || 'Укажу лично в чате с консьержем');

      return `🏛 VIP CONCIERGE ALLOCATION TICKET [${this.state.ticketId}]
━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Партнер: @${cleanTg || 'HighRoller'}
🏛 Букмекер: ${bkName}
👑 VIP Ранг: ${tier.name}
📉 Статус счета: ${this.state.pnlConfirmed ? 'High-Roller (Отрицательный PnL подтвержден)' : 'Стандартный'}
⚽️ Лимит 1X2 (АПЛ/ЛЧ): ${this.state.limitAmount} (Подтвержден)
📍 Формат сессии: ${format.name}
💎 USDT Кошелек: ${walletDisplay}
💰 Запрос пула: ${this.state.targetPool}
🔒 Non-Custodial: Баланс выведен в 0 • 0 паролей
━━━━━━━━━━━━━━━━━━━━━━━━━━
Прошу согласовать время сессии и аллокацию пула ликвидности.`;
    }

    getTelegramDeepLink() {
      const text = this.buildTicketText();
      const desk = (this.config.tgDeskUsername || 'syndicate_vip_desk').replace(/^@+/, '');
      return `https://t.me/${desk}?text=${encodeURIComponent(text)}`;
    }

    async dispatchWebhook() {
      if (this.state.webhookSending) return;
      this.state.webhookSending = true;
      this.state.webhookError = null;
      this.render();

      const bk = this.getSelectedBk();
      const bkName = this.state.bkKey === 'Other' && this.state.customBkName ? this.state.customBkName : bk.name;
      const tier = this.getSelectedTier();
      const format = this.getSelectedFormat();
      const cleanTg = (this.state.telegram || '').trim().replace(/^@+/, '').replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '');
      const walletVal = (this.state.wallet || '').trim();
      const walletCheck = this.validateWallet(walletVal, true);

      const payload = {
        ticketId: this.state.ticketId,
        bk: bkName,
        tier: tier.name,
        pnl: this.state.pnlConfirmed ? 'High-Roller (Минусовой баланс)' : 'Обычный',
        limit: this.state.limitAmount,
        fixture: this.state.limitFixture,
        noHolds: this.state.noHoldsConfirmed,
        sessionFormat: format.name,
        telegram: cleanTg ? `@${cleanTg}` : '',
        wallet: walletVal,
        walletType: walletCheck.valid && walletCheck.type !== 'deferred' ? walletCheck.type : null,
        targetPool: this.state.targetPool,
        zeroBalanceAgreed: this.state.zeroBalanceAgreed,
        fileName: this.state.attachedFileName,
        timestamp: new Date().toISOString()
      };

      try {
        const res = await fetch(this.config.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        
        this.state.webhookSent = true;
        this.state.webhookSending = false;
        if (data.directTelegramLink) {
          this.state.serverDirectTelegramLink = data.directTelegramLink;
        }
        this.render();
      } catch (err) {
        console.warn('[VIP Concierge] Webhook dispatch warning (server might be offline):', err.message);
        this.state.webhookSending = false;
        this.state.webhookError = 'Сервер локального вебхука недоступен. Используйте прямую ссылку Telegram ниже.';
        this.render();
      }
    }

    copyTicketToClipboard() {
      const text = this.buildTicketText();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          this.showToast('Данные тикета скопированы в буфер обмена');
        }).catch(() => {
          this.fallbackCopy(text);
        });
      } else {
        this.fallbackCopy(text);
      }
    }

    fallbackCopy(text) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        this.showToast('Данные тикета скопированы');
      } catch (e) {
        alert('Не удалось скопировать. Пожалуйста, выделите текст вручную.');
      }
      document.body.removeChild(textarea);
    }

    showToast(message) {
      let toast = document.getElementById('vip-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'vip-toast';
        toast.className = 'fixed bottom-6 right-6 z-[999999] px-4 py-3 rounded-lg bg-[#151A24] border border-[#00F0FF]/50 text-[#00F0FF] font-mono text-xs shadow-2xl flex items-center gap-2 transition-all';
        document.body.appendChild(toast);
      }
      toast.innerHTML = `<span class="w-2 h-2 rounded-full bg-[#00F0FF] animate-pulse"></span> ${message}`;
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
      }, 3000);
    }

    render() {
      let stepContent = '';
      if (this.currentStep === 1) stepContent = this.renderStep1();
      else if (this.currentStep === 2) stepContent = this.renderStep2();
      else if (this.currentStep === 3) stepContent = this.renderStep3();
      else if (this.currentStep === 4) stepContent = this.renderStep4();
      else if (this.currentStep === 5) stepContent = this.renderStep5();

      this.container.innerHTML = `
        <div class="vip-modal-dialog">
          
          <!-- Top Institutional Header -->
          <div class="px-6 py-4 border-b border-white/10 bg-black/40 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-red-500/80"></span>
                <span class="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
              </div>
              <div class="h-4 w-[1px] bg-white/10 mx-1"></div>
              <span class="vip-mono text-[11px] tracking-wider text-brand-cyan uppercase font-semibold text-[#00F0FF]">
                VIP ALLOCATION DESK // VERIFICATION PROTOCOL
              </span>
            </div>
            
            <button id="vip-close-btn" class="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors" title="Закрыть (Esc)">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>

          <!-- Step Progress Segmented Bar -->
          <div class="px-6 pt-4 pb-3 border-b border-white/5 bg-black/20">
            <div class="grid grid-cols-4 gap-2 text-center">
              <div class="vip-step-pill p-2 rounded-lg border text-left ${this.currentStep === 1 ? 'is-active' : (this.currentStep > 1 ? 'is-done' : 'border-white/5 bg-white/[0.02] text-zinc-500')}">
                <div class="vip-mono text-[10px] uppercase font-semibold opacity-75">01 // TIER</div>
                <div class="text-xs font-medium truncate">Букмекер & Ранг</div>
              </div>

              <div class="vip-step-pill p-2 rounded-lg border text-left ${this.currentStep === 2 ? 'is-active' : (this.currentStep > 2 ? 'is-done' : 'border-white/5 bg-white/[0.02] text-zinc-500')}">
                <div class="vip-mono text-[10px] uppercase font-semibold opacity-75">02 // LIMIT</div>
                <div class="text-xs font-medium truncate">Потолок 1X2</div>
              </div>

              <div class="vip-step-pill p-2 rounded-lg border text-left ${this.currentStep === 3 ? 'is-active' : (this.currentStep > 3 ? 'is-done' : 'border-white/5 bg-white/[0.02] text-zinc-500')}">
                <div class="vip-mono text-[10px] uppercase font-semibold opacity-75">03 // VENUE</div>
                <div class="text-xs font-medium truncate">Формат сессии</div>
              </div>

              <div class="vip-step-pill p-2 rounded-lg border text-left ${this.currentStep >= 4 ? 'is-active' : 'border-white/5 bg-white/[0.02] text-zinc-500'}">
                <div class="vip-mono text-[10px] uppercase font-semibold opacity-75">04 // DISPATCH</div>
                <div class="text-xs font-medium truncate">Выплаты & TG</div>
              </div>
            </div>
          </div>

          <!-- Modal Scrollable Content Area -->
          <div class="vip-modal-body p-6 max-h-[75vh] overflow-y-auto">
            ${stepContent}
          </div>

        </div>
      `;

      this.bindEvents();

      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons({ root: this.container });
      }
    }

    renderStep1() {
      const selectedBk = this.getSelectedBk();
      const selectedTier = this.getSelectedTier();

      return `
        <div class="space-y-6">
          
          <div>
            <div class="vip-mono text-xs text-[#00F0FF] uppercase tracking-wider mb-1 font-semibold">
              // ШАГ 1 ИЗ 4: КВАЛИФИКАЦИЯ СТАТУСА
            </div>
            <h3 class="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Выберите крипто-букмекера и VIP-ранг
            </h3>
            <p class="text-xs text-zinc-400 mt-1 leading-relaxed">
              Синдикат выделяет капитал от <strong class="text-[#00F0FF] font-mono font-medium">$10,000</strong> до <strong class="text-[#00F0FF] font-mono font-medium">$150,000+</strong> под зрелые аккаунты с активным VIP-уровнем.
            </p>
          </div>

          <!-- Bookmakers Grid -->
          <div class="space-y-2">
            <label class="block text-xs font-semibold text-zinc-300">Платформа счета:</label>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              ${Object.keys(BOOKMAKER_DATA).map(key => {
                const bk = BOOKMAKER_DATA[key];
                const isSelected = this.state.bkKey === key;
                return `
                  <div class="vip-radio-card p-3 rounded-xl border ${isSelected ? 'is-selected' : 'border-white/10 bg-white/[0.03]'}" data-bk="${key}">
                    <div class="flex items-center justify-between mb-1">
                      <span class="font-semibold text-xs ${isSelected ? 'text-[#00F0FF]' : 'text-white'}">${bk.name}</span>
                      <span class="w-2 h-2 rounded-full ${isSelected ? 'bg-[#00F0FF] shadow-[0_0_8px_#00f0ff]' : 'bg-white/20'}"></span>
                    </div>
                    <div class="vip-mono text-[9px] text-zinc-400 tracking-wider truncate">${bk.badge}</div>
                  </div>
                `;
              }).join('')}
            </div>

            ${this.state.bkKey === 'Other' ? `
              <div class="pt-2">
                <input type="text" id="vip-custom-bk" placeholder="Название букмекера (например, Rollbit, Shuffle, Thunderpick...)" value="${this.escapeHtml(this.state.customBkName)}" class="w-full bg-black/40 border border-white/15 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-[#00F0FF] font-mono">
              </div>
            ` : ''}
          </div>

          <!-- Dynamic VIP Tiers -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="block text-xs font-semibold text-zinc-300">Текущий VIP-уровень профиля:</label>
              <span class="vip-mono text-[10px] text-[#00F0FF]">АЛЛОКАЦИЯ ДО ${selectedTier.pool.split('–')[1] || selectedTier.pool}</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              ${selectedBk.tiers.map(tier => {
                const isSelected = this.state.tierId === tier.id;
                return `
                  <div class="vip-radio-card p-3 rounded-xl border ${isSelected ? 'is-selected' : 'border-white/10 bg-white/[0.03]'}" data-tier="${tier.id}">
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-xs font-medium ${isSelected ? 'text-[#00F0FF] font-semibold' : 'text-zinc-200'}">${tier.name}</span>
                      ${tier.recommended ? `<span class="vip-mono text-[9px] px-1.5 py-0.5 rounded bg-[#00F0FF]/20 text-[#00F0FF] font-semibold">PRIORITY</span>` : ''}
                    </div>
                    <div class="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                      <span>Банкролл: <strong class="text-white">${tier.pool}</strong></span>
                      <span class="text-[#10B981]">Сплит ${tier.split}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- High Roller / Negative PnL Confirmation Checkbox -->
          <div class="p-3.5 rounded-xl border border-white/10 bg-black/30 flex items-start gap-3">
            <input type="checkbox" id="vip-pnl-check" ${this.state.pnlConfirmed ? 'checked' : ''} class="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 text-[#00F0FF] focus:ring-0 focus:ring-offset-0 cursor-pointer">
            <div>
              <label for="vip-pnl-check" class="text-xs font-medium text-white cursor-pointer select-none">
                Подтверждаю общий отрицательный баланс (минус) на аккаунте
              </label>
              <p class="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                Букмекерские конторы мгновенно режут плюсовых игроков, но держат максимальные потолки ставок на аккаунтах с историей проигрышей.
              </p>
            </div>
          </div>

          <!-- Bottom Action Buttons -->
          <div class="pt-2 flex items-center justify-between">
            <div class="vip-mono text-[11px] text-zinc-500">
              Шаг 1 из 4
            </div>
            <button id="vip-step1-next" class="px-6 py-3 rounded-xl bg-[#00F0FF] hover:bg-[#33f3ff] text-black font-semibold text-xs vip-mono tracking-wide flex items-center gap-2 shadow-[0_0_20px_rgba(0,240,255,0.3)] transition-all active:scale-95">
              <span>Перейти к проверке лимита</span>
              <i data-lucide="arrow-right" class="w-4 h-4"></i>
            </button>
          </div>

        </div>
      `;
    }

    renderStep2() {
      const presets = ['$5,000 – $10,000', '$10,000 – $25,000', '$25,000 – $50,000', '$50,000 – $100,000+'];

      return `
        <div class="space-y-6">
          
          <div>
            <div class="vip-mono text-xs text-[#00F0FF] uppercase tracking-wider mb-1 font-semibold">
              // ШАГ 2 ИЗ 4: ЭКСПРЕСС-АУДИТ ПОТОЛКА СТАВКИ
            </div>
            <h3 class="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Зафиксируйте лимит на исход 1X2 (АПЛ / ЛЧ)
            </h3>
            <p class="text-xs text-zinc-400 mt-1 leading-relaxed">
              Аналитический совет синдиката утверждает банкролл строго исходя из фактического максимального лимита в купоне на ликвидные события.
            </p>
          </div>

          <!-- Institutional Walkthrough Box -->
          <div class="p-4 rounded-xl border border-[#00F0FF]/30 bg-[#00F0FF]/[0.04] space-y-2.5">
            <div class="flex items-center gap-2 text-[#00F0FF] text-xs font-semibold vip-mono">
              <i data-lucide="help-circle" class="w-4 h-4"></i>
              <span>РЕГЛАМЕНТ ПРОВЕРКИ МАКСИМАЛЬНОЙ СТАВКИ:</span>
            </div>
            <ol class="text-xs text-zinc-300 space-y-1.5 list-decimal list-inside pl-1 leading-relaxed">
              <li>Откройте ближайший топ-матч (<strong class="text-white">Английская Премьер-Лига</strong> или <strong class="text-white">Лига Чемпионов</strong>).</li>
              <li>Выберите основной исход <strong class="text-[#00F0FF]">1X2</strong> (Победа 1, Ничья или Победа 2).</li>
              <li>Введите в купон сумму <strong class="text-white font-mono">$50,000</strong> (размещать ставку НЕ нужно).</li>
              <li>Зафиксируйте значение <strong class="text-[#00F0FF] font-mono">Max Bet</strong> (потолок ставки, который допускает букмекер).</li>
            </ol>
          </div>

          <!-- Limit Selector -->
          <div class="space-y-3">
            <label class="block text-xs font-semibold text-zinc-300">Фактический или оценочный лимит на событие:</label>
            
            <div class="grid grid-cols-2 gap-2">
              ${presets.map(p => {
                const isSelected = this.state.limitAmount === p;
                return `
                  <button type="button" class="vip-limit-preset py-2.5 px-3 rounded-lg border text-xs font-mono text-left transition-all ${isSelected ? 'border-[#00F0FF] bg-[#00F0FF]/15 text-[#00F0FF] font-bold shadow-[0_0_12px_rgba(0,240,255,0.2)]' : 'border-white/10 bg-white/[0.02] text-zinc-300 hover:border-white/20'}" data-val="${p}">
                    ${p}
                  </button>
                `;
              }).join('')}
            </div>

            <div class="pt-1">
              <label class="block text-[11px] text-zinc-400 font-mono mb-1">Или укажите точную сумму ($):</label>
              <div class="relative">
                <span class="absolute left-3 top-2.5 text-zinc-400 font-mono text-xs">$</span>
                <input type="text" id="vip-limit-custom" value="${this.escapeHtml(this.state.limitAmount)}" placeholder="25,000" class="w-full bg-black/40 border border-white/15 rounded-lg pl-7 pr-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#00F0FF]">
              </div>
            </div>
          </div>

          <!-- Anti-Inspect Protocol Callout -->
          <div class="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.05] space-y-2">
            <div class="flex items-center gap-2 text-amber-400 text-xs font-semibold vip-mono">
              <i data-lucide="shield-alert" class="w-4 h-4"></i>
              <span>ANTI-INSPECT ELEMENT ПРОТОКОЛ</span>
            </div>
            <p class="text-[11px] text-zinc-300 leading-relaxed">
              Для выделения пулов свыше $10,000 статичные скриншоты с F12 не принимаются. Подтверждение проводится через видео купона с <strong class="text-white">обновлением страницы (F5)</strong> либо короткий 2-минутный созвон с демонстрацией экрана.
            </p>
          </div>

          <!-- Verifications Checkbox -->
          <div class="space-y-2">
            <div class="flex items-center gap-2 text-xs text-zinc-300">
              <input type="checkbox" id="vip-noholds-check" ${this.state.noHoldsConfirmed ? 'checked' : ''} class="w-4 h-4 rounded border-white/20 bg-white/5 text-[#00F0FF] cursor-pointer">
              <label for="vip-noholds-check" class="cursor-pointer select-none">
                Вывод средств активен, холдов безопасности и нерешенных тикетов нет
              </label>
            </div>
            <div class="flex items-center gap-2 text-xs text-zinc-300">
              <input type="checkbox" id="vip-anti-inspect-check" ${this.state.antiInspectAcknowledged ? 'checked' : ''} class="w-4 h-4 rounded border-white/20 bg-white/5 text-[#00F0FF] cursor-pointer">
              <label for="vip-anti-inspect-check" class="cursor-pointer select-none">
                Готов подтвердить лимит по видеозаписи F5 или Telegram Screen Share
              </label>
            </div>
          </div>

          <!-- Bottom Action Buttons -->
          <div class="pt-2 flex items-center justify-between">
            <button id="vip-step2-prev" class="px-4 py-2.5 rounded-xl border border-white/10 hover:border-white/20 text-zinc-300 font-mono text-xs transition-colors flex items-center gap-1.5">
              <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
              <span>Назад</span>
            </button>

            <button id="vip-step2-next" class="px-6 py-3 rounded-xl bg-[#00F0FF] hover:bg-[#33f3ff] text-black font-semibold text-xs vip-mono tracking-wide flex items-center gap-2 shadow-[0_0_20px_rgba(0,240,255,0.3)] transition-all active:scale-95">
              <span>Выбрать формат сессии</span>
              <i data-lucide="arrow-right" class="w-4 h-4"></i>
            </button>
          </div>

        </div>
      `;
    }

    renderStep3() {
      return `
        <div class="space-y-6">
          
          <div>
            <div class="vip-mono text-xs text-[#00F0FF] uppercase tracking-wider mb-1 font-semibold">
              // ШАГ 3 ИЗ 4: ВЫБОР ФОРМАТА И ЛОКАЦИИ
            </div>
            <h3 class="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Где и как вам комфортно проводить сессию?
            </h3>
            <p class="text-xs text-zinc-400 mt-1 leading-relaxed">
              Мы ценим приватность партнеров. Все форматы соответствуют институциональному протоколу <strong class="text-[#00F0FF]">Non-Custodial</strong> (0 паролей, личный баланс выводится в ноль).
            </p>
          </div>

          <!-- Formats List -->
          <div class="space-y-2.5">
            ${SESSION_FORMATS.map(fmt => {
              const isSelected = this.state.sessionFormatId === fmt.id;
              return `
                <div class="vip-radio-card p-4 rounded-xl border ${isSelected ? 'is-selected' : 'border-white/10 bg-white/[0.02]'}" data-format="${fmt.id}">
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex items-start gap-3">
                      <div class="p-2 rounded-lg ${isSelected ? 'bg-[#00F0FF]/20 text-[#00F0FF]' : 'bg-white/5 text-zinc-400'} shrink-0 mt-0.5">
                        <i data-lucide="${fmt.icon}" class="w-4 h-4"></i>
                      </div>
                      <div>
                        <div class="flex items-center gap-2 flex-wrap">
                          <h4 class="text-xs sm:text-sm font-semibold ${isSelected ? 'text-white' : 'text-zinc-200'}">${fmt.name}</h4>
                          <span class="vip-mono text-[9px] px-2 py-0.5 rounded-full ${isSelected ? 'bg-[#00F0FF]/20 text-[#00F0FF] font-semibold' : 'bg-white/5 text-zinc-400'}">${fmt.badge}</span>
                        </div>
                        <p class="text-[11px] text-zinc-400 mt-1 leading-relaxed">${fmt.desc}</p>
                      </div>
                    </div>
                    <span class="w-4 h-4 rounded-full border ${isSelected ? 'border-[#00F0FF] bg-[#00F0FF] shadow-[0_0_8px_#00f0ff]' : 'border-white/20'} shrink-0 mt-1 flex items-center justify-center">
                      ${isSelected ? `<span class="w-1.5 h-1.5 rounded-full bg-black"></span>` : ''}
                    </span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <!-- Non-Custodial Core Guarantee -->
          <div class="p-3.5 rounded-xl border border-[#10B981]/30 bg-[#10B981]/[0.04] flex items-center gap-3">
            <i data-lucide="shield-check" class="w-5 h-5 text-[#10B981] shrink-0"></i>
            <p class="text-[11px] text-zinc-300 leading-snug">
              <strong class="text-white">Гарантия безопасности:</strong> Ваши логины, пароли и 2FA остаются исключительно у вас. Перед стартом сессии вы выводите все свои личные средства до нуля.
            </p>
          </div>

          <!-- Bottom Action Buttons -->
          <div class="pt-2 flex items-center justify-between">
            <button id="vip-step3-prev" class="px-4 py-2.5 rounded-xl border border-white/10 hover:border-white/20 text-zinc-300 font-mono text-xs transition-colors flex items-center gap-1.5">
              <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
              <span>Назад</span>
            </button>

            <button id="vip-step3-next" class="px-6 py-3 rounded-xl bg-[#00F0FF] hover:bg-[#33f3ff] text-black font-semibold text-xs vip-mono tracking-wide flex items-center gap-2 shadow-[0_0_20px_rgba(0,240,255,0.3)] transition-all active:scale-95">
              <span>Указать контакт и кошелек</span>
              <i data-lucide="arrow-right" class="w-4 h-4"></i>
            </button>
          </div>

        </div>
      `;
    }

    renderStep4() {
      const pools = ['$10,000', '$25,000', '$50,000', '$100,000+'];
      const rawTg = (this.state.telegram || '').replace(/^@+/, '').replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '');
      const rawWallet = this.state.wallet || '';
      const walletCheck = this.validateWallet(rawWallet, true);
      const isWalletValid = rawWallet ? walletCheck.valid : false;
      const isWalletError = rawWallet ? !walletCheck.valid : false;

      return `
        <div class="space-y-6">
          
          <div>
            <div class="vip-mono text-xs text-[#00F0FF] uppercase tracking-wider mb-1 font-semibold">
              // ШАГ 4 ИЗ 4: ПРИВАТНЫЙ ДИСПЕТЧЕР И ВЫПЛАТЫ
            </div>
            <h3 class="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Реквизиты связи и начисления прибыли
            </h3>
            <p class="text-xs text-zinc-400 mt-1 leading-relaxed">
              Старший риск-консьерж свяжется с вами в течение 5 минут для согласования точного графика сессии.
            </p>
          </div>

          <!-- Inputs -->
          <div class="space-y-4">
            
            <!-- Telegram Handle -->
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="block text-xs font-semibold text-zinc-300">Ваш Telegram (@username): <span class="text-[#00F0FF]">*</span></label>
                <span class="vip-mono text-[10px] text-zinc-400">ШИФРОВАННЫЙ КАНАЛ СВЯЗИ</span>
              </div>
              <div class="relative">
                <span class="absolute left-3.5 top-2.5 text-[#00F0FF] font-mono text-xs font-bold">@</span>
                <input type="text" id="vip-telegram-input" value="${this.escapeHtml(rawTg)}" placeholder="whale_boss" class="w-full bg-black/40 border border-white/15 rounded-xl pl-8 pr-4 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-[#00F0FF] transition-all">
              </div>
              <div id="vip-telegram-msg" class="text-[11px] mt-1.5 font-mono text-zinc-500">
                Консьерж напишет вам в Telegram с верифицированного деска синдиката.
              </div>
            </div>

            <!-- Non-Custodial USDT Wallet -->
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="block text-xs font-semibold text-zinc-300">Некастодиальный USDT кошелек (TRC20 / ERC20):</label>
                <span class="vip-mono text-[10px] text-[#10B981]">ДЛЯ ВЫПЛАТ ДИВИДЕНДОВ</span>
              </div>
              <div class="relative">
                <input type="text" id="vip-wallet-input" value="${this.escapeHtml(rawWallet)}" placeholder="T... (TRC-20, 34 симв.) или 0x... (ERC-20, 42 симв.)" class="w-full bg-black/40 border ${isWalletError ? 'vip-input-error' : (isWalletValid ? 'vip-input-success' : 'border-white/15')} rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-[#00F0FF] transition-all">
              </div>
              <div id="vip-wallet-msg" class="text-[11px] mt-1.5 font-mono text-zinc-500">
                ${rawWallet && walletCheck.valid ? `<span class="text-emerald-400">${walletCheck.message}</span>` : (rawWallet && !walletCheck.valid ? `<span class="text-rose-400">✕ ${walletCheck.message}</span>` : '🔒 30–40% чистой прибыли начисляются НА этот кошелек (или согласуйте лично в чате).')}
              </div>
              <div class="pt-1 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                <span>Форматы: <b>TRC-20</b> (T..., 34 симв.) или <b>ERC-20</b> (0x..., 42 симв.)</span>
                <button type="button" id="vip-defer-wallet-btn" class="text-[#00F0FF] hover:underline cursor-pointer">
                  Указать в личном чате
                </button>
              </div>
            </div>

            <!-- Target Pool Size -->
            <div>
              <label class="block text-xs font-semibold text-zinc-300 mb-1.5">Желаемый объем выделяемого банкролла:</label>
              <div class="grid grid-cols-4 gap-2">
                ${pools.map(p => {
                  const isSelected = this.state.targetPool.includes(p.replace('+', ''));
                  return `
                    <button type="button" class="vip-pool-btn py-2 px-1 rounded-lg border text-[11px] font-mono transition-all ${isSelected ? 'border-[#00F0FF] bg-[#00F0FF]/20 text-[#00F0FF] font-semibold shadow-[0_0_10px_rgba(0,240,255,0.2)]' : 'border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20'}" data-pool="${p}">
                      ${p}
                    </button>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- Safety Zero Balance Agreement -->
            <div id="vip-zero-balance-container" class="p-3.5 rounded-xl border border-white/10 bg-black/30 flex items-start gap-3 transition-colors">
              <input type="checkbox" id="vip-zero-balance-check" ${this.state.zeroBalanceAgreed ? 'checked' : ''} class="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 text-[#00F0FF] cursor-pointer">
              <div>
                <label for="vip-zero-balance-check" class="text-xs font-medium text-white cursor-pointer select-none">
                  Обязуюсь вывести все личные средства с баланса до нуля перед запуском пула
                </label>
                <p class="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                  100% средств на сессии — это капитал синдиката. Возможные просадки на 100% компенсируются фондом.
                </p>
                <div id="vip-zero-msg" class="text-[11px] mt-1 font-mono text-rose-400 hidden"></div>
              </div>
            </div>

          </div>

          <!-- Bottom Action Buttons -->
          <div class="pt-2 flex items-center justify-between">
            <button id="vip-step4-prev" class="px-4 py-2.5 rounded-xl border border-white/10 hover:border-white/20 text-zinc-300 font-mono text-xs transition-colors flex items-center gap-1.5">
              <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
              <span>Назад</span>
            </button>

            <button id="vip-step4-submit" class="px-6 py-3 rounded-xl bg-[#00F0FF] hover:bg-[#33f3ff] text-black font-semibold text-xs vip-mono tracking-wide flex items-center gap-2 shadow-[0_0_20px_rgba(0,240,255,0.3)] transition-all active:scale-95">
              <i data-lucide="shield-check" class="w-4 h-4"></i>
              <span>Сформировать тикет аудита</span>
            </button>
          </div>

        </div>
      `;
    }

    renderStep5() {
      const bk = this.getSelectedBk();
      const bkName = this.state.bkKey === 'Other' && this.state.customBkName ? this.state.customBkName : bk.name;
      const tier = this.getSelectedTier();
      const format = this.getSelectedFormat();
      const tgDeepLink = this.state.serverDirectTelegramLink || this.getTelegramDeepLink();
      const cleanTg = (this.state.telegram || '').replace(/^@+/, '').replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '');
      const walletVal = (this.state.wallet || '').trim();
      const walletCheck = this.validateWallet(walletVal, true);
      const walletBadge = walletVal && walletCheck.valid && walletCheck.type !== 'deferred'
        ? `<span class="text-zinc-200 truncate block">${walletVal.slice(0, 8)}...${walletVal.slice(-6)} <span class="text-[#00F0FF] text-[10px]">(${walletCheck.type})</span></span>`
        : `<span class="text-zinc-400 italic">Согласование лично в Telegram</span>`;

      return `
        <div class="space-y-6 text-center">
          
          <!-- Animated Status -->
          <div class="w-16 h-16 rounded-2xl bg-[#00F0FF]/10 border border-[#00F0FF]/40 text-[#00F0FF] mx-auto flex items-center justify-center shadow-[0_0_30px_rgba(0,240,255,0.25)]">
            <i data-lucide="check-check" class="w-8 h-8"></i>
          </div>

          <div>
            <div class="vip-mono text-xs text-[#00F0FF] uppercase tracking-wider mb-1 font-semibold">
              // TICKET REGISTERED • STATUS: PRE-APPROVED
            </div>
            <h3 class="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Заявка на аллокацию пула сформирована
            </h3>
            <p class="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
              Тикет <span class="text-white font-mono font-semibold">${this.state.ticketId}</span> закреплен за старшим риск-консьержем деска.
            </p>
          </div>

          <!-- Institutional Ticket Card -->
          <div class="text-left rounded-xl border border-white/10 bg-black/50 p-4 sm:p-5 space-y-3 font-mono text-xs shadow-inner">
            <div class="flex items-center justify-between border-b border-white/10 pb-2.5">
              <span class="text-[#00F0FF] font-bold tracking-wider">${this.state.ticketId}</span>
              <span class="text-[10px] px-2 py-0.5 rounded bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 font-semibold">TIER-A ALLOCATED</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div>
                <span class="text-zinc-500 block">Букмекер & Ранг:</span>
                <span class="text-white font-semibold">${bkName} • ${tier.name}</span>
              </div>
              <div>
                <span class="text-zinc-500 block">Лимит 1X2 (АПЛ/ЛЧ):</span>
                <span class="text-[#00F0FF] font-semibold">${this.state.limitAmount}</span>
              </div>
              <div>
                <span class="text-zinc-500 block">Формат сессии:</span>
                <span class="text-white">${format.name.split('(')[0]}</span>
              </div>
              <div>
                <span class="text-zinc-500 block">Банкролл синдиката:</span>
                <span class="text-[#10B981] font-semibold">${this.state.targetPool} (Сплит ${tier.split})</span>
              </div>
              <div>
                <span class="text-zinc-500 block">Telegram партнера:</span>
                <span class="text-white font-bold">@${cleanTg || 'Указан'}</span>
              </div>
              <div>
                <span class="text-zinc-500 block">Кошелек дивидендов:</span>
                ${walletBadge}
              </div>
            </div>

            <div class="border-t border-white/10 pt-2 text-[10px] text-zinc-400 flex items-center justify-between">
              <span>🔒 0 паролей • 0% риска игрока</span>
              <span>Баланс в 0 перед стартом</span>
            </div>
          </div>

          <!-- Dual Dispatch Actions -->
          <div class="space-y-3 pt-1">
            
            <!-- Primary CTA: Direct Telegram Link with pre-filled text -->
            <a href="${tgDeepLink}" id="vip-open-tg-btn" target="_blank" rel="noopener noreferrer" class="w-full py-4 px-4 rounded-xl bg-[#00F0FF] hover:bg-[#33f3ff] text-black font-bold text-xs vip-mono tracking-wide flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(0,240,255,0.4)] transition-all active:scale-[0.98]">
              <i data-lucide="send" class="w-4 h-4"></i>
              <span>Открыть в Telegram с готовым тикетом</span>
            </a>

            <!-- Secondary Actions Grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              
              <!-- Webhook Trigger Button -->
              <button type="button" id="vip-webhook-btn" class="py-2.5 px-3 rounded-lg border border-white/15 bg-white/[0.03] hover:bg-white/[0.08] text-white font-mono text-xs flex items-center justify-center gap-2 transition-all">
                <i data-lucide="${this.state.webhookSent ? 'check' : 'cpu'}" class="w-3.5 h-3.5 ${this.state.webhookSent ? 'text-[#10B981]' : 'text-[#00F0FF]'}"></i>
                <span>${this.state.webhookSending ? 'Отправка...' : (this.state.webhookSent ? 'В деске синдиката ✓' : 'Отправить в Webhook')}</span>
              </button>

              <!-- Copy Ticket to Clipboard -->
              <button type="button" id="vip-copy-btn" class="py-2.5 px-3 rounded-lg border border-white/15 bg-white/[0.03] hover:bg-white/[0.08] text-white font-mono text-xs flex items-center justify-center gap-2 transition-all">
                <i data-lucide="copy" class="w-3.5 h-3.5 text-zinc-400"></i>
                <span>Скопировать тикет</span>
              </button>

            </div>

            ${this.state.webhookError ? `
              <div class="text-[11px] font-mono text-amber-400/90 text-left p-2 rounded bg-amber-500/10 border border-amber-500/20">
                ${this.state.webhookError}
              </div>
            ` : ''}

          </div>

          <!-- Done / Close -->
          <div class="pt-2">
            <button id="vip-finish-btn" class="text-zinc-500 hover:text-zinc-300 font-mono text-xs transition-colors underline">
              Закрыть окно аудита
            </button>
          </div>

        </div>
      `;
    }

    bindEvents() {
      const closeBtn = document.getElementById('vip-close-btn');
      if (closeBtn) closeBtn.onclick = () => this.close();

      const finishBtn = document.getElementById('vip-finish-btn');
      if (finishBtn) finishBtn.onclick = () => this.close();

      if (this.currentStep === 1) {
        this.container.querySelectorAll('[data-bk]').forEach(el => {
          el.onclick = () => {
            this.state.bkKey = el.getAttribute('data-bk');
            const tiers = BOOKMAKER_DATA[this.state.bkKey].tiers;
            const rec = tiers.find(t => t.recommended) || tiers[0];
            this.state.tierId = rec.id;
            this.render();
          };
        });

        const customBk = document.getElementById('vip-custom-bk');
        if (customBk) {
          customBk.oninput = (e) => {
            this.state.customBkName = e.target.value;
          };
        }

        this.container.querySelectorAll('[data-tier]').forEach(el => {
          el.onclick = () => {
            this.state.tierId = el.getAttribute('data-tier');
            this.render();
          };
        });

        const pnlCheck = document.getElementById('vip-pnl-check');
        if (pnlCheck) {
          pnlCheck.onchange = (e) => {
            this.state.pnlConfirmed = e.target.checked;
          };
        }

        const step1Next = document.getElementById('vip-step1-next');
        if (step1Next) {
          step1Next.onclick = () => this.goToStep(2);
        }
      }

      if (this.currentStep === 2) {
        this.container.querySelectorAll('.vip-limit-preset').forEach(el => {
          el.onclick = () => {
            this.state.limitAmount = el.getAttribute('data-val');
            this.render();
          };
        });

        const limitCustom = document.getElementById('vip-limit-custom');
        if (limitCustom) {
          limitCustom.oninput = (e) => {
            this.state.limitAmount = e.target.value.trim();
          };
        }

        const noHoldsCheck = document.getElementById('vip-noholds-check');
        if (noHoldsCheck) {
          noHoldsCheck.onchange = (e) => {
            this.state.noHoldsConfirmed = e.target.checked;
          };
        }

        const antiInspectCheck = document.getElementById('vip-anti-inspect-check');
        if (antiInspectCheck) {
          antiInspectCheck.onchange = (e) => {
            this.state.antiInspectAcknowledged = e.target.checked;
          };
        }

        const step2Prev = document.getElementById('vip-step2-prev');
        if (step2Prev) step2Prev.onclick = () => this.goToStep(1);

        const step2Next = document.getElementById('vip-step2-next');
        if (step2Next) step2Next.onclick = () => this.goToStep(3);
      }

      if (this.currentStep === 3) {
        this.container.querySelectorAll('[data-format]').forEach(el => {
          el.onclick = () => {
            this.state.sessionFormatId = el.getAttribute('data-format');
            this.render();
          };
        });

        const step3Prev = document.getElementById('vip-step3-prev');
        if (step3Prev) step3Prev.onclick = () => this.goToStep(2);

        const step3Next = document.getElementById('vip-step3-next');
        if (step3Next) step3Next.onclick = () => this.goToStep(4);
      }

      if (this.currentStep === 4) {
        const tgInput = document.getElementById('vip-telegram-input');
        if (tgInput) {
          tgInput.oninput = (e) => {
            this.state.telegram = e.target.value.trim();
          };
        }

        const walletInput = document.getElementById('vip-wallet-input');
        if (walletInput) {
          walletInput.oninput = (e) => {
            this.state.wallet = e.target.value.trim();
          };
        }

        this.container.querySelectorAll('.vip-pool-btn').forEach(el => {
          el.onclick = () => {
            const p = el.getAttribute('data-pool');
            this.state.targetPool = p;
            this.render();
          };
        });

        const zeroCheck = document.getElementById('vip-zero-balance-check');
        if (zeroCheck) {
          zeroCheck.onchange = (e) => {
            this.state.zeroBalanceAgreed = e.target.checked;
          };
        }

        const step4Prev = document.getElementById('vip-step4-prev');
        if (step4Prev) step4Prev.onclick = () => this.goToStep(3);

        const step4Submit = document.getElementById('vip-step4-submit');
        if (step4Submit) {
          step4Submit.onclick = () => {
            const tg = (this.state.telegram || '').replace(/^@+/, '').trim();
            if (!tg) {
              alert('Пожалуйста, укажите ваш Telegram (@username) для связи с риск-консьержем.');
              const el = document.getElementById('vip-telegram-input');
              if (el) el.focus();
              return;
            }
            this.dispatchWebhook();
            this.goToStep(5);
          };
        }
      }

      if (this.currentStep === 5) {
        const webhookBtn = document.getElementById('vip-webhook-btn');
        if (webhookBtn) {
          webhookBtn.onclick = () => this.dispatchWebhook();
        }

        const copyBtn = document.getElementById('vip-copy-btn');
        if (copyBtn) {
          copyBtn.onclick = () => this.copyTicketToClipboard();
        }
      }
    }

    escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  }

  let instance = null;

  return {
    getInstance: function (config) {
      if (!instance) {
        instance = new VIPConciergeModal(config);
      }
      return instance;
    },
    open: function (initialData, config) {
      const modal = this.getInstance(config);
      modal.open(initialData);
      return modal;
    },
    close: function () {
      if (instance) instance.close();
    },
    ModalClass: VIPConciergeModal
  };
}));
