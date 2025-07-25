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
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coin.id}&vs_currencies=usd,jpy`;

    try {
      console.log(`[DEBUG] Fetching price for ${coin.id}`);
      const res = await fetch(url);
      const json = await res.json();

      if (json[coin.id] && json[coin.id].usd !== undefined && json[coin.id].jpy !== undefined) {
        prices.push({ name: coin.name, usd: json[coin.id].usd, jpy: json[coin.id].jpy });
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
  const prices = await fetchPrices();
  if (prices.length === 0) {
    console.warn("⚠️ 投稿する価格データがありません");
    return;
  }

  for (const id of channelIds) {
    const channel = await client.channels.fetch(id).catch(err => {
      console.error(`❌ チャンネルID ${id} の取得に失敗:`, err.message);
    });

    if (!channel) continue;

    for (const p of prices) {
      const message = `🔹 **${p.name}**: $${p.usd.toFixed(3)} / ¥${p.jpy.toFixed(2)}`;

      if (MESSAGE_TYPE === 'embed') {
        await channel.send({
          embeds: [
            {
              title: `💰 ${p.name} 価格情報`,
              description: message,
              color: 0x00cc99,
              timestamp: new Date().toISOString()
            }
          ]
        }).catch(err => {
          console.error(`❌ ${p.name} の送信失敗:`, err.message);
        });
      } else {
        await channel.send(message).catch(err => {
          console.error(`❌ ${p.name} の送信失敗:`, err.message);
        });
      }

      console.info(`[INFO] Updated channel ${p.name}: ${message}`);
    }
  }
}

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  if (BOARDCAST) {
    postPrices();
  }

  if (UPDATE_STATUS) {
    setInterval(postPrices, UPDATE_FREQUENCY);
  }
});

client.login(DISCORD_TOKEN);
