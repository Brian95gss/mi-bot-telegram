const axios = require("axios");
const { Telegraf } = require("telegraf");
const { nuevasDivisas, nuevasCriptos } = require("./nuevasMonedas");

const bot = new Telegraf("7617489508:AAEBj_jgwWcd81GAvqHPm6nRYhrF2y0FTbQ");
const chatId = "6062771979";

const MONTO_ARS = 500000;
const UMBRAL_GANANCIA = 1000;
const DELAY_MS = 600; // Espera entre requests (600 ms ≈ 100 requests por minuto)

const divisasExcluidas = ["eur", "brl", "clp", "mxn", "cop", "pen", "pyg", "uyu"];

const cryptoList = [
  "btc", "eth", "usdt", "usdc", "dai", "criptodolar", "pax", "nuars", "sol",
  "bnb", "wld", "xrp", "ada", "avax", "doge", "trx", "link", "matic", "dot",
  "shib", "ltc", "bch", "eos", "xlm", "ftm", "aave", "uni", "algo", "bat",
  "paxg", "cake", "axs", "slp", "mana", "sand", "chz",
  "apt", "arb", "op", "imx", "gmx", "rune", "mina", "one", "icp", "render",
  "sui", "sei", "kas", "egld", "kava", "hbar", "theta", "zilliqa", "neo",
  "coti", "enj", "flow", "grt", "snx", "comp", "crv", "cvx", "yfi", "lrc",
  "sushi", "1inch", "fet", "ocean", "mask", "bnt", "rpl", "ankr", "arweave",
  "stx", "bal", "flux", "nexo", "qtum", "zil", "zrx"
];

const fiatCurrenciesBase = ["ars", "usd", "usdt"];
const allFiatCurrencies = [...new Set([...fiatCurrenciesBase, ...nuevasDivisas])].filter(f => !divisasExcluidas.includes(f));
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
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getBestPrices(symbol, currency) {
  try {
    const urlCriptoYa = `https://criptoya.com/api/${symbol}/${currency}/0.1`;
    const { data: criptoYaData } = await axios.get(urlCriptoYa);

    const prices = exchanges
      .map((ex) => {
        const buy = criptoYaData[ex]?.totalAsk;
        const sell = criptoYaData[ex]?.totalBid;
        if (buy && sell) return { exchange: ex, buyPrice: buy, sellPrice: sell };
        return null;
      })
      .filter(Boolean);

    if (!prices.length) return null;

    const bestBuy = prices.reduce((a, b) => (a.buyPrice < b.buyPrice ? a : b));
    const bestSell = prices.reduce((a, b) => (a.sellPrice > b.sellPrice ? a : b));

    return { pair: `${symbol.toUpperCase()}/${currency.toUpperCase()}`, bestBuy, bestSell };
  } catch (err) {
    if (err.response && err.response.status === 404) {
      // Par no disponible, lo ignoramos silenciosamente
      return null;
    }
    console.error("Error al obtener precios:", symbol, currency, err.message);
    return null;
  }
}

async function buscarArbitrajes() {
  const results = [];

  for (const symbol of [...allCryptoList, ...fiatCurrenciesBase]) {
    for (const currency of [...allCryptoList, ...allFiatCurrencies]) {
      if (symbol === currency) continue;

      const esDivisa1 = allFiatCurrencies.includes(symbol);
      const esDivisa2 = allFiatCurrencies.includes(currency);

      if (esDivisa1 && esDivisa2 && !(
        (symbol === "usd" && currency === "usdt") || 
        (symbol === "usdt" && currency === "ars")
      )) continue;

      if (!fiatCurrenciesBase.includes(symbol) && !fiatCurrenciesBase.includes(currency) && (esDivisa1 || esDivisa2)) continue;

      try {
        const res = await getBestPrices(symbol, currency);
        await delay(DELAY_MS);

        if (!res) continue;

        const { bestBuy, bestSell } = res;
        const coins = MONTO_ARS / bestBuy.buyPrice;
        const result = coins * bestSell.sellPrice;
        const gain = result - MONTO_ARS;

        if (gain >= UMBRAL_GANANCIA) {
          results.push({
            pair: res.pair,
            buy: bestBuy,
            sell: bestSell,
            coins,
            result,
            gain
          });
        }
      } catch (err) {
        console.error("Error en arbitraje:", err.message);
      }
    }
  }

  if (!results.length) return;

  results.sort((a, b) => b.gain - a.gain);

  let msg = `📊 Simples con ${MONTO_ARS} ARS\n\n`;
  for (const r of results.slice(0, 10)) {
    msg += `💱 Par: ${r.pair}\n`;
    msg += `🔽 Comprar en ${r.buy.exchange} a $${r.buy.buyPrice.toFixed(2)}\n`;
    msg += `🔼 Vender en ${r.sell.exchange} a $${r.sell.sellPrice.toFixed(2)}\n`;
    msg += `➡️ Obtenés: $${r.result.toFixed(2)} (Ganancia: $${r.gain.toFixed(2)})\n\n`;
  }

  try {
    await bot.telegram.sendMessage(chatId, msg);
    console.log("✅ Mensaje simples enviado.");
  } catch (err) {
    console.error("❌ Error al enviar mensaje:", err.message);
  }
}

setInterval(buscarArbitrajes, 180000);

bot.telegram
  .sendMessage(chatId, "📉 index.js iniciado. Analizando operaciones simples...")
  .then(() => console.log("✅ Script index.js activo."))
  .catch((err) => console.error("❌ Error al iniciar:", err.message));
