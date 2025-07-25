const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

const TOKEN = process.env.DISCORD_TOKEN;
const UPDATE_FREQUENCY = parseInt(process.env.UPDATE_FREQUENCY) || 3600000;
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

async function fetchPrices(tokenId) {
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${tokenId}&vs_currencies=usd,jpy`;
    const { data } = await axios.get(url);
    const price = data[tokenId];
    if (!price || !price.usd || !price.jpy) throw new Error("価格情報が不正または見つかりません");
    return { usd: price.usd, jpy: price.jpy };
  } catch (err) {
    console.error(`[ERROR] fetchPrices(${tokenId}) 失敗: ${err.message}`);
    return null;
  }
}

async function updateChannels() {
  for (const token of tokens) {
    const price = await fetchPrices(token.id);
    if (!price) {
      console.warn(`[WARN] ${token.symbol} の価格取得に失敗しました`);
      continue;
    }

    const text = `${token.emoji} ${token.symbol}: $${price.usd.toFixed(3)} / ¥${price.jpy.toFixed(2)}`;
    console.log(`[INFO] Updated channel ${token.symbol}: ${text}`);

    for (const channelId of TARGET_CHANNEL_IDS) {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) continue;

      if (MESSAGE_TYPE === 'embed') {
        const embed = new EmbedBuilder()
          .setTitle(`${token.symbol} Price`)
          .setDescription(text)
          .setColor(0x00FFAA)
          .setTimestamp();
        await channel.send({ embeds: [embed] }).catch(console.error);
      } else {
        await channel.send(text).catch(console.error);
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
const http = require('http');
http.createServer((_, res) => {
  res.write('Bot is running');
  res.end();
}).listen(process.env.PORT || 10000, () => {
  console.log(`🌐 Web server is running at http://localhost:${process.env.PORT || 10000}`);
});

client.login(TOKEN);

// --- ExpressでRenderのポート要求を満たすためだけの簡易サーバー ---
const express = require("express");
const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.send("Bot is running!");
});

app.listen(PORT, () => {
  console.log(`🌐 Web server is running at http://localhost:${PORT}`);
});

