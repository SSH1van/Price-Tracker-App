# Price-Tracker-App

## About
На основе полученных данных из парсинга предоставляет веб-интерфейс для анализа динамики цен на товары

## Configuration
Перед запуском приложения создайте файл `application.properties` в директории `resources` со следующей структурой:

```properties
# Настройки безопасности
app.security.username=username
app.security.password=password

# Настройки подключения к базе данных PostgreSQL
spring.datasource.url=jdbc:postgresql://localhost:5432/products
spring.datasource.username=postgres
spring.datasource.password=root
spring.datasource.driver-class-name=org.postgresql.Driver

# Настройки пула соединений Hikari (опционально)
spring.datasource.hikari.maximum-pool-size=10
spring.datasource.hikari.minimum-idle=2
spring.datasource.hikari.idle-timeout=30000
spring.datasource.hikari.max-lifetime=1800000
spring.datasource.hikari.connection-timeout=10000
```