// token-price-bot/index.js
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

console.log("[DEBUG] TARGET_CHANNEL_IDS =", TARGET_CHANNEL_IDS);

const TOKEN = process.env.DISCORD_TOKEN;
const UPDATE_FREQUENCY = parseInt(process.env.UPDATE_FREQUENCY) || 3600000;
const UPDATE_STATUS = process.env.UPDATE_STATUS === 'on';
const BOARDCAST = process.env.BOARDCAST === 'on';
const TARGET_CHANNEL_IDS = (process.env.TARGET_CHANNEL_IDS || '').split(',');
const MESSAGE_TYPE = process.env.MESSAGE_TYPE || 'embed';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const tokens = [
  { id: 'stepn', symbol: 'GMT', emoji: '🟡' },
  { id: 'green-satoshi-token', symbol: 'GST', emoji: '⚪' },
  { id: 'go-game-token', symbol: 'GGT', emoji: '🟣' },
];

async function fetchPricesWithRetry(ids, retries = 3, delay = 5000) {
  const idsParam = ids.join(',');
  for (let i = 0; i < retries; i++) {
    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${idsParam}&vs_currencies=usd,jpy`;
      const { data } = await axios.get(url);
      console.debug(`[DEBUG] fetchPrices success for: ${idsParam}`);
      return data;
    } catch (err) {
      if (err.response && err.response.status === 429) {
        console.warn(`[WARN] 429 Too Many Requests: リトライします。残り回数: ${retries - i - 1}, ${delay / 1000}秒待機中...`);
        await new Promise(res => setTimeout(res, delay));
      } else {
        console.error(`[ERROR] fetchPrices failed: ${err.message}`);
        break;
      }
    }
  }
  return null;
}

async function updateChannels() {
  const ids = tokens.map(t => t.id);
  const prices = await fetchPricesWithRetry(ids);
  if (!prices) {
    console.warn('[WARN] 価格データ取得に失敗したため更新処理を中止します');
    return;
  }

  for (const token of tokens) {
    const price = prices[token.id];
    if (!price) {
      console.warn(`[WARN] ${token.symbol} の価格が見つかりません`);
      continue;
    }
    const text = `${token.emoji} ${token.symbol}: $${price.usd.toFixed(3)} / \u00a5${price.jpy.toFixed(2)}`;
    console.info(`[INFO] Updated channel ${token.symbol}: ${text}`);

    for (const channelId of TARGET_CHANNEL_IDS) {
      const channel = await client.channels.fetch(channelId).catch(err => {
        console.error(`[ERROR] チャンネル取得失敗 (${channelId}): ${err.message}`);
        return null;
      });
      if (!channel || !channel.isTextBased()) {
        console.warn(`[WARN] チャンネル無効または非テキスト形式: ${channelId}`);
        continue;
      }

      if (MESSAGE_TYPE === 'embed') {
        const embed = new EmbedBuilder()
          .setTitle(`${token.symbol} Price`)
          .setDescription(text)
          .setColor(0x00FFAA)
          .setTimestamp();
        await channel.send({ embeds: [embed] }).catch(err => {
          console.error(`[ERROR] メッセージ送信失敗 (${token.symbol}): ${err.message}`);
        });
      } else {
        await channel.send(text).catch(err => {
          console.error(`[ERROR] メッセージ送信失敗 (${token.symbol}): ${err.message}`);
        });
      }
    }
  }
}

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  if (BOARDCAST) updateChannels();
  if (UPDATE_STATUS) {
    setInterval(updateChannels, UPDATE_FREQUENCY);
  }
});

// 🌐 ダミーWebサーバー（Render Free プラン回避用）
const express = require("express");
const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.send("Bot is running!");
});

app.listen(PORT, () => {
  console.log(`🌐 Web server is running at http://localhost:${PORT}`);
});

client.login(TOKEN);
