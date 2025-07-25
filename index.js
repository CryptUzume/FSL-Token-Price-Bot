const { Client, GatewayIntentBits } = require('discord.js');
const fetch = require('node-fetch');

// Discord Bot Token（環境変数または直接記述）
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || 'YOUR_DISCORD_BOT_TOKEN';
const CHANNEL_ID = process.env.CHANNEL_ID || 'YOUR_CHANNEL_ID';

// 対象トークンのID（CoinGecko）
const tokenIds = {
  GMT: 'stepn',
  GST: 'green-satoshi-token',
  GGT: 'go-game-token',
};

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  postPrices(); // 初回起動時に即実行
  setInterval(postPrices, 60 * 60 * 1000); // 毎時更新（1時間）
});

async function fetchPrices() {
  const ids = Object.values(tokenIds).join(',');
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    const prices = {};

    for (const [symbol, id] of Object.entries(tokenIds)) {
      if (data[id] && data[id].usd) {
        prices[symbol] = data[id].usd.toFixed(6);
      } else {
        console.warn(`[WARN] ${symbol} の価格取得に失敗しました`);
        prices[symbol] = '取得失敗';
      }
    }

    return prices;
  } catch (err) {
    console.error('[ERROR] 価格取得失敗:', err.message);
    return null;
  }
}

async function postPrices() {
  const channel = await client.channels.fetch(CHANNEL_ID);
  if (!channel) {
    console.error('[ERROR] Discordチャンネルが見つかりません');
    return;
  }

  const prices = await fetchPrices();
  if (!prices) {
    channel.send('❌ トークン価格の取得に失敗しました。しばらくして再試行します。');
    return;
  }

  const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const message = `🪙 トークン価格（${now} 更新）\n\n` +
    Object.entries(prices)
      .map(([symbol, price]) => `・${symbol}: $${price}`)
      .join('\n');

  channel.send(message);
}

client.login(DISCORD_TOKEN);
