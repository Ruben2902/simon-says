# Seguridad

## Modelo

El juego usa invitados y no almacena contraseñas ni datos personales. El token de reconexión funciona como credencial de capacidad: quien lo posee puede recuperar únicamente a ese jugador dentro de su sala.

## Controles implementados

- IDs de jugador aleatorios e independientes del ID público de Socket.IO.
- Tokens de reconexión de 256 bits; solo se persiste SHA-256.
- Comparación del hash en tiempo constante.
- Cada acción valida que la conexión activa siga controlando al jugador; una reconexión invalida la anterior.
- Validación Zod para eventos, configuración y registros recuperados.
- Allowlist exacta de orígenes HTTP y WebSocket mediante `WEB_ORIGINS`.
- Cabeceras seguras con Helmet y CORS con credenciales restringidas.
- Payload máximo de Socket.IO de 10 KB y compresión WebSocket desactivada.
- Límite de handshakes por IP, eventos de membresía, controles e inputs.
- Límite global para endpoints HTTP.
- Errores operativos sin detalles internos; el servidor registra el error completo.
- Bloqueo distribuido con propietario y liberación atómica en Redis.
- Archivo local con permisos `0600` y reemplazo atómico.
- Apagado ordenado de HTTP, Socket.IO y Redis.

## Operación

- `GET /health`: comprueba que el proceso responde.
- `GET /ready`: comprueba el repositorio y devuelve `503` si no está disponible.
- `GET /metrics`: expone conteos operativos sin códigos, nombres ni tokens.
- En producción debe usarse TLS en el proxy y configurarse `TRUST_PROXY=true` solo cuando el proxy sea confiable.

## Límites pendientes

El proyecto no incluye cuentas, chat ni contenido generado por usuarios. Si se agregan, necesitarán autenticación, autorización y políticas de moderación propias. Los límites actuales reducen abuso, pero no sustituyen protección perimetral, observabilidad ni rotación de secretos de la plataforma.
