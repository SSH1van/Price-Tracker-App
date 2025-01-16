package com.ivan.pricetrackerapp.services;

import org.springframework.stereotype.Service;

import java.sql.*;
import java.nio.file.*;
import java.util.*;
import java.util.stream.Stream;

@Service
public class DataService {

    private void extractTableData(Connection conn, String tableName, String timestamp, Map<String, Map<String, List<Map<String, Object>>>> data) {
        String query = "SELECT price, link FROM " + tableName;
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
        return data;
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
}
