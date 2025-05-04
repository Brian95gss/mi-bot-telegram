const express = require("express");
const axios = require("axios");
const { Telegraf } = require("telegraf");
const { nuevasDivisas, nuevasCriptos } = require("./nuevasMonedas");

const app = express();
const bot = new Telegraf("7617489508:AAEBj_jgwWcd81GAvqHPm6nRYhrF2y0FTbQ"); // ⚠️ TOKEN TEMPORAL
const chatId = "6062771979";
const MONTO_ARS = 500000;
const UMBRAL_GANANCIA = 1000;

const fiatCurrencies = ["ars", "usd", "usdt"];
const allFiatCurrencies = [...new Set([...fiatCurrencies, ...nuevasDivisas])];
const cryptoList = [
  "btc", "eth", "usdt", "usdc", "dai", "criptodolar", "pax", "nuars", "sol",
  "bnb", "wld", "xrp", "ada", "avax", "doge", "trx", "link", "matic", "dot",
  "shib", "ltc", "bch", "eos", "xlm", "ftm", "aave", "uni", "algo", "bat",
  "paxg", "cake", "axs", "slp", "mana", "sand", "chz"
];
const allCryptoList = [...new Set([...cryptoList, ...nuevasCriptos])];

const exchanges = [
  "letsbit", "universalcoins", "binance", "binancep2p", "fiwind", "trubit",
  "pollux", "pluscrypto", "tiendacrypto", "bitsoalpha", "cocoscrypto",
  "decrypto", "buenbit", "saldo", "ripio", "ripiotrade", "belo",
  "cryptomarketpro", "satoshitango", "paxful", "eluter", "lnp2pbot",
  "bybitp2p", "kriptonmarket", "kucoinp2p", "bitgetp2p", "htxp2p",
  "lemoncashp2p", "eldoradop2p", "coinexp2p", "vesseo", "dolarapp", "bitso"
];

const exchangeFees = {
  letsbit: { buy: 0, sell: 0 }, universalcoins: { buy: 0.0025, sell: 0.0025 },
  binance: { buy: 0.0007, sell: 0.0107 }, binancep2p: { buy: 0, sell: 0 },
  fiwind: { buy: 0, sell: 0 }, trubit: { buy: 0.005, sell: 0.005 },
  pollux: { buy: 0, sell: 0 }, pluscrypto: { buy: 0, sell: 0 },
  tiendacrypto: { buy: 0, sell: 0 }, bitsoalpha: { buy: 0.006, sell: 0.006 },
  cocoscrypto: { buy: 0, sell: 0 }, decrypto: { buy: 0.0035, sell: 0.0035 },
  buenbit: { buy: 0, sell: 0 }, saldo: { buy: 0, sell: 0 },
  ripio: { buy: 0.005, sell: 0.005 }, ripiotrade: { buy: 0.005, sell: 0.005 },
  belo: { buy: 0, sell: 0 }, cryptomarketpro: { buy: 0.0119, sell: 0.0119 },
  satoshitango: { buy: 0.005, sell: 0.005 }, paxful: { buy: 0, sell: 0.01 },
  eluter: { buy: 0.01, sell: 0.01 }, lnp2pbot: { buy: 0, sell: 0.006 },
  bybitp2p: { buy: 0, sell: 0 }, kriptonmarket: { buy: 0.048, sell: 0.03 },
  kucoinp2p: { buy: 0, sell: 0 }, bitgetp2p: { buy: 0, sell: 0 },
  htxp2p: { buy: 0, sell: 0 }, lemoncashp2p: { buy: 0.015, sell: 0.015 }
};

const BSC_API_KEY = "BZED56H367KMXFWS7T5S8MJ1FRCNKPIB9Z";
const MAX_REQUESTS_PER_EXECUTION = 115;
const BLOQUE_MONEDAS = 10;

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

function aplicarFee(exchange, precio, tipo) {
  const fee = exchangeFees[exchange]?.[tipo] ?? 0;
  return tipo === "buy"
    ? precio * (1 + fee)
    : precio * (1 - fee);
}

