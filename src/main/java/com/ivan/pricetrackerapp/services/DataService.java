package com.ivan.pricetrackerapp.services;

import java.sql.*;
import java.util.*;
import java.nio.file.*;

import java.io.File;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Optional;
import java.util.stream.Stream;
import org.springframework.stereotype.Service;

@Service
public class DataService {

    // Получение диапазона доступных дат
    public List<String> getAvailableDates(String directoryPath) {
        File dir = new File(directoryPath);
        if (!dir.exists() || !dir.isDirectory()) return Collections.emptyList();

        return Arrays.stream(Objects.requireNonNull(dir.list()))
                .filter(name -> name.matches("\\d{4}-\\d{2}-\\d{2}_\\d{2}-\\d{2}-\\d{2}"))
                .map(name -> name.split("_")[0])
                .distinct()
                .sorted()
                .toList();
    }

    // Извлечение диапазона даты и времени получения цены товаров
    public Map.Entry<String, String> getDateTimeRange(String directoryPath) {
        File dir = new File(directoryPath);
        if (!dir.exists() || !dir.isDirectory()) return new AbstractMap.SimpleEntry<>("", "");

        String[] folders = dir.list((file, name) -> name.matches("\\d{4}-\\d{2}-\\d{2}_\\d{2}-\\d{2}-\\d{2}")); // Фильтр

        if (folders == null || folders.length == 0) return new AbstractMap.SimpleEntry<>("", "");

        DateTimeFormatter inputFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss");
        DateTimeFormatter outputFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm");

        Optional<String> minFolder = Arrays.stream(folders).min(Comparator.naturalOrder());
        Optional<String> maxFolder = Arrays.stream(folders).max(Comparator.naturalOrder());

        String minDateTime = minFolder.map(f -> LocalDateTime.parse(f, inputFormatter).format(outputFormatter)).orElse("");
        String maxDateTime = maxFolder.map(f -> LocalDateTime.parse(f, inputFormatter).format(outputFormatter)).orElse("");

        return new AbstractMap.SimpleEntry<>(minDateTime, maxDateTime);
    }

    // Загрузить данные в указанном диапазоне дат
    public Map<String, Map<String, List<Map<String, Object>>>> loadDataInRange(String resultsDir, LocalDate start, LocalDate end) {
        Map<String, Map<String, List<Map<String, Object>>>> data = new HashMap<>();

        try (Stream<Path> folders = Files.list(Paths.get(resultsDir))) {
            folders.filter(Files::isDirectory)
                    .map(Path::getFileName)
                    .map(Path::toString)
                    .filter(name -> name.matches("\\d{4}-\\d{2}-\\d{2}_\\d{2}-\\d{2}-\\d{2}")) // Проверка формата
                    .forEach(folderName -> {
                        try {
                            String datePart = folderName.split("_")[0]; // Берем только дату
                            LocalDate folderDate = LocalDate.parse(datePart);
                            if (!folderDate.isBefore(start) && !folderDate.isAfter(end)) {
                                Path dbPath = Paths.get(resultsDir, folderName, "products.db");
                                if (Files.exists(dbPath)) {
                                    extractDataFromDB(dbPath.toString(), folderName, data);
                                }
                            }
                        } catch (Exception ignored) {}
                    });
        } catch (Exception e) {
            System.out.println("Ошибка загрузки данных: " + e.getMessage());
        }

        filterData(data);
        return data;
    }

    // Фильтр, который пропускает товары показавшие снижение цены
    private void filterData(Map<String, Map<String, List<Map<String, Object>>>> data) {
        Iterator<Map.Entry<String, Map<String, List<Map<String, Object>>>>> dataIterator = data.entrySet().iterator();

        while (dataIterator.hasNext()) {
            Map.Entry<String, Map<String, List<Map<String, Object>>>> tableEntry = dataIterator.next();
            Map<String, List<Map<String, Object>>> tableData = tableEntry.getValue();

            // Удаляем элементы внутри tableData, если они не проходят фильтрацию
            tableData.entrySet().removeIf(entry -> {
                List<Map<String, Object>> prices = entry.getValue();
                if (prices.size() < 2) return true; // Должно быть минимум 2 записи

                // Отсортировать по timestamp (временная метка)
                prices.sort(Comparator.comparing(p -> (String) p.get("timestamp")));

                int firstPrice = (int) prices.getFirst().get("price");
                int lastPrice = (int) prices.getLast().get("price");
                int prevLastPrice = (int) prices.get(prices.size() - 2).get("price");

                return (firstPrice - lastPrice) <= 0 && (prevLastPrice - lastPrice) <= 0;
            });

            // Если после удаления tableData пустой, удалить его из data
            if (tableData.isEmpty()) {
                dataIterator.remove();
            }
        }
    }

    private void extractDataFromDB(String dbPath, String timestamp, Map<String, Map<String, List<Map<String, Object>>>> data) {
        try (Connection conn = DriverManager.getConnection("jdbc:sqlite:" + dbPath)) {
            DatabaseMetaData meta = conn.getMetaData();

            // Получаем список всех таблиц
            try (ResultSet tables = meta.getTables(null, null, "%", new String[]{"TABLE"})) {
                while (tables.next()) {
                    String tableName = tables.getString("TABLE_NAME");
                    if (!"sqlite_sequence".equals(tableName)) {
                        extractTableData(conn, tableName, timestamp, data);
                    }
                }
            }
        } catch (SQLException e) {
            System.out.println("Возникла ошибка: " + e.getMessage());
        }
    }

