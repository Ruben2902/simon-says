# Publicación

La entrega de producción usa tres servicios: la web Next.js, el servidor
Socket.IO y Redis. El servidor necesita un proceso persistente con WebSockets;
no debe publicarse como una función efímera.

## Validar antes de publicar

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm quality
```

El mismo control se ejecuta en GitHub Actions para cada pull request y cada
push a `main`.

## Levantar la imagen de producción

```bash
cp .env.production.example .env.production
docker compose --env-file .env.production -f compose.production.yaml up -d --build
WEB_URL=http://localhost:3000 SERVER_URL=http://localhost:3001 pnpm smoke
```

Para una comprobación local no es necesario editar el ejemplo: Compose usa
`http://localhost:3000` y `http://localhost:3001` como valores por defecto.

## Dominio y TLS

En el entorno público:

1. `PUBLIC_WEB_URL` debe ser el origen HTTPS exacto de la web, sin `/` final.
2. `PUBLIC_GAME_SERVER_URL` debe ser la URL HTTPS pública del servidor.
3. Ambos dominios deben terminar TLS en el proveedor o en un proxy inverso.
4. El proxy del servidor debe permitir el upgrade de WebSocket y mantener
   conexiones de larga duración.
5. No se debe exponer Redis a Internet; solo web y servidor publican puertos.

`NEXT_PUBLIC_GAME_SERVER_URL` queda incorporada al JavaScript durante el build
de la imagen web. Si cambia el dominio del servidor, se debe reconstruir esa
imagen.

Para ejecutar también el flujo completo de dos jugadores contra una publicación
ya levantada:

```bash
E2E_BASE_URL=https://simon.example.com pnpm test:e2e
```

## Escalado y operación

- Se pueden ejecutar varias réplicas del servidor porque Redis comparte salas,
  eventos y bloqueos.
- El balanceador debe comprobar `/ready`; `/health` confirma el proceso y
  `/metrics` expone contadores operativos sin datos personales.
- La aplicación atiende `SIGTERM` y cierra WebSockets y conexiones Redis de
  forma ordenada. Se recomienda un margen de apagado de 30 segundos.
- Redis usa AOF y el volumen `simon-redis-data`. En un proveedor administrado,
  se reemplaza `REDIS_URL` por la URL secreta del servicio.

## Reversión

Conservar la etiqueta de la imagen anterior. Si el smoke test falla, restaurar
las imágenes de web y servidor como una unidad y mantener el mismo volumen de
Redis. La estructura persistida incluye versión y tolera reinicios, pero cada
cambio futuro de esquema deberá documentar su migración.
