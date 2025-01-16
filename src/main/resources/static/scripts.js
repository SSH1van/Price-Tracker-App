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
            let diffText = "Нет данных";

            if (valueList.length > 0) {
                const latestPrice = valueList[valueList.length - 1].price;
                const initialPrice = valueList[0].price;
                priceText = latestPrice;
                diffText = initialPrice - latestPrice;
            }

            htmlRows += `
                <tr>
                    <td>${link}</td>
                    <td>${priceText}</td>
                    <td>${diffText}</td>
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