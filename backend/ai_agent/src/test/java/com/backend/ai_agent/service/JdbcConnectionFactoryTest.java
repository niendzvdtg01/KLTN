package com.backend.ai_agent.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

import java.util.Properties;

import org.junit.jupiter.api.Test;

import com.backend.ai_agent.entity.DataSourceEntity;
import com.backend.ai_agent.entity.DataSourcePropertyEntity;
import com.backend.ai_agent.entity.DbEngineEntity;
import com.backend.ai_agent.exception.BadRequestException;
import com.backend.ai_agent.repository.DbEngineRepository;

class JdbcConnectionFactoryTest {
    private final JdbcConnectionFactory factory = new JdbcConnectionFactory(mock(DbEngineRepository.class));

    @Test
    void buildsUrlAndPropertiesFromEngineCatalog() {
        DbEngineEntity engine = engine("SQLSERVER", "jdbc:sqlserver://{host}:{port};databaseName={database}", "[", "]",
                "TOP");
        engine.setDefaultProperties("encrypt=false;applicationName=KLTN");
        engine.setSslProperties("encrypt=true;trustServerCertificate=true");
        engine.setTimeoutProperty("loginTimeout");
        engine.setTimeoutUnit("SECONDS");
        DataSourceEntity source = source("db.local", 1433, "sales");
        source.setSslEnabled(true);
        source.setConnectTimeoutSeconds(7);
        source.getProperties().add(new DataSourcePropertyEntity(source, "applicationIntent", "ReadOnly"));

        assertEquals("jdbc:sqlserver://db.local:1433;databaseName=sales", factory.buildUrl(engine, source));
        Properties properties = factory.buildProperties(engine, source);
        assertEquals("true", properties.getProperty("encrypt"));
        assertEquals("7", properties.getProperty("loginTimeout"));
        assertEquals("ReadOnly", properties.getProperty("applicationIntent"));
        assertEquals("reader", properties.getProperty("user"));
    }

    @Test
    void customPropertiesCannotOverrideCredentialsOrEnableDangerousOptions() {
        DbEngineEntity engine = engine("MYSQL", "jdbc:mysql://{host}:{port}/{database}", "`", "`", "LIMIT");
        engine.setTimeoutProperty("connectTimeout");
        engine.setTimeoutUnit("MILLISECONDS");
        DataSourceEntity source = source("localhost", 3306, "shop");
        source.getProperties().add(new DataSourcePropertyEntity(source, "password", "other"));
        source.getProperties().add(new DataSourcePropertyEntity(source, "allowLoadLocalInfile", "true"));

        Properties properties = factory.buildProperties(engine, source);
        assertEquals("secret", properties.getProperty("password"));
        assertNull(properties.getProperty("allowLoadLocalInfile"));
        assertEquals("10000", properties.getProperty("connectTimeout"));
        assertNotNull(factory.propertyError("autoDeserialize", "true"));
        assertNotNull(factory.propertyError("socketFactory", "x.Y"));
        assertNull(factory.propertyError("characterEncoding", "utf8"));
    }

    @Test
    void quotesIdentifiersAndAppliesEngineRowLimit() {
        DbEngineEntity mysql = engine("MYSQL", "", "`", "`", "LIMIT");
        DbEngineEntity sqlServer = engine("SQLSERVER", "", "[", "]", "TOP");
        DbEngineEntity oracle = engine("ORACLE", "", "\"", "\"", "FETCH");

        assertEquals("[sales].[orders]", factory.quote(sqlServer, "sales.orders"));
        assertEquals("SELECT a FROM t LIMIT 5", factory.limit(mysql, "SELECT a FROM t", 5));
        assertEquals("SELECT DISTINCT TOP 5 a FROM t", factory.limit(sqlServer, "SELECT DISTINCT a FROM t", 5));
        assertEquals("SELECT a FROM t FETCH FIRST 5 ROWS ONLY", factory.limit(oracle, "SELECT a FROM t", 5));
        assertThrows(BadRequestException.class, () -> factory.quote(mysql, "orders`; DROP TABLE x"));
    }

    @Test
    void rejectsHostsAndDatabasesThatWouldInjectUrlParameters() {
        assertThrows(BadRequestException.class, () -> factory.validateEndpoint("db.local/x?autoDeserialize=true", "a"));
        assertThrows(BadRequestException.class, () -> factory.validateEndpoint("db.local", "shop?allowLoadLocalInfile=true"));
        assertThrows(BadRequestException.class, () -> factory.validateEndpoint("db.local", "shop;integratedSecurity=true"));
        factory.validateEndpoint("[::1]", "ORCLPDB1.localdomain");
    }

    private DbEngineEntity engine(String code, String url, String open, String close, String limitStyle) {
        DbEngineEntity engine = new DbEngineEntity();
        engine.setCode(code);
        engine.setDisplayName(code);
        engine.setUrlTemplate(url);
        engine.setIdentifierQuoteOpen(open);
        engine.setIdentifierQuoteClose(close);
        engine.setLimitStyle(limitStyle);
        engine.setTimeoutUnit("SECONDS");
        engine.setEnabled(true);
        return engine;
    }

    private DataSourceEntity source(String host, int port, String database) {
        DataSourceEntity source = new DataSourceEntity();
        source.setHost(host);
        source.setPort(port);
        source.setDatabaseName(database);
        source.setUsername("reader");
        source.setPassword("secret");
        return source;
    }
}
