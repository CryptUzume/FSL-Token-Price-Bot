// index.js

const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const TARGET_CHANNEL_IDS = process.env.TARGET_CHANNEL_IDS.split(',').map(id => id.trim());

console.log("[DEBUG] TARGET_CHANNEL_IDS =", TARGET_CHANNEL_IDS);

const TOKENS = [
  { id: 'stepn', symbol: 'GMT', emoji: '🟡' },
  { id: 'green-satoshi-token', symbol: 'GST', emoji: '⚪' },
  { id: 'go-game-token', symbol: 'GGT', emoji: '🟣' }
];

const fetchPrices = async () => {
  const ids = TOKENS.map(t => t.id).join(',');
  try {
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd,jpy`
    );
    console.debug("[DEBUG] fetchPrices success for:", ids);
    return response.data;
  } catch (err) {
    console.warn("[ERROR] fetchPrices failed:", err.message);
    return null;
  }
};

const updateChannelNames = async () => {
  const prices = await fetchPrices();
  if (!prices) {
    console.warn("[WARN] 価格データ取得に失敗したため更新処理を中止します");
    return;
  }

  for (const [index, token] of TOKENS.entries()) {
    const data = prices[token.id];
    if (!data) continue;

    const usd = data.usd.toFixed(3);
    const jpy = data.jpy.toFixed(2);
    const text = `${token.emoji} ${token.symbol}: $${usd} / ¥${jpy}`;

    const channelId = TARGET_CHANNEL_IDS[index];
    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel) {
        console.warn(`[WARN] チャンネルID ${channelId} が見つかりません`);
        continue;
      }

      if (channel.type !== 2) { // 2 = GUILD_VOICE
        console.warn(`[WARN] チャンネルID ${channelId} はボイスチャンネルではありません`);
        continue;
      }

      await channel.setName(text);
      console.log(`[RENAME] Channel ${channelId} renamed to: ${text}`);
    } catch (err) {
      console.error(`[ERROR] Failed to update channel ${channelId}:`, err.message);
    }
  }
};

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  updateChannelNames();
  setInterval(updateChannelNames, 1000 * 60 * 5); // 5分ごとに更新
});

// Express server to keep Render service alive
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(10000, () => {
  console.log('\ud83c\udf10 Web server is running at http://localhost:10000');
});

client.login(TOKEN);
