let chart;
let tempElement = null;
const applyButton = document.getElementById('apply-button');
const progressBar = document.getElementById("loading-bar");
const progressContainer = document.getElementById("progress-container");
const filterInput = document.getElementById("filterInput");
const table = document.getElementById("product-table").getElementsByTagName("tbody")[0];
const header = document.getElementById("selected-table");

// Отображает таблицу товаров для выбранной категории
function showTable(element) {
    if (element === null) return;

    applyButton.disabled = false;
    tempElement = element;

    // Установка заголовка и очистка старых данных
    const category = element.getAttribute("data-category");
    header.textContent = category;
    table.innerHTML = "";

    // Получение данных
    const categoryData = data[category];
    const rows = Object.entries(categoryData);

    setupProgressBar(rows.length);
    processRows(rows)
}

// Настраивает прогресс-бар
function setupProgressBar(total) {
    progressContainer.style.display = "flex";
    progressBar.max = total;
    progressBar.value = 0;
}

// Обрабатывает строки данных в батчах
function processRows(rows) {
    const batchSize = Math.ceil(rows.length * 0.05); // 5% за раз
    let htmlRows = "";

    const filters = getFilters();
    let minPrice = Infinity, maxPrice = -Infinity;
    let minDiff = Infinity, maxDiff = -Infinity;

    function processBatch(startIndex) {
        for (let i = startIndex; i < Math.min(startIndex + batchSize, rows.length); i++) {
            const rowHtml = processRow(rows[i], filters, (price, diff) => {
                minPrice = Math.min(minPrice, price);
                maxPrice = Math.max(maxPrice, price);
                minDiff = Math.min(minDiff, diff);
                maxDiff = Math.max(maxDiff, diff);
            });

            if (rowHtml) htmlRows += rowHtml;
        }

        progressBar.value = Math.min(startIndex + batchSize, rows.length);

        if (startIndex + batchSize < rows.length) {
            requestAnimationFrame(() => processBatch(startIndex + batchSize));
        } else {
            updateSliders(minPrice, maxPrice, minDiff, maxDiff);
            table.innerHTML = htmlRows;
            progressContainer.style.display = "none";
        }
    }

    processBatch(0);
}

// Обрабатывает одну строку и возвращает HTML, если она проходит фильтр
function processRow([link, valueList], filters, updateMinMax) {
    if (!valueList.length) return "";

    const { minCurrentPrice, maxCurrentPrice, minPriceDiff, maxPriceDiff, diffType, filterText } = filters;
    const latestPrice = valueList.at(-1).price;
    const initialPrice = valueList[0].price;
    const penultimatePrice = valueList.length > 1 ? valueList.at(-2).price : latestPrice;

    let diffText = diffType === "start-last" ? initialPrice - latestPrice : penultimatePrice - latestPrice;
    let percentText = ((diffText * 100) / (diffType === "start-last" ? initialPrice : penultimatePrice)).toFixed(1);

    updateMinMax(latestPrice, diffText);

    if (latestPrice < minCurrentPrice || latestPrice > maxCurrentPrice ||
        diffText < minPriceDiff || diffText > maxPriceDiff ||
        (filterText && !link.toLowerCase().includes(filterText))) {
        return "";
    }

    return `<tr>
                <td><a href="${link}" target="_blank">${link}</a></td>
                <td>${latestPrice}</td>
                <td>${diffText}</td>
                <td>${percentText}</td>
            </tr>`;
}

// Получает текущие значения фильтров
function getFilters() {
    const selectedOption = document.querySelector('input[name="diffOption"]:checked');
    const diffType = selectedOption?.value.includes("start-last") ? "start-last" : "prev-last";

    const [minCurrentPrice, maxCurrentPrice] = getSliderRange("#sliders div:nth-child(1) input[type='range']");
    const [minPriceDiff, maxPriceDiff] = getSliderRange("#sliders div:nth-child(2) input[type='range']");
    const filterText = filterInput.value.toLowerCase();

    return { minCurrentPrice, maxCurrentPrice, minPriceDiff, maxPriceDiff, diffType, filterText };
}

