// Inicializar Handsontable
const container = document.getElementById('spreadsheet');
if (!container) {
    console.error('❌ No se encontró el contenedor de la tabla');
} else {
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

    // Datos iniciales (como en tu Excel)
    const initialData = [
        ["Fecha", "Operación", "Monto Transferido ($)", "Precio c/u Compra", "Cantidad", "Abreviatura", "Precio c/u HOY", "Precio Objetivo", "Estado Alerta", "HOY NETO ($)", "Diferencia ($)", "Rendimiento (%)", "Máximo Histórico ($)", "Drawdown (%)"],
        ["2025-04-11", "COMPRA", 4936800, 28050, 176, "YPFD", 43500, 50000, "", "", "", "", "", ""],
        ["2025-04-08", "COMPRA", 4937700, 22650, 218, "CEDEAR.BRKB", 27450, 30000, "", "", "", "", "", ""],
        ["2025-04-11", "COMPRA", 4932000, 20550, 240, "CEDEAR.C", 30000, 35000, "", "", "", "", "", ""],
        ["2025-04-07", "COMPRA", 19950000, 3990, 5000, "CEDEAR.NVDA", 6900, 8000, "", "", "", "", "", ""],
        ["2025-04-09", "COMPRA", 4949880, 7410, 668, "CEDEAR.OXY", 9860, 11000, "", "", "", "", "", ""],
        ["2025-04-11", "COMPRA", 4939350, 11050, 447, "CEDEAR.PG", 13400, 15000, "", "", "", "", "", ""],
        ["2025-04-11", "COMPRA", 17807587.50, 712.30, 25000, "AL35.BA", 822.90, 900, "", "", "", "", "", ""],
        ["2025-04-08", "COMPRA", 11811895.73, 696.66, 16955, "AE38.BA", 858.70, 950, "", "", "", "", "", ""]
    ];

    // Cargar datos iniciales
    hot.loadData(initialData);

    // Función para agregar fila
    window.addRow = function() {
        const rowCount = hot.countRows();
        hot.alter('insert_row', rowCount);
    };

    // Función para actualizar precios en tiempo real (Yahoo Finance)
    window.fetchPrices = async function() {
        const data = hot.getData();
        for (let i = 1; i < data.length; i++) {
            let ticker = data[i][5]; // Abreviatura
            if (!ticker) continue;

            let symbol = ticker;
            if (ticker.startsWith("CEDEAR.")) {
                symbol = ticker.split(".")[1] + ".BA";
            } else if (ticker.endsWith(".BA")) {
                // Ya tiene .BA
            } else if (!ticker.includes(".") && !ticker.startsWith("^")) {
                symbol = ticker + ".BA";
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
        calculateMetrics();
    };

    // Función para calcular métricas
    window.calculateMetrics = function() {
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

            // Alerta de precio
            let alertStatus = "";
            if (precioObjetivo > 0 && precioHoy > 0) {
                if (precioHoy >= precioObjetivo) {
                    alertStatus = "🎯 ¡ALCANZADO!";
                    const alertKey = `alert_${i}_${precioObjetivo}`;
                    if (!localStorage.getItem(alertKey)) {
                        alert(`🔔 ¡Alerta de Precio!\n${data[i][5]} ha alcanzado tu objetivo: $${precioObjetivo}`);
                        localStorage.setItem(alertKey, "shown");
                    }
                } else {
                    const diffPercent = ((precioObjetivo - precioHoy) / precioObjetivo * 100).toFixed(1);
                    alertStatus = `⏳ ${diffPercent}% por alcanzar`;
                }
            }
            data[i][8] = alertStatus;

            // Aplicar colores a Rendimiento %
            const cell = hot.getCell(i, 11);
            if (cell) {
                if (rendimiento > 0) {
                    cell.className = 'positive';
                } else if (rendimiento < 0) {
                    cell.className = 'negative';
                } else {
                    cell.className = '';
                }
            }

            // Acumular para resumen
            if (!isNaN(monto)) totalInvertido += monto;
            if (!isNaN(hoyNeto)) valorActualTotal += hoyNeto;
        }

        hot.loadData(data);

        // Actualizar resumen
        const rendimientoPonderado = totalInvertido > 0 ? (valorActualTotal - totalInvertido) / totalInvertido : 0;
        document.getElementById('totalInvertido').innerText = '$' + totalInvertido.toLocaleString('es-AR', { minimumFractionDigits: 2 });
        document.getElementById('valorActualTotal').innerText = '$' + valorActualTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 });
        document.getElementById('rendimientoPonderado').innerText = (rendimientoPonderado * 100).toFixed(2) + '%';

        const rendimientoElement = document.getElementById('rendimientoPonderado');
        if (rendimientoPonderado > 0) {
            rendimientoElement.style.color = 'green';
            rendimientoElement.style.fontWeight = 'bold';
        } else if (rendimientoPonderado < 0) {
            rendimientoElement.style.color = 'red';
            rendimientoElement.style.fontWeight = 'bold';
        } else {
            rendimientoElement.style.color = '#212529';
            rendimientoElement.style.fontWeight = 'normal';
        }

        // Actualizar gráficos
        updatePortfolioChart();
        updateTipoActivoChart();

        // Guardar datos
        saveData();
    };

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

    // Gráfico de Torta
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

    // Gráfico por Tipo de Activo
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

            if (abreviatura.includes('YPF') || abreviatura.includes('GGAL') || abreviatura.includes('ALUA') || abreviatura.includes('TXAR')) {
                tipo = 'Acción';
            } else if (abreviatura.includes('CEDEAR')) {
                tipo = 'CEDEAR';
            } else if (abreviatura.includes('AL35') || abreviatura.includes('AE38') || abreviatura.includes('GD30') || abreviatura.includes('TV25')) {
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
                    backgroundColor: backgroundColors,
                    borderColor: '#fff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw || 0;
                                return `$${value.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toLocaleString('es-AR');
                            }
                        }
                    }
                }
            }
        });
    }

    // Inicializar
    setTimeout(() => {
        loadData();
        calculateMetrics();
    }, 1000);
}
