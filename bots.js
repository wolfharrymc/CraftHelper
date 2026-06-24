// Suppress spammy console errors from mineflayer/protodef
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
console.error = function(...args) {
    const msg = args.join(' ');
    if (msg.includes('PartialReadError') || 
        msg.includes('Chunk size is') || 
        msg.includes('partial packet') ||
        msg.includes('packet_world_particles')) {
        return; // Ignore these spammy errors
    }
    originalConsoleError.apply(console, args);
};
console.warn = function(...args) {
    const msg = args.join(' ');
    if (msg.includes('Chunk size is') || 
        msg.includes('partial packet')) {
        return; // Ignore these spammy warnings
    }
    originalConsoleWarn.apply(console, args);
};

console.log("Bots.js starting...");

const mineflayer = require('mineflayer');
console.log("Mineflayer imported");

require('dotenv').config();
console.log("Dotenv loaded");

const SERVER = 'play.craftsmp.fun';
const PORT = 25565;
const BOT_USERNAME = 'CraftHelper';
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || '';
const OWNER_USERNAMES = (process.env.OWNER_USERNAMES || '').split(',').map(name => name.trim()).filter(name => name);
const SPECIAL_PLAYER = 'Wolf_Harry';

console.log("Config:", { 
    SERVER, 
    PORT, 
    BOT_USERNAME, 
    LOGIN_PASSWORD: LOGIN_PASSWORD ? "***" : "(EMPTY!)", 
    OWNER_USERNAMES, 
    SPECIAL_PLAYER 
});

if (!LOGIN_PASSWORD) {
    console.error("ERROR: LOGIN_PASSWORD is empty! Bot won't be able to authenticate!");
}

const OWNER_GREETINGS = [
    (name) => `☠️ The ruler ${name} has descended! The server trembles before their power ☠️`,
    (name) => `⚔️ ${name} is here! Show some respect ⚔️`,
    (name) => `💀 ${name} has joined! Everyone welcome them 💀`,
    (name) => `🌑 ${name} arrives! The server gets a little more chaotic 🌑`,
    (name) => `🔥 ${name} is here! Let's go 🔥`
];

const SPECIAL_PLAYER_GREETINGS = [
    (name) => `🐺 ${name}! The alpha of the server! Everyone make way! 🐺`,
    (name) => `⚡ ${name} has entered! The server just got more powerful! ⚡`,
    (name) => `💀 The legendary ${name}! Bow down! 💀`,
    (name) => `🗡️ ${name} is in the building! Let's go! 🗡️`,
    (name) => `🌪️ ${name} is here! The server will never be the same! 🌪️`,
    (name) => `👑 The one and only ${name}! Welcome! 👑`,
    (name) => `🔥 ${name}! Let's get this started! 🔥`
];

let isBotConnected = false;
let hasSentLogin = false; // To prevent double login commands
let lastKickReason = null;

// Helper to get kick reason string from object
function getKickReason(reason) {
    if (typeof reason === 'string') return reason;
    if (reason && typeof reason === 'object') {
        if (reason.text) return reason.text;
        if (reason.extra && Array.isArray(reason.extra)) {
            return reason.extra.map(part => part.text || '').join('');
        }
    }
    return JSON.stringify(reason);
}

