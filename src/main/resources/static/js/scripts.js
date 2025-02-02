let chart;
let tempElements = null;
let tempCategoryName = null;
const applyButton = document.getElementById('apply-button');
const filterInput = document.getElementById("filterInput");
const table = document.getElementById("product-table").getElementsByTagName("tbody")[0];
const header = document.getElementById("selected-table");
const rowSlider = document.getElementById("row-slider");
const rowCountDisplay = document.getElementById("row-count");
const overlay = document.getElementById('loadingOverlay');

/************************************************
 *             ОТОБРАЖЕНИЕ ТАБЛИЦЫ              *
 ************************************************/
// Отображает таблицу товаров для выбранной категории
function showTable(elements, categoryName) {
    if (!elements || elements.length === 0) return;

    tempElements = elements;
    tempCategoryName = categoryName;
    header.textContent = categoryName;
    table.innerHTML = "";

    // Объединяем данные всех переданных категорий
    let allRows = [];
    elements.forEach(element => {
        const category = element.getAttribute("data-category");
        const categoryData = data[category];

        if (categoryData) {
            allRows = allRows.concat(Object.entries(categoryData));
        }
    });

    processRows(allRows);
}


// Обрабатывает строки данных в батчах
function processRows(rows) {
    let maxRows = parseInt(rowSlider.value, 10);
    let filteredRows = [];

    for (let i = 0; i < rows.length && filteredRows.length < maxRows; i++) {
        let rowHtml = processRow(rows[i]);
        if (rowHtml) filteredRows.push(rowHtml);
    }

    table.innerHTML = filteredRows.join('');
}

// Обрабатывает одну строку и возвращает HTML, если она проходит фильтр
function processRow([link, valueList]) {
    if (!valueList.length) return "";

    const { minCurrentPrice, maxCurrentPrice, minPriceDiff, maxPriceDiff, diffType, filterText } = getFilters();
    const { latestPrice, diffPrice, percentText } = getPricePercent(valueList, diffType);

    if (latestPrice < minCurrentPrice || latestPrice > maxCurrentPrice ||
        diffPrice < minPriceDiff || diffPrice > maxPriceDiff ||
        (filterText && !link.toLowerCase().includes(filterText))) {
        return "";
    }

    return `<tr>
                <td><a href="${link}" target="_blank">${link}</a></td>
                <td>${latestPrice}</td>
                <td>${diffPrice}</td>
                <td>${percentText}</td>
            </tr>`;
}

/************************************************
 *           ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ            *
 ************************************************/
// Получает последнюю цену, разницу и процент разницы
function getPricePercent(valueList, diffType) {
    const latestPrice = valueList.at(-1).price;
    const initialPrice = valueList[0].price;
    const penultimatePrice = valueList.length > 1 ? valueList.at(-2).price : latestPrice;

    let diffPrice = diffType === "start-last" ? initialPrice - latestPrice : penultimatePrice - latestPrice;
    let percentText = ((diffPrice * 100) / (diffType === "start-last" ? initialPrice : penultimatePrice)).toFixed(1);

    return { latestPrice, diffPrice, percentText };
}

// Получает текущие значения фильтров
function getFilters() {
    const diffType = getDiffType();
    const [minCurrentPrice, maxCurrentPrice] = getSliderRange("#sliders div:nth-child(1) input[type='range']");
    const [minPriceDiff, maxPriceDiff] = getSliderRange("#sliders div:nth-child(2) input[type='range']");
    const filterText = filterInput.value.toLowerCase();

    return { minCurrentPrice, maxCurrentPrice, minPriceDiff, maxPriceDiff, diffType, filterText };
}

// Получает тип разницы цен
function getDiffType() {
    const selectedOption = document.querySelector('input[name="diffOption"]:checked');
    return selectedOption?.value.includes("start-last") ? "start-last" : "prev-last";
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
        sliders[0].min = sliders[1].min = min;
        sliders[0].max = sliders[1].max = max;

        sliders[0].value = min;
        sliders[1].value = max;

        sliders[0].dispatchEvent(new Event("input"));
        sliders[1].dispatchEvent(new Event("input"));
    }
}

// Применяет выбранный тип сравнения цен
function updateDiff() {
    if (!tempElements) return;
    overlay.classList.add('active');

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            document.querySelector('input[name="diffOption"]:checked')?.setAttribute('checked', 'checked');
            updateCategorySliders(tempElements);
            showTable(tempElements, tempCategoryName);
            overlay.classList.remove('active');
        });
    });
}

// Сортирует таблицу по указанному столбцу
function sortTable(columnIndex) {
    // Определяем порядок сортировки. Для последней цены от меньшего к большему, для остальных наоборот
    const currentSortOrder = columnIndex === 1;

    if (!tempElements || tempElements.length === 0 || columnIndex === 0) return;
    const diffType = getDiffType();
    let allRows = [];

    // Собираем все данные из tempElement
    tempElements.forEach(element => {
        const category = element.getAttribute("data-category");
        const categoryData = data[category];

        if (categoryData) {
            allRows = allRows.concat(Object.entries(categoryData));
        }
    });

    // Сортируем все строки по нужному столбцу
    allRows.sort((a, b) => {
        const rowA = extractSortValue(a, columnIndex, diffType);
        const rowB = extractSortValue(b, columnIndex, diffType);

        return currentSortOrder ? (rowA > rowB ? 1 : -1) : (rowA < rowB ? 1 : -1);
    });

    // Запускаем процесс отображения уже отсортированных данных
    processRows(allRows);
}

