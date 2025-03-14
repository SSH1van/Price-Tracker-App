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
    public Map<String, Map<String, List<Map<String, Object>>>> loadDataInRange(LocalDate start, LocalDate end, List<String> categories) {
        Map<String, Map<String, List<Map<String, Object>>>> data = new HashMap<>();

        // Базовый SQL-запрос
        StringBuilder sql = new StringBuilder(
                "SELECT c.name AS category_name, p.url AS product_url, pp.price, pp.date " +
                        "FROM product_prices pp " +
                        "JOIN products p ON pp.product_id = p.id " +
                        "JOIN categories c ON p.category_id = c.id " +
                        "WHERE pp.date >= ? AND pp.date <= ?"
        );

        // Добавляем фильтр по категориям, если они указаны
        if (categories != null && !categories.isEmpty()) {
            sql.append(" AND c.name IN (");
            sql.append(String.join(",", Collections.nCopies(categories.size(), "?")));
            sql.append(")");
        }

        try (Connection conn = dataSource.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql.toString())) {

            // Устанавливаем параметры для дат
            pstmt.setTimestamp(1, Timestamp.valueOf(start.atStartOfDay()));
            pstmt.setTimestamp(2, Timestamp.valueOf(end.plusDays(1).atStartOfDay())); // Включаем весь последний день

            // Устанавливаем параметры для категорий, если они есть
            if (categories != null && !categories.isEmpty()) {
                for (int i = 0; i < categories.size(); i++) {
                    pstmt.setString(i + 3, categories.get(i)); // Начинаем с 3-го параметра после дат
                }
            }

            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    String categoryName = rs.getString("category_name");
                    String productUrl = rs.getString("product_url");
                    int price = rs.getInt("price");
                    String timestamp = rs.getTimestamp("date")
                            .toLocalDateTime()
                            .format(INPUT_FORMATTER);

                    // Создаем структуру данных
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
    public Map<String, Map<String, Map<String, Map<String, Object>>>> getStructuredCategories() {
        Map<String, Map<String, Map<String, Map<String, Object>>>> categoryProducts = new LinkedHashMap<>();

        String sql = """
            WITH RECURSIVE category_tree AS (
                SELECT\s
                    id,
                    name,
                    parent_id,
                    1 AS level
                FROM categories
                WHERE parent_id IS NULL
               \s
                UNION ALL
               \s
                SELECT\s
                    c.id,
                    c.name,
                    c.parent_id,
                    ct.level + 1 AS level
                FROM categories c
                JOIN category_tree ct ON c.parent_id = ct.id
            )
            SELECT\s
                c1.name AS level1,
                c2.name AS level2,
                c3.name AS level3,
                c4.name AS level4
            FROM category_tree c1
            LEFT JOIN category_tree c2 ON c2.parent_id = c1.id AND c2.level = 2
            LEFT JOIN category_tree c3 ON c3.parent_id = c2.id AND c3.level = 3
            LEFT JOIN category_tree c4 ON c4.parent_id = c3.id AND c4.level = 4
            WHERE c1.level = 1
            ORDER BY c1.name, c2.name, c3.name, c4.name;
       \s""";

        try (Connection conn = dataSource.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql);
             ResultSet rs = pstmt.executeQuery()) {

            while (rs.next()) {
                String level1 = rs.getString("level1");
                String level2 = rs.getString("level2");
                String level3 = rs.getString("level3");
                String level4 = rs.getString("level4");

                if (level2 == null) {
                    continue; // Пропускаем, если нет подкатегории
                }

                // Заполняем структуру
                Map<String, Map<String, Map<String, Object>>> level2Map = categoryProducts
                        .computeIfAbsent(level1, k -> new LinkedHashMap<>());

                Map<String, Map<String, Object>> level3Map = level2Map
                        .computeIfAbsent(level2, k -> new LinkedHashMap<>());

                Map<String, Object> level4Map = level3Map
                        .computeIfAbsent(level3 != null ? level3 : "", k -> new LinkedHashMap<>());

                if (level4 != null) {
                    level4Map.computeIfAbsent(level4, k -> new LinkedHashMap<>());
                }
            }

        } catch (SQLException e) {
            LOGGER.error("Ошибка при загрузке данных из PostgreSQL", e);
        }

        return categoryProducts;
    }

}