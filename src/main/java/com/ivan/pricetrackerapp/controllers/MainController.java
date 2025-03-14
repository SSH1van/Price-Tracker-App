package com.ivan.pricetrackerapp.controllers;

import java.util.Map;
import java.util.List;
import java.util.HashMap;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

import org.springframework.ui.Model;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Autowired;
import com.ivan.pricetrackerapp.services.LoadDataRequest;
import com.ivan.pricetrackerapp.services.DatabaseService;

@Controller
public class MainController {
    String resultsDir = "results";

    @Autowired
    private DatabaseService databaseService;

    @GetMapping("/")
    public String index(Model model) {
        Map.Entry<String, String> dateTimeRange = databaseService.getDateTimeRange();
        var categories = databaseService.getStructuredCategories();

        model.addAttribute("dateTimeRange", dateTimeRange);
        model.addAttribute("categories", categories);
        return "index";
    }

    @PostMapping("/load-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> loadData(@RequestBody LoadDataRequest request) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        LocalDate start = LocalDate.parse(request.getStartDate(), formatter);
        LocalDate end = LocalDate.parse(request.getEndDate(), formatter);
        List<String> categories = request.getCategories();

        var data = databaseService.loadDataInRange(start, end, categories);

        Map<String, Object> response = new HashMap<>();
        response.put("data", data);

        return ResponseEntity.ok(response);
    }
}