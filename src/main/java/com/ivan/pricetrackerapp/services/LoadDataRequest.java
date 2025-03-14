package com.ivan.pricetrackerapp.services;

import java.util.List;

// DTO для десериализации JSON-запроса
public class LoadDataRequest {
    private String startDate;
    private String endDate;
    private List<String> categories;

    // Геттеры и сеттеры
    public String getStartDate() { return startDate; }
    public void setStartDate(String startDate) { this.startDate = startDate; }
    public String getEndDate() { return endDate; }
    public void setEndDate(String endDate) { this.endDate = endDate; }
    public List<String> getCategories() { return categories; }
    public void setCategories(List<String> categories) { this.categories = categories; }
}
