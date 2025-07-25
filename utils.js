const fetch = require('node-fetch');

/**
 * 指定したトークンIDの価格（USD・JPY）を取得
 */
async function fetchPrices(id) {
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd,jpy`;
    const res = await fetch(url);
    const data = await res.json();

    // データ存在チェック
    if (!data || !data[id] || typeof data[id].usd !== 'number' || typeof data[id].jpy !== 'number') {
      throw new Error(`価格情報が不正または見つかりません: ${JSON.stringify(data)}`);
    }

    return {
      usd: data[id].usd,
      jpy: data[id].jpy
    };
  } catch (err) {
    console.error(`[ERROR] fetchPrices(${id}) 失敗:`, err.message);
    return null;
  }
}

module.exports = {
  fetchPrices
};

