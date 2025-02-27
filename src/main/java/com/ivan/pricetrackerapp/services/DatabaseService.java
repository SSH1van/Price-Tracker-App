package com.ivan.pricetrackerapp.services;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.zaxxer.hikari.HikariDataSource;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class DatabaseService {
    private static final Logger LOGGER = LoggerFactory.getLogger(DatabaseService.class);
    private final HikariDataSource dataSource;
    private static final DateTimeFormatter OUTPUT_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm");
    private static final DateTimeFormatter INPUT_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss");

    @Autowired
    public DatabaseService(HikariDataSource dataSource) {
        this.dataSource = dataSource;
    }

    public Map.Entry<String, String> getDateTimeRange() {
        String sql = "SELECT MIN(date) as min_date, MAX(date) as max_date FROM product_prices";

        try (Connection conn = dataSource.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql);
             ResultSet rs = pstmt.executeQuery()) {

            if (rs.next()) {
                Timestamp minTimestamp = rs.getTimestamp("min_date");
                Timestamp maxTimestamp = rs.getTimestamp("max_date");

                String minDateTime = minTimestamp != null
                        ? minTimestamp.toLocalDateTime().format(OUTPUT_FORMATTER)
                        : "";
                String maxDateTime = maxTimestamp != null
                        ? maxTimestamp.toLocalDateTime().format(OUTPUT_FORMATTER)
                        : "";

                return new AbstractMap.SimpleEntry<>(minDateTime, maxDateTime);
            }

        } catch (SQLException e) {
            LOGGER.error("Ошибка при получении диапазона дат", e);
        }

        return new AbstractMap.SimpleEntry<>("", "");
    }


    // Извлечение данных из PostgreSQL в указанном диапазоне дат
    public Map<String, Map<String, List<Map<String, Object>>>> loadDataInRange(LocalDate start, LocalDate end) {
        Map<String, Map<String, List<Map<String, Object>>>> data = new HashMap<>();
        String sql = "SELECT c.name AS category_name, p.url AS product_url, pp.price, pp.date " +
                "FROM product_prices pp " +
                "JOIN products p ON pp.product_id = p.id " +
                "JOIN categories c ON p.category_id = c.id " +
                "WHERE pp.date >= ? AND pp.date <= ?";

        try (Connection conn = dataSource.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setTimestamp(1, Timestamp.valueOf(start.atStartOfDay()));
            pstmt.setTimestamp(2, Timestamp.valueOf(end.plusDays(1).atStartOfDay())); // Включаем весь последний день

            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    String categoryName = rs.getString("category_name");
                    String productUrl = rs.getString("product_url");
                    int price = rs.getInt("price");
                    String timestamp = rs.getTimestamp("date")
                            .toLocalDateTime()
                            .format(INPUT_FORMATTER); // Соответствует исходному формату

                    // Создаем структуру данных, аналогичную SQLite (categoryName вместо tableName)
                    data.computeIfAbsent(categoryName, k -> new HashMap<>())
                            .computeIfAbsent(productUrl, k -> new ArrayList<>())
                            .add(Map.of(
                                    "timestamp", timestamp,
                                    "price", price
                            ));
                }
            }
        } catch (SQLException e) {
            LOGGER.error("Ошибка при загрузке данных из PostgreSQL", e);
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