// Configuración de fuentes de datos gratuitas
const DATA_SOURCES = {
    stock: 'https://finnhub.io/api/v1/quote?symbol=',
    currency: 'https://api.exchangerate-api.com/v4/latest/',
    crypto: 'https://min-api.cryptocompare.com/data/price?fsym=',
    commodities: 'https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol='
};

// Inicialización de la tabla
const container = document.getElementById('spreadsheet');
const hot = new Handsontable(container, {
    startRows: 15,
    startCols: 14,
    colHeaders: [
        "Fecha", "Operación", "Monto Transferido ($)", "Precio c/u Compra", "Cantidad", "Abreviatura", 
        "Precio c/u HOY", "Precio Objetivo", "Estado Alerta", "HOY NETO ($)", 
        "Diferencia ($)", "Rendimiento (%)", "Máximo Histórico ($)", "Drawdown (%)"
    ],
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
        { type: 'numeric', format: '0.00%', readOnly: true },  // Rendimiento %
        { type: 'numeric', format: '0,0.00', readOnly: true }, // Máximo Histórico
        { type: 'numeric', format: '0.00%', readOnly: true }  // Drawdown
    ]
});

// Datos iniciales
const initialData = [
    ["Fecha", "Operación", "Monto Transferido ($)", "Precio c/u Compra", "Cantidad", "Abreviatura", 
     "Precio c/u HOY", "Precio Objetivo", "Estado Alerta", "HOY NETO ($)", 
     "Diferencia ($)", "Rendimiento (%)", "Máximo Histórico ($)", "Drawdown (%)"]
];

// Cargar datos iniciales
hot.loadData(initialData);

// Función para agregar fila
function addRow() {
    const rowCount = hot.countRows();
    hot.alter('insert_row', rowCount);
}

// Función para actualizar precios en tiempo real
async function fetchPrices() {
    const data = hot.getData();
    const tickers = new Set();
    
    // Recopilar todos los tickers únicos
    for (let i = 1; i < data.length; i++) {
        if (data[i][5]) tickers.add(data[i][5]);
    }

    // Actualizar precios para cada ticker
    for (const ticker of tickers) {
        try {
            let url = DATA_SOURCES.stock + ticker;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.c) {
                const price = data.c[0];
                updatePriceInTable(ticker, price);
            }
        } catch (error) {
            console.error(`Error al actualizar ${ticker}:`, error);
        }
    }

    calculateMetrics();
}

// Función para actualizar un precio en la tabla
function updatePriceInTable(ticker, price) {
    const data = hot.getData();
    for (let i = 1; i < data.length; i++) {
        if (data[i][5] === ticker) {
            data[i][6] = price; // Actualizar precio actual
        }
    }
    hot.loadData(data);
}

// Función para calcular métricas
function calculateMetrics() {
    const data = hot.getData();
    let totalInvertido = 0;
    let valorActualTotal = 0;

    for (let i = 1; i < data.length; i++) {
        const monto = parseFloat(data[i][2]) || 0;
        const precioCompra = parseFloat(data[i][3]) || 0;
        const cantidad = parseFloat(data[i][4]) || 0;
        const precioHoy = parseFloat(data[i][6]) || 0;
        const precioObjetivo = parseFloat(data[i][7]) || 0;

        // Calcular HOY NETO
        const hoyNeto = precioHoy * cantidad;
        data[i][9] = isNaN(hoyNeto) ? "" : hoyNeto;

        // Calcular Diferencia $ y Rendimiento %
        let difPesos = 0;
        let rendimiento = 0;

        if (monto > 0 && !isNaN(hoyNeto)) {
            difPesos = hoyNeto - monto;
            rendimiento = difPesos / monto;
        }

        data[i][10] = difPesos;
        data[i][11] = rendimiento;

        // Máximo Histórico y Drawdown
        let maxHistorico = parseFloat(data[i][12]) || 0;
        if (hoyNeto > maxHistorico) {
            maxHistorico = hoyNeto;
            data[i][12] = maxHistorico;
        }

        let drawdown = 0;
        if (maxHistorico > 0) {
            drawdown = (hoyNeto - maxHistorico) / maxHistorico;
        }
        data[i][13] = drawdown;

        // Acumular para resumen
        if (!isNaN(monto)) totalInvertido += monto;
        if (!isNaN(hoyNeto)) valorActualTotal += hoyNeto;
    }

    hot.loadData(data);
}

