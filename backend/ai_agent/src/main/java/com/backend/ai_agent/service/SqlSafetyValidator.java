package com.backend.ai_agent.service;

import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import com.backend.ai_agent.exception.BadRequestException;

@Component
public class SqlSafetyValidator {
    private static final Pattern FORBIDDEN = Pattern.compile(
            "\\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|RENAME|GRANT|REVOKE|CALL|EXEC|SET|USE|LOAD|OUTFILE|DUMPFILE)\\b",
            Pattern.CASE_INSENSITIVE);

    public String validateReadOnly(String sql) {
        if (sql == null || sql.isBlank())
            throw new BadRequestException("SQL không được để trống");
        String value = sql.trim();
        // The agent normalizes output to a single trailing ';'. Allow that one, forbid any others.
        if (value.endsWith(";"))
            value = value.substring(0, value.length() - 1).trim();
        String upper = value.toUpperCase(Locale.ROOT);
        if (value.isEmpty() || value.length() > 100000 || value.contains(";")
                || !(upper.startsWith("SELECT") || upper.startsWith("WITH"))
                || FORBIDDEN.matcher(value).find() || value.contains("--") || value.contains("/*")
                || value.contains("*/"))
            throw new BadRequestException("Chỉ cho phép một câu SQL đọc dữ liệu (SELECT/WITH)");
        return value;
    }
}
