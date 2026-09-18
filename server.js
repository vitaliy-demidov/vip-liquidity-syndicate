/**
 * VIP Liquidity Syndicate - Production-Grade Static & API Server
 * Supports:
 * - 60fps Video Scrubbing with HTTP 206 Partial Content (Range requests)
 * - Serving cinematic-story.html / index.html as the primary landing experience
 * - Telegram Webhook lead dispatch with beautiful HTML formatting & direct t.me deep-links
 * - Dual port resilience (Primary 3040, Secondary 3060)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Zero-dependency .env loader
function loadEnv() {
  const envPaths = [
    path.join(__dirname, '.env'),
    path.join(__dirname, '..', '.env')
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
            if (key && !process.env[key]) {
              process.env[key] = val;
            }
          }
        }
        console.log(`[ENV] Loaded environment configuration from ${envPath}`);
        break;
      } catch (e) {
        console.warn(`[ENV] Error reading ${envPath}:`, e.message);
      }
    }
  }
}
loadEnv();

const PRIMARY_PORT = parseInt(process.env.PORT || '3040', 10);
const ALT_PORT = parseInt(process.env.ALT_PORT || (PRIMARY_PORT === 3040 ? '3060' : '3040'), 10);
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const TELEGRAM_DESK_USERNAME = (process.env.TELEGRAM_DESK_USERNAME || 'syndicate_vip_desk').replace(/^@+/, '');

// Escape special characters for Telegram HTML parse_mode
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Detect and validate wallet network
function detectWallet(wallet) {
  if (!wallet || !String(wallet).trim()) {
    return { type: 'Не указан', valid: true, display: 'Будет согласован лично в Telegram' };
  }
  const w = String(wallet).trim();
  if (/^T[1-9A-HJ-NP-za-km-z]{33}$/.test(w) || /^T[a-zA-Z0-9]{33}$/.test(w)) {
    return { type: 'TRC-20', valid: true, display: w };
  }
  if (/^0x[a-fA-F0-9]{40}$/.test(w)) {
    return { type: 'ERC-20', valid: true, display: w };
  }
  return { type: 'Custom', valid: false, display: w };
}

// Build pre-filled ticket text for direct t.me link
function buildPrefilledTicketText(payload, ticketId, cleanTg, walletInfo) {
  return `🏛 VIP CONCIERGE ALLOCATION TICKET [${ticketId}]
━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Партнер: @${cleanTg || 'HighRoller'}
🏛 Букмекер: ${payload.bk || 'Stake.com'}
👑 VIP Ранг: ${payload.tier || 'Platinum IV'}
📉 Статус счета: ${payload.pnl || 'High-Roller (Отрицательный PnL)'}
⚽️ Лимит 1X2 (АПЛ/ЛЧ): ${payload.limit || '$25,000'} (Подтвержден)
📍 Формат сессии: ${payload.sessionFormat || 'VIP Lounge'}
💎 USDT Кошелек: ${walletInfo.display} (${walletInfo.type})
💰 Запрос пула: ${payload.targetPool || '$25,000 – $50,000'}
🔒 Non-Custodial: Баланс выведен в 0 • 0 паролей
━━━━━━━━━━━━━━━━━━━━━━━━━━
Прошу согласовать время сессии и аллокацию пула ликвидности.`;
}

// Generate direct Telegram deep link
function generateTelegramDeepLink(prefilledText) {
  return `https://t.me/${TELEGRAM_DESK_USERNAME}?text=${encodeURIComponent(prefilledText)}`;
}

// Build beautiful Telegram HTML message
function buildTelegramHtmlMessage(payload, ticketId, cleanTg, walletInfo, timestamp) {
  const formattedDate = new Date(timestamp).toLocaleString('ru-RU', { timeZone: 'UTC' }) + ' UTC';
  const tgUserLink = cleanTg ? `<a href="https://t.me/${escapeHtml(cleanTg)}">@${escapeHtml(cleanTg)}</a>` : '<i>Не указан</i>';
  const directChatLink = cleanTg ? `<a href="https://t.me/${escapeHtml(cleanTg)}"><b>👉 СВЯЗАТЬСЯ С КЛИЕНТОМ В TELEGRAM (@${escapeHtml(cleanTg)})</b></a>` : '<i>Контакт не указан</i>';

  return `⚡️ <b>[VIP ALLOCATION LEAD] #${escapeHtml(ticketId)}</b>\n` +
    `<code>═════════════════════════════════</code>\n` +
    `🎫 <b>Тикет:</b> <code>#${escapeHtml(ticketId)}</code>\n` +
    `⏱ <b>Регистрация:</b> <code>${formattedDate}</code>\n\n` +
    `📊 <b>ПАРАМЕТРЫ АККАУНТА:</b>\n` +
    `• 🏛 <b>Букмекер:</b> <code>${escapeHtml(payload.bk || 'Stake.com')}</code>\n` +
    `• 👑 <b>VIP Ранг:</b> <code>${escapeHtml(payload.tier || 'Platinum IV')}</code>\n` +
    `• 📉 <b>PnL Статус:</b> <code>${escapeHtml(payload.pnl || 'High-Roller (Отрицательный PnL)')}</code>\n` +
    `• ⚽️ <b>Лимит 1X2 (АПЛ/ЛЧ):</b> <b>${escapeHtml(payload.limit || '$25,000')}</b> <i>(Подтвержден)</i>\n\n` +
    `💼 <b>УСЛОВИЯ СЕССИИ:</b>\n` +
    `• 📍 <b>Формат:</b> <code>${escapeHtml(payload.sessionFormat || 'VIP Lounge Dubai / Moscow')}</code>\n` +
    `• 💰 <b>Запрос пула:</b> <code>${escapeHtml(payload.targetPool || '$25,000 – $50,000')}</code>\n` +
    `• 🔒 <b>Режим безопасности:</b> <code>100% Non-Custodial (Баланс 0, без передачи паролей)</code>\n\n` +
    `💳 <b>РЕКВИЗИТЫ ДЛЯ СВЯЗИ И ВЫПЛАТ:</b>\n` +
    `• 👤 <b>Telegram:</b> ${tgUserLink}\n` +
    `• 💎 <b>USDT Кошелек [${walletInfo.type}]:</b>\n` +
    `  <code>${escapeHtml(walletInfo.display)}</code>\n\n` +
    `<code>═════════════════════════════════</code>\n` +
    `${directChatLink}`;
}

// Telegram dispatch with timeout and error resilience
function sendTelegramMessage(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('[TELEGRAM DISPATCH] Bot Token or Chat ID not configured. Lead logged locally:\n' + text);
    return Promise.resolve({ ok: true, mocked: true, reason: 'Local mode (no bot token)' });
  }

  return new Promise((resolve) => {
    const postData = JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.ok) {
            console.log(`[TELEGRAM DISPATCH] Lead dispatched successfully to ${TELEGRAM_CHAT_ID} (msg_id: ${parsed.result?.message_id})`);
            resolve({ ok: true, result: parsed.result });
          } else {
            console.warn(`[TELEGRAM DISPATCH WARNING] Telegram API response error: ${parsed.description}`);
            resolve({ ok: false, error: parsed.description });
          }
        } catch (e) {
          console.warn('[TELEGRAM DISPATCH WARNING] Response JSON parse error:', e.message);
          resolve({ ok: false, error: e.message });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      console.warn('[TELEGRAM DISPATCH TIMEOUT] Telegram request timed out after 10s');
      resolve({ ok: false, error: 'Request timeout' });
    });

    req.on('error', (err) => {
      console.error('[TELEGRAM DISPATCH ERROR] Connection error:', err.message);
      resolve({ ok: false, error: err.message });
    });

    req.write(postData);
    req.end();
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8'
};

const handleRequest = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlPath = req.url.split('?')[0].replace(/\/+$/, '') || '/';

  // Route: POST /api/audit-request
  if (req.method === 'POST' && urlPath === '/api/audit-request') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
      }
    });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const ticketId = payload.ticketId || ('SYND-VIP-' + Math.floor(1000 + Math.random() * 9000));
        const timestamp = payload.timestamp || new Date().toISOString();
        const cleanTg = (payload.telegram || '').trim().replace(/^@+/, '').replace(/^https?:\/\/t\.me\//, '');
        const walletInfo = detectWallet(payload.wallet);

        const prefilledText = buildPrefilledTicketText(payload, ticketId, cleanTg, walletInfo);
        const directTelegramLink = generateTelegramDeepLink(prefilledText);
        const tgHtmlMessage = buildTelegramHtmlMessage(payload, ticketId, cleanTg, walletInfo, timestamp);

        const tgResult = await sendTelegramMessage(tgHtmlMessage);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          ok: true,
          ticketId,
          telegramSent: tgResult.ok && !tgResult.mocked,
          telegramMocked: !!tgResult.mocked,
          directTelegramLink,
          walletInfo,
          received: {
            ...payload,
            ticketId,
            cleanTg,
            walletType: walletInfo.type
          }
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          ok: false,
          error: 'Invalid JSON payload: ' + err.message
        }));
      }
    });
    return;
  }

  // Determine static file to serve
  let cleanUrl = req.url.split('?')[0];
  if (cleanUrl === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }
  if (cleanUrl === '/' || cleanUrl === '/story' || cleanUrl === '/cinematic' || cleanUrl === '/portal' || cleanUrl === '/dashboard') {
    cleanUrl = '/index.html';
  }

  const filePath = path.join(__dirname, cleanUrl);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const extname = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';
    const totalSize = stats.size;
    const range = req.headers.range;

    // Handle HTTP 206 Range requests (crucial for smooth 60fps video seeking)
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
      const chunkSize = (end - start) + 1;

      const fileStream = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600'
      });
      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': totalSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });
};

const server = http.createServer(handleRequest);

server.listen(PRIMARY_PORT, () => {
  console.log(`[VIP SYNDICATE SERVER] Active on http://localhost:${PRIMARY_PORT}`);
  console.log(`[CINEMATIC STORY] Available at http://localhost:${PRIMARY_PORT}/ (index.html)`);
});

// Dual port support for concurrent access (e.g. 3040 and 3060)
if (ALT_PORT && ALT_PORT !== PRIMARY_PORT) {
  const altServer = http.createServer(handleRequest);
  altServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[VIP SYNDICATE SERVER] Alt port ${ALT_PORT} is in use by another instance; continuing on primary port ${PRIMARY_PORT}.`);
    } else {
      console.warn(`[VIP SYNDICATE SERVER] Alt port ${ALT_PORT} warning:`, err.message);
    }
  });
  altServer.listen(ALT_PORT, () => {
    console.log(`[VIP SYNDICATE SERVER] Dual listener active on http://localhost:${ALT_PORT}`);
  });
}