// Función para actualizar gráficos
function updatePortfolioChart() {
    const data = hot.getData();
    const labels = [];
    const values = [];
    const colors = [];

    for (let i = 1; i < data.length; i++) {
        const abreviatura = data[i][5] || '';
        const hoyNeto = parseFloat(data[i][9]) || 0;

        if (abreviatura && hoyNeto > 0) {
            labels.push(abreviatura);
            values.push(hoyNeto);
            const color = '#' + Math.floor(Math.random()*16777215).toString(16);
            colors.push(color);
        }
    }

    const existingChart = Chart.getChart("portfolioChart");
    if (existingChart) existingChart.destroy();

    const ctx = document.getElementById('portfolioChart').getContext('2d');
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(2);
                            return `${label}: $${value.toLocaleString()} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Función para actualizar gráfico de tipos de activos
function updateTipoActivoChart() {
    const data = hot.getData();
    const tipos = {};
    const colores = {
        'Acción': '#FF6384',
        'CEDEAR': '#36A2EB',
        'Bono': '#FFCE56',
        'Cripto': '#4BC0C0',
        'Materia Prima': '#9966FF',
        'Índice': '#FF9F40',
        'Otro': '#C9CBCF'
    };

    for (let i = 1; i < data.length; i++) {
        const abreviatura = data[i][5] || '';
        const hoyNeto = parseFloat(data[i][9]) || 0;
        let tipo = 'Otro';

        if (abreviatura.includes('YPF') || abreviatura.includes('GGAL') || 
            abreviatura.includes('ALUA') || abreviatura.includes('TXAR')) {
            tipo = 'Acción';
        } else if (abreviatura.includes('CEDEAR')) {
            tipo = 'CEDEAR';
        } else if (abreviatura.includes('AL35') || abreviatura.includes('AE38') || 
                  abreviatura.includes('GD30') || abreviatura.includes('TV25')) {
            tipo = 'Bono';
        } else if (abreviatura.includes('BTC') || abreviatura.includes('ETH')) {
            tipo = 'Cripto';
        } else if (abreviatura.includes('^')) {
            tipo = 'Índice';
        } else if (abreviatura.includes('GC=F') || abreviatura.includes('CL=F')) {
            tipo = 'Materia Prima';
        }

        if (!tipos[tipo]) {
            tipos[tipo] = 0;
        }
        tipos[tipo] += hoyNeto;
    }

    const labels = Object.keys(tipos);
    const values = Object.values(tipos);
    const backgroundColors = labels.map(label => colores[label] || colores['Otro']);

    const existingChart = Chart.getChart("tipoActivoChart");
    if (existingChart) existingChart.destroy();

    const ctx = document.getElementById('tipoActivoChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor
// Función para inicializar la tabla
function initializeTable() {
    const container = document.getElementById('spreadsheet');
    if (!container) {
        console.error('No se encontró el contenedor de la tabla');
        return;
    }

    const hot = new Handsontable(container, {
        startRows: 15,
        startCols: 14,
        colHeaders: [
            "Fecha", "Operación", "Monto Transferido ($)", "Precio c/u Compra", "Cantidad", "Abreviatura", 
            "Precio c/u HOY", "Precio Objetivo", "Estado Alerta", "HOY NETO ($)", 
            "Diferencia ($)", "Rendimiento (%)", "Máximo Histórico ($)", "Drawdown (%)"
        ],
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
            { type: 'numeric', format: '0.00%', readOnly: true },  // Rendimiento %
            { type: 'numeric', format: '0,0.00', readOnly: true }, // Máximo Histórico
            { type: 'numeric', format: '0.00%', readOnly: true }  // Drawdown
        ]
    });

    return hot;
}

// Inicializar la tabla cuando se cargue la página
document.addEventListener('DOMContentLoaded', () => {
    const hot = initializeTable();
    if (hot) {
        console.log('Tabla inicializada correctamente');
    }
});