async function getBestPrices(symbol, currency) {
  try {
    const url = `https://criptoya.com/api/${symbol}/${currency}/0.1`;
    const { data } = await axios.get(url);
    const prices = exchanges
      .map((ex) => {
        const buy = data[ex]?.totalAsk;
        const sell = data[ex]?.totalBid;
        if (buy && sell) {
          return {
            exchange: ex,
            buyPrice: aplicarFee(ex, buy, "buy"),
            sellPrice: aplicarFee(ex, sell, "sell")
          };
        }
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

async function getBNBBlockNumber() {
  try {
    const res = await axios.get(
      `https://api.bscscan.com/api?module=proxy&action=eth_blockNumber&apikey=${BSC_API_KEY}`
    );
    return parseInt(res.data.result, 16);
  } catch {
    return null;
  }
}

async function sendMessage() {
  const results = [];
  let requestCount = 0;

  const selectedCryptos = allCryptoList.slice(0, BLOQUE_MONEDAS);

  for (const symbol of selectedCryptos) {
    for (const currency of allFiatCurrencies) {
      if (symbol === currency || requestCount >= MAX_REQUESTS_PER_EXECUTION - 5) break;
      if (!fiatCurrencies.includes(symbol) && !fiatCurrencies.includes(currency)) continue;

      const criptoYa = await getBestPrices(symbol, currency);
      requestCount++;

      if (!criptoYa) continue;

      const bestBuy = criptoYa.bestBuy;
      const bestSell = criptoYa.bestSell;

      const coins = MONTO_ARS / bestBuy.buyPrice;
      const result = coins * bestSell.sellPrice;
      const gain = result - MONTO_ARS;

      if (gain < UMBRAL_GANANCIA) continue;

      results.push({
        pair: `${symbol.toUpperCase()}/${currency.toUpperCase()}`,
        buy: bestBuy,
        sell: bestSell,
        amountIn: MONTO_ARS,
        coins,
        result,
        gain,
        type: "simple",
      });

      await delay(400);
    }
  }

  for (const from of selectedCryptos) {
    for (const mid of selectedCryptos) {
      if (from === mid || requestCount >= MAX_REQUESTS_PER_EXECUTION - 2) break;
      for (const to of fiatCurrencies) {
        const a = await getBestPrices(from, mid);
        requestCount++;
        const b = await getBestPrices(mid, to);
        requestCount++;

        if (!a || !b) continue;

        const coins1 = MONTO_ARS / a.bestBuy.buyPrice;
        const result = coins1 * b.bestSell.sellPrice;
        const gain = result - MONTO_ARS;

        if (gain < UMBRAL_GANANCIA) continue;

        results.push({
          pair: `${from.toUpperCase()} → ${mid.toUpperCase()} → ${to.toUpperCase()}`,
          buy: a.bestBuy,
          sell: b.bestSell,
          amountIn: MONTO_ARS,
          coins: coins1,
          result,
          gain,
          type: "triangular",
        });

        await delay(400);
      }
    }
  }

  if (!results.length) return;

  results.sort((a, b) => b.gain - a.gain);

  let msg = `📊 Simulación con ${MONTO_ARS} ARS\n\n`;
  for (const r of results.slice(0, 10)) {
    msg += `🔄 Tipo: ${r.type.toUpperCase()}\n`;
    msg += `💱 Ruta: ${r.pair}\n`;
    msg += `🔽 Comprar en ${r.buy.exchange} a $${r.buy.buyPrice.toFixed(2)}\n`;
    msg += `🔼 Vender en ${r.sell.exchange} a $${r.sell.sellPrice.toFixed(2)}\n`;
    msg += `➡️ Obtenés: $${r.result.toFixed(2)} (Ganancia: $${r.gain.toFixed(2)})\n\n`;
  }

  const block = await getBNBBlockNumber();
  if (block) msg += `📦 Último bloque BNB Chain: ${block}`;

  try {
    await bot.telegram.sendMessage(chatId, msg);
    console.log("✅ Mensaje enviado con éxito.");
  } catch (err) {
    console.error("❌ Error al enviar mensaje:", err.message);
  }
}

setInterval(sendMessage, 180000);

app.get("/", (_, res) => {
  res.send("Bot de arbitraje en funcionamiento.");
});

app.listen(3000, () => {
  console.log("Servidor activo en el puerto 3000");
});

bot.telegram
  .sendMessage(chatId, "✅ Bot de arbitraje iniciado. Esperando oportunidades...")
  .then(() => console.log("Mensaje inicial enviado."))
  .catch((err) => console.error("❌ Error al enviar mensaje inicial:", err.message));
