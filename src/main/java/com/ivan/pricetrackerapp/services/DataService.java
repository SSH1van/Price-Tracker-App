package com.ivan.pricetrackerapp.services;

import org.springframework.stereotype.Service;

import java.sql.*;
import java.nio.file.*;
import java.util.*;
import java.util.stream.Stream;

@Service
public class DataService {

    public Map<String, Map<String, Map<String, Object>>> getStructuredCategories(Map<String, Map<String, List<Map<String, Object>>>> rawData) {
        Map<String, Map<String, Map<String, Object>>> categoryProducts = new LinkedHashMap<>();

        // Карта соответствия категорий
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
                Map.entry("Запчасти", "Телефоны и смарт-часы>Запчасти"),
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
                //Map.entry("Запчасти", "Ноутбуки, планшеты и электронные книги>Запчасти"),
                Map.entry("Аккумуляторы для ноутбуков", "Ноутбуки, планшеты и электронные книги>Аккумуляторы для ноутбуков"),
                Map.entry("Зарядные устройства", "Ноутбуки, планшеты и электронные книги>Зарядные устройства"),
                Map.entry("Чехлы для электронных книг", "Ноутбуки, планшеты и электронные книги>Чехлы для электронных книг"),
                Map.entry("Электронные переводчики и словари", "Ноутбуки, планшеты и электронные книги>Электронные переводчики и словари")
        ));

        for (String tableName : rawData.keySet()) {
            String categoryPath = "Прочее>Разное"; // Категория по умолчанию

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

    public Map<String, Map<String, List<Map<String, Object>>>> loadData(String resultsDir) {
        Map<String, Map<String, List<Map<String, Object>>>> data = new HashMap<>();
        try (Stream<Path> folders = Files.list(Paths.get(resultsDir))) {
            folders.filter(Files::isDirectory)
                    .forEach(folder -> {
                        String timestamp = folder.getFileName().toString();
                        Path dbPath = folder.resolve("products.db");
                        if (Files.exists(dbPath)) {
                            extractDataFromDB(dbPath.toString(), timestamp, data);
                        }
                    });
        } catch (Exception e) {
            System.out.println("Возникла ошибка: " + e.getMessage());
        }
        filterData(data);
        return data;
    }

    // Фильтр, который пропускает товары показавшие снижение цены
    private void filterData(Map<String, Map<String, List<Map<String, Object>>>> data) {
        for (Map<String, List<Map<String, Object>>> tableData : data.values()) {
            tableData.entrySet().removeIf(entry -> {
                List<Map<String, Object>> prices = entry.getValue();
                if (prices.size() < 2) return false; // Должно быть минимум 2 записи

                // Отсортировать по timestamp (временная метка)
                prices.sort(Comparator.comparing(p -> (String) p.get("timestamp")));

                int firstPrice = (int) prices.getFirst().get("price");
                int lastPrice = (int) prices.getLast().get("price");
                int prevLastPrice = (int) prices.get(prices.size() - 2).get("price");

                return (firstPrice - lastPrice) <= 0 && (prevLastPrice - lastPrice) <= 0;
            });
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
}