// Функция извлечения значения для сортировки
function extractSortValue(row, columnIndex, diffType) {
    const valueList = row[1];
    if (!valueList.length) return 0;

    const latestPrice = valueList.at(-1).price;
    const initialPrice = valueList[0].price;
    const penultimatePrice = valueList.length > 1 ? valueList.at(-2).price : latestPrice;

    switch (columnIndex) {
        case 1:
            return latestPrice;
        case 2: {
            return diffType === "start-last"
                ? initialPrice - latestPrice
                : penultimatePrice - latestPrice;
        }
        case 3: {
            const basePrice = diffType === "start-last" ? initialPrice : penultimatePrice;
            return basePrice ? ((basePrice - latestPrice) * 100) / basePrice : 0;
        }
        default:
            return 0;
    }
}

// Функция обновления границ слайдеров на основе данных категории
function updateCategorySliders(elements) {
    let minPrice = Infinity, maxPrice = -Infinity;
    let minDiff = Infinity, maxDiff = -Infinity;

    elements.forEach(element => {
        const category = element.getAttribute("data-category");
        const categoryData = data[category];

        if (categoryData) {
            Object.values(categoryData).forEach(valueList => {
                if (!valueList.length) return;

                const diffType = getDiffType();
                const { latestPrice, diffPrice} = getPricePercent(valueList, diffType);

                minPrice = Math.min(minPrice, latestPrice);
                maxPrice = Math.max(maxPrice, latestPrice);
                minDiff = Math.min(minDiff, diffPrice);
                maxDiff = Math.max(maxDiff, diffPrice);
            });
        }
    });

    updateSliders(minPrice, maxPrice, minDiff, maxDiff);
}

/************************************************
 *              ФУНКЦИОНАЛ ГРАФИКА              *
 ************************************************/
// Отображает график изменения цены для выбранного товара
function showChart(selectedTableId, product) {
    const productData = data[selectedTableId][product] || [];

    const dataset = {
        label: "Цена",
        data: productData.map(point => ({
            x: new Date(formatDate(point.timestamp)),
            y: point.price
        })),
        borderColor: 'rgba(0, 191, 255, 1)',
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
                plugins: {
                    legend: {
                        display: false // Скрываем легенду
                    }
                },
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

// Преобразует строку даты
function formatDate(input) {
    const [datePart, timePart] = input.split('_');
    const [day, month, year] = datePart.split('-');
    const [hour, minute, second] = timePart.split('-');

    const date = new Date(year, month - 1, day, hour, minute, second);

    return date.toISOString().slice(0, 19);
}

/************************************************
 *            СОБЫТИЯ ДЛЯ ЭЛЕМЕНТОВ             *
 ************************************************/
// События для категорий товаров
document.getElementById('category-list').addEventListener('click', (event) => {
    overlay.classList.add('active');

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            processCategoryClick(event);
        });
    });
});

function processCategoryClick(event) {
    const toggleBtn = event.target.closest('.toggle-btn');
    const categoryItem = event.target.closest('li');

    if (!categoryItem) {
        overlay.classList.remove('active');
        return;
    }

    if (toggleBtn) {
        // Переключение раскрытия подкатегорий
        categoryItem.classList.toggle('open');
        toggleBtn.textContent = categoryItem.classList.contains('open') ? '▼' : '▶';
        overlay.classList.remove('active');
    } else {
        // Определяем текст категории
        let categoryNameElement = categoryItem.querySelector('strong, span:not(.toggle-btn)');
        let categoryName = categoryNameElement ? categoryNameElement.textContent.trim() : "Категория";
        tempCategoryName = categoryName;

        // Собираем все вложенные элементы с data-category
        const nestedItems = categoryItem.querySelectorAll('li[data-category]');
        const selectedItems = nestedItems.length > 0 ? nestedItems : [categoryItem];

        // Находим min/max перед отображением
        updateCategorySliders(selectedItems);

        // Отображаем таблицу
        showTable(selectedItems, categoryName);
        overlay.classList.remove('active');
    }
}

// Вызов функции отрисовки графика для товара
document.querySelector('#product-table tbody').addEventListener('click', event => {
    const row = event.target.closest('tr');
    if (!row) return;

    const product = row.cells[0].textContent.trim();
    let selectedTableId = header.textContent.trim();
    if (!(selectedTableId in data)) {
        let exitLoop = false;
        for (const selectedTable in data) {
            if (exitLoop) break;

            for (const productUrl in data[selectedTable]) {
                if (productUrl === product) {
                    selectedTableId = selectedTable;
                    exitLoop = true;
                    break;
                }
            }
        }
    }

    if (data[selectedTableId]?.[product]) {
        showChart(selectedTableId, product);
    } else {
        console.error(`Данные для продукта "${product}" не найдены`);
    }
});


// Повторно загружает таблицу при нажатии на кнопку "Применить фильтры".
applyButton.addEventListener('click', () => {
    overlay.classList.add('active');

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            showTable(tempElements, tempCategoryName);
            overlay.classList.remove('active');
        });
    });
});

// Сортировка при клике на заголовок таблицы
document.querySelectorAll("#product-table thead th").forEach((header, index) => {
    header.addEventListener("click", () => {
        overlay.classList.add('active');
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                sortTable(index);
                overlay.classList.remove('active');
            });
        });
    });
});

// Изменение режима отображения разницы цен
document.querySelectorAll('#price-diff-options input[name="diffOption"]').forEach(radio => {
    radio.addEventListener('change', updateDiff);
});

// Событие изменения значения слайдера количества ссылок
rowSlider.addEventListener("input", () => {
    rowCountDisplay.textContent = rowSlider.value;
});