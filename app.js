// Inicializar Handsontable (Tabla tipo Excel)
const container = document.getElementById('spreadsheet');
const hot = new Handsontable(container, {
     [
        ["Nombre de la Inversión (Ticker)", "Cantidad Comprada", "Fecha de Compra (YYYY-MM-DD)", "Precio de Compra (USD)", "Precio Actual (USD)", "Precio Objetivo (USD)", "Estado Alerta", "Valor Invertido (USD)", "Valor Actual (USD)", "Ganancia/Perdida (%)"],
        ["CEDEAR.AAPL", 5, "2024-01-15", 15000, "", 20000, "", "", "", ""],
        ["AAPL", 10, "2024-03-10", 150, "", 200, "", "", "", ""],
        ["GD30.BA", 2, "2024-02-05", 50000, "", 60000, "", "", "", ""],
        ["^GSPC", 1, "2024-01-01", 4500, "", 5000, "", "", "", ""],
        ["BTC-USD", 0.5, "2024-04-01", 60000, "", 70000, "", "", "", ""]
    ],
    colHeaders: true,
    rowHeaders: true,
    formulas: true,
    height: 400,
    licenseKey: 'non-commercial-and-evaluation',
    afterChange: function() {
        saveData();
    }
});

// Calcular métricas y aplicar colores
function calculateMetrics() {
    const data = hot.getData();
    for (let i = 1; i < data.length; i++) {
        const qty = parseFloat(data[i][1]) || 0;
        const buyPrice = parseFloat(data[i][3]) || 0;
        const currentPrice = parseFloat(data[i][4]) || 0;
        const targetPrice = parseFloat(data[i][5]) || 0;

        // Calcular valores
        const invested = qty * buyPrice;
        const current = qty * currentPrice;
        const gainPercent = currentPrice > 0 ? ((currentPrice - buyPrice) / buyPrice) * 100 : 0;

        // Formatear valores
        data[i][7] = isNaN(invested) ? "" : invested.toFixed(2); // Valor Invertido
        data[i][8] = isNaN(current) ? "" : current.toFixed(2); // Valor Actual
        data[i][9] = currentPrice > 0 ? gainPercent.toFixed(2) + "%" : ""; // Ganancia %

        // Alerta de precio
        let alertStatus = "";
        if (targetPrice > 0 && currentPrice > 0) {
            if (currentPrice >= targetPrice) {
                alertStatus = "🎯 ¡ALCANZADO!";
                const alertKey = `alert_${i}_${targetPrice}`;
                if (!localStorage.getItem(alertKey)) {
                    alert(`🔔 ¡Alerta de Precio!\n${data[i][0]} ha alcanzado tu objetivo: $${targetPrice}`);
                    localStorage.setItem(alertKey, "shown");
                }
            } else {
                const diffPercent = ((targetPrice - currentPrice) / targetPrice * 100).toFixed(1);
                alertStatus = `⏳ ${diffPercent}% por alcanzar`;
            }
        }
        data[i][6] = alertStatus; // Estado Alerta

        // Aplicar colores a ganancia/pérdida
        const cell = hot.getCell(i, 9); // Columna de Ganancia %
        if (cell) {
            if (gainPercent > 0) {
                cell.className = 'positive';
            } else if (gainPercent < 0) {
                cell.className = 'negative';
            } else {
                cell.className = '';
            }
        }
    }
    hot.loadData(data);
    updatePortfolioChart(); // Actualizar gráfico
}

// Traer precios desde Yahoo Finance
async function fetchPrices() {
    const data = hot.getData();
    for (let i = 1; i < data.length; i++) {
        let ticker = data[i][0];
        if (!ticker) continue;

        let symbol = ticker;
        if (ticker.startsWith("CEDEAR.")) {
            symbol = ticker.split(".")[1] + ".BA";
        }

        try {
            const proxyUrl = "https://corsproxy.io/?";
            const apiUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;

            const response = await fetch(proxyUrl + encodeURIComponent(apiUrl));
            const json = await response.json();

            if (json.chart && json.chart.result && json.chart.result[0]) {
                const price = json.chart.result[0].meta.regularMarketPrice;
                data[i][4] = price ? price.toFixed(2) : "N/D";
            } else {
                data[i][4] = "No encontrado";
            }
        } catch (e) {
            data[i][4] = "Error";
            console.log("Error con " + ticker, e);
        }
    }
    hot.loadData(data);
    calculateMetrics();
}

// Guardar datos en localStorage
function saveData() {
    const data = hot.getData();
    localStorage.setItem('investmentData', JSON.stringify(data));
}

// Cargar datos guardados
function loadData() {
    const saved = localStorage.getItem('investmentData');
    if (saved) {
        const data = JSON.parse(saved);
        hot.loadData(data);
        calculateMetrics();
    }
}

// Inicializar
setTimeout(() => {
    loadData();
    calculateMetrics();
}, 1000);
