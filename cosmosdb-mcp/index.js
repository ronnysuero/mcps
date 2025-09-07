#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { CosmosClient } from '@azure/cosmos';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

class CosmosConnectionManager {
  constructor() {
    this.clients = new Map();
    this.configs = new Map();
  }

  addDatabase(name, config) {
    this.configs.set(name, config);
  }

  async getClient(databaseName) {
    if (!this.clients.has(databaseName)) {
      if (!this.configs.has(databaseName)) {
        throw new Error(`Base de datos CosmosDB '${databaseName}' no está configurada`);
      }
      const config = this.configs.get(databaseName);
      const client = new CosmosClient({
        endpoint: config.endpoint,
        key: config.key
      });
      this.clients.set(databaseName, client);
    }
    return this.clients.get(databaseName);
  }

  getAvailableDatabases() {
    return Array.from(this.configs.keys());
  }

  async disconnect(databaseName) {
    if (this.clients.has(databaseName)) {
      const client = this.clients.get(databaseName);
      await client.dispose();
      this.clients.delete(databaseName);
    }
  }

  async disconnectAll() {
    const promises = Array.from(this.clients.keys()).map(name => this.disconnect(name));
    await Promise.all(promises);
  }
}

class CosmosDBMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: "cosmosdb-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.connectionManager = new CosmosConnectionManager();
    this.defaultDatabase = null;
    this.loadDatabaseConfigs();
    this.setupToolHandlers();
  }

  debugLog(message) {
    if (process.env.DEBUG_MCP === 'true') {
      process.stderr.write(`[COSMOS-MCP] ${message}\n`);
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
      const requiredFields = ['name', 'endpoint', 'key', 'database'];
      for (const field of requiredFields) {
        if (!db[field]) {
          throw new Error(`Base de datos en índice ${index}: campo requerido "${field}" faltante`);
        }
      }
      // Validar API type
      if (db.type && !['sql', 'mongodb', 'gremlin', 'cassandra', 'table'].includes(db.type)) {
        throw new Error(`Base de datos en índice ${index}: tipo "${db.type}" no válido. Debe ser: sql, mongodb, gremlin, cassandra, o table`);
      }
    });
    
    this.debugLog(`Configuración cargada desde databases.config.json: ${config.databases.length} base(s) de datos`);

    // Agregar todas las bases de datos configuradas
    config.databases.forEach(dbConfig => {
      this.connectionManager.addDatabase(dbConfig.name, {
        endpoint: dbConfig.endpoint,
        key: dbConfig.key,
        database: dbConfig.database,
        type: dbConfig.type || 'sql'
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

  async getCosmosDatabase(databaseName) {
    const dbName = databaseName || this.defaultDatabase;
    if (!dbName) {
      throw new Error('No hay bases de datos configuradas');
    }
    
    const client = await this.connectionManager.getClient(dbName);
    const config = this.connectionManager.configs.get(dbName);
    return {
      client,
      database: client.database(config.database),
      config
    };
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "cosmos_query",
          description: "Ejecuta una consulta SQL en CosmosDB (SQL API)",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Consulta SQL a ejecutar (ej: SELECT * FROM c WHERE c.type = 'user')"
              },
              database: {
                type: "string",
                description: "Nombre de la base de datos (opcional, usa la default si no se especifica)"
              },
              container: {
                type: "string", 
                description: "Nombre del container/collection"
              }
            },
            required: ["query", "container"]
          }
        },
        {
          name: "cosmos_get_item",
          description: "Obtiene un item específico por ID y partition key",
          inputSchema: {
            type: "object",
            properties: {
              itemId: {
                type: "string",
                description: "ID del item a obtener"
              },
              partitionKey: {
                type: "string",
                description: "Valor de la partition key"
              },
              container: {
                type: "string",
                description: "Nombre del container/collection"
              },
              database: {
                type: "string",
                description: "Nombre de la base de datos (opcional)"
              }
            },
            required: ["itemId", "partitionKey", "container"]
          }
        },
        {
          name: "cosmos_containers",
          description: "Lista todos los containers/collections en la base de datos",
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
          name: "cosmos_database_info",
          description: "Muestra información de la base de datos CosmosDB",
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
          name: "cosmos_databases",
          description: "Lista todas las bases de datos CosmosDB disponibles configuradas",
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
          case "cosmos_query":
            return await this.handleQuery(request.params.arguments);
          case "cosmos_get_item":
            return await this.handleGetItem(request.params.arguments);
          case "cosmos_containers":
            return await this.handleContainers(request.params.arguments);
          case "cosmos_database_info":
            return await this.handleDatabaseInfo(request.params.arguments);
          case "cosmos_databases":
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
    const { query, database, container } = args;
    
    const { database: cosmosDb } = await this.getCosmosDatabase(database);
    const containerRef = cosmosDb.container(container);
    
    const querySpec = {
      query: query
    };
    
    const { resources: results } = await containerRef.items.query(querySpec).fetchAll();
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            database: database || this.defaultDatabase,
            container: container,
            query: query,
            resultCount: results.length,
            results: results
          }, null, 2)
        }
      ]
    };
  }

  async handleGetItem(args) {
    const { itemId, partitionKey, container, database } = args;
    
    const { database: cosmosDb } = await this.getCosmosDatabase(database);
    const containerRef = cosmosDb.container(container);
    
    const { resource: item } = await containerRef.item(itemId, partitionKey).read();
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            database: database || this.defaultDatabase,
            container: container,
            itemId: itemId,
            partitionKey: partitionKey,
            item: item
          }, null, 2)
        }
      ]
    };
  }

  async handleContainers(args = {}) {
    const { database } = args;
    
    const { database: cosmosDb } = await this.getCosmosDatabase(database);
    const { resources: containers } = await cosmosDb.containers.readAll().fetchAll();
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            database: database || this.defaultDatabase,
            containers: containers.map(c => ({
              id: c.id,
              partitionKey: c.partitionKey
            }))
          }, null, 2)
        }
      ]
    };
  }

  async handleDatabaseInfo(args = {}) {
    const { database } = args;
    const dbName = database || this.defaultDatabase;
    const config = this.connectionManager.configs.get(dbName);
    const isConnected = this.connectionManager.clients.has(dbName);
    
    if (!config) {
      throw new Error(`Base de datos '${dbName}' no está configurada`);
    }
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            name: dbName,
            endpoint: config.endpoint,
            database: config.database,
            type: config.type,
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
      await this.connectionManager.disconnectAll();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      await this.connectionManager.disconnectAll();
      process.exit(0);
    });
  }
}

// Ejecutar el servidor
const server = new CosmosDBMCPServer();
server.run().catch(console.error);