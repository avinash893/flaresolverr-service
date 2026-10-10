const http = require('http');
const https = require('https');
const mineflayer = require('mineflayer');

const MC_HOST = process.env.MC_HOST || 'legacy-7.hexacraft.fun';
const MC_PORT = parseInt(process.env.MC_PORT || '25587', 10);
const MC_USERNAME = process.env.MC_USERNAME || 'Tillu_Guard';
const MC_VERSION = process.env.MC_VERSION || '1.21.1';
const PORT = parseInt(process.env.PORT || '8080', 10);

let bot = null;
let isReconnecting = false;
let connectAttempts = 0;
let lastStatus = 'starting';

function log(msg) {
  console.log(`[${new Date().toISOString()}] [TilluGuard] ${msg}`);
}

function startBot() {
  if (bot) {
    try {
      bot.removeAllListeners();
      bot.end();
    } catch (e) {}
    bot = null;
  }

  isReconnecting = false;
  connectAttempts++;
  lastStatus = `connecting (attempt ${connectAttempts})`;
  log(`Connecting to ${MC_HOST}:${MC_PORT} as ${MC_USERNAME}...`);

  try {
    bot = mineflayer.createBot({
      host: MC_HOST,
      port: MC_PORT,
      username: MC_USERNAME,
      version: MC_VERSION,
      hideErrors: false,
      checkTimeoutInterval: 60000,
      viewDistance: 'tiny'
    });

    bot.once('login', () => {
      lastStatus = 'logged_in';
      log(`Logged in to ${MC_HOST}:${MC_PORT} successfully.`);
    });

    bot.once('spawn', () => {
      lastStatus = 'online';
      connectAttempts = 0;
      log(`Spawned in Minecraft world! Server is now kept awake 24/7.`);
    });

    bot.on('kicked', (reason) => {
      lastStatus = `kicked: ${typeof reason === 'string' ? reason : JSON.stringify(reason)}`;
      log(`Kicked from server: ${lastStatus}`);
      scheduleReconnect();
    });

    bot.on('error', (err) => {
      lastStatus = `error: ${err.message}`;
      log(`Connection error: ${err.message}`);
      scheduleReconnect();
    });

    bot.on('end', (reason) => {
      lastStatus = `disconnected: ${reason}`;
      log(`Disconnected: ${reason}`);
      scheduleReconnect();
    });

  } catch (err) {
    lastStatus = `init_error: ${err.message}`;
    log(`Failed to initialize bot: ${err.message}`);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (isReconnecting) return;
  isReconnecting = true;
  const delay = Math.min(30000, 10000 + connectAttempts * 2000);
  log(`Scheduling reconnect in ${Math.round(delay / 1000)}s...`);
  setTimeout(() => {
    startBot();
  }, delay);
}

// Anti-AFK Routine: Small head movement every 45 seconds to avoid AFK kick plugins
setInterval(() => {
  if (bot && bot.entity) {
    try {
      const yaw = (Math.random() - 0.5) * Math.PI;
      const pitch = (Math.random() - 0.5) * 0.2;
      bot.look(yaw, pitch, true);
    } catch (e) {}
  }
}, 45000);

// Lightweight HTTP server for Render health checks and monitoring
const server = http.createServer((req, res) => {
  const isOnline = !!bot && !!bot.entity;
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: isOnline ? 'online' : 'reconnecting',
    detail: lastStatus,
    target: `${MC_HOST}:${MC_PORT}`,
    username: MC_USERNAME,
    uptime_seconds: Math.floor(process.uptime()),
    memory_usage_mb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
    timestamp: new Date().toISOString()
  }));
});

server.listen(PORT, '0.0.0.0', () => {
  log(`Health check HTTP server active on port ${PORT}`);
  startBot();
});

// Self-ping to prevent Render free instance from idling
const selfUrl = process.env.RENDER_EXTERNAL_URL;
if (selfUrl) {
  setInterval(() => {
    try {
      const client = selfUrl.startsWith('https') ? https : http;
      client.get(selfUrl, () => {}).on('error', () => {});
    } catch (e) {}
  }, 10 * 60 * 1000);
}
