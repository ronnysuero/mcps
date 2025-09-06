#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

class ConnectionManager {
  constructor() {
    this.pools = new Map();
    this.configs = new Map();
  }

  addDatabase(name, config) {
    this.configs.set(name, config);
  }

  async getPool(databaseName) {
    if (!this.pools.has(databaseName)) {
      if (!this.configs.has(databaseName)) {
        throw new Error(`Base de datos '${databaseName}' no está configurada`);
      }
      const config = this.configs.get(databaseName);
      const pool = new sql.ConnectionPool(config);
      await pool.connect();
      this.pools.set(databaseName, pool);
    }
    return this.pools.get(databaseName);
  }

  getAvailableDatabases() {
    return Array.from(this.configs.keys());
  }

  async disconnect(databaseName) {
    if (this.pools.has(databaseName)) {
      const pool = this.pools.get(databaseName);
      await pool.close();
      this.pools.delete(databaseName);
    }
  }

  async disconnectAll() {
    const promises = Array.from(this.pools.keys()).map(name => this.disconnect(name));
    await Promise.all(promises);
  }
}

class SQLServerMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: "sqlserver-mcp",
        version: "2.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.connectionManager = new ConnectionManager();
    this.defaultDatabase = null;
    this.loadDatabaseConfigs();
    this.setupToolHandlers();
  }

  debugLog(message) {
    // Solo log si DEBUG_MCP está habilitado, y va a stderr para no interferir con protocolo MCP
    if (process.env.DEBUG_MCP === 'true') {
      process.stderr.write(`[SQL-MCP] ${message}\n`);
    }
  }

  loadDatabaseConfigs() {
    // Buscar el archivo en el mismo directorio que este script
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const configPath = path.join(__dirname, 'databases.config.json');
    
    // Verificar que el archivo existe
    if (!fs.existsSync(configPath)) {
      throw new Error(`Archivo databases.config.json no encontrado en: ${configPath}`);
    }
    
    let config;
    try {
      const configData = fs.readFileSync(configPath, 'utf8');
      config = JSON.parse(configData);
    } catch (error) {
      throw new Error(`Error leyendo databases.config.json: ${error.message}`);
    }
    
    // Validar estructura del JSON
    if (!config.databases || !Array.isArray(config.databases)) {
      throw new Error('El archivo databases.config.json debe tener una propiedad "databases" que sea un array');
    }
    
    if (config.databases.length === 0) {
      throw new Error('El archivo databases.config.json debe contener al menos una base de datos');
    }
    
    // Validar cada base de datos
    config.databases.forEach((db, index) => {
      const requiredFields = ['name', 'user', 'password', 'server', 'database', 'port'];
      for (const field of requiredFields) {
        if (!db[field]) {
          throw new Error(`Base de datos en índice ${index}: campo requerido "${field}" faltante`);
        }
      }
    });
    
    this.debugLog(`Configuración cargada desde databases.config.json: ${config.databases.length} base(s) de datos`);

    // Agregar todas las bases de datos configuradas
    config.databases.forEach(dbConfig => {
      this.connectionManager.addDatabase(dbConfig.name, {
        user: dbConfig.user,
        password: dbConfig.password,
        server: dbConfig.server,
        database: dbConfig.database,
        port: dbConfig.port,
        options: dbConfig.options || {
          encrypt: false,
          trustServerCertificate: true,
        },
      });
    });

    // Establecer base de datos por defecto
    if (config.defaultDatabase && config.databases.find(db => db.name === config.defaultDatabase)) {
      this.defaultDatabase = config.defaultDatabase;
    } else {
      this.defaultDatabase = config.databases[0].name;
    }
    
    this.debugLog(`Base de datos por defecto: ${this.defaultDatabase}`);
  }

  async getPool(databaseName) {
    const dbName = databaseName || this.defaultDatabase;
    if (!dbName) {
      throw new Error('No hay bases de datos configuradas');
    }
    return await this.connectionManager.getPool(dbName);
  }

  async disconnect() {
    await this.connectionManager.disconnectAll();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "sql_query",
          description: "Ejecuta una consulta SQL SELECT en la base de datos especificada",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Consulta SQL SELECT a ejecutar"
              },
              database: {
                type: "string",
                description: "Nombre de la base de datos (opcional, usa la default si no se especifica)"
              }
            },
            required: ["query"]
          }
        },
        {
          name: "sql_execute",
          description: "Ejecuta comandos SQL (INSERT, UPDATE, DELETE, CREATE, etc.) en la base de datos especificada",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Comando SQL a ejecutar"
              },
              database: {
                type: "string",
                description: "Nombre de la base de datos (opcional, usa la default si no se especifica)"
              }
            },
            required: ["query"]
          }
        },
        {
          name: "sql_tables",
          description: "Lista todas las tablas en la base de datos especificada",
          inputSchema: {
            type: "object",
            properties: {
              database: {
                type: "string",
                description: "Nombre de la base de datos (opcional, usa la default si no se especifica)"
              }
            }
          }
        },
        {
          name: "sql_describe",
          description: "Describe la estructura de una tabla en la base de datos especificada",
          inputSchema: {
            type: "object",
            properties: {
              table: {
                type: "string",
                description: "Nombre de la tabla a describir"
              },
              database: {
                type: "string",
                description: "Nombre de la base de datos (opcional, usa la default si no se especifica)"
              }
            },
            required: ["table"]
          }
        },
        {
          name: "sql_connection_info",
          description: "Muestra información de la conexión para una base de datos específica",
          inputSchema: {
            type: "object",
            properties: {
              database: {
                type: "string",
                description: "Nombre de la base de datos (opcional, usa la default si no se especifica)"
              }
            }
          }
        },
        {
          name: "sql_databases",
          description: "Lista todas las bases de datos disponibles configuradas",
          inputSchema: {
            type: "object",
            properties: {}
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case "sql_query":
            return await this.handleQuery(request.params.arguments);
          case "sql_execute":
            return await this.handleExecute(request.params.arguments);
          case "sql_tables":
            return await this.handleTables(request.params.arguments);
          case "sql_describe":
            return await this.handleDescribe(request.params.arguments);
          case "sql_connection_info":
            return await this.handleConnectionInfo(request.params.arguments);
          case "sql_databases":
            return await this.handleDatabases();
          default:
            throw new Error(`Herramienta desconocida: ${request.params.name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error.message}`
            }
          ]
        };
      }
    });
  }

  async handleQuery(args) {
    const { query, database } = args;
    
    // Verificar que sea una consulta SELECT
    if (!query.trim().toLowerCase().startsWith('select')) {
      throw new Error('Solo se permiten consultas SELECT con sql_query. Usa sql_execute para otros comandos.');
    }

    const pool = await this.getPool(database);
    const request = pool.request();
    const result = await request.query(query);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            database: database || this.defaultDatabase,
            rowCount: result.recordset.length,
            data: result.recordset
          }, null, 2)
        }
      ]
    };
  }

  async handleExecute(args) {
    const { query, database } = args;
    
    const pool = await this.getPool(database);
    const request = pool.request();
    const result = await request.query(query);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            database: database || this.defaultDatabase,
            rowsAffected: result.rowsAffected,
            output: result.output || {},
            recordset: result.recordset || []
          }, null, 2)
        }
      ]
    };
  }

  async handleTables(args = {}) {
    const { database } = args;
    
    const query = `
      SELECT 
        TABLE_SCHEMA,
        TABLE_NAME,
        TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `;
    
    const pool = await this.getPool(database);
    const request = pool.request();
    const result = await request.query(query);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            database: database || this.defaultDatabase,
            tables: result.recordset
          }, null, 2)
        }
      ]
    };
  }

  async handleDescribe(args) {
    const { table, database } = args;
    
    const query = `
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE,
        COLUMN_DEFAULT,
        ORDINAL_POSITION
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = @table
      ORDER BY ORDINAL_POSITION
    `;
    
    const pool = await this.getPool(database);
    const request = pool.request();
    request.input('table', sql.NVarChar, table);
    const result = await request.query(query);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            database: database || this.defaultDatabase,
            table: table,
            columns: result.recordset
          }, null, 2)
        }
      ]
    };
  }

  async handleConnectionInfo(args = {}) {
    const { database } = args;
    const dbName = database || this.defaultDatabase;
    const config = this.connectionManager.configs.get(dbName);
    const isConnected = this.connectionManager.pools.has(dbName);
    
    if (!config) {
      throw new Error(`Base de datos '${dbName}' no está configurada`);
    }
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            database: dbName,
            server: config.server,
            port: config.port,
            user: config.user,
            connected: isConnected
          }, null, 2)
        }
      ]
    };
  }

  async handleDatabases() {
    const databases = this.connectionManager.getAvailableDatabases();
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            defaultDatabase: this.defaultDatabase,
            availableDatabases: databases,
            totalCount: databases.length
          }, null, 2)
        }
      ]
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    // Manejar cierre limpio
    process.on('SIGINT', async () => {
      await this.disconnect();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      await this.disconnect();
      process.exit(0);
    });
  }
}

// Ejecutar el servidor
const server = new SQLServerMCPServer();
server.run().catch(console.error);