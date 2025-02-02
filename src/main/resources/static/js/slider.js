function syncValues(parent) {
    const minInput = parent.querySelector(".min-input");
    const maxInput = parent.querySelector(".max-input");
    const minSlider = parent.querySelector(".min-slider");
    const maxSlider = parent.querySelector(".max-slider");

    // Функция обновления ползунков при вводе в поля
    function updateSliders() {
        let minValue = parseFloat(minInput.value);
        let maxValue = parseFloat(maxInput.value);

        const minLimit = parseFloat(minInput.min);
        const maxLimit = parseFloat(maxInput.max);

        // Ограничиваем значения в пределах min/max
        minValue = Math.max(minLimit, Math.min(maxLimit, minValue));
        maxValue = Math.max(minLimit, Math.min(maxLimit, maxValue));

        minInput.value = minValue;
        maxInput.value = maxValue;

        // Если минимальное значение больше максимального, меняем их местами
        if (minValue > maxValue) {
            [minValue, maxValue] = [maxValue, minValue];
        }

        minSlider.value = minValue;
        maxSlider.value = maxValue;
    }

    // Функция обновления полей при изменении ползунков
    function updateInputs() {
        let minValue = parseFloat(minSlider.value);
        let maxValue = parseFloat(maxSlider.value);

        if (minValue > maxValue) {
            [minValue, maxValue] = [maxValue, minValue];
        }

        minInput.value = minValue;
        maxInput.value = maxValue;
    }

    // Привязываем обработчики событий
    minInput.addEventListener("input", updateSliders);
    maxInput.addEventListener("input", updateSliders);
    minSlider.addEventListener("input", updateInputs);
    maxSlider.addEventListener("input", updateInputs);

    // Инициализация значений
    updateInputs();
}

window.onload = function () {
    document.querySelectorAll(".range-slider").forEach(syncValues);
};