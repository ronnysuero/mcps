# CosmosDB MCP Multi-Database

Un servidor MCP (Model Context Protocol) para interactuar con múltiples bases de datos Azure CosmosDB desde Claude Code.

## 🚀 Características

- **🔗 Conexiones múltiples** - Conecta a múltiples instancias de CosmosDB
- **📊 API SQL nativa** - Ejecuta queries SQL en CosmosDB
- **🔍 Búsqueda directa** - Obtén items por ID y partition key
- **📋 Exploración fácil** - Lista containers y explora estructura
- **⚡ Sin portal de Azure** - Todo desde Claude Code
- **🛡️ Configuración segura** - Credenciales en archivo JSON ignorado por git

## Instalación

1. Clonar o descargar este proyecto
2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Configurar bases de datos:
   - Copiar `databases.config.example.json` a `databases.config.json` y configurar

## Configuración

### 📋 Archivo JSON (Única opción)

Configuración simple y clara usando un archivo JSON:

1. Copiar el archivo ejemplo:
   ```bash
   cp databases.config.example.json databases.config.json
   ```

2. Editar `databases.config.json` con tus configuraciones CosmosDB:

```json
{
  "defaultDatabase": "production",
  "databases": [
    {
      "name": "production",
      "description": "Base de datos de producción",
      "type": "sql",
      "endpoint": "https://your-cosmos.documents.azure.com:443/",
      "key": "your-primary-key-here",
      "database": "ProductionDB"
    },
    {
      "name": "development",
      "description": "Base de datos de desarrollo", 
      "type": "sql",
      "endpoint": "https://dev-cosmos.documents.azure.com:443/",
      "key": "your-dev-key-here",
      "database": "DevDB"
    }
  ]
}
```

### 🔑 Cómo obtener las credenciales de CosmosDB:

1. **Endpoint**: Azure Portal → Tu cuenta CosmosDB → Keys → URI
2. **Key**: Azure Portal → Tu cuenta CosmosDB → Keys → Primary Key (o Secondary Key)
3. **Database**: Nombre de la base de datos dentro de tu cuenta CosmosDB

### ✅ Campos requeridos:
- `defaultDatabase`: Nombre de la base de datos a usar por defecto
- `databases`: Array con al menos una base de datos
- Cada base de datos debe tener: `name`, `endpoint`, `key`, `database`

### Configuración de Claude Desktop

Una vez que hayas configurado tus bases de datos, necesitas agregar el MCP a Claude Desktop.

#### ✅ Configuración simple:

1. Configura tus bases de datos en `databases.config.json`
2. Agrega esto a tu `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cosmosdb": {
      "command": "node", 
      "args": ["RUTA_COMPLETA_A_TU_PROYECTO/cosmosdb-mcp/index.js"]
    }
  }
}
```

**⚠️ Importante:** Reemplaza `RUTA_COMPLETA_A_TU_PROYECTO` con la ruta real donde tienes el proyecto.

## Herramientas disponibles

1. **cosmos_query**: Ejecuta consultas SQL en CosmosDB (SQL API)
2. **cosmos_get_item**: Obtiene un item específico por ID y partition key
3. **cosmos_containers**: Lista todos los containers/collections en la base de datos
4. **cosmos_database_info**: Muestra información de una base de datos específica
5. **cosmos_databases**: Lista todas las bases de datos disponibles configuradas

### Parámetros de las herramientas

Todas las herramientas (excepto `cosmos_databases`) soportan un parámetro opcional `database`:

- Si no se especifica `database`, se usa la primera base de datos configurada
- El parámetro `database` debe coincidir con el `name` definido en la configuración

## Uso

Una vez configurado, puedes usar las herramientas desde Claude Code:

### 🚀 Primeros pasos:
1. "Lista todas las bases de datos CosmosDB disponibles"
2. "Muestra información de conexión"
3. "Lista todos los containers de la base de datos production"

### 💡 Ejemplos con base de datos específica:
- "Ejecuta SELECT * FROM c WHERE c.type = 'user' en el container Users de production"
- "Obtén el item con ID 'user123' y partition key 'active' del container Users"
- "Lista todos los containers de la base de datos development"
- "Muestra información de la base de datos analytics"

### ⚡ Comandos rápidos (usan la base de datos por defecto):
- "SELECT * FROM c WHERE c.status = 'active'" (en container específico)
- "Lista todos los containers"
- "Obtén el item user456 con partition key premium del container Users"

### 📊 Casos de uso comunes:
- **Consultas de datos**: Análisis directo sin usar Azure Portal
- **Debugging**: Verificar datos específicos rápidamente
- **Exploración**: Entender estructura de datos y containers
- **Reportes**: Generar informes desde múltiples bases CosmosDB
- **Desarrollo**: Probar queries antes de implementarlas en aplicaciones

### 🔒 APIs soportadas:
- **SQL API** (recomendada): Sintaxis SQL familiar para documentos JSON
- **MongoDB API**: Para datos migrados de MongoDB (próximamente)
- **Gremlin API**: Para bases de datos de grafos (próximamente) 
- **Cassandra API**: Para datos wide-column (próximamente)

### 📝 Ejemplos de queries SQL:

```sql
-- Obtener todos los usuarios activos
SELECT * FROM c WHERE c.type = 'user' AND c.status = 'active'

-- Contar documentos por tipo
SELECT c.type, COUNT(1) as count FROM c GROUP BY c.type

-- Buscar por fecha
SELECT * FROM c WHERE c.createdDate >= '2024-01-01'

-- Queries con agregaciones  
SELECT c.category, AVG(c.price) as avg_price FROM c GROUP BY c.category
```

## 🛠️ Solución de Problemas

### Habilitar logs de debug

Para diagnosticar problemas, habilita debug en Claude Desktop:

```json
{
  "mcpServers": {
    "cosmosdb": {
      "command": "node",
      "args": ["ruta/cosmosdb-mcp/index.js"],
      "env": {
        "DEBUG_MCP": "true"
      }
    }
  }
}
```

### Errores comunes:

- **"databases.config.json no encontrado"**: Copia el archivo ejemplo y configúralo
- **"Unauthorized"**: Verifica el endpoint y key en Azure Portal
- **"Container not found"**: Verifica que el container existe en CosmosDB
- **"Invalid partition key"**: Asegúrate de usar el partition key correcto

## 📋 Archivos incluidos

- `index.js` - Servidor MCP principal
- `databases.config.example.json` - Ejemplo de configuración
- `claude-config-example.json` - Configuración para Claude Desktop
- `README.md` - Esta documentación