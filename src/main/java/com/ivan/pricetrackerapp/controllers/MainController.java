package com.ivan.pricetrackerapp.controllers;

import java.util.Map;
import java.util.HashMap;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

import org.springframework.ui.Model;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.beans.factory.annotation.Autowired;
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

    @GetMapping("/load-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> loadData(
            @RequestParam(name = "startDate") String startDate,
            @RequestParam(name = "endDate") String endDate) {

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        LocalDate start = LocalDate.parse(startDate, formatter);
        LocalDate end = LocalDate.parse(endDate, formatter);

        var data = databaseService.loadDataInRange(start, end);

        Map<String, Object> response = new HashMap<>();
        response.put("data", data);

        return ResponseEntity.ok(response);
    }
}