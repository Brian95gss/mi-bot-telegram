const axios = require("axios");
const { Telegraf } = require("telegraf");
const { nuevasDivisas, nuevasCriptos } = require("./nuevasMonedas");

const bot = new Telegraf("7617489508:AAEBj_jgwWcd81GAvqHPm6nRYhrF2y0FTbQ");
const chatId = "6062771979";

const MONTO_ARS = 500000;
const UMBRAL_GANANCIA = 1000;
const MAX_REQUESTS_PER_EXECUTION = 115;
const BLOQUE_MONEDAS = 10;

const fiatCurrencies = ["ars", "usd", "usdt"];
const cryptoList = [
  "btc", "eth", "usdt", "usdc", "dai", "criptodolar", "pax", "nuars", "sol",
  "bnb", "wld", "xrp", "ada", "avax", "doge", "trx", "link", "matic", "dot",
  "shib", "ltc", "bch", "eos", "xlm", "ftm", "aave", "uni", "algo", "bat",
  "paxg", "cake", "axs", "slp", "mana", "sand", "chz"
];

const allFiatCurrencies = [...new Set([...fiatCurrencies, ...nuevasDivisas])];
const allCryptoList = [...new Set([...cryptoList, ...nuevasCriptos])];

const exchanges = [
  "letsbit", "universalcoins", "binance", "binancep2p", "fiwind", "trubit",
  "pollux", "pluscrypto", "tiendacrypto", "bitsoalpha", "cocoscrypto",
  "decrypto", "buenbit", "saldo", "ripio", "ripiotrade", "belo",
  "cryptomarketpro", "satoshitango", "paxful", "eluter", "lnp2pbot",
  "bybitp2p", "kriptonmarket", "kucoinp2p", "bitgetp2p", "htxp2p",
  "lemoncashp2p", "eldoradop2p", "coinexp2p", "vesseo", "dolarapp", "bitso"
];

async function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function getBestPrices(symbol, currency) {
  try {
    const url = `https://criptoya.com/api/${symbol}/${currency}/0.1`;
    const { data } = await axios.get(url);
    const prices = exchanges
      .map((ex) => {
        const buy = data[ex]?.totalAsk;
        const sell = data[ex]?.totalBid;
        if (buy && sell) return { exchange: ex, buyPrice: buy, sellPrice: sell };
        return null;
      })
      .filter(Boolean);
    if (!prices.length) return null;
    const bestBuy = prices.reduce((a, b) => (a.buyPrice < b.buyPrice ? a : b));
    const bestSell = prices.reduce((a, b) => (a.sellPrice > b.sellPrice ? a : b));
    return { pair: `${symbol.toUpperCase()}/${currency.toUpperCase()}`, bestBuy, bestSell };
  } catch {
    return null;
  }
}

async function buscarTriangulares() {
  const results = [];
  let requestCount = 0;
  const selectedCryptos = allCryptoList.slice(0, BLOQUE_MONEDAS);

  for (const from of selectedCryptos) {
    for (const mid of selectedCryptos) {
      if (from === mid || requestCount >= MAX_REQUESTS_PER_EXECUTION - 2) break;
      for (const to of allFiatCurrencies) {
        try {
          const a = await getBestPrices(from, mid);
          requestCount++;
          const b = await getBestPrices(mid, to);
          requestCount++;

          if (!a || !b) continue;

          const aBuy = a.bestBuy.buyPrice;
          const bSell = b.bestSell.sellPrice;

          const coins1 = MONTO_ARS / aBuy;
          const result = coins1 * bSell;
          const gain = result - MONTO_ARS;

          if (gain < UMBRAL_GANANCIA) continue;

          results.push({
            pair: `${from.toUpperCase()} → ${mid.toUpperCase()} → ${to.toUpperCase()}`,
            buy: a.bestBuy,
            sell: b.bestSell,
            amountIn: MONTO_ARS,
            coins: coins1,
            result,
            gain
          });

          await delay(400);
        } catch {}
      }
    }
  }

  if (!results.length) return;

  results.sort((a, b) => b.gain - a.gain);

  let msg = `📊 Triangulares con ${MONTO_ARS} ARS\n\n`;
  for (const r of results.slice(0, 10)) {
    msg += `🔄 Tipo: TRIANGULAR\n`;
    msg += `💱 Ruta: ${r.pair}\n`;
    msg += `🔽 Comprar en ${r.buy.exchange} a $${r.buy.buyPrice.toFixed(2)}\n`;
    msg += `🔼 Vender en ${r.sell.exchange} a $${r.sell.sellPrice.toFixed(2)}\n`;
    msg += `➡️ Obtenés: $${r.result.toFixed(2)} (Ganancia: $${r.gain.toFixed(2)})\n\n`;
  }

  try {
    await bot.telegram.sendMessage(chatId, msg);
    console.log("✅ Mensaje triangulares enviado.");
  } catch (err) {
    console.error("❌ Error al enviar triangulares:", err.message);
  }
}

// Ejecutar cada 2 minutos
setInterval(buscarTriangulares, 120000);

bot.telegram
  .sendMessage(chatId, "📈 Triangulares.js iniciado. Analizando rutas triangulares...")
  .then(() => console.log("✅ Script triangulares activo."))
  .catch((err) => console.error("❌ Error al iniciar triangulares:", err.message));
