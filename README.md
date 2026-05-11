# MCP Gateway — Hub de Herramientas para IA

Un gateway que unifica servidores MCP (Model Context Protocol) para **GitHub Copilot**, **Antigravity** y **Cursor** en un único punto de acceso. Diseñado para ejecutarse con Docker Compose y consumirse directamente desde Cursor IDE.

## Tabla de Contenidos

- [Descripción General](#descripción-general)
- [Arquitectura](#arquitectura)
- [Requisitos Previos](#requisitos-previos)
- [Inicio Rápido](#inicio-rápido)
- [Variables de Entorno](#variables-de-entorno)
- [Servidores](#servidores)
  - [Copilot Server](#copilot-server)
  - [Antigravity Server](#antigravity-server)
  - [Cursor Server](#cursor-server)
- [Gateway](#gateway)
- [Configuración de Cursor IDE](#configuración-de-cursor-ide)
- [Docker Compose](#docker-compose)
- [Desarrollo Local](#desarrollo-local)
- [Troubleshooting](#troubleshooting)

---

## Descripción General

Este proyecto implementa un **MCP Gateway** que actúa como un proxy inverso para múltiples servidores MCP especializados. Cada servidor encapsula las capacidades de una plataforma de desarrollo con IA:

| Servidor | Función |
|----------|---------|
| **Copilot Server** | Expone agentes personalizados (`.agent.md`), skills (`SKILL.md`) e instrucciones de GitHub Copilot |
| **VSCode Server** | Gestiona la configuración de VSCode (`.vscode/settings.json`) y tareas |
| **Antigravity Server** | Expone el conocimiento y contexto local a cualquier cliente MCP conectado |
| **Cursor Server** | Gestiona la configuración de Cursor IDE: reglas (`.cursorrules`), configuración MCP y workspaces |

El Gateway agrega todas las herramientas, recursos y prompts de los servidores bajo un **namespace con prefijo corto** (`cp_`, `ag_`, `cs_`, `vs_`) para evitar colisiones y mejorar la velocidad de invocación. También se incluyen **alias globales** para las tareas más comunes.

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Compose                        │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │              MCP Gateway (:3000)                    │  │
│  │         Streamable HTTP / SSE Transport             │  │
│  │                                                      │  │
│  │  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  │  │
│  │  │ Copilot  │  │ Antigravity  │  │   Cursor     │  │  │
│  │  │ Server   │  │   Server     │  │   Server     │  │  │
│  │  │ (stdio)  │  │   (stdio)    │  │   (stdio)    │  │  │
│  │  └──────────┘  └──────────────┘  └──────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │ HTTP
                          │
                 ┌────────┴────────┐
                 │   Cursor IDE    │
                 │  (mcp.json)     │
                 └─────────────────┘
```

**Flujo:**
1. El Gateway inicia cada servidor como un **proceso hijo** usando transporte `stdio`
2. El Gateway se conecta a cada servidor como **cliente MCP** y agrega sus capacidades
3. El Gateway expone un **servidor MCP unificado** sobre HTTP (SSE) en el puerto 3000
4. **Cursor IDE** se conecta al gateway como un único servidor MCP remoto

---

## Requisitos Previos

- **Node.js** >= 22.0.0
- **Docker** y **Docker Compose** (para ejecución containerizada)
- **Cursor IDE** (para consumir el gateway)

---

## Inicio Rápido

### 1. Clonar y configurar variables de entorno

```bash
cd dev-tools/mcp
cp .env.example .env
```

Edita `.env` con tus rutas y configuraciones (ver [Variables de Entorno](#variables-de-entorno)).

### 2. Agregar assets de Copilot (opcional)

Copia tus archivos `.agent.md`, `SKILL.md` e instrucciones en los directorios correspondientes:

```
copilot-assets/
├── agents/          # Archivos .agent.md
├── skills/          # Archivos SKILL.md
└── instructions/    # Archivos .md con instrucciones
```

### 3. Levantar con Docker Compose

```bash
docker compose up --build
```

### 4. Configurar tu Entorno

#### 4.1 Cursor IDE
Copia el archivo de ejemplo a tu configuración de Cursor:
```bash
# Configuración global
cp cursor-config/mcp.json.example ~/.cursor/mcp.json
```
Luego verifica en **Cursor Settings** -> **Features** -> **MCP** que el servidor aparezca conectado.

#### 4.2 VSCode
1. Instala una extensión cliente de MCP (ej. **Roo Code**, **Claude Dev** o la extensión oficial de MCP).
2. En la configuración del servidor MCP de la extensión, añade:
   - **Type**: `sse`
   - **URL**: `http://localhost:3000/sse`

#### 4.3 Antigravity / Otros Agentes
Para usar el Gateway desde este u otros asistentes de IA:
1. Asegúrate de que el Gateway esté corriendo.
2. Configura el endpoint SSE (`http://localhost:3000/sse`) en la sección de servidores MCP de tu agente.
3. Ahora el agente podrá usar herramientas como `ls_ki` para acceder a tu conocimiento local.

### 5. Verificar

```bash
curl http://localhost:3000/health
```

Deberías ver una respuesta JSON con el estado de todos los servidores.

---

## Variables de Entorno

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `GATEWAY_PORT` | Puerto HTTP del gateway | `3000` |
| `GATEWAY_AUTH_TOKEN` | Token Bearer opcional para autenticar requests al gateway. Dejar vacío para desactivar | _(vacío)_ |
| `COPILOT_ASSETS_DIR` | Ruta al directorio con agentes, skills e instrucciones de Copilot | `./copilot-assets` |
| `ANTIGRAVITY_DATA_DIR` | Ruta al directorio de datos de Antigravity | `~/.gemini/antigravity` |
| `CURSOR_CONFIG_DIR` | Ruta al directorio de configuración global de Cursor | `~/.cursor` |
| `CURSOR_WORKSPACE_DIR` | Ruta al workspace a gestionar | `.` |
| `LOG_LEVEL` | Nivel de logging: `debug`, `info`, `warn`, `error` | `info` |

---

## Servidores

### Copilot Server

Expone los assets personalizados de GitHub Copilot como herramientas y recursos MCP.

#### Tools

| Tool | Descripción |
|------|-------------|
| `cp_list_agents` | Lista todos los agentes personalizados disponibles |
| `cp_read_agent` | Lee la definición completa de un agente (YAML frontmatter + instrucciones) |
| `cp_list_skills` | Lista todos los skills disponibles |
| `cp_read_skill` | Lee la definición de un skill específico |
| `cp_list_instructions` | Lista todas las instrucciones personalizadas |
| `cp_read_instruction` | Lee una instrucción específica |
| `cp_apply_agent_context` | Genera el contexto completo de un agente para inyectar en una conversación |

#### Resources

| URI | Descripción |
|-----|-------------|
| `copilot://agents/{name}` | Contenido de un archivo `.agent.md` |
| `copilot://skills/{name}` | Contenido de un archivo `SKILL.md` |
| `copilot://instructions/{name}` | Contenido de un archivo de instrucciones |

#### Prompts

| Prompt | Descripción |
|--------|-------------|
| `cp_agent-prompt` | Genera un system prompt configurado con el contexto de un agente específico |
| `cp_review-prompt` | Prompt de code review siguiendo convenciones de Copilot |

#### Formato de archivos `.agent.md`

```yaml
---
name: Mi Agente
description: Un agente especializado en...
tools: ['read', 'some-mcp-server/tool-1']
---

Instrucciones del agente en Markdown...
```

---

### Antigravity Server

Accede a los knowledge items y conversaciones almacenados localmente por Antigravity.

#### Tools

| Tool | Descripción |
|------|-------------|
| `ag_list_knowledge_items` | Lista todos los knowledge items con sus metadatos |
| `ag_read_knowledge_item` | Lee un knowledge item específico incluyendo sus artefactos |
| `ag_list_conversations` | Lista las conversaciones recientes con un preview |
| `ag_read_conversation` | Lee el overview completo de una conversación |
| `ag_search_knowledge` | Busca knowledge items por keyword |

#### Resources

| URI | Descripción |
|-----|-------------|
| `antigravity://knowledge/{id}` | Artefactos de un knowledge item |
| `antigravity://conversations/{id}` | Overview de una conversación |

---

### Cursor Server

Gestiona la configuración de Cursor IDE programáticamente.

#### Tools

| Tool | Descripción |
|------|-------------|
| `cs_read_rules` | Lee el archivo `.cursorrules` del workspace |
| `cs_write_rules` | Escribe o actualiza el archivo `.cursorrules` |
| `cs_read_mcp_config` | Lee la configuración MCP actual de `mcp.json` |
| `cs_add_mcp_server` | Agrega un nuevo servidor MCP a la configuración |
| `cs_remove_mcp_server` | Elimina un servidor MCP de la configuración |
| `cs_list_workspaces` | Lista los workspaces conocidos de Cursor |

#### Resources

| URI | Descripción |
|-----|-------------|
| `cursor://rules` | Contenido actual del archivo `.cursorrules` |
| `cursor://mcp-config` | Configuración MCP actual |

---

## Gateway

El gateway actúa como un **proxy inverso MCP** que:

1. **Inicia** cada servidor backend como proceso hijo con transporte `stdio`
2. **Agrega** todas las herramientas, recursos y prompts bajo namespaces
3. **Enruta** las llamadas entrantes al servidor backend correcto basándose en el prefijo
4. **Expone** todo a través de un servidor HTTP con SSE

### Namespacing (Prefijos Cortos)

Para evitar nombres excesivamente largos, se utilizan los siguientes prefijos:

| Prefijo | Servidor | Ejemplo |
|---------|----------|---------|
| `cp_` | Copilot | `cp_list_agents` |
| `ag_` | Antigravity | `ag_search_knowledge` |
| `cs_` | Cursor | `cs_read_rules` |
| `vs_` | VSCode | `vs_read_settings` |

### Alias Globales (Shorthand)

El Gateway expone alias ultra-cortos para las herramientas más utilizadas, permitiendo invocarlas directamente:

| Alias | Destino Real | Descripción |
|-------|--------------|-------------|
| `ls_ki` | `ag_list_knowledge_items` | Listar items de conocimiento |
| `ls_agents` | `cp_list_agents` | Listar agentes de Copilot |
| `ls_ws` | `cs_list_workspaces` | Listar workspaces |
| `read_rules` | `cs_read_rules` | Leer .cursorrules |
| `write_rules` | `cs_write_rules` | Escribir .cursorrules |

### Endpoints

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/sse` | GET | Establece conexión SSE para el transporte MCP |
| `/messages` | POST | Recibe mensajes JSON-RPC del cliente MCP |
| `/health` | GET | Health check con estado de todos los servidores |

### Autenticación

Si `GATEWAY_AUTH_TOKEN` está configurado, todas las requests (excepto `/health`) deben incluir el header:

```
Authorization: Bearer <tu-token>
```

---

---

## Docker Compose

### Levantar

```bash
docker compose up --build
```

### Levantar en background

```bash
docker compose up --build -d
```

### Ver logs

```bash
docker compose logs -f gateway
```

### Detener

```bash
docker compose down
```

### Volúmenes montados

| Host | Container | Modo |
|------|-----------|------|
| `./copilot-assets` | `/app/copilot-assets` | Solo lectura |
| `$ANTIGRAVITY_DATA_DIR` | `/data/antigravity` | Solo lectura |
| `$CURSOR_CONFIG_DIR` | `/data/cursor-config` | Solo lectura |
| `$CURSOR_WORKSPACE_DIR` | `/data/workspace` | Solo lectura |

---

## Desarrollo Local

### Sin Docker

```bash
# Instalar dependencias
npm install

# Compilar todos los paquetes
npm run build

# Configurar variables de entorno
cp .env.example .env

# Ejecutar el gateway
node packages/gateway/dist/index.js
```

### Build individual

```bash
# Solo el paquete shared
npm run build:shared

# Solo los servidores
npm run build:servers

# Solo el gateway
npm run build:gateway
```

---

## Troubleshooting

### El gateway no inicia

1. Verifica que Node.js >= 22 esté instalado: `node --version`
2. Verifica que las dependencias estén instaladas: `npm install`
3. Verifica que el build sea exitoso: `npm run build`
4. Revisa los logs con `LOG_LEVEL=debug`

### Cursor no se conecta

1. Verifica que el gateway esté corriendo: `curl http://localhost:3000/health`
2. Verifica que `mcp.json` tenga la URL correcta
3. Reinicia Cursor después de modificar `mcp.json`
4. Revisa la consola de desarrollador de Cursor: **Help** → **Toggle Developer Tools**

### Un servidor backend falla

El gateway es resiliente: si un servidor backend falla al iniciar, los otros siguen funcionando. El health check reportará estado `degraded` en lugar de `unhealthy`.

### Las herramientas de Copilot están vacías

Verifica que hayas colocado tus archivos `.agent.md` y `SKILL.md` en el directorio `copilot-assets/`. Los archivos deben seguir el formato estándar de GitHub Copilot con YAML frontmatter.

### No se encuentran knowledge items de Antigravity

Verifica que `ANTIGRAVITY_DATA_DIR` apunte al directorio correcto. Por defecto es `~/.gemini/antigravity`. El directorio debe contener subcarpetas `knowledge/` y/o `brain/`.

---

## Stack Técnico

- **Runtime**: Node.js 22
- **Lenguaje**: TypeScript (strict mode, sin `any`)
- **Protocolo**: MCP v1.29.0 (`@modelcontextprotocol/sdk`)
- **Transporte**: SSE sobre HTTP (compatible con Cursor IDE)
- **HTTP Server**: Express 4
- **Validación**: Zod
- **Containerización**: Docker + Docker Compose
