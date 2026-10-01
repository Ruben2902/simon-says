# Simon Says

Juego de memoria preparado para crecer desde una experiencia local hasta partidas en tiempo real para dos jugadores.

## Estado actual

- Fase 0: reglas, alcance y arquitectura documentados.
- Fase 1: monorepo con web, servidor y paquetes compartidos.
- Fase 2: motor de memoria probado y tablero local jugable.
- Fase 3: salas privadas de dos jugadores con código y lobby.
- Fase 4: protocolo Socket.IO tipado y validado en servidor.
- Fase 5: partida multijugador autoritativa, resultados y revancha.
- Fase 6: sesión recuperable, reserva de 15 segundos y resincronización de ronda.
- Fase 7: contador, audio opcional, teclado, accesibilidad y pulido responsive.
- Fase 8: salas persistentes, restauración de temporizadores y repositorios intercambiables.
- Fase 9: Redis multiinstancia, bloqueo por sala, rate limiting y endurecimiento de red.
- Fase 10: puerta de calidad, CI, E2E multisesión y auditoría WCAG automatizada.
- Fase 11: versión 1.0, contenedores de producción, smoke test y guía de publicación.

## Requisitos

- Node.js 22 o superior.
- pnpm 11 o superior.

## Ejecutar

```bash
pnpm install
pnpm dev
```

La web queda disponible en `http://localhost:3000` y el servidor en `http://localhost:3001`.

Abre la web en dos pestañas: crea una sala en la primera, utiliza el código en la segunda y confirma **Estoy listo** en ambas.

Cada pestaña conserva su identidad en `sessionStorage`. Una recarga o corte breve restaura la sala y el estado oficial si el cliente vuelve antes de 15 segundos.

También se pueden ejecutar por separado:

```bash
pnpm dev:web
pnpm dev:server
```

## Abrir en un celular

Conecta la computadora y el celular a la misma red Wi-Fi y ejecuta:

```bash
npm run dev:mobile
```

El comando detecta la IP local, configura web, API y CORS, y muestra el enlace
que debes abrir en el celular. Usa los puertos `3200` y `3201` para no interferir
con el entorno normal.

Para compartirlo por el panel **Ports** de un IDE, agrega los puertos `3200` y
`3201`, cambia ambos a visibilidad pública y copia sus URLs. Después ejecuta:

```bash
PUBLIC_WEB_URL="https://url-publica-del-3200" \
PUBLIC_GAME_SERVER_URL="https://url-publica-del-3201" \
npm run dev:mobile
```

Comparte únicamente `PUBLIC_WEB_URL`; la segunda URL queda incorporada en la web
para mantener la conexión multijugador.

Sin `REDIS_URL`, el servidor persiste las salas localmente en `.data/rooms.json`. Para probar la configuración distribuida:

```bash
docker compose up -d redis
REDIS_URL=redis://localhost:6379 pnpm dev
```

Con Redis activo, las instancias comparten estado mediante bloqueos por sala y publican eventos con el adaptador Redis de Socket.IO.

## Verificación

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e
```

Para ejecutar toda la puerta de calidad local usa `pnpm quality`. Este comando
incluye la prueba E2E, que levanta la web y el servidor en puertos aislados y
controla dos sesiones reales de Chromium.

La primera vez instala el navegador de pruebas con
`pnpm exec playwright install chromium`.

## Publicación

La versión de producción se distribuye como web, servidor WebSocket y Redis:

```bash
docker compose -f compose.production.yaml up -d --build
pnpm smoke
```

Consulta [`docs/deployment.md`](docs/deployment.md) antes de configurar dominios,
TLS, escalado o una reversión.

## Documentación

- [`docs/game-rules.md`](docs/game-rules.md): reglas y decisiones del producto.
- [`docs/architecture.md`](docs/architecture.md): límites técnicos y responsabilidades.
- [`docs/socket-events.md`](docs/socket-events.md): contrato multijugador implementado.
- [`docs/security.md`](docs/security.md): controles, límites y modelo de amenazas.
- [`docs/deployment.md`](docs/deployment.md): build, publicación, operación y rollback.

## Configuración

La web utiliza `NEXT_PUBLIC_GAME_SERVER_URL` para localizar el servidor Socket.IO. Consulta `apps/web/.env.example`. Esta variable es pública y no debe contener secretos.

El servidor valida al iniciar `PORT`, `HOST`, `WEB_ORIGINS`, persistencia, TTL, proxy y límites. Consulta `apps/server/.env.example`.
