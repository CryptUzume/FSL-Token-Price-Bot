require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');
const axios = require('axios');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const TARGET_CHANNEL_IDS = process.env.TARGET_CHANNEL_IDS
  ? process.env.TARGET_CHANNEL_IDS.split(',').map(id => id.trim())
  : [];

const MESSAGE_TYPE = 'text'; // 'text' or 'embed'
const INTERVAL_MINUTES = 10;
const PORT = process.env.PORT || 10000;

console.log("[DEBUG] TARGET_CHANNEL_IDS =", TARGET_CHANNEL_IDS);

const app = express();
app.get('/', (req, res) => {
  res.send('Bot is running.');
});
app.listen(PORT, () => {
  console.log(`🌐 Web server is running at http://localhost:${PORT}`);
});

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  updatePrices();
  setInterval(updatePrices, INTERVAL_MINUTES * 60 * 1000);
});

async function fetchPrices() {
  const ids = ['stepn', 'green-satoshi-token', 'go-game-token'];
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd,jpy`;

  let retries = 3;
  while (retries > 0) {
    try {
      const res = await axios.get(url);
      console.log("[DEBUG] fetchPrices success for:", ids.join(','));
      return res.data;
    } catch (err) {
      if (err.response?.status === 429) {
        retries--;
        console.warn(`[WARN] 429 Too Many Requests: リトライします。残り回数: ${retries}, 5秒待機中...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        console.error("[ERROR] fetchPrices failed:", err.message);
        break;
      }
    }
  }
  console.warn("[WARN] 価格データ取得に失敗したため更新処理を中止します");
  return null;
}

async function updatePrices() {
  const prices = await fetchPrices();
  if (!prices) return;

  const tokens = [
    { id: 'stepn', symbol: 'GMT', emoji: '🟡' },
    { id: 'green-satoshi-token', symbol: 'GST', emoji: '⚪' },
    { id: 'go-game-token', symbol: 'GGT', emoji: '🟣' }
  ];

  for (const token of tokens) {
    const data = prices[token.id];
    if (!data) {
      console.warn(`[WARN] ${token.symbol} の価格取得に失敗しました`);
      continue;
    }

    const usd = data.usd.toFixed(3);
    const jpy = data.jpy.toFixed(2);
    const text = `${token.emoji} ${token.symbol}: $${usd} / ¥${jpy}`;

    for (const channelId of TARGET_CHANNEL_IDS) {
      const channel = await client.channels.fetch(channelId).catch(err => {
        console.error(`[ERROR] チャンネル ${channelId} の取得に失敗:`, err.message);
      });
      if (!channel || !channel.send) continue;

      if (MESSAGE_TYPE === 'embed') {
        const embed = new EmbedBuilder()
          .setTitle(`${token.symbol} Price`)
          .setDescription(text)
          .setColor(0x00FFAA)
          .setTimestamp();

        await channel.send({ embeds: [embed] })
          .then(() => console.log(`[SEND] Sent embed to ${channelId}`))
          .catch(err => console.error(`[ERROR] Failed to send embed to ${channelId}:`, err));
      } else {
        await channel.send(text)
          .then(() => console.log(`[SEND] Sent text to ${channelId}`))
          .catch(err => console.error(`[ERROR] Failed to send text to ${channelId}:`, err));
      }
    }

    console.log(`[INFO] Updated channel ${token.symbol}: ${text}`);
  }
}

client.login(DISCORD_TOKEN);
