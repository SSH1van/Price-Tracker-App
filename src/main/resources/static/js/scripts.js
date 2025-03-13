let chart;
let tempElements = null;
let tempCategoryName = null;
const applyButton = document.getElementById('apply-button');
const filterInput = document.getElementById("filter-input");
const table = document.getElementById("product-table").getElementsByTagName("tbody")[0];
const header = document.getElementById("selected-table");
const rowSlider = document.getElementById("row-slider");
const rowCountDisplay = document.getElementById("row-count");
const overlay = document.getElementById('loading-overlay');
const datetimeInput = document.getElementById("last-update");
const checkbox = document.getElementById("update-checkbox");

/************************************************
 *          ВЫПОЛНЯЕТСЯ ПРИ ЗАГРУЗКЕ            *
 ************************************************/
 // Отображение всех категорий
 renderCategories();

// Получаем диапазон дат, в котором можно выбирать периоды, когда собирались цены
if (dateTimeRange) {
    const startDateInput = document.getElementById("start-date");
    const endDateInput = document.getElementById("end-date");

    // Получаем даты и преобразуем их в формат YYYY-MM-DD
    const startDate = new Date(Object.keys(dateTimeRange)[0]).toISOString().split('T')[0];
    const endDate = new Date(Object.values(dateTimeRange)[0]).toISOString().split('T')[0];

    startDateInput.value = startDate;
    endDateInput.value = endDate;

    // Ограничиваем выбор дат
    startDateInput.min = startDate;
    startDateInput.max = endDate;
    endDateInput.min = startDate;
    endDateInput.max = endDate;
}

// Получаем диапазон дат и времени, для фильтра по последнему получению цены товара
if (dateTimeRange) {
    const dateValue = new Date(Object.values(dateTimeRange)[0]);

    // Устанавливаем время в UTC
    const utcDate = new Date(Date.UTC(
        dateValue.getUTCFullYear(),
        dateValue.getUTCMonth(),
        dateValue.getUTCDate(),
        0, 0, 0, 0
    ));

    // Преобразуем в строку в нужном формате
    const formattedDate = utcDate.toISOString().slice(0, 16);

    datetimeInput.value = formattedDate;
    datetimeInput.min = Object.keys(dateTimeRange)[0];
    datetimeInput.max =  Object.values(dateTimeRange)[0];
}

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
        (filterText && !link.toLowerCase().includes(filterText)) ||
        (checkbox.checked && formatDate(valueList.at(-1).timestamp) < datetimeInput.value)) {
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

// Обновляет значения ползунков и полей ввода на основе минимальных и максимальных значений
function updateSliders(minPrice, maxPrice, minDiff, maxDiff) {
    if (minPrice > 0) minPrice = 0;
    updateSliderRange("#sliders > div:nth-child(1)", minPrice, maxPrice);
    updateSliderRange("#sliders > div:nth-child(2)", minDiff, maxDiff);
}

// Устанавливает минимальные и максимальные значения для ползунков и полей ввода
function updateSliderRange(parentSelector, min, max) {
    const parent = document.querySelector(parentSelector);
    if (!parent) return;

    const sliders = parent.querySelectorAll("input[type='range']");
    const inputs = parent.querySelectorAll("input[type='number']");

    if (sliders.length === 2 && inputs.length === 2) {
        // Обновляем минимальные и максимальные значения
        sliders[0].min = sliders[1].min = inputs[0].min = inputs[1].min = min;
        sliders[0].max = sliders[1].max = inputs[0].max = inputs[1].max = max;

        // Устанавливаем значения ползунков
        sliders[0].value = inputs[0].value = min;
        sliders[1].value = inputs[1].value = max;

        // Принудительно вызываем события обновления
        sliders[0].dispatchEvent(new Event("input"));
        sliders[1].dispatchEvent(new Event("input"));
        inputs[0].dispatchEvent(new Event("input"));
        inputs[1].dispatchEvent(new Event("input"));
    }
}

// Применяет выбранный тип сравнения цен
function updateDiff() {
    if (!tempElements) return;

    runWithLoading(() => {
        document.querySelector('input[name="diffOption"]:checked')?.setAttribute('checked', 'checked');
        updateCategorySliders(tempElements);
        showTable(tempElements, tempCategoryName);
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

// Отображение экрана загрузки
function runWithLoading(action) {
    overlay.classList.add('active');

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const result = action();
            if (result instanceof Promise) {
                result.finally(() => overlay.classList.remove('active'));
            } else {
                overlay.classList.remove('active');
            }
        });
    });
}

