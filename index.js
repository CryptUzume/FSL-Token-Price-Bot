const axios = require("axios");
const { Client, GatewayIntentBits } = require("discord.js");
const express = require("express");

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const TARGET_CHANNEL_IDS = (process.env.TARGET_CHANNEL_IDS || "")
  .split(",")
  .map((id) => id.trim());

console.log("[DEBUG] TARGET_CHANNEL_IDS =", TARGET_CHANNEL_IDS);

const tokenMap = {
  stepn: {
    symbol: "GMT",
    emoji: "🟡",
    channelIndex: 0,
  },
  "green-satoshi-token": {
    symbol: "GST",
    emoji: "⚪",
    channelIndex: 1,
  },
  "go-game-token": {
    symbol: "GGT",
    emoji: "🟣",
    channelIndex: 2,
  },
};

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  updateChannelNames();
  setInterval(updateChannelNames, 10 * 60 * 1000); // 10分ごとに更新
});

async function fetchPricesWithRetry(ids, retries = 3, delay = 5000) {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd,jpy`;

  for (let i = 0; i <= retries; i++) {
    try {
      const response = await axios.get(url);
      console.log("[DEBUG] fetchPrices success for:", ids.join(","));
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 429) {
        if (i < retries) {
          console.warn(
            `[WARN] 429 Too Many Requests: リトライします。残り回数: ${retries - i}, ${delay / 1000}秒待機中...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          console.error("[ERROR] fetchPrices failed:", error.message);
          return null;
        }
      } else {
        console.error("[ERROR] fetchPrices unexpected error:", error.message);
        return null;
      }
    }
  }
}

async function updateChannelNames() {
  const ids = Object.keys(tokenMap);
  const prices = await fetchPricesWithRetry(ids);

  if (!prices) {
    console.warn("[WARN] 価格データ取得に失敗したため更新処理を中止します");
    return;
  }

  for (const [id, info] of Object.entries(tokenMap)) {
    const usd = prices[id]?.usd?.toFixed(3);
    const jpy = prices[id]?.jpy?.toFixed(2);

    if (!usd || !jpy) {
      console.warn(`[WARN] ${id} の価格データが取得できませんでした`);
      continue;
    }

    const newName = `${info.emoji} ${info.symbol}: $${usd} / ¥${jpy}`;
    const channelId = TARGET_CHANNEL_IDS[info.channelIndex];

    try {
      const channel = await client.channels.fetch(channelId);
      if (channel && channel.isVoiceBased()) {
        await channel.setName(newName);
        console.log(`[RENAME] Channel ${channelId} renamed to: ${newName}`);
      } else {
        console.warn(`[SKIP] ${channelId} はボイスチャンネルではありません`);
      }
    } catch (err) {
      console.error(`[ERROR] Failed to rename channel ${channelId}:`, err.message);
    }
  }
}

// Webサーバー（Render用）
const app = express();
const PORT = process.env.PORT || 10000;
app.get("/", (req, res) => res.send("Bot is running"));
app.listen(PORT, () =>
  console.log(`🌐 Web server is running at http://localhost:${PORT}`)
);

client.login(DISCORD_TOKEN);