// Возвращает минимальное и максимальное значение ползунков
function getSliderRange(selector) {
    const sliders = document.querySelectorAll(selector);
    let min = parseFloat(sliders[0].value);
    let max = parseFloat(sliders[1].value);
    return min > max ? [max, min] : [min, max];
}

// Обновляет значения ползунков на основе минимальных и максимальных значений цен и разницы цен
function updateSliders(minPrice, maxPrice, minDiff, maxDiff) {
    updateSliderRange("#sliders > div:nth-child(1) input[type='range']", minPrice, maxPrice);
    updateSliderRange("#sliders > div:nth-child(2) input[type='range']", minDiff, maxDiff);
}

// Устанавливает минимальные и максимальные значения для ползунков и обновляет их визуальное состояние
function updateSliderRange(selector, min, max) {
    const sliders = document.querySelectorAll(selector);
    if (sliders.length === 2) {
        sliders.forEach(slider => {
            slider.min = min;
            slider.max = max;
        });
        sliders[0].oninput();
    }
}

// Применяет выбранный тип сравнения цен
function updateDiff() {
    document.querySelector('input[name="diffOption"]:checked')?.setAttribute('checked', 'checked');
    showTable(tempElement);
}

// Сортирует таблицу по указанному столбцу
function sortTable(columnIndex) {
    const table = document.getElementById("product-table");
    const tbody = table.querySelector("tbody");
    const rows = Array.from(tbody.rows);

    // Определяем порядок сортировки. Для последней цены от меньшего к большему, для остальных наоборот
    let isAscending = columnIndex === 1;

    rows.sort((rowA, rowB) => {
        const valueA = parseFloat(rowA.cells[columnIndex].textContent) || rowA.cells[columnIndex].textContent.trim();
        const valueB = parseFloat(rowB.cells[columnIndex].textContent) || rowB.cells[columnIndex].textContent.trim();
        return isAscending ? (valueA > valueB ? 1 : -1) : (valueA < valueB ? 1 : -1);
    });

    tbody.innerHTML = "";
    rows.forEach(row => tbody.appendChild(row));
}

/************************************************
 *              ФУНКЦИОНАЛ ГРАФИКА              *
 ************************************************/
// Преобразует строку даты
function formatDate(input) {
    const [datePart, timePart] = input.split('_');
    const [day, month, year] = datePart.split('-');
    const [hour, minute, second] = timePart.split('-');

    const date = new Date(year, month - 1, day, hour, minute, second);

    return date.toISOString().slice(0, 19);
}

// Отображает график изменения цены для выбранного товара
function showChart(selectedTableId, product) {
    const productData = data[selectedTableId][product] || [];

    const dataset = {
        label: "Цена",
        data: productData.map(point => ({
            x: new Date(formatDate(point.timestamp)),
            y: point.price
        })),
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 2,
        fill: false
    };

    const ctx = document.getElementById('priceChart').getContext('2d');
    if (chart) {
        chart.data.datasets = [dataset];
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

/************************************************
 *            СОБЫТИЯ ДЛЯ ЭЛЕМЕНТОВ             *
 ************************************************/
// Повторно загружает таблицу при нажатии на кнопку "Применить фильтры".
applyButton.addEventListener('click', () => showTable(tempElement));

document.addEventListener('DOMContentLoaded', () => {
    // Сортировка при клике на заголовок таблицы
    document.querySelectorAll("#product-table thead th").forEach((header, index) => {
        header.addEventListener("click", () => sortTable(index));
    });

    // Вызов функции отрисовки графика для товара
    document.querySelector('#product-table tbody').addEventListener('click', event => {
        const row = event.target.closest('tr');
        if (!row) return;

        const product = row.cells[0].textContent.trim();
        const selectedTableId = header.textContent.trim();

        if (data[selectedTableId]?.[product]) {
            showChart(selectedTableId, product);
        } else {
            console.error(`Данные для продукта "${product}" не найдены`);
        }
    });

    // Нажатие на категорию товара
    document.getElementById('category-list').addEventListener('click', (event) => {
        const liElement = event.target.closest('li');
        showTable(liElement);
    });

    // Изменение режима отображения разницы цен
    document.querySelectorAll('#price-diff-options input[name="diffOption"]').forEach(radio => {
        radio.addEventListener('change', updateDiff);
    });
});