// Отображение всех категорий
function renderCategories() {
    const categoryList = document.getElementById("category-list");
    categoryList.innerHTML = "";

    const categories = window.categories;
    if (!categories || Object.keys(categories).length === 0) {
        categoryList.innerHTML = "<li>Категории не найдены</li>";
        return;
    }

    categoryList.appendChild(createCategoryItem("all", "Все", true));

    Object.entries(categories).forEach(([title, children]) => {
        categoryList.appendChild(createNestedCategory(title, children));
    });

    setupCheckboxSynchronization();
}

function createCategoryItem(id, title, isTopLevel = false) {
    const li = document.createElement("li");
    li.classList.add(isTopLevel ? "category-item" : "subcategory-item");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `category-${id}`;

    const label = document.createElement("label");
    label.htmlFor = checkbox.id;

    const titleElement = document.createElement(isTopLevel ? "strong" : "span");
    titleElement.textContent = title;

    label.appendChild(titleElement);
    li.appendChild(checkbox);
    li.appendChild(label);

    return li;
}

function createNestedCategory(title, children, parentIds = []) {
    const fullId = [...parentIds, title].join('-');
    const li = createCategoryItem(fullId, title, !parentIds.length);

    if (Object.keys(children).length > 0) {
        const toggle = document.createElement("button");
        toggle.classList.add("toggle-btn");
        toggle.textContent = "▶";

        const ul = document.createElement("ul");
        ul.classList.add("nested");

        toggle.onclick = () => ul.classList.toggle("active");
        li.querySelector("label").prepend(toggle);

        Object.entries(children).forEach(([childTitle, grandChildren]) => {
            const childLi = createNestedCategory(childTitle, grandChildren, [...parentIds, title]);
            // Добавляем data-category только для листовых узлов
            if (Object.keys(grandChildren).length === 0) {
                childLi.setAttribute("data-category", childTitle);
            }
            ul.appendChild(childLi);
        });

        li.appendChild(ul);
    } else {
        li.setAttribute("data-category", title); // Листовой узел
    }

    return li;
}

// Настройка синхронизации чекбоксов
function setupCheckboxSynchronization() {
    const categoryList = document.getElementById("category-list");

    // Проверка состояния поддерева
    function updateCheckboxState(checkbox) {
        const li = checkbox.closest("li");
        // Исключаем текущий чекбокс из выборки
        const nestedCheckboxes = Array.from(li.querySelectorAll(".nested input[type='checkbox']"))
            .filter(cb => cb !== checkbox);

        // Проверяем, есть ли вложенные чекбоксы для обработки
        if (nestedCheckboxes.length > 0) {
            const allChecked = nestedCheckboxes.every(cb => cb.checked);
            const noneChecked = nestedCheckboxes.every(cb => !cb.checked);

            checkbox.classList.remove("partial");
            if (noneChecked) {
                checkbox.checked = false;
            } else if (allChecked) {
                checkbox.checked = true;
            } else {
                checkbox.checked = false;
                checkbox.classList.add("partial");
            }
        }

        // Обновляем родителя, если он есть
        const parentLi = li.closest(".nested")?.parentElement;
        if (parentLi) {
            const parentCheckbox = parentLi.querySelector(":scope > input[type='checkbox']");
            updateCheckboxState(parentCheckbox);
        }
    }

    // Обновление состояния "Все"
    function updateAllCheckbox() {
        const allCheckbox = categoryList.querySelector("#category-all");
        const allCheckboxes = categoryList.querySelectorAll("input[type='checkbox']:not(#category-all)");
        const checkedCount = Array.from(allCheckboxes).filter(cb => cb.checked).length;

        allCheckbox.classList.remove("partial");
        if (checkedCount === 0) {
            allCheckbox.checked = false;
        } else if (checkedCount === allCheckboxes.length) {
            allCheckbox.checked = true;
        } else {
            allCheckbox.checked = false;
            allCheckbox.classList.add("partial");
        }
    }

    // Обработчик для "Все"
    const allCheckbox = categoryList.querySelector("#category-all");
    allCheckbox.addEventListener("change", (e) => {
        const allCheckboxes = categoryList.querySelectorAll("input[type='checkbox']:not(#category-all)");
        allCheckboxes.forEach(cb => {
            cb.checked = e.target.checked;
            cb.classList.remove("partial");
        });
    });

    // Обработчики для остальных чекбоксов
    categoryList.querySelectorAll("input[type='checkbox']:not(#category-all)").forEach(checkbox => {
        checkbox.addEventListener("change", (e) => {
            const li = e.target.closest("li");
            const nestedCheckboxes = li.querySelectorAll(".nested input[type='checkbox']");

            // Если есть дочерние элементы, синхронизируем их
            if (nestedCheckboxes.length > 0) {
                nestedCheckboxes.forEach(cb => {
                    cb.checked = e.target.checked;
                    cb.classList.remove("partial");
                });
            }

            // Обновляем состояние текущего чекбокса и всех родителей
            updateCheckboxState(checkbox);
            updateAllCheckbox();
        });
    });

    // Инициализируем начальное состояние
    updateAllCheckbox();
}

