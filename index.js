const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

const TOKEN = process.env.DISCORD_TOKEN;
const UPDATE_FREQUENCY = parseInt(process.env.UPDATE_FREQUENCY) || 7200000; // デフォルト2時間
const UPDATE_STATUS = process.env.UPDATE_STATUS === 'on';
const BOARDCAST = process.env.BOARDCAST === 'on';
const TARGET_CHANNEL_IDS = (process.env.TARGET_CHANNEL_IDS || '').split(',');
const MESSAGE_TYPE = process.env.MESSAGE_TYPE || 'embed';
const CHAIN = process.env.CHAIN || 'bsc';
const PAIR_HASH = process.env.PAIR_HASH || '';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const tokens = [
  { id: 'stepn', symbol: 'GMT', emoji: '🟡' },
  { id: 'green-satoshi-token', symbol: 'GST', emoji: '⚪' },
  { id: 'go-game-token', symbol: 'GGT', emoji: '🟣' },
];

// まとめて価格取得。リトライ機能付き（429対応）
async function fetchPrices(tokenIds, retries = 3) {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${tokenIds}&vs_currencies=usd,jpy`;
  try {
    const { data } = await axios.get(url);
    console.log(`[DEBUG] fetchPrices success for: ${tokenIds}`);
    return data;
  } catch (err) {
    if (err.response && err.response.status === 429 && retries > 0) {
      console.warn(`[WARN] 429 Too Many Requests: リトライします。残り回数: ${retries}, 5秒待機中...`);
      await new Promise(r => setTimeout(r, 5000));
      return fetchPrices(tokenIds, retries - 1);
    }
    console.error(`[ERROR] fetchPrices failed: ${err.message}`);
    return null;
  }
}

async function updateChannels() {
  const ids = tokens.map(t => t.id).join(',');
  const prices = await fetchPrices(ids);

  if (!prices) {
    console.warn(`[WARN] 価格データ取得に失敗したため更新処理を中止します`);
    return;
  }

  for (const token of tokens) {
    const price = prices[token.id];
    if (!price || !price.usd || !price.jpy) {
      console.warn(`[WARN] ${token.symbol} の価格情報が不正またはありません`);
      continue;
    }

    const text = `${token.emoji} ${token.symbol}: $${price.usd.toFixed(3)} / ¥${price.jpy.toFixed(2)}`;
    console.log(`[INFO] Updated channel ${token.symbol}: ${text}`);

    for (const channelId of TARGET_CHANNEL_IDS) {
      try {
        const channel = await client.channels.fetch(channelId);
        if (!channel || !channel.isTextBased()) {
          console.warn(`[WARN] チャンネルID ${channelId} がテキストチャンネルではありません`);
          continue;
        }

        if (MESSAGE_TYPE === 'embed') {
          const embed = new EmbedBuilder()
            .setTitle(`${token.symbol} Price`)
            .setDescription(text)
            .setColor(0x00FFAA)
            .setTimestamp();

          await channel.send({ embeds: [embed] });
        } else {
          await channel.send(text);
        }
      } catch (e) {
        console.error(`[ERROR] チャンネルID ${channelId} への送信失敗: ${e.message}`);
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

// Express で Render のポートバインド要件を満たす（無料プラン対策）
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
