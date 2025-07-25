// index.js
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

const TOKEN = process.env.DISCORD_TOKEN;
const UPDATE_FREQUENCY = parseInt(process.env.UPDATE_FREQUENCY) || 3600000; // 1時間デフォルト
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

// 一括価格取得関数
async function fetchAllPrices(tokenList) {
  const ids = tokenList.map(t => t.id).join(',');
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd,jpy`;

  try {
    const { data } = await axios.get(url);
    return data;
  } catch (err) {
    console.error(`[ERROR] fetchAllPrices 失敗: ${err.message}`);
    return null;
  }
}

async function updateChannels() {
  const priceData = await fetchAllPrices(tokens);
  if (!priceData) {
    console.warn("[WARN] 価格データ取得に失敗しました");
    return;
  }

  for (const token of tokens) {
    const price = priceData[token.id];
    if (!price || !price.usd || !price.jpy) {
      console.warn(`[WARN] ${token.symbol} の価格情報が不正または見つかりません`);
      continue;
    }

    const text = `${token.emoji} ${token.symbol}: $${price.usd.toFixed(3)} / ¥${price.jpy.toFixed(2)}`;
    console.log(`[INFO] Updated channel ${token.symbol}: ${text}`);

    for (const channelId of TARGET_CHANNEL_IDS) {
      try {
        const channel = await client.channels.fetch(channelId);
        if (!channel || !channel.isTextBased()) continue;

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
      } catch (err) {
        console.error(`[ERROR] チャンネル送信失敗 (${channelId}): ${err.message}`);
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

// Renderのポートバインディング用Webサーバー（Express）
const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('Bot is running!');
});

app.listen(PORT, () => {
  console.log(`🌐 Web server is running at http://localhost:${PORT}`);
});

client.login(TOKEN);
