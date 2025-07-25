const { Client, GatewayIntentBits } = require('discord.js');
const fetch = require('node-fetch');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const UPDATE_FREQUENCY = Number(process.env.UPDATE_FREQUENCY) || 3600000; // default: 1 hour
const UPDATE_STATUS = process.env.UPDATE_STATUS === 'on';
const BOARDCAST = process.env.BOARDCAST === 'on';
const TARGET_CHANNEL_IDS = process.env.TARGET_CHANNEL_IDS || '';
const MESSAGE_TYPE = process.env.MESSAGE_TYPE || 'embed';

const channelIds = TARGET_CHANNEL_IDS.split(',').map(id => id.trim()).filter(Boolean);

if (channelIds.length === 0) {
  console.error("❌ エラー: TARGET_CHANNEL_IDS が設定されていません。");
  process.exit(1);
}

async function fetchPrices() {
  const prices = [];

  const coins = [
    { name: 'GMT', id: 'stepn' },
    { name: 'GST', id: 'green-satoshi-token' },
    { name: 'GGT', id: 'go-game-token' }
  ];

  for (const coin of coins) {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coin.id}&vs_currencies=usd`;

    try {
      console.log(`[DEBUG] Fetching price for ${coin.id}`);
      const res = await fetch(url);
      const json = await res.json();

      if (json[coin.id] && json[coin.id].usd !== undefined) {
        prices.push({ name: coin.name, usd: json[coin.id].usd });
      } else {
        console.warn(`[WARN] ${coin.name} の価格取得に失敗しました`);
      }
    } catch (err) {
      console.error(`[ERROR] fetchPrices(${coin.id}) 失敗:`, err);
    }
  }

  return prices;
}

async function postPrices() {
  const prices =
