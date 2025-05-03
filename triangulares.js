const { getBestPrices, delay } = require("./utils");
const { nuevasDivisas, nuevasCriptos } = require("./nuevasMonedas");

const MONTO_ARS = 500000;
const UMBRAL_GANANCIA = 1000;
const BLOQUE_MONEDAS = 10;
const MAX_REQUESTS = 115;

const fiatCurrencies = ["ars", "usd", "usdt"];
const cryptoList = [
  "btc", "eth", "usdt", "usdc", "dai", "criptodolar", "pax", "nuars", "sol",
  "bnb", "wld", "xrp", "ada", "avax", "doge", "trx", "link", "matic", "dot",
  "shib", "ltc", "bch", "eos", "xlm", "ftm", "aave", "uni", "algo", "bat",
  "paxg", "cake", "axs", "slp", "mana", "sand", "chz"
];
const allFiatCurrencies = [...new Set([...fiatCurrencies, ...nuevasDivisas])];
const allCryptoList = [...new Set([...cryptoList, ...nuevasCriptos])];

module.exports = (bot, chatId) => {
  async function triangularArbitrage() {
    const results = [];
    let requestCount = 0;
    const selectedCryptos = allCryptoList.slice(0, BLOQUE_MONEDAS);

    for (const from of selectedCryptos) {
      for (const mid of selectedCryptos) {
        if (from === mid || requestCount >= MAX_REQUESTS - 2) break;
        for (const to of allFiatCurrencies) {
          try {
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
              ruta: `${from.toUpperCase()} → ${mid.toUpperCase()} → ${to.toUpperCase()}`,
              buy: a.bestBuy,
              sell: b.bestSell,
              result,
              gain,
            });

            await delay(400);
          } catch {}
        }
      }
    }

    if (!results.length) return;

    results.sort((a, b) => b.gain - a.gain);
    let msg = `📊 Oportunidades TRIANGULARES con ${MONTO_ARS} ARS\n\n`;

    for (const r of results.slice(0, 10)) {
      msg += `🔁 Ruta: ${r.ruta}\n`;
      msg += `🔽 Comprar en ${r.buy.exchange} a $${r.buy.buyPrice.toFixed(2)}\n`;
      msg += `🔼 Vender en ${r.sell.exchange} a $${r.sell.sellPrice.toFixed(2)}\n`;
      msg += `📈 Ganancia: $${r.gain.toFixed(2)}\n\n`;
    }

    await bot.telegram.sendMessage(chatId, msg);
    console.log("✅ Mensaje de oportunidades triangulares enviado.");
  }

  // Ejecutar cada 2 minutos
  setInterval(triangularArbitrage, 120000);
};
