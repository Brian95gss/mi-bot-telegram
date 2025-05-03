const axios = require('axios');
const { Telegraf } = require('telegraf');

// Token y chat ID proporcionados
const bot = new Telegraf("7617489508:AAEBj_jgwWcd81GAvqHPm6nRYhrF2y0FTbQ");
const chatId = "6062771979";

const MONTO_ARS = 500000;
const UMBRAL_GANANCIA = 1000;
const BLOQUE_MONEDAS = 5;
const MAX_REQUESTS_PER_EXECUTION = 110;
const INTERVALO_EJECUCION_MS = 65000;
let bloqueActual = 0;

// Criptomonedas
const allCryptoList = [
  "btc", "eth", "usdt", "usdc", "dai", "criptodolar", "pax", "nuars", "sol",
  "bnb", "wld", "xrp", "ada", "avax", "doge", "trx", "link", "matic", "dot",
  "shib", "ltc", "bch", "eos", "xlm", "ftm", "aave", "uni", "algo", "bat",
  "paxg", "cake", "axs", "slp", "mana", "sand", "chz"
];

// Solo se consideran estos como destinos finales
const fiatAndStables = ["ars", "usd", "usdt", "usdc", "dai"];

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getBestPrices(from, to) {
  try {
    const response = await axios.get(`https://criptoya.com/api/${from}/${to}/1`);
    const data = response.data;
    let bestBuy = { buyPrice: Infinity, exchange: null };
    let bestSell = { sellPrice: 0, exchange: null };

    for (const [exchange, info] of Object.entries(data)) {
      if (info.compra && info.compra < bestBuy.buyPrice) {
        bestBuy = { buyPrice: info.compra, exchange };
      }
      if (info.venta && info.venta > bestSell.sellPrice) {
        bestSell = { sellPrice: info.venta, exchange };
      }
    }

    if (bestBuy.exchange && bestSell.exchange) {
      return { bestBuy, bestSell };
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function buscarTriangularesPorBloque() {
  const totalBloques = Math.ceil(allCryptoList.length / BLOQUE_MONEDAS);
  const fromCryptos = allCryptoList.slice(bloqueActual * BLOQUE_MONEDAS, (bloqueActual + 1) * BLOQUE_MONEDAS);
  const results = [];
  const cache = {};
  let requestCount = 0;

  for (const from of fromCryptos) {
    for (const mid of allCryptoList) {
      if (from === mid || requestCount >= MAX_REQUESTS_PER_EXECUTION - 2) break;

      for (const to of fiatAndStables) {
        const key1 = `${from}-${mid}`;
        const key2 = `${mid}-${to}`;

        if (!cache[key1]) {
          cache[key1] = await getBestPrices(from, mid);
          requestCount++;
          await delay(400);
        }
        if (!cache[key2]) {
          cache[key2] = await getBestPrices(mid, to);
          requestCount++;
          await delay(400);
        }

        const a = cache[key1];
        const b = cache[key2];
        if (!a || !b) continue;

        const coins1 = MONTO_ARS / a.bestBuy.buyPrice;
        const result = coins1 * b.bestSell.sellPrice;
        const gain = result - MONTO_ARS;

        if (gain >= UMBRAL_GANANCIA) {
          results.push({
            pair: `${from.toUpperCase()} → ${mid.toUpperCase()} → ${to.toUpperCase()}`,
            buy: a.bestBuy,
            sell: b.bestSell,
            result,
            gain
          });
        }
      }
    }
  }

  if (results.length) {
    results.sort((a, b) => b.gain - a.gain);
    let msg = `📊 Triangulares con ${MONTO_ARS} ARS (bloque ${bloqueActual + 1}/${totalBloques})\n\n`;
    for (const r of results.slice(0, 10)) {
      msg += `🔄 Ruta: ${r.pair}\n`;
      msg += `🔽 Comprar en ${r.buy.exchange} a $${r.buy.buyPrice.toFixed(2)}\n`;
      msg += `🔼 Vender en ${r.sell.exchange} a $${r.sell.sellPrice.toFixed(2)}\n`;
      msg += `➡️ Obtenés: $${r.result.toFixed(2)} (Ganancia: $${r.gain.toFixed(2)})\n\n`;
    }
    await bot.telegram.sendMessage(chatId, msg);
  } else {
    console.log(`⏭️ Bloque ${bloqueActual + 1}/${totalBloques} sin resultados.`);
  }

  bloqueActual = (bloqueActual + 1) % totalBloques;
}

setInterval(buscarTriangularesPorBloque, INTERVALO_EJECUCION_MS);
buscarTriangularesPorBloque();