function createBot() {
    hasSentLogin = false; // Reset login flag on new connection
    lastKickReason = null;
    console.log(`[${BOT_USERNAME}] Starting to connect to ${SERVER}:${PORT}...`);
    try {
        const bot = mineflayer.createBot({
            host: SERVER,
            port: PORT,
            username: BOT_USERNAME,
            version: '1.21', // Set correct Minecraft version for play.craftsmp.fun
            checkTimeoutInterval: 120000 // Increase timeout to 2 minutes
        });

        bot.on('connect', () => {
            console.log(`[${BOT_USERNAME}] ✅ Connected to server!`);
            isBotConnected = true;
        });

        bot.on('spawn', () => {
            console.log(`[${BOT_USERNAME}] ✅ Spawned successfully!`);
        });

        bot.on('chat', (username, message) => {
            console.log(`[CHAT] ${username}: ${message}`);
            const lowerMsg = message.toLowerCase();
            if (!hasSentLogin && (lowerMsg.includes('login') || lowerMsg.includes('password'))) {
                hasSentLogin = true;
                bot.chat(`/login ${LOGIN_PASSWORD}`);
                console.log(`[${BOT_USERNAME}] Sent login command`);
            }
        });

        bot.on('message', (jsonMsg) => {
            const text = jsonMsg.toString();
            console.log(`[MESSAGE] ${text}`);
            const lowerText = text.toLowerCase();
            if (!hasSentLogin && lowerText.includes('/login')) {
                hasSentLogin = true;
                bot.chat(`/login ${LOGIN_PASSWORD}`);
                console.log(`[${BOT_USERNAME}] Sent login command from message`);
            }
        });

        bot.on('playerJoined', (player) => {
            setTimeout(() => {
                if (player.username === SPECIAL_PLAYER) {
                    const greeting = SPECIAL_PLAYER_GREETINGS[Math.floor(Math.random() * SPECIAL_PLAYER_GREETINGS.length)];
                    bot.chat(greeting(SPECIAL_PLAYER));
                    console.log(`[${BOT_USERNAME}] Gave extra aura greeting to ${SPECIAL_PLAYER}`);
                } else if (OWNER_USERNAMES.includes(player.username)) {
                    const greeting = OWNER_GREETINGS[Math.floor(Math.random() * OWNER_GREETINGS.length)];
                    bot.chat(greeting(player.username));
                    console.log(`[${BOT_USERNAME}] Greeted owner: ${player.username}`);
                }
            }, 1000);
        });

        bot.on('kicked', (reason) => {
            const reasonStr = getKickReason(reason);
            console.log(`[${BOT_USERNAME}] ❌ Kicked: ${reasonStr}`);
            lastKickReason = reasonStr;
            isBotConnected = false;
            const lowerReason = reasonStr.toLowerCase();
            // Don't reconnect for these reasons
            if (lowerReason.includes('already connected') || lowerReason.includes('logging in too fast')) {
                console.log(`[${BOT_USERNAME}] Not reconnecting - ${reasonStr}`);
            } else {
                console.log(`[${BOT_USERNAME}] Reconnecting in 60 seconds...`);
                setTimeout(createBot, 60000);
            }
        });

        bot.on('error', (err) => {
            const errStr = err.toString();
            if (errStr.includes('PartialReadError') || 
                errStr.includes('client timed out')) {
                return; // Ignore these non-critical errors
            }
            console.error(`[${BOT_USERNAME}] ❌ Error:`, err);
        });

        bot.on('end', (reason) => {
            console.log(`[${BOT_USERNAME}] ❌ Disconnected: ${reason}`);
            isBotConnected = false;
            // Reconnect if it's a socketClosed and not due to a kick we already handled
            if (lastKickReason === null) {
                console.log(`[${BOT_USERNAME}] Reconnecting in 60 seconds...`);
                setTimeout(createBot, 60000);
            }
        });
    } catch (err) {
        console.error(`Failed to create bot:`, err);
        setTimeout(createBot, 60000);
    }
}

console.log("Calling createBot()");
createBot();

// Minimal HTTP server to satisfy Hugging Face Spaces port requirement
const http = require('http');
const HTTP_PORT = process.env.PORT || 7860;

const server = http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('CraftHelper Bot is running!\n');
});

server.listen(HTTP_PORT, () => {
    console.log(`[HTTP] Server listening on port ${HTTP_PORT}`);
});

// Print status every 10 seconds
setInterval(() => {
    console.log(`[STATUS] ${BOT_USERNAME} is ${isBotConnected ? '✅ CONNECTED' : '❌ DISCONNECTED'}`);
}, 10000);
