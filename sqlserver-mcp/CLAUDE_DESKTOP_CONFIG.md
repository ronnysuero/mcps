# Configuración para Claude Desktop

Este documento explica cómo configurar el SQL Server MCP en Claude Desktop.

## 🚀 Configuración simple

### Paso 1: Configurar bases de datos
```bash
# Copiar archivo de ejemplo
cp databases.config.example.json databases.config.json

# Editar con tus configuraciones
# (El archivo será ignorado por git automáticamente)
```

### Paso 2: Agregar a Claude Desktop
Agrega esta configuración a tu `claude_desktop_config.json`:

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

**⚠️ Importante:** Reemplaza `RUTA_COMPLETA_A_TU_PROYECTO` con la ruta real de tu proyecto.

### Ejemplos de rutas por sistema operativo:

**Windows:**
```json
"args": ["C:/Users/TuUsuario/mcp/sqlserver-mcp/index.js"]
```

**macOS/Linux:**
```json
"args": ["/Users/tuusuario/mcp/sqlserver-mcp/index.js"]
```

## 🔍 Verificar Configuración

Una vez configurado, puedes verificar que funciona:

1. Reinicia Claude Desktop
2. En Claude Code, pregunta: "Lista todas las bases de datos disponibles"
3. Deberías ver tus bases de datos configuradas

## 🛠️ Solución de Problemas

### 🔍 Habilitar logs de debug

Para diagnosticar problemas, puedes habilitar logs detallados:

```json
{
  "mcpServers": {
    "sqlserver": {
      "command": "node",
      "args": ["RUTA_COMPLETA_A_TU_PROYECTO/sqlserver-mcp/index.js"],
      "env": {
        "DEBUG_MCP": "true"
      }
    }
  }
}
```

Los logs de debug aparecerán en los logs de Claude Desktop y mostrarán:
- Cuántas bases de datos se cargaron desde `databases.config.json`
- Cuál es la base de datos por defecto

### ❌ Error: "Cannot find module"
- Verifica que la ruta en `args` sea correcta
- Usa rutas absolutas, no relativas
- Asegúrate de que el archivo `index.js` existe en esa ruta

### ❌ Error: "databases.config.json no encontrado"
- Verifica que `databases.config.json` existe en el directorio `sqlserver-mcp/`
- Copia `databases.config.example.json` a `databases.config.json`
- Configura al menos una base de datos

### ❌ Error: JSON inválido
- Comprueba que el JSON sea válido (usa un validador online)
- Verifica que todos los campos requeridos estén presentes
- Asegúrate de que `databases` sea un array con al menos una base de datos

### ❌ Error: "Connection failed"
- Verifica credenciales de base de datos en `databases.config.json`
- Comprueba conectividad de red al servidor SQL Server
- Revisa configuración de firewall
- Usa `DEBUG_MCP=true` para ver intentos de conexión

## 📝 Archivos de Ejemplo Incluidos

- `claude-config-example.json` - Configuración para Claude Desktop
- `databases.config.example.json` - Ejemplo de configuración de bases de datos

## ✅ ¡Todo listo!

Con estos dos archivos configurados, tu MCP SQL Server estará listo para usar:
1. Configuración simple de bases de datos en JSON
2. Configuración limpia en Claude Desktop
3. Sin complicaciones de variables de entorno

¡Disfruta trabajando con múltiples bases de datos desde Claude Code!