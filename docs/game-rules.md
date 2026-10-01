# Reglas del juego

## Visión

Simon Says es una competencia de memoria para dos personas. Los jugadores entrarán en una misma sala, observarán una secuencia común y la reproducirán de manera individual. Antes de conectar la experiencia multijugador, el motor se valida con un modo local completo.

## Elementos

- Cuatro controles: verde, rojo, amarillo y azul.
- Cada control tiene una señal visual y un tono propio.
- La secuencia comienza con un elemento y aumenta en uno por ronda.
- La secuencia generada debe pertenecer al servidor cuando exista una partida multijugador.

## Reglas del modo local

1. El jugador pulsa **Comenzar**.
2. El juego muestra la secuencia completa.
3. Los controles permanecen bloqueados mientras se muestra la secuencia.
4. El jugador repite la secuencia en el mismo orden.
5. Cada entrada correcta parcial permite continuar.
6. Completar la secuencia aumenta la puntuación y abre una nueva ronda.
7. Una entrada incorrecta termina la partida.
8. El jugador puede iniciar otra partida desde la ronda uno.

## Reglas para dos jugadores

- Una sala admite exactamente dos jugadores activos.
- Ambos deben indicar que están listos.
- Ambos observan la misma secuencia.
- Cada jugador responde de manera independiente dentro del tiempo disponible.
- El servidor valida entradas, puntuación, ronda y ganador.
- El cliente nunca genera la secuencia oficial ni decide el resultado.
- Si solo un jugador completa una ronda, gana la partida.
- Si ambos fallan en el mismo punto, la partida termina en empate y se ofrece revancha.
- Si ambos fallan en puntos distintos, gana quien haya progresado más.
- Si se agota el tiempo, la respuesta pendiente cuenta como fallo en el punto alcanzado.
- Una desconexión reserva el lugar durante 15 segundos; al vencer ese plazo durante la partida, se considera abandono.

## Estados del motor

- `idle`: todavía no existe una partida activa.
- `showing-sequence`: el juego reproduce la secuencia y bloquea entradas.
- `accepting-input`: el jugador puede responder.
- `round-success`: la secuencia fue completada correctamente.
- `game-over`: se recibió una respuesta incorrecta.

## Alcance del primer MVP multijugador

- Invitados con nombre, sin registro.
- Código de sala corto.
- Dos jugadores.
- Una partida activa por sala.
- Resultado, revancha y abandono.
- Sin clasificación global ni compras.

## Accesibilidad

- Cada control tiene nombre además del color.
- El estado se comunica con texto y no solo mediante animación.
- El tablero se puede operar con teclado.
- Las teclas `1`, `2`, `3` y `4` activan verde, rojo, amarillo y azul.
- El movimiento se reduce cuando el sistema lo solicita.
- El audio complementa la interfaz, pero no es la única señal.
- El jugador puede silenciar los tonos sin perder las señales visuales y textuales.
