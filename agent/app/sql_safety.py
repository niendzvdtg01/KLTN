import re


class UnsafeSqlError(ValueError):
    pass


_FORBIDDEN = re.compile(
    r"\b(insert|update|delete|drop|alter|truncate|create|replace|merge|grant|revoke|call|execute|outfile|load_file|dumpfile|lock|unlock|set|use|handler|into)\b",
    re.IGNORECASE,
)


def validate_read_only_sql(sql: str) -> str:
    normalized = sql.strip()
    if not normalized:
        raise UnsafeSqlError("Generated SQL is empty")
    if normalized.count(";") > 1 or (";" in normalized and not normalized.endswith(";")):
        raise UnsafeSqlError("Only one SQL statement is allowed")
    statement = normalized[:-1].strip() if normalized.endswith(";") else normalized
    if not re.match(r"^(select|with)\b", statement, re.IGNORECASE):
        raise UnsafeSqlError("Only SELECT or WITH queries are allowed")
    if "--" in statement or "/*" in statement or "*/" in statement:
        raise UnsafeSqlError("SQL comments are not allowed")
    match = _FORBIDDEN.search(statement)
    if match:
        raise UnsafeSqlError(f"Forbidden SQL operation: {match.group(1).upper()}")
    return statement + ";"


def quote_identifier(identifier: str) -> str:
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", identifier):
        raise UnsafeSqlError(f"Invalid identifier: {identifier}")
    return identifier

