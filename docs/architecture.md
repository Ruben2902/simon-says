# Arquitectura

## Objetivo

Mantener las reglas independientes de la interfaz y de la red. Esta separación permite probar el juego localmente y reutilizar el mismo motor cuando Socket.IO coordine las salas.

```text
apps/web ───────────┐
                    ├── packages/game-engine
apps/server ────────┤
                    └── packages/shared-types
```

## Responsabilidades

### `apps/web`

- Renderizar el tablero y el estado de la partida.
- Reproducir luces y tonos.
- Capturar acciones del jugador.
- Enviar intenciones al servidor y renderizar su estado oficial.
- Conservar por pestaña el token opaco necesario para recuperar la sesión.

### `apps/server`

- Exponer el estado de salud del servicio.
- Alojar Socket.IO.
- Crear salas y ser la autoridad de las partidas.
- Validar todos los payloads con Zod.
- Controlar cuenta regresiva, reproducción, ventana de respuesta y resultados.
- Serializar cada transición mediante un repositorio y un bloqueo por sala.
- Restaurar temporizadores absolutos después de reinicios.

### `packages/game-engine`

- Definir estados y colores.
- Generar secuencias mediante una fuente aleatoria inyectable.
- Validar entradas.
- Avanzar rondas.
- No depende de React, Socket.IO ni Fastify.

### `packages/shared-types`

- Compartir tipos de jugadores, salas y eventos.
- Evitar contratos duplicados entre web y servidor.

## Flujo actual

```text
Acción del jugador
       ↓
Componente React
       ↓
Motor puro de memoria
       ↓
Nuevo estado
       ↓
Animación y audio
```

## Flujo multijugador implementado

```text
Jugador → evento Socket.IO → servidor → motor → estado oficial → sala
```

El navegador nunca calcula el resultado oficial. Las secuencias, fases, puntos, tiempos y ganador pertenecen al servidor.

## Persistencia

`RoomManager` mantiene una copia de trabajo, pero el repositorio es la fuente compartida entre acciones. Cada evento realiza este flujo:

```text
evento → bloqueo de sala → carga validada → transición → persistencia → emisión
```

- Desarrollo sin infraestructura: archivo JSON escrito mediante reemplazo atómico y permisos `0600`.
- Producción: Redis con TTL renovable, índice de salas y bloqueo distribuido con token de propietario.
- Reinicio: se cargan las salas y se reprograman cuenta regresiva, apertura de entradas, timeout o siguiente ronda usando marcas de tiempo absolutas.

El formato persistido tiene versión explícita y se valida con Zod antes de ingresar al dominio.

## Escala horizontal

El adaptador Redis de Socket.IO propaga eventos y membresía entre instancias. La misma Redis serializa mutaciones por código de sala; por ello, dos jugadores conectados a nodos diferentes siguen operando sobre una única versión oficial. Las escrituras renuevan el TTL y las salas inactivas expiran automáticamente.

## Reconexión

El identificador del jugador es un UUID independiente de Socket.IO. Al crear o entrar a una sala, el servidor genera un token aleatorio de 256 bits que el navegador guarda en `sessionStorage`; el servidor persiste únicamente su hash SHA-256 y lo compara en tiempo constante.

Cuando se corta la conexión, el servidor marca al jugador como desconectado y reserva su lugar durante 15 segundos. Si regresa con el código y el token correctos, recibe una instantánea con la fase, cuenta regresiva, reproducción, límite de respuesta o resultado vigente. Los tiempos son absolutos para reanudar sin repetir eventos ya vencidos.

## Decisiones

- Monorepo con pnpm para compartir tipos sin publicar paquetes.
- ESM y TypeScript estricto.
- Fastify separado de Next.js para mantener conexiones Socket.IO de larga duración.
- Repositorio por interfaz: archivo atómico local o Redis compartida.
- Bloqueo distribuido por sala para conservar una sola autoridad entre instancias.
- Socket.IO Redis Adapter para difusión horizontal.
- El generador aleatorio se inyecta para que las pruebas sean deterministas.
- Los clientes reciben únicamente la secuencia de la ronda actual.
- Una desconexión produce victoria por abandono solo después de agotar los 15 segundos de reserva.
