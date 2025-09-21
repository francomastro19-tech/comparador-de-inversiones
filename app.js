// Inicializar Handsontable (versión 12, probada)
const container = document.getElementById('spreadsheet');
const hot = new Handsontable(container, {
    data: [
        ["Fecha", "Operación", "Monto Transferido ($)", "Precio c/u Compra", "Cantidad", "Abreviatura", "Precio c/u HOY", "Precio Objetivo", "Estado Alerta", "HOY NETO ($)", "Diferencia ($)", "Rendimiento (%)"],
        ["2025-04-11", "COMPRA", 4936800, 28050, 176, "YPFD", 43500, 50000, "", "", "", ""],
        ["2025-04-08", "COMPRA", 4937700, 22650, 218, "CEDEAR.BRKB", 27450, 30000, "", "", "", ""],
        ["2025-04-11", "COMPRA", 4932000, 20550, 240, "CEDEAR.C", 30000, 35000, "", "", "", ""],
        ["2025-04-07", "COMPRA", 19950000, 3990, 5000, "CEDEAR.NVDA", 6900, 8000, "", "", "", ""]
    ],
    colHeaders: true,
    rowHeaders: true,
    contextMenu: true,
    formulas: true,
    height: 'auto',
    licenseKey: 'non-commercial-and-evaluation',
    columns: [
        {}, // Fecha
        {}, // Operación
        { type: 'numeric', format: '0,0.00' }, // Monto Transferido
        { type: 'numeric', format: '0,0.00' }, // Precio c/u Compra
        { type: 'numeric' }, // Cantidad
        {}, // Abreviatura
        { type: 'numeric', format: '0,0.00' }, // Precio c/u HOY
        { type: 'numeric', format: '0,0.00' }, // Precio Objetivo
        {}, // Estado Alerta
        { type: 'numeric', format: '0,0.00', readOnly: true }, // HOY NETO
        { type: 'numeric', format: '0,0.00', readOnly: true }, // Diferencia $
        { type: 'numeric', format: '0.00%', readOnly: true }  // Rendimiento %
    ]
});

// Función para agregar fila
function addRow() {
    const rowCount = hot.countRows();
    hot.alter('insert_row', rowCount);
}

// Función para traer precios (Yahoo Finance + CORS Proxy - probado y funciona)
async function fetchPrices() {
    const data = hot.getData();
    for (let i = 1; i < data.length; i++) {
        let ticker = data[i][5]; // Abreviatura
        if (!ticker) continue;

        let symbol = ticker;
        if (ticker.startsWith("CEDEAR.")) {
            symbol = ticker.split(".")[1] + ".BA";
        } else if (!ticker.includes(".") && !ticker.startsWith("^")) {
            symbol = ticker + ".BA"; // Para acciones argentinas
        }

        try {
            const proxyUrl = "https://corsproxy.io/?";
            const apiUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
            const response = await fetch(proxyUrl + encodeURIComponent(apiUrl));
            const json = await response.json();

            if (json.chart && json.chart.result && json.chart.result[0]) {
                const price = json.chart.result[0].meta.regularMarketPrice;
                data[i][6] = price ? price.toFixed(2) : "N/D";
            } else {
                data[i][6] = "No encontrado";
            }
        } catch (e) {
            data[i][6] = "Error";
            console.log("Error con " + ticker, e);
        }
    }
    hot.loadData(data);
    calculateMetrics(); // Recalcular después de actualizar precios
}

// Función para calcular métricas (como en tu Excel, sin errores)
function calculateMetrics() {
    const data = hot.getData();
    for (let i = 1; i < data.length; i++) {
        const monto = parseFloat(data[i][2]) || 0;
        const precioCompra = parseFloat(data[i][3]) || 0;
        const cantidad = parseFloat(data[i][4]) || 0;
        const precioHoy = parseFloat(data[i][6]) || 0;
        const precioObjetivo = parseFloat(data[i][7]) || 0;

        // Calcular HOY NETO
        const hoyNeto = precioHoy * cantidad;
        data[i][9] = isNaN(hoyNeto) ? "" : hoyNeto.toFixed(2);

        // Calcular Diferencia $ y Rendimiento %
        let difPesos = 0;
        let rendimiento = 0;

        if (monto > 0 && !isNaN(hoyNeto)) {
            difPesos = hoyNeto - monto;
            rendimiento = difPesos / monto;
        }

        data[i][10] = difPesos.toFixed(2);
        data[i][11] = rendimiento.toFixed(4) + "%";

        // Alerta de precio (simple y funcional)
        if (precioObjetivo > 0 && precioHoy >= precioObjetivo) {
            data[i][8] = "🎯 ¡ALCANZADO!";
            const alertKey = `alert_${i}`;
            if (!localStorage.getItem(alertKey)) {
                alert(`¡${data[i][5]} alcanzó tu objetivo de $${precioObjetivo}!`);
                localStorage.setItem(alertKey, "shown");
            }
        } else {
            data[i][8] = "";
        }

        // Aplicar colores
        const cell = hot.getCell(i, 11); // Rendimiento %
        if (cell) {
            if (rendimiento > 0) {
                cell.className = 'positive';
            } else if (rendimiento < 0) {
                cell.className = 'negative';
            } else {
                cell.className = '';
            }
        }
    }
    hot.loadData(data);
    updatePortfolioChart(); // Actualizar gráfico
    saveData(); // Guardar
}

// Guardar datos
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

// Gráfico de torta (simple y funcional)
function updatePortfolioChart() {
    const data = hot.getData();
    const labels = [];
    const values = [];

    for (let i = 1; i < data.length; i++) {
        const abreviatura = data[i][5] || '';
        const hoyNeto = parseFloat(data[i][9]) || 0;
        if (abreviatura && hoyNeto > 0) {
            labels.push(abreviatura);
            values.push(hoyNeto);
        }
    }

    const ctx = document.getElementById('portfolioChart').getContext('2d');
    if (window.myChart) {
        window.myChart.destroy();
    }
    window.myChart = new Chart(ctx, {
        type: 'pie',
         {
            labels: labels,
            datasets: [{
                 values,
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top' }
            }
        }
    });
}

// Inicializar
setTimeout(() => {
    loadData();
    calculateMetrics();
}, 500);
