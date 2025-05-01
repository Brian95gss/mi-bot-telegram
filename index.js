const express = require("express");
const axios = require("axios");
const { Telegraf } = require("telegraf");

const app = express();
const bot = new Telegraf("7617489508:AAEBj_jgwWcd81GAvqHPm6nRYhrF2y0FTbQ");
const chatId = "6062771979";

// Lista extendida de criptomonedas
const cryptoList = [
  "btc",
  "eth",
  "usdt",
  "usdc",
  "dai",
  "criptodolar",
  "pax",
  "nuars",
  "sol",
  "bnb",
  "wld",
  "xrp",
  "ada",
  "avax",
  "doge",
  "trx",
  "link",
  "matic",
  "dot",
  "shib",
  "ltc",
  "bch",
  "eos",
  "xlm",
  "ftm",
  "aave",
  "uni",
  "algo",
  "bat",
  "paxg",
  "cake",
  "axs",
  "slp",
  "mana",
  "sand",
  "chz",
];

const pairs = [];
const fiatCurrencies = ["ars", "usd", "usdt"];
cryptoList.forEach((symbol) => {
  fiatCurrencies.forEach((currency) => {
    if (symbol !== currency) pairs.push({ symbol, currency });
  });
});

// Exchanges compatibles (CriptoYa)
const exchanges = [
  "letsbit",
  "universalcoins",
  "binance",
  "binancep2p",
  "fiwind",
  "trubit",
  "pollux",
  "pluscrypto",
  "tiendacrypto",
  "bitsoalpha",
  "cocoscrypto",
  "decrypto",
  "buenbit",
  "saldo",
  "ripio",
  "ripiotrade",
  "belo",
  "cryptomarketpro",
  "satoshitango",
  "paxful",
  "eluter",
  "lnp2pbot",
  "bybitp2p",
  "kriptonmarket",
  "kucoinp2p",
  "bitgetp2p",
  "htxp2p",
  "lemoncashp2p",
  "eldoradop2p",
  "coinexp2p",
  "vesseo",
  "dolarapp",
  "bitso",
];

// Obtener precios de CriptoYa
async function getBestPrices(symbol, currency) {
  const url = `https://criptoya.com/api/${symbol}/${currency}/0.1`;
  try {
    const response = await axios.get(url);
    const data = response.data;

    const prices = exchanges
      .map((ex) => {
        const buyPrice = data[ex]?.totalAsk;
        const sellPrice = data[ex]?.totalBid;
        if (buyPrice && sellPrice) {
          return { exchange: ex, buyPrice, sellPrice };
        }
        return null;
      })
      .filter((p) => p !== null);

    if (prices.length === 0) return null;

    const buyExchange = prices.reduce((min, ex) =>
      ex.buyPrice < min.buyPrice ? ex : min
    );
    const sellExchange = prices.reduce((max, ex) =>
      ex.sellPrice > max.sellPrice ? ex : max
    );

    return {
      pair: `${symbol.toUpperCase()}/${currency.toUpperCase()}`,
      buyExchange,
      sellExchange,
    };
  } catch (err) {
    console.error(`❌ Error CriptoYa ${symbol}/${currency}:`, err.message);
    return null;
  }
}

// Precio Kraken
async function getKrakenPrice(symbol) {
  const formatted = symbol.toLowerCase().replace("/", "");
  const map = {
    btcusd: "XBTUSD",
    ethusd: "ETHUSD",
    usdtusd: "USDTUSD",
    btcusdt: "XBTUSDT",
    ethusdt: "ETHUSDT",
    usdtusdc: "USDTUSDC",
    usdcusdt: "USDCUSDT",
  };
  const pair = map[formatted];
  if (!pair) return null;

  try {
    const response = await axios.get(
      `https://api.kraken.com/0/public/Ticker?pair=${pair}`
    );
    const key = Object.keys(response.data.result)[0];
    const price = parseFloat(response.data.result[key].c[0]);
    return { exchange: "kraken", buyPrice: price, sellPrice: price };
  } catch (err) {
    console.error(`❌ Error Kraken ${symbol}:`, err.message);
    return null;
  }
}

