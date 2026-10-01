# Contrato de Socket.IO

Este contrato está implementado y tipado en `packages/shared-types`. Los eventos del cliente utilizan confirmaciones para comunicar éxito o errores recuperables.

## Cliente a servidor

| Evento           | Propósito                                            |
| ---------------- | ---------------------------------------------------- |
| `room:create`    | Crear una sala y unir al anfitrión                   |
| `room:join`      | Entrar mediante código                               |
| `room:reconnect` | Recuperar identidad y estado mediante un token opaco |
| `player:ready`   | Cambiar el estado de preparación                     |
| `game:input`     | Enviar un color seleccionado                         |
| `game:rematch`   | Solicitar otra partida                               |
| `room:leave`     | Abandonar voluntariamente                            |

## Servidor a cliente

| Evento                 | Propósito                                      |
| ---------------------- | ---------------------------------------------- |
| `room:updated`         | Publicar el lobby actualizado                  |
| `room:error`           | Comunicar un error recuperable                 |
| `game:starting`        | Iniciar la cuenta regresiva                    |
| `game:sequence`        | Reproducir la secuencia autorizada             |
| `game:input-enabled`   | Habilitar respuestas                           |
| `game:player-progress` | Sincronizar avance y estado de ambos jugadores |
| `game:round-result`    | Comunicar el resultado de la ronda             |
| `game:finished`        | Comunicar ganador y causa                      |

La creación y entrada devuelven `playerId`, `reconnectToken` y la sala mediante su callback. `room:reconnect` devuelve una instantánea completa de sincronización. Una desconexión se comunica mediante `room:updated`; si no se recupera en 15 segundos durante una partida, `game:finished` usa la causa `forfeit`.

Todos los payloads se validan con Zod en el límite del servidor. El cliente envía acciones; el servidor devuelve hechos y estado oficial.

## Errores

Las confirmaciones utilizan códigos estables como `ROOM_NOT_FOUND`, `ROOM_FULL`, `GAME_ALREADY_STARTED`, `INPUT_LOCKED`, `RECONNECT_EXPIRED`, `RATE_LIMITED`, `SERVICE_UNAVAILABLE` e `INVALID_PAYLOAD`. Los mensajes visibles pueden cambiar sin afectar al contrato.

Las acciones se procesan dentro de un bloqueo por sala. El estado se persiste antes de responder o emitir el hecho a otros jugadores.

## Secuencia de una partida

```text
room:create / room:join
        ↓
room:updated (lobby)
        ↓
player:ready × 2
        ↓
game:starting
        ↓
game:sequence
        ↓
game:input-enabled
        ↓
game:input × jugador
        ↓
game:round-result o game:finished
```

## Recuperación de sesión

```text
disconnect
    ↓
room:updated (connected: false)
    ↓ menos de 15 s
room:reconnect
    ↓
snapshot de fase + tiempos absolutos + resultado vigente
```
