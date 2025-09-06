# SQL Server MCP Multi-Database

Un servidor MCP (Model Context Protocol) para interactuar con múltiples bases de datos SQL Server desde Claude Code.

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

2. Editar `databases.config.json` con tus configuraciones:

```json
{
  "defaultDatabase": "desarrollo",
  "databases": [
    {
      "name": "desarrollo",
      "description": "Base de datos de desarrollo local",
      "user": "sa",
      "password": "dev_password",
      "server": "localhost", 
      "database": "DevelopmentDB",
      "port": 1433,
      "options": {
        "encrypt": false,
        "trustServerCertificate": true
      }
    },
    {
      "name": "produccion",
      "description": "Base de datos de producción",
      "user": "prod_user",
      "password": "secure_password",
      "server": "prod-server.company.com",
      "database": "ProductionDB", 
      "port": 1433,
      "options": {
        "encrypt": true,
        "trustServerCertificate": false
      }
    }
  ]
}
```

### ✅ Campos requeridos:
- `defaultDatabase`: Nombre de la base de datos a usar por defecto
- `databases`: Array con al menos una base de datos
- Cada base de datos debe tener: `name`, `user`, `password`, `server`, `database`, `port`

### Configuración de Claude Desktop

Una vez que hayas configurado tus bases de datos, necesitas agregar el MCP a Claude Desktop.

**📖 Guía completa:** Ver [CLAUDE_DESKTOP_CONFIG.md](./CLAUDE_DESKTOP_CONFIG.md) para instrucciones detalladas.

#### ✅ Configuración simple:

1. Configura tus bases de datos en `databases.config.json`
2. Agrega esto a tu `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sqlserver": {
      "command": "node", 
      "args": ["RUTA_COMPLETA_A_TU_PROYECTO/sqlserver-mcp/index.js"]
    }
  }
}
```

**⚠️ Importante:** Reemplaza `RUTA_COMPLETA_A_TU_PROYECTO` con la ruta real donde tienes el proyecto.

#### 📋 Archivos de ejemplo incluidos:
- `claude-config-example.json` - Configuración para Claude Desktop
- `CLAUDE_DESKTOP_CONFIG.md` - Guía completa de configuración

## Herramientas disponibles

1. **sql_query**: Ejecuta consultas SELECT en una base de datos específica
2. **sql_execute**: Ejecuta comandos SQL (INSERT, UPDATE, DELETE, etc.) en una base de datos específica
3. **sql_tables**: Lista todas las tablas de una base de datos específica
4. **sql_describe**: Describe la estructura de una tabla en una base de datos específica
5. **sql_connection_info**: Muestra información de conexión para una base de datos específica
6. **sql_databases**: Lista todas las bases de datos disponibles configuradas

### Parámetros de las herramientas

Todas las herramientas (excepto `sql_databases`) ahora soportan un parámetro opcional `database`:

- Si no se especifica `database`, se usa la primera base de datos configurada
- El parámetro `database` debe coincidir con el `name` definido en la configuración

## Uso

Una vez configurado, puedes usar las herramientas desde Claude Code:

### 🚀 Primeros pasos:
1. "Lista todas las bases de datos disponibles" → usa `sql_databases`
2. "Muestra información de conexión" → verifica que esté conectado
3. "Muéstrame todas las tablas" → usa la base de datos por defecto

### 💡 Ejemplos con base de datos específica:
- "Ejecuta SELECT * FROM usuarios en la base de datos desarrollo"
- "Describe la tabla productos de la base de datos produccion"  
- "Lista todas las tablas de la base de datos testing"
- "Inserta un nuevo registro en clientes de la base produccion"

### ⚡ Comandos rápidos (usan la base de datos por defecto):
- "SELECT * FROM productos"
- "Describe la tabla usuarios" 
- "Lista todas las tablas"
- "INSERT INTO clientes (nombre, email) VALUES ('Juan', 'juan@email.com')"

### 📊 Casos de uso comunes:
- **Desarrollo**: Consultar datos de desarrollo sin afectar producción
- **Testing**: Ejecutar pruebas en bases de datos dedicadas
- **Análisis**: Consultar datos de múltiples fuentes desde una sola interfaz
- **Reportes**: Generar informes cruzando datos de diferentes entornos

### 🔒 Seguridad:
- Las herramientas `sql_query` solo permiten SELECT (solo lectura)
- Usa `sql_execute` para comandos que modifican datos (INSERT/UPDATE/DELETE)
- Cada base de datos puede tener credenciales y configuraciones de seguridad diferentes