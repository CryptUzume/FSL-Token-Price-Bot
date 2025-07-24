require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fetch = require('node-fetch');
const express = require("express");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const app = express();
const PORT = process.env.PORT || 3000;

// Discord Bot Token 読み込み
const TOKEN = process.env.DISCORD_BOT_TOKEN;
if (!TOKEN) {
  throw new Error("DISCORD_BOT_TOKEN が設定されていません（Secretsに登録してください）");
}

// トークンとチャンネルの設定
const TOKEN_IDS = {
  GMT: 'stepn',
  GST: 'green-satoshi-token',
  GGT: 'go-game-token'
};

const CHANNEL_IDS = {
  GMT: '1367887693446643804',
  GST: '1367887745086787594',
  GGT: '1367888140534153266'
};

const TOKEN_EMOJIS = {
  GMT: '🟡',
  GST: '⚪',
  GGT: '🟣'
};

// Bot準備完了時の処理
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  updatePrices(); // 初回実行
  setInterval(updatePrices, 5 * 60 * 1000); // 5分ごとに実行
});

// 価格更新関数
async function updatePrices() {
  for (const symbol in TOKEN_IDS) {
    const id = TOKEN_IDS[symbol];
    try {
      console.log(`[DEBUG] Fetching price for ${id}`);
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd,jpy`);
      const data = await response.json();

      const usd = data[id].usd.toFixed(3);
      const jpy = data[id].jpy.toFixed(2);
      const emoji = TOKEN_EMOJIS[symbol] || '';
      const newName = `${emoji} ${symbol}: $${usd} / ¥${jpy}`;

      const channel = await client.channels.fetch(CHANNEL_IDS[symbol]);
      await channel.setName(newName);
      console.log(`[INFO] Updated channel ${symbol}: ${newName}`);

      await new Promise(resolve => setTimeout(resolve, 5000)); // レート制限対策

    } catch (error) {
      console.error(`[ERROR] Failed to update channel ${symbol}: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}

// Expressサーバー（Ping用ルート）
app.get("/", (req, res) => {
  res.send("Bot is alive!");
});

app.listen(PORT, () => {
  console.log(`🌐 Web server is running at http://localhost:${PORT}`);
});

// Bot起動
client.login(TOKEN);
