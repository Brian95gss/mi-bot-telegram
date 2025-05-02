const express = require("express");
const axios = require("axios");
const { Telegraf } = require("telegraf");

const app = express();
const bot = new Telegraf("7617489508:AAEBj_jgwWcd81GAvqHPm6nRYhrF2y0FTbQ");
const chatId = "6062771979";
const MONTO_ARS = 500000;
const UMBRAL_GANANCIA = 1000;

const cryptoList = [
  "btc", "eth", "usdt", "usdc", "dai", "criptodolar", "pax", "nuars", "sol",
  "bnb", "wld", "xrp", "ada", "avax", "doge", "trx", "link", "matic", "dot",
  "shib", "ltc", "bch", "eos", "xlm", "ftm", "aave", "uni", "algo", "bat",
  "paxg", "cake", "axs", "slp", "mana", "sand", "chz",
];
const fiatCurrencies = ["ars", "usd", "usdt"];
const pairs = [];
cryptoList.forEach((symbol) => {
  fiatCurrencies.forEach((currency) => {
    if (symbol !== currency) pairs.push({ symbol, currency });
  });
});

const exchanges = [
  "letsbit", "universalcoins", "binance", "binancep2p", "fiwind", "trubit",
  "pollux", "pluscrypto", "tiendacrypto", "bitsoalpha", "cocoscrypto",
  "decrypto", "buenbit", "saldo", "ripio", "ripiotrade", "belo",
  "cryptomarketpro", "satoshitango", "paxful", "eluter", "lnp2pbot",
  "bybitp2p", "kriptonmarket", "kucoinp2p", "bitgetp2p", "htxp2p",
  "lemoncashp2p", "eldoradop2p", "coinexp2p", "vesseo", "dolarapp", "bitso",
];

const BSC_API_KEY = "BZED56H367KMXFWS7T5S8MJ1FRCNKPIB9Z";

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

async function getKrakenPrice(symbol) {
  const pairMap = {
    btcusd: "XBTUSD", ethusd: "ETHUSD", usdtusd: "USDTUSD",
    btcusdt: "XBTUSDT", ethusdt: "ETHUSDT", usdtusdc: "USDTUSDC", usdcusdt: "USDCUSDT"
  };
  const formatted = symbol.toLowerCase().replace("/", "");
  const pair = pairMap[formatted];
  if (!pair) return null;

  try {
    const res = await axios.get(`https://api.kraken.com/0/public/Ticker?pair=${pair}`);
    const key = Object.keys(res.data.result)[0];
    const price = parseFloat(res.data.result[key].c[0]);
    return { exchange: "kraken", buyPrice: price, sellPrice: price };
  } catch {
    return null;
  }
}

async function getKuCoinPrice(symbol) {
  const formatted = symbol.toUpperCase().replace("/", "-");
  try {
    const res = await axios.get(`https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=${formatted}`);
    const d = res.data.data;
    return { exchange: "kucoin", buyPrice: parseFloat(d.bestBid), sellPrice: parseFloat(d.bestAsk) };
  } catch {
    return null;
  }
}

async function getBybitPrice(symbol) {
  const formatted = symbol.toUpperCase().replace("/", "");
  try {
    const res = await axios.get(`https://api.bybit.com/v5/market/tickers?category=spot`);
    const match = res.data.result.list.find(p => p.symbol === formatted);
    if (!match) return null;
    return { exchange: "bybit", buyPrice: parseFloat(match.bid1Price), sellPrice: parseFloat(match.ask1Price) };
  } catch {
    return null;
  }
}

async function getBitgetPrice(symbol) {
  const formatted = symbol.toUpperCase().replace("/", "");
  try {
    const res = await axios.get(`https://api.bitget.com/api/spot/v1/market/ticker?symbol=${formatted}`);
    const d = res.data.data;
    return { exchange: "bitget", buyPrice: parseFloat(d.buyOne), sellPrice: parseFloat(d.sellOne) };
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
  const maxRequestsPerMinute = 115;

  for (const { symbol, currency } of pairs) {
    if (requestCount >= maxRequestsPerMinute) break;
    const key = `${symbol}/${currency}`;
    const criptoYa = await getBestPrices(symbol, currency);
    requestCount++;

    const kraken = await getKrakenPrice(key);
    const kucoin = await getKuCoinPrice(key);
    const bybit = await getBybitPrice(key);
    const bitget = await getBitgetPrice(key);

    const options = [
      criptoYa?.bestBuy,
      criptoYa?.bestSell,
      kraken,
      kucoin,
      bybit,
      bitget,
    ].filter(Boolean);

    if (options.length < 2) continue;

    const bestBuy = options.reduce((a, b) => (a.buyPrice < b.buyPrice ? a : b));
    const bestSell = options.reduce((a, b) => (a.sellPrice > b.sellPrice ? a : b));

    const amountIn = MONTO_ARS;
    const coins = amountIn / bestBuy.buyPrice;
    const result = coins * bestSell.sellPrice;
    const gain = result - amountIn;

    if (gain < UMBRAL_GANANCIA) continue;

    results.push({
      pair: key,
      buy: bestBuy,
      sell: bestSell,
      amountIn,
      coins,
      result,
      gain,
      type: "simple",
    });

    await delay(400);
  }

  for (const from of cryptoList.slice(0, 10)) {
    for (const mid of cryptoList.slice(0, 10)) {
      if (from === mid) continue;
      for (const to of fiatCurrencies) {
        if (requestCount >= maxRequestsPerMinute - 2) break;
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
            gain,
            type: "triangular",
          });

          await delay(400);
        } catch {}
      }
    }
  }

  if (!results.length) return;

  results.sort((a, b) => b.gain - a.gain);

  let msg = `📊 Simulación con ${MONTO_ARS} ARS\n\n`;
  for (const r of results.slice(0, 15)) {  // Cambié 10 a 
