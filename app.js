// Inicializar planilla tipo Excel
const container = document.getElementById('spreadsheet');
const hot = new Handsontable(container, {
  data: [
         ["Nombre de la Inversión (Ticker)", "Cantidad Comprada", "Fecha de Compra (YYYY-MM-DD)", "Precio de Compra (USD)", "Precio Actual (USD)", "Valor Invertido (USD)", "Valor Actual (USD)", "Ganancia/Perdida (%)"],,,
    ["CEDEAR.MELI", 5, 15000, "", "", "", ""],
    ["AAPL", 10, 150, "", "", "", ""],
    ["GD30", 2, 50000, "", "", "", ""]
  ],
  colHeaders: true,
  rowHeaders: true,
  formulas: true,
  height: 300,
  licenseKey: 'non-commercial-and-evaluation'
});

function calculateMetrics() {
  const data = hot.getData();
  for (let i = 1; i < data.length; i++) {
    const qty = parseFloat(data[i][1]) || 0;
    const buyPrice = parseFloat(data[i][2]) || 0;
    const currentPrice = parseFloat(data[i][3]) || 0;

    const invested = qty * buyPrice;
    const current = qty * currentPrice;
    const gainPercent = currentPrice > 0 ? ((currentPrice - buyPrice) / buyPrice) * 100 : 0;

    data[i][4] = isNaN(invested) ? "" : invested.toFixed(2); // Valor Invertido
    data[i][5] = isNaN(current) ? "" : current.toFixed(2); // Valor Actual
    data[i][6] = currentPrice > 0 ? gainPercent.toFixed(2) + "%" : "";

    // Aplicar color según ganancia/pérdida
    const cell = hot.getCell(i, 6); // Fila i, columna 6 (Ganancia %)
    if (cell) {
      if (gainPercent > 0) {
        cell.style.color = "green";
        cell.style.fontWeight = "bold";
      } else if (gainPercent < 0) {
        cell.style.color = "red";
        cell.style.fontWeight = "bold";
      } else {
        cell.style.color = "black";
        cell.style.fontWeight = "normal";
      }
    }
  }
  hot.loadData(data);
}

// Función para traer precios desde Yahoo Finance
async function fetchPrices() {
  const data = hot.getData();
  for (let i = 1; i < data.length; i++) {
    let ticker = data[i][0];
    if (!ticker) continue;

    let symbol = ticker;

    // Si empieza con CEDEAR., lo convertimos al formato de Yahoo para Argentina
    if (ticker.startsWith("CEDEAR.")) {
      symbol = ticker.split(".")[1] + ".BA";
    }

    // Para bonos argentinos, usamos .BA también (Yahoo los tiene como acciones)
    // Ej: GD30 → GD30.BA

    try {
      const proxyUrl = "https://corsproxy.io/?";
      const apiUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;

      const response = await fetch(proxyUrl + encodeURIComponent(apiUrl));
      const json = await response.json();

      if (json.chart && json.chart.result && json.chart.result[0]) {
        const price = json.chart.result[0].meta.regularMarketPrice;
        data[i][3] = price ? price.toFixed(2) : "N/D";
      } else {
        data[i][3] = "No encontrado";
      }
    } catch (e) {
      data[i][3] = "Error";
      console.log("Error con " + ticker, e);
    }
  }
  hot.loadData(data);
  calculateMetrics(); // Recalcula todo después de traer precios
}

// Calcular al cargar la página
setTimeout(calculateMetrics, 1000);
