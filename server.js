/**
 * VIP Liquidity Syndicate - Production-Grade Static & API Server
 * Supports:
 * - 60fps Video Scrubbing with HTTP 206 Partial Content (Range requests)
 * - Serving cinematic-story.html as the primary landing experience
 * - Telegram Webhook lead dispatch
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

let PORT = process.env.PORT || 3060;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

function sendTelegramMessage(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('[LOG] No Telegram Bot Token configured. Lead details:\n' + text);
    return Promise.resolve({ ok: true, mocked: true });
  }

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: text,
      parse_mode: 'HTML'
    });

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ ok: false, error: e.message });
        }
      });
    });

    req.on('error', (err) => {
      console.error('[ERROR] Failed to send Telegram message:', err.message);
      reject(err);
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

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Route: POST /api/audit-request
  if (req.method === 'POST' && req.url === '/api/audit-request') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const ticketId = payload.ticketId || ('SYND-' + Math.floor(1000 + Math.random() * 9000));

        const tgMessage = `🚨 <b>НОВАЯ ЗАЯВКА НА VIP-АУДИТ [${ticketId}]</b>\n\n` +
          `🏛 <b>Букмекер:</b> ${payload.bk || 'Stake'}\n` +
          `👑 <b>VIP Ранг:</b> ${payload.tier || 'Не указан'}\n` +
          `📉 <b>Статус счета:</b> ${payload.pnl || 'Отрицательный PnL'}\n` +
          `📊 <b>Макс. Лимит 1X2:</b> ${payload.limit || 'Оценка на месте'}\n` +
          `📍 <b>Формат сессии:</b> ${payload.sessionFormat || 'VIP Lounge'}\n` +
          `👤 <b>Telegram:</b> @${(payload.telegram || '').replace('@', '')}\n` +
          `💎 <b>USDT Кошелек:</b> ${payload.wallet || 'Не указан'}\n` +
          `💰 <b>Запрос пула:</b> ${payload.targetPool || '$25k – $50k'}\n` +
          `⏱ <b>Время:</b> ${new Date().toISOString()}\n\n` +
          `<i>Статус: 100% Non-Custodial • 0% персонального риска</i>`;

        await sendTelegramMessage(tgMessage);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, ticketId, received: payload }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON payload: ' + err.message }));
      }
    });
    return;
  }

  // Determine file to serve
  let cleanUrl = req.url.split('?')[0];
  if (cleanUrl === '/' || cleanUrl === '/story' || cleanUrl === '/cinematic') {
    cleanUrl = '/index.html';
  } else if (cleanUrl === '/portal' || cleanUrl === '/dashboard') {
    cleanUrl = '/portal.html';
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
        'Cache-Control': extname === '.html' ? 'no-cache' : 'public, max-age=3600'
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });
});

server.listen(PORT, () => {
  console.log(`[VIP SYNDICATE SERVER] Active on http://localhost:${PORT}`);
  console.log(`[CINEMATIC STORY] Available at http://localhost:${PORT}/ (index.html)`);
  console.log(`[PORTAL] Available at http://localhost:${PORT}/portal (portal.html)`);
});
