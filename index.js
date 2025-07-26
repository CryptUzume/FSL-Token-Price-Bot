const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const express = require('express');

// チャンネルIDのカンマ区切り
const TARGET_CHANNEL_IDS = process.env.TARGET_CHANNEL_IDS?.split(',') || [];
console.log("[DEBUG] TARGET_CHANNEL_IDS =", TARGET_CHANNEL_IDS);

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const PORT = process.env.PORT || 10000;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Expressによるウェブサーバー起動（Renderでの起動検知用）
const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(PORT, () => {
  console.log(`🌐 Web server is running at http://localhost:${PORT}`);
});

// トークン価格取得（リトライ付き）
async function fetchPricesWithRetry(ids, retries = 5, delay = 10000) {
  const url = 'https://api.coingecko.com/api/v3/simple/price';
  const params = {
    ids: ids.join(','),
    vs_currencies: 'usd,jpy',
  };

  for (let i = 0; i <= retries; i++) {
    try {
      const response = await axios.get(url, { params });
      console.log('[DEBUG] fetchPrices success for:', ids.join(','));
      return response.data;
    } catch (err) {
      if (err.response?.status === 429 && i < retries) {
        console.warn(`[WARN] 429 Too Many Requests: リトライします。残り回数: ${retries - i}, ${delay / 1000}秒待機中...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('[ERROR] fetchPrices failed:', err.message);
        return null;
      }
    }
  }
}

// チャンネル名更新処理
async function updateChannelNames() {
  const prices = await fetchPricesWithRetry(['stepn', 'green-satoshi-token', 'go-game-token']);

  if (!prices) {
    console.warn('[WARN] 価格データ取得に失敗したため更新処理を中止します');
    return;
  }

  const tokenMap = {
    GMT: { id: 'stepn', emoji: '🟡' },
    GST: { id: 'green-satoshi-token', emoji: '⚪' },
    GGT: { id: 'go-game-token', emoji: '🟣' },
  };

  const tokenKeys = Object.keys(tokenMap);

  for (let i = 0; i < tokenKeys.length; i++) {
    const key = tokenKeys[i];
    const { id, emoji } = tokenMap[key];
    const channelId = TARGET_CHANNEL_IDS[i];

    const token = prices[id];
    if (!token) continue;

    const name = `${emoji} ${key}: $${token.usd.toFixed(3)} / ¥${token.jpy.toFixed(2)}`;

    try {
      const channel = await client.channels.fetch(channelId);
      if (channel && channel.setName) {
        await channel.setName(name);
        console.log(`[RENAME] Channel ${channelId} renamed to: ${name}`);
      }
    } catch (err) {
      console.error(`[ERROR] チャンネル名更新に失敗: ${channelId}`, err.message);
    }
  }
}

// Bot起動時
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // 初回即時実行
  updateChannelNames();

  // 20分ごとに更新
  setInterval(updateChannelNames, 20 * 60 * 1000);
});

client.login(TOKEN);