// Precio KuCoin
async function getKuCoinPrice(symbol) {
  const formatted = symbol.toUpperCase().replace("/", "-");
  const url = `https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=${formatted}`;
  try {
    const response = await axios.get(url);
    const data = response.data.data;
    return {
      exchange: "kucoin",
      buyPrice: parseFloat(data.bestBid),
      sellPrice: parseFloat(data.bestAsk),
    };
  } catch (err) {
    console.error(`❌ Error KuCoin ${symbol}:`, err.message);
    return null;
  }
}

// Obtener último bloque de BNB Chain
async function getBNBBlockNumber() {
  const apiKey = "BZED56H367KMXFWS7T5S8MJ1FRCNKPIB9Z";
  const url = `https://api.bscscan.com/api?module=proxy&action=eth_blockNumber&apikey=${apiKey}`;
  try {
    const response = await axios.get(url);
    return parseInt(response.data.result, 16);
  } catch (err) {
    console.error("❌ Error bloque BNB:", err.message);
    return null;
  }
}

// Enviar mensaje a Telegram
async function sendMessage() {
  let message =
    "💰 Comparación de precios de criptomonedas entre exchanges:\n\n";

  const results = await Promise.all(
    pairs.map(async ({ symbol, currency }) => {
      const key = `${symbol}/${currency}`;
      const criptoYa = await getBestPrices(symbol, currency);
      const kraken = await getKrakenPrice(key);
      const kucoin = await getKuCoinPrice(key);

      const all = [
        criptoYa?.buyExchange,
        criptoYa?.sellExchange,
        kraken,
        kucoin,
      ].filter(Boolean);

      if (all.length < 2) return null;

      const bestBuy = all.reduce((a, b) => (a.buyPrice < b.buyPrice ? a : b));
      const bestSell = all.reduce((a, b) =>
        a.sellPrice > b.sellPrice ? a : b
      );

      return {
        pair: key,
        buyExchange: bestBuy,
        sellExchange: bestSell,
      };
    })
  );

  const valid = results.filter(Boolean);

  if (valid.length === 0) {
    await bot.telegram.sendMessage(
      chatId,
      "⚠️ No se encontraron precios válidos."
    );
    return;
  }

  for (const { pair, buyExchange, sellExchange } of valid) {
    message +=
      `🔽 Comprar ${pair} en: ${
        buyExchange.exchange
      } a $${buyExchange.buyPrice.toFixed(2)}\n` +
      `🔼 Vender ${pair} en: ${
        sellExchange.exchange
      } a $${sellExchange.sellPrice.toFixed(2)}\n\n`;
  }

  message += "🔄 Aprovechá la diferencia de precios para arbitraje.\n";

  const block = await getBNBBlockNumber();
  if (block !== null) {
    message += `📦 Último bloque en BNB Chain: ${block}`;
  }

  try {
    await bot.telegram.sendMessage(chatId, message);
    console.log("✅ Mensaje enviado con éxito.");
  } catch (err) {
    console.error("❌ Error al enviar mensaje:", err.message);
  }
}

// Ejecutar cada 60 segundos
setInterval(sendMessage, 60000);

// Ruta web
app.get("/", (req, res) => {
  res.send("Bot de comparación de precios funcionando.");
});

// Iniciar servidor web
app.listen(3000, () => {
  console.log("Servidor corriendo en el puerto 3000");
});

// Mensaje inicial
bot.telegram
  .sendMessage(chatId, "Hola, ¿estás recibiendo este mensaje?")
  .then(() => console.log("Mensaje de prueba enviado."))
  .catch((err) =>
    console.error("Error al enviar mensaje de prueba:", err.message)
  );