// Запрос о получении данных
function get(startDate, endDate) {
    return fetch(`/load-data?startDate=${startDate}&endDate=${endDate}`)
        .then(response => response.json())
        .then(responseData => {
            window.data = responseData.data;
        })
        .catch(error => {
            console.error("Ошибка загрузки данных:", error);
        })
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

    const ctx = document.getElementById('price-chart').getContext('2d');
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
    const [year, month, day] = datePart.split('-');
    const [hour, minute, second] = timePart.split('-');

    const date = new Date(year, month - 1, day, hour, minute, second);

    const yyyy = date.getFullYear();
    const MM = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');

    return `${yyyy}-${MM}-${dd}T${hh}:${mm}:${ss}`;
}

/************************************************
 *            СОБЫТИЯ ДЛЯ ЭЛЕМЕНТОВ             *
 ************************************************/
// События для категорий товаров
document.getElementById('category-list').addEventListener('click', (event) => {
    const target = event.target;
    const categoryItem = target.closest('li');
    if (!categoryItem) return;

    const checkbox = categoryItem.querySelector('input[type="checkbox"]');
    const toggleBtn = target.closest('.toggle-btn');
    const clickableText = target.closest('strong') ||
                        (target.tagName === 'SPAN' && !target.classList.contains('toggle-btn') ? target : null);

    if (toggleBtn) {
        categoryItem.classList.toggle('open');
        event.preventDefault();
        event.stopPropagation();
        return;
    }

    if (target === checkbox) {
        event.stopPropagation();
        return;
    }

    if (clickableText) {
        event.preventDefault();
        runWithLoading(() => processCategoryClick(categoryItem));
    }
});

function processCategoryClick(categoryItem) {
    const categoryNameElement = categoryItem.querySelector('strong, span:not(.toggle-btn)');
    const categoryName = categoryNameElement?.textContent.trim() || "Категория";
    tempCategoryName = categoryName;

    let selectedItems;
    if (categoryName === "Все") {
        selectedItems = document.querySelectorAll('#category-list li[data-category]');
    } else if (categoryItem.querySelectorAll('li[data-category]').length > 0) {
        selectedItems = categoryItem.querySelectorAll('li[data-category]');
    } else if (categoryItem.hasAttribute('data-category')) {
        selectedItems = [categoryItem];
    } else {
        selectedItems = [];
    }

    if (!Object.keys(data).length) {
        alert("Пожалуйста, предварительно загрузите данные.");
        overlay.classList.remove('active');
        return;
    }

    updateCategorySliders(selectedItems);
    showTable(selectedItems, categoryName);
    overlay.classList.remove('active');
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
    runWithLoading(() => {
        showTable(tempElements, tempCategoryName);
    });
});

// Сортировка при клике на заголовок таблицы
document.querySelectorAll("#product-table thead th").forEach((header, index) => {
    header.addEventListener("click", () => {
        runWithLoading(() => {
            sortTable(index);
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

// Событие загрузки данных в установленном диапазоне
document.getElementById("load-data-btn").addEventListener("click", function () {
    table.innerHTML = "";

    let startDate = document.getElementById("start-date").value;
    let endDate = document.getElementById("end-date").value;

    if (!startDate || !endDate) {
        alert("Выберите диапазон дат!");
        return;
    }

    runWithLoading(() => get(startDate, endDate));
});

// Событие корректировки диапазона min max для фильтра последнего обновления цены
document.addEventListener("DOMContentLoaded", function () {
    let lastUpdate = document.getElementById("last-update");

    let minTime = lastUpdate.min;
    let maxTime = lastUpdate.max;

    // Если текущее значение выходит за пределы min/max — корректируем
    if (lastUpdate.value < minTime) {
        lastUpdate.value = minTime;
    } else if (lastUpdate.value > maxTime) {
        lastUpdate.value = maxTime;
    }

    // Запрещаем ввод за пределами min/max
    lastUpdate.addEventListener("input", function () {
        if (this.value < this.min) this.value = this.min;
        if (this.value > this.max) this.value = this.max;
    });
});

// Событие переключения checkbox последнего обновления цены
checkbox.addEventListener("change", () => datetimeInput.disabled = !checkbox.checked);