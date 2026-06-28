# Pixel Agent Desk

[![CI](https://github.com/kekukeku/pixel-agent-desk/actions/workflows/test.yml/badge.svg)](https://github.com/kekukeku/pixel-agent-desk/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-42+-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)

> Una oficina pixel en tiempo real para tus agentes de codificación con IA.
>
> Fork de [Mgpixelart/pixel-agent-desk](https://github.com/Mgpixelart/pixel-agent-desk), mantenido de forma independiente con integraciones extendidas y funciones de panel de control.

## De los Guardianes en la Máquina

Antaño, ningún artesano trazaba pergaminos sin un guardián invisible que guiara su pluma. Hoy, los pergaminos son pantallas de cristal y esos espíritus visten armaduras de píxeles y código binario, pero su vigilia no ha cesado.
*Pixel Agent Desk* brinda a estos leales centinelas un rincón en dos dimensiones: una pequeña oficina donde tus agentes de IA piensan, trabajan y, de vez en cuando, cabecean de sueño.
Abre el escritorio, haz visible lo invisible y contempla cómo la vieja magia del código cobra vida ante tus ojos.

*[Lee el preludio completo](docs/readme-prelude.md) — De los Guardianes en la Máquina*

Pixel Agent Desk es una aplicación independiente de Electron que observa los eventos del ciclo de vida de los agentes y representa las sesiones activas de IA como personajes pixelados animados en una oficina 2D. Es compatible de forma inmediata con cinco espacios de trabajo de agentes principales:

- **Claude Cowork**
- **Codex**
- **Grok Build**
- **Antigravity**
- **OpenWork**

La aplicación es una capa de observación y visualización. No despacha trabajo, asigna tareas ni controla tus agentes.

![Demo](docs/demo.gif)

| | | |
|---|---|---|
| ![](docs/screenshot-1.png) | ![](docs/screenshot-2.png) | ![](docs/screenshot-4.png) |
| ![](docs/screenshot-5.png) | | |

## Aspectos Destacados

- **Observador Independiente** — PAD funciona de forma independiente como observador de espacios de trabajo de agentes GUI y TUI.
- **Oficina Pixel** — Una oficina virtual 2D donde los agentes activos aparecen como personajes pixelados animados impulsados por eventos del ciclo de vida.
- **Roster del Sistema** — Tarjetas de panel de control en vivo que muestran el estado del agente, herramientas activas, fuentes, uso de tokens y costo medido cuando está disponible.
- **Cinco Integraciones Opcionales** — Claude Cowork, Codex, Grok Build, Antigravity y OpenWork, con compatibilidad OpenCode a través del núcleo de OpenWork.
- **Análisis de Tokens y Costos** — Muestra visibilidad de tokens para los agentes compatibles excepto Antigravity, y estima costos solo cuando hay datos de precios fiables.
- **Malla de Actividad y Revisión de GroupChat** — Acceso a reproducciones de sesiones históricas y matrices de actividad de mapas de calor visuales.
- **API de Eventos Genéricos** — Las herramientas externas personalizadas pueden publicar eventos normalizados a través de `POST /events/agent`.
- **Recuperación Automática** — Restaura de forma segura las sesiones de agentes activos al reiniciar la aplicación usando PID verificados o configuraciones de permiso.

## Requisitos

**Para ejecutar Pixel Agent Desk:**
- **macOS (recomendado):** no se requiere una instalación de Node separada — [`Install.command`](Install.command) descarga Node.js 22 portable a `~/.local/node` en la primera ejecución.
- **Windows / Linux / macOS manual:** **Node.js** 20 o posterior y **npm**
- **macOS, Windows o Linux**

*Nota: Los espacios de trabajo de agentes **no** son requisitos para ejecutar la aplicación. Pixel Agent Desk funciona como observador independiente. Las plataformas que falten se reportarán en el diagnóstico pero nunca provocarán bloqueos ni interrupciones del panel de control.*

## Inicio Rápido

### macOS — Inicio de Escritorio (Recomendado)

1. **Configuración Inicial**: Haz doble clic en [`Install.command`](Install.command) en la raíz del repositorio.
   - Descarga los binarios oficiales de Node.js a `~/.local/node` si aún no tienes Node 20+.
   - Ejecuta `npm install` para las dependencias de Pixel Agent Desk.
   - Requiere acceso a red en la primera ejecución.
2. **Iniciar el Panel de Control**: Haz doble clic en [`Start.command`](Start.command).
   - Usa el mismo Node.js (`~/.local/node` o un Node 20+ del sistema existente).
   - Abre la ventana del panel de control a través de `npm start`.
   - *Nota de permisos: Si macOS dice que `Install.command` o `Start.command` no se puede abrir, ejecuta `chmod +x Install.command Start.command` en esta carpeta usando Terminal.*
   - *Nota de Gatekeeper: Si macOS bloquea la ejecución, haz clic derecho en el archivo `.command` y selecciona **Abrir**.*

### Todas las Plataformas — Inicio desde Código Fuente

Para clonar y ejecutar manualmente desde el código fuente:

```bash
git clone https://github.com/kekukeku/pixel-agent-desk.git
cd pixel-agent-desk
npm install
npm start
```

Al iniciar:
- Se abre la ventana del panel de control de Pixel Agent Desk (mostrando `Oficina de {username}` coincidiendo dinámicamente con el perfil de tu cuenta del sistema operativo).
- El servidor de puerta de enlace de eventos local comienza a escuchar en `127.0.0.1:47821`.
- Los observadores configurados y las integraciones de reenvío se registran y preparan para recibir eventos de agentes.

### Diagnósticos

Para inspeccionar el estado de detección de tus integraciones locales de agentes sin escribir ningún enlace de configuración ni iniciar observadores:

```bash
npm run diagnose:integrations
```

## Vistas del Panel de Control

La navegación de la barra lateral proporciona cuatro modos de vista principales para monitorear y explorar tus sesiones de agentes:

| Vista | Propósito | Detalles |
|---|---|---|
| **Overview** | Lienzo principal de la oficina 2D y Roster en vivo | Ver sprites pixelados animados moviéndose y trabajando, junto a tarjetas de estado de agentes en tiempo real. Admite ventana PiP (Imagen sobre imagen). |
| **Activity Mesh** | Matriz de mapa de calor interactiva | Muestra la frecuencia de eventos diaria/horaria y los picos. |
| **GroupChat Review** | Reproducción de sesiones locales | Reproduce discusiones multiagente grabadas (`groupchat_*.json`) directamente en el lienzo visual de la oficina 2D. |
| **Metered API Usage** | Panel de uso de tokens y facturación | Muestra recuentos de tokens para agentes compatibles, costos estimados cuando los precios son fiables, y el uso pico de la ventana de contexto (CTX%) para Grok Build. |

## Integraciones

| Agente | Mecanismo | Ruta de Configuración / Datos | ¿Escribe Configuración? | Notas |
|---|---|---|---|---|
| Claude Cowork | Reenviador de eventos | `~/.claude/settings.json` | Sí | Registra automáticamente los enlaces propiedad de PAD; migra enlaces HTTP heredados si existen |
| Codex | Observador JSONL de solo lectura | `~/.codex/` | No | Escanea archivos de sesión cada ~2 segundos |
| Grok Build | Reenviador de eventos + observador | `~/.grok/hooks/pixel-agent-desk.json` + `~/.grok/sessions/**/signals.json` | Sí | El enlace gestiona el ciclo de vida; el observador rastrea tokens y CTX% |
| Antigravity | Reenviador de eventos | `~/.gemini/config/hooks.json` | Sí | Integra directamente el ejecutable del reenviador |
| OpenWork / OpenCode | Plugin compatible con OpenCode | `~/.config/opencode/plugins/pad-adapter.js` | Sí | OpenWork es compatible a través de su núcleo compatible con OpenCode |

En las compilaciones empaquetadas, los archivos auxiliares se materializan bajo `~/.pixel-agent-desk/runtime/` para ejecutar los reenviadores a través del binario de Electron usando `ELECTRON_RUN_AS_NODE=1`. En modo de desarrollo con código fuente, los reenviadores se ejecutan directamente desde la carpeta de código fuente del repositorio.

Consulta [docs/integration-smoke-test.md](docs/integration-smoke-test.md) para obtener una guía de pruebas de integración completa.

*Nota Importante: Si no hay agentes activos, una **oficina virtual vacía** es normal y no significa que PAD esté fallando. Los personajes animados solo aparecen después de que sus respectivos agentes envíen al menos un evento (por ejemplo, abrir un espacio de trabajo compatible o enviar un mensaje).*

Para desconectar las integraciones de Pixel Agent Desk, elimina solo las configuraciones de enlace/plugin o claves propiedad de PAD:

| Agente | Qué eliminar |
|---|---|
| Claude Cowork | Elimina las entradas de enlace propiedad de PAD de `~/.claude/settings.json` |
| Grok Build | Elimina `~/.grok/hooks/pixel-agent-desk.json` |
| Antigravity | Elimina la clave `"pixel-agent-desk"` de `~/.gemini/config/hooks.json` |
| OpenWork / OpenCode | Elimina `~/.config/opencode/plugins/pad-adapter.js` |
| Codex | No se escribe ninguna configuración — simplemente cierra PAD para desconectar |

Caché opcional (seguro de eliminar; PAD la recrea en el siguiente inicio):

```text
~/.pixel-agent-desk/runtime/
```

Reinicia el espacio de trabajo del agente afectado después de la modificación para recargar las configuraciones.

## Configuración

Pixel Agent Desk lee la configuración de usuario opcional de:

```text
~/.pixel-agent-desk/config.json
```

Ejemplo:

```json
{
  "integrations": {
    "claude": {
      "enabled": true
    },
    "opencode": {
      "enabled": true
    }
  }
}
```

Compuertas de configuración actuales:

- `integrations.claude.enabled: false` omite el registro de enlace de Claude Cowork y el escaneo de transcripciones.
- `integrations.opencode.enabled: false` omite el registro del plugin de OpenCode.

Otras integraciones se detectan por capacidad y fallan abiertamente si su plataforma no está instalada.

## API de Eventos de Agente Normalizados

Las herramientas personalizadas pueden reportar actividad enviando eventos normalizados a:

```text
POST http://127.0.0.1:47821/events/agent
Content-Type: application/json
```

Ejemplo:

```json
{
  "event": "agent.working",
  "agent_id": "custom-session-1",
  "source": "my-custom-agent",
  "name": "Research Agent",
  "project_path": "/path/to/project",
  "model": "gpt-4o",
  "tool": "Bash",
  "parent_id": null,
  "pid": 12345,
  "timestamp": 1781550497208,
  "token_usage": {
    "input_tokens": 1200,
    "cached_input_tokens": 500,
    "output_tokens": 400
  },
  "context_usage": {
    "kind": "snapshot",
    "tokens_used": 50000,
    "window_tokens": 200000,
    "percent": 25
  },
  "metadata": {}
}
```

### Eventos Soportados

- `agent.started` — Registra o refresca una sesión de agente.
- `agent.thinking` — Muestra el estado de pensamiento y puede acumular uso de tokens.
- `agent.working` — Muestra el estado de trabajo y la herramienta activa.
- `agent.idle` — Muestra el estado de descanso/inactividad.
- `agent.done` — Marca una acción completada.
- `agent.error` — Muestra el estado de error.
- `agent.help` — Muestra el estado de permisos/ayuda.
- `agent.removed` — Elimina el personaje de la oficina.

## Recuperación de Sesiones y Nombres para Mostrar

Pixel Agent Desk persiste las sesiones activas e intenta la recuperación al reiniciar cuando la fuente puede verificarse de forma segura.

Archivos de mapeo locales opcionales:

- `~/.pixel-agent-desk/name-map.json` asigna IDs de sesión estables a nombres para mostrar.
- `~/.pixel-agent-desk/watcher-allowlist.json` es un nombre de archivo heredado utilizado como lista de permisos de recuperación para sesiones personalizadas/manuales. No está vinculado al observador de Python eliminado.

Ejemplo de `name-map.json`:

```json
{
  "codex-main": "Codex",
  "antigravity-ui": "Antigravity"
}
```

## Personalización de Avatar

Las selecciones de avatar se almacenan localmente en el almacenamiento del navegador:

```text
Clave localStorage: pixel-agent-desk.avatarOverrides.v1
```

El valor asigna IDs de agente estables a índices de avatar. Seleccionar "Restablecer a Predeterminado" elimina la anulación.

## Visualización de Tokens y Costos

Pixel Agent Desk muestra el uso de recursos dependiendo de los datos proporcionados por el agente:

- **Agentes con visibilidad de tokens**: Claude Cowork, Codex, Grok Build y OpenWork/OpenCode pueden mostrar el uso de tokens cuando sus datos locales de eventos o sesiones lo exponen.
- **Agentes conscientes de costos**: Cuando el uso de tokens puede coincidir con precios fiables en [src/pricing.js](src/pricing.js), Pixel Agent Desk estima el costo. De lo contrario, muestra el uso sin inventar un número de facturación.
- **Agentes conscientes de contexto (por ejemplo, Grok Build)**: Muestra el porcentaje pico de la ventana de contexto (`CTX: N tok` o presión porcentual). Los valores de instantánea de contexto no se acumulan. El mapa de calor diario registra los tokens de contexto pico diarios.
- **Antigravity**: Se admite la visibilidad del ciclo de vida, pero la detección de tokens no está disponible actualmente.

Consulta [docs/integration-smoke-test.md](docs/integration-smoke-test.md) §5.3 para la verificación de Grok CTX.

*Nota: Asegúrate de que `npm start` esté cerrado al validar enlaces empaquetados, ya que solo una instancia de PAD puede vincularse al puerto del servidor de eventos local (`47821`).*

## Avanzado: Compilación Empaquetada

Aunque se recomienda ejecutar desde el código fuente, puedes compilar una aplicación independiente empaquetada localmente:

```bash
npm run dist:mac
```

Luego inicia:

```text
release/mac/Pixel Agent Desk.app
```

## Registro de Depuración

Pixel Agent Desk escribe registros de tiempo de ejecución en `debug.log`:

- **Desde fuente (`npm start`)**: `src/debug.log` dentro del repositorio clonado
- **Aplicación empaquetada (macOS)**: `~/Library/Application Support/pixel-agent-desk/debug.log`
- **Aplicación empaquetada (Windows)**: `%APPDATA%/pixel-agent-desk/debug.log`
- **Aplicación empaquetada (Linux)**: `~/.config/pixel-agent-desk/debug.log`

Busca las líneas `[Processor]` y `[Event]` al verificar que los eventos de agente están llegando a la oficina.

## Solución de Problemas

| Síntoma | Causa Probable | Solución |
|---|---|---|
| No aparecen personajes | Ningún evento de agente ha llegado a PAD aún | Inicia una sesión de agente una vez, luego verifica `debug.log` (ver Registro de Depuración arriba) en busca de líneas `[Processor]` |
| Oficina vacía (sin personajes) | Estado normal al inicio o en sesiones inactivas | Los personajes animados solo aparecen después de que sus agentes envíen al menos un evento (por ejemplo, abrir un espacio de trabajo compatible o enviar un mensaje). Confirma que `debug.log` tiene eventos `[Processor]`. |
| El diagnóstico dice Codex `active=false` | El diagnóstico es de solo lectura y no inicia observadores | Usa `npm start`; Codex debería activarse si está instalado |
| Grok o Antigravity no aparecen en la app empaquetada | El comando de enlace aún apunta a una ruta de fuente antigua | Reinicia la app empaquetada para que los enlaces se refresquen; inspecciona la configuración de enlace para `~/.pixel-agent-desk/runtime/forwarders/` |
| El comando de enlace usa `node` en validación empaquetada | La configuración de enlace fue generada por la app de desarrollo o una versión antigua | Cierra PAD de desarrollo, abre la `.app` empaquetada, luego vuelve a verificar la configuración de enlace |
| OpenCode no aparece | El plugin no fue instalado o OpenCode no lo ha cargado | Verifica `~/.config/opencode/plugins/pad-adapter.js`, luego reinicia OpenCode/OpenWork |
| Claude Cowork no aparece | Faltan o están deshabilitados los enlaces de Claude Cowork | Ejecuta `npm run diagnose:integrations` e inspecciona `~/.claude/settings.json` |
| Permanece un personaje obsoleto | La recuperación de sesión persistida aún tiene un ID coincidente | Elimina las entradas obsoletas de `name-map.json` o `watcher-allowlist.json`, luego reinicia |

## Comandos de Desarrollo

```bash
npm start                  # Ejecutar la aplicación Electron desde el código fuente
npm test                   # Ejecutar la suite de pruebas
npm run diagnose:integrations
npm run dist:mac           # Compilar el paquete para macOS
```

## Contribuciones

Consulta [PR_TEMPLATE.md](PR_TEMPLATE.md) para obtener el resumen de PR esperado, notas de prueba y verificación de alcance.

## Licencia

- **Código fuente:** [Licencia MIT](LICENSE)
- **Recursos artísticos** (`public/characters/`, `public/office/`): [Licencia restrictiva personalizada](LICENSE-ASSETS) — no se permite su redistribución ni modificación.