    private void extractTableData(Connection conn, String tableName, String timestamp, Map<String, Map<String, List<Map<String, Object>>>> data) {
        String query = "SELECT price, link FROM \"" + tableName + "\"";
        try (PreparedStatement stmt = conn.prepareStatement(query);
             ResultSet rs = stmt.executeQuery()) {

            // Убедимся, что структура данных для таблицы существует
            data.computeIfAbsent(tableName, k -> new HashMap<>());

            while (rs.next()) {
                String link = rs.getString("link");
                int price = rs.getInt("price");

                // Добавляем данные в структуру, соответствующую таблице и ссылке
                data.get(tableName)
                        .computeIfAbsent(link, k -> new ArrayList<>())
                        .add(Map.of(
                                "timestamp", timestamp,
                                "price", price
                        ));
            }
        } catch (SQLException e) {
            System.out.println("Возникла ошибка при обработке таблицы " + tableName + ": " + e.getMessage());
        }
    }

    // Карта соответствия категорий
    public Map<String, Map<String, Map<String, Object>>> getStructuredCategories(Map<String, Map<String, List<Map<String, Object>>>> rawData) {
        Map<String, Map<String, Map<String, Object>>> categoryProducts = new LinkedHashMap<>();

        Map<String, String> categoryMapping = new HashMap<>(Map.ofEntries(
                // Телефоны и смарт-часы
                Map.entry("Смартфоны", "Телефоны и смарт-часы>Смартфоны"),
                Map.entry("Аксессуары для смартфонов и телефонов", "Телефоны и смарт-часы>Аксессуары для смартфонов и телефонов"),
                Map.entry("Смарт-часы", "Телефоны и смарт-часы>Смарт-часы"),
                Map.entry("Фитнес-браслеты", "Телефоны и смарт-часы>Фитнес-браслеты"),
                Map.entry("Ремешки для смарт-часов и фитнес-браслетов", "Телефоны и смарт-часы>Ремешки для смарт-часов и фитнес-браслетов"),
                Map.entry("Аксессуары для смарт-часов и фитнес-браслетов", "Телефоны и смарт-часы>Аксессуары для смарт-часов и фитнес-браслетов"),
                Map.entry("Мобильные телефоны", "Телефоны и смарт-часы>Мобильные телефоны"),
                Map.entry("Sim-карты", "Телефоны и смарт-часы>Sim-карты"),
                Map.entry("Запчасти для смартфонов", "Телефоны и смарт-часы>Запчасти для смартфонов"),
                Map.entry("Проводные и радиотелефоны", "Телефоны и смарт-часы>Проводные и радиотелефоны"),

                // Ноутбуки, планшеты и электронные книги
                Map.entry("Ноутбуки", "Ноутбуки, планшеты и электронные книги>Ноутбуки"),
                Map.entry("Игровые ноутбуки", "Ноутбуки, планшеты и электронные книги>Игровые ноутбуки"),
                Map.entry("Планшеты", "Ноутбуки, планшеты и электронные книги>Планшеты"),
                Map.entry("Электронные книги", "Ноутбуки, планшеты и электронные книги>Электронные книги"),
                Map.entry("Графические планшеты", "Ноутбуки, планшеты и электронные книги>Графические планшеты"),
                Map.entry("Чехлы и подставки для планшетов", "Ноутбуки, планшеты и электронные книги>Чехлы и подставки для планшетов"),
                Map.entry("Стилусы", "Ноутбуки, планшеты и электронные книги>Стилусы"),
                Map.entry("Аксессуары для ноутбуков", "Ноутбуки, планшеты и электронные книги>Аксессуары для ноутбуков"),
                Map.entry("Запчасти для ноутбуков и планшетов", "Ноутбуки, планшеты и электронные книги>Запчасти для ноутбуков и планшетов"),
                Map.entry("Аккумуляторы для ноутбуков", "Ноутбуки, планшеты и электронные книги>Аккумуляторы для ноутбуков"),
                Map.entry("Зарядные устройства", "Ноутбуки, планшеты и электронные книги>Зарядные устройства"),
                Map.entry("Чехлы для электронных книг", "Ноутбуки, планшеты и электронные книги>Чехлы для электронных книг"),
                Map.entry("Электронные переводчики и словари", "Ноутбуки, планшеты и электронные книги>Электронные переводчики и словари")
        ));

        for (String tableName : rawData.keySet()) {
            String categoryPath = "Прочее>Разное";

            for (Map.Entry<String, String> entry : categoryMapping.entrySet()) {
                if (tableName.contains(entry.getKey())) {
                    categoryPath = entry.getValue();
                    break;
                }
            }

            String[] levels = categoryPath.split(">");
            String mainCategory = levels[0];
            String subCategory = levels[1];

            categoryProducts
                    .computeIfAbsent(mainCategory, k -> new LinkedHashMap<>())
                    .computeIfAbsent(subCategory, k -> new LinkedHashMap<>())
                    .computeIfAbsent(tableName, k -> new LinkedHashMap<>());
        }

        return categoryProducts;
    }
}
