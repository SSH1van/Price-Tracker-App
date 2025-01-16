// Ссылка на объект графика
let chart;

function showTable(element) {
    const category = element.getAttribute("data-category");
    const table = document.getElementById("product-table").getElementsByTagName("tbody")[0];
    const progressBar = document.getElementById("loading-bar");
    const progressContainer = document.getElementById("progress-container");

    // Очистка старых данных
    table.innerHTML = "";

    // Установка заголовка
    const header = document.getElementById("selected-table");
    header.textContent = category;

    // Получение данных
    const categoryData = data[category];

    if (!categoryData || typeof categoryData !== "object") {
        console.error(`Данные для категории "${category}" не найдены.`);
        return;
    }

    const rows = Object.entries(categoryData);
    const updateStep = Math.ceil(rows.length * 0.01);

    // Показать прогресс
    progressContainer.style.display = "flex";
    progressBar.max = rows.length;
    progressBar.value = 0;

    let htmlRows = "";

    // Функция обработки строк с задержкой каждые 5%
    function processRows(startIndex) {
        for (let i = startIndex; i < rows.length; i++) {
            const [link, valueList] = rows[i];
            let priceText = "Нет данных";
            let diffSLText = "Нет данных";
            let percentSLText = "Нет данных";
            let diffLPText = "Нет данных";
            let percentLPText = "Нет данных";

            if (valueList.length > 0) {
                const latestPrice = valueList[valueList.length - 1].price;
                const initialPrice = valueList[0].price;
                priceText = latestPrice;
                diffSLText = initialPrice - latestPrice;
                percentSLText = diffSLText * 100 / priceText;
                percentSLText = parseFloat(percentSLText.toFixed(1));

                let penultimatePrice;
                if (valueList.length !== 1) {
                    penultimatePrice = valueList[valueList.length - 2].price;
                } else {
                    penultimatePrice = latestPrice;
                }

                diffLPText = penultimatePrice - latestPrice;
                percentLPText = diffLPText * 100 / priceText;
                percentLPText = parseFloat(percentLPText.toFixed(1));

            }

            htmlRows += `
                <tr>
                    <td><a href="${link}" target="_blank">${link}</a></td>
                    <td>${priceText}</td>
                    <td>${diffSLText}</td>
                    <td>${percentSLText}</td>
                    <td>${diffLPText}</td>
                    <td>${percentLPText}</td>
                </tr>
            `;

            // Обновляем прогресс и делаем задержку каждые updateStep строк
            if ((i + 1) % updateStep === 0 || i === rows.length - 1) {
                progressBar.value = i + 1;

                // Если не конец, ставим задержку и продолжаем обработку
                if (i < rows.length - 1) {
                    setTimeout(() => processRows(i + 1), 0);
                } else {
                    // Если обработка завершена, обновляем таблицу и скрываем прогресс
                    table.innerHTML = htmlRows;
                    progressContainer.style.display = "none";
                }
                return;
            }
        }
    }

    // Запускаем обработку с первой строки
    processRows(0);
}

document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.querySelector('#product-table tbody');

    // Проверяем, что `data` доступно
    if (typeof data !== 'object') {
        console.error('Данные для продуктов не найдены');
        return;
    }

    // Добавляем обработчик событий на таблицу
    tableBody.addEventListener('click', (event) => {
        const selectedTableId = document.getElementById('selected-table').textContent.trim();

        // Проверяем существование таблицы и данных для этой таблицы
        if (!data[selectedTableId]) {
            console.error(`Данные для таблицы "${selectedTableId}" не найдены`);
            return;
        }

        const row = event.target.closest('tr');
        if (row) {
            // Получаем продукт из первой ячейки строки
            const product = row.cells[0].textContent.trim();
            if (data[selectedTableId][product]) {
                showChart(selectedTableId, product); // Отображаем график для выбранного продукта
            } else {
                console.error(`Данные для продукта "${product}" не найдены`);
            }
        }
    });
});

// Функция для сортировки таблицы
function sortTable(columnIndex) {
    const table = document.getElementById("product-table");
    const tbody = table.querySelector("tbody");
    const rows = Array.from(tbody.rows);

    // Определяем порядок сортировки: asc (по умолчанию) или desc
    const isAscending = table.dataset.sortOrder !== "asc";
    table.dataset.sortOrder = isAscending ? "asc" : "desc";

    // Сортируем строки
    rows.sort((rowA, rowB) => {
        const cellA = rowA.cells[columnIndex].textContent.trim();
        const cellB = rowB.cells[columnIndex].textContent.trim();

        // Проверяем, являются ли значения числами
        const valueA = parseFloat(cellA);
        const valueB = parseFloat(cellB);

        if (!isNaN(valueA) && !isNaN(valueB)) {
            // Если оба значения числа, сравниваем их как числа
            return isAscending ? valueA - valueB : valueB - valueA;
        } else {
            // Если значения строки, сравниваем их как строки
            return isAscending ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
        }
    });

    // Перестраиваем таблицу
    tbody.innerHTML = "";
    rows.forEach(row => tbody.appendChild(row));
}

// Добавляем обработчики событий для заголовков таблицы
document.addEventListener("DOMContentLoaded", () => {
    const headers = document.querySelectorAll("#product-table thead th");

    headers.forEach((header, index) => {
        header.addEventListener("click", () => sortTable(index));
    });
});

function formatDate(input) {
    const [datePart, timePart] = input.split('_');
    const [day, month, year] = datePart.split('-');
    const [hour, minute, second] = timePart.split('-');

    const date = new Date(year, month - 1, day, hour, minute, second);

    return date.toISOString().slice(0, 19);
}

function showChart(selectedTableId, product) {
    // Получаем данные для выбранного товара
    const productData = data[selectedTableId][product] || [];

    const dataset = {
        label: product,
        data: productData.map(point => ({
            x: new Date(formatDate(point.timestamp)), // Временная метка
            y: point.price // Цена
        })),
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 2,
        fill: false
    };

    // Если график уже существует, обновляем его
    const ctx = document.getElementById('priceChart').getContext('2d');
    if (chart) {
        chart.data.datasets = [dataset];  // Обновляем данные
        chart.update();
    } else {
        // Создаём график, если его нет
        chart = new Chart(ctx, {
            type: 'line',
            data: { datasets: [dataset] },
            options: {
                scales: {
                    x: {
                        type: 'time',
                        time: { unit: 'day' },
                        title: { display: true, text: 'Дата' }
                    },
                    y: {
                        title: { display: true, text: 'Цена' }
                    }
                }
            }
        });
    }
}