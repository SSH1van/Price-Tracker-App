package com.ivan.pricetrackerapp.controllers;

import com.ivan.pricetrackerapp.services.DataService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class MainController {

    @Autowired
    private DataService dataService;

    @GetMapping("/")
    public String index(Model model) {
        String resultsDir = "results"; // путь к директории
        var data = dataService.loadData(resultsDir); // Загружаем данные
        model.addAttribute("data", data);
        return "index";
    }
}
