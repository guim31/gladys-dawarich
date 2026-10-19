# Dawarich

Conecte Gladys a [Dawarich](https://dawarich.app), el historial de ubicaciones
autoalojado (una alternativa a Google Timeline): siga las distancias recorridas
y los países visitados, y reciba un aviso cuando su teléfono deje de enviar su
posición. Todo se queda en su red local: Gladys solo lee su servidor Dawarich y
no le envía nada.

Probada con un servidor Dawarich 1.16.0 real (la imagen Docker oficial) y
trayectos simulados, no con un teléfono en carretera: sus comentarios son
bienvenidos en el foro de Gladys. Para el seguimiento GPS en directo, vea la
integración Traccar: esta trata del historial y las estadísticas.

## Requisitos previos

- Gladys Assistant 5.1 o posterior.
- Un servidor Dawarich accesible desde el equipo de Gladys, en el puerto 3000
  por defecto o detrás de un proxy inverso, y una aplicación de seguimiento que
  le envíe posiciones (aplicación Dawarich, OwnTracks, Overland…).
- La clave de API de su usuario de Dawarich: abra el menú de su cuenta →
  **Account**, allí aparece la clave.

## Configuración

1. Abra la pestaña **Configuración** de la integración.
2. En **Dirección de Dawarich**, introduzca la dirección IP del servidor, por
   ejemplo `192.168.1.50`: la integración usa entonces el puerto 3000. Añada el
   puerto si es otro (`192.168.1.50:3100`). Detrás de un proxy inverso,
   introduzca la dirección completa (`https://dawarich.example.org`).
3. Pegue la **clave de API**.
4. **Leer Dawarich cada**: 5, 15 (por defecto), 30 o 60 minutos.
5. **Mostrar las coordenadas de la última posición**: desactivado por defecto.
   Activado, el dispositivo recibe una función más con la latitud y la longitud
   del último punto.
6. **Idioma de los nombres** fija los nombres de las funciones (fijados al
   añadir el dispositivo), los nombres de los países y los textos de las
   escenas. Francés por defecto.
7. Guarde y use **Probar la conexión**: muestra el número de puntos y de países
   visitados.
8. En la pestaña **Descubrir**, añada el dispositivo **Dawarich**.

## Dispositivo

**Dawarich** (un dispositivo para el usuario de la clave de API):

| Función                       | Valor                                                      |
| ----------------------------- | ---------------------------------------------------------- |
| Distancia hoy                 | km recorridos desde medianoche, sumados a partir de puntos |
| Distancia este mes            | km del mes, según las estadísticas de Dawarich             |
| Distancia este año            | km del año, según las estadísticas de Dawarich             |
| Distancia total               | km desde su primer punto                                   |
| Países visitados              | países de todos sus puntos                                 |
| Ciudades visitadas            | ciudades contadas por Dawarich (requiere geocodificación)  |
| Puntos registrados            | número de posiciones guardadas en Dawarich                 |
| Última posición recibida      | fecha y hora del último punto, o «Ninguna»                 |
| Última posición (coordenadas) | «latitud, longitud», solo con la opción del paso 5         |

Distancias y contadores guardan su historial: un gráfico muestra los
kilómetros de cada día o de cada mes.

## Widget del panel

**Desplazamientos**: cuatro mosaicos (hoy, este mes, este año, países), la
antigüedad de la última posición (verde, amarillo tras una hora, rojo tras un
día) y los países de los últimos 30 días. No requiere ajustes.

## Disparadores de escena

- **Nuevo país visitado**: llega una posición de un país nunca visitado antes
  en Dawarich. Variables: **País** (en el idioma de la integración) y **Código
  del país** (ISO, 3 letras, por ejemplo `ITA`). Los países que ya están en
  Dawarich al instalar la integración, y los de un historial antiguo importado
  más tarde, no se anuncian.
- **No se reciben posiciones**: ningún punto nuevo durante al menos el tiempo
  elegido (1, 2, 3, 6, 12, 24 o 48 horas). Puede que la aplicación de
  seguimiento se haya detenido o que el teléfono esté apagado o sin red. Se
  dispara una vez por silencio y por duración; un punto nuevo vuelve a empezar.
  Variable: **Hora de la última posición**.

## Ejemplos de escenas

- **Modo vacaciones**: cuando se dispare «Nuevo país visitado», envíese el
  mensaje «¡Bienvenido a {{triggerEvent.data.country}}!» y pase la casa al modo
  vacaciones.
- **Aplicación de seguimiento detenida**: cuando se dispare «No se reciben
  posiciones» para 6 horas, envíe el mensaje «Dawarich no ha recibido nada desde
  {{triggerEvent.data.last_position}}: compruebe la aplicación de seguimiento
  del teléfono.»
- **Balance mensual**: el día 1 del mes a las 9:00, envíe un mensaje con el
  valor de «Distancia este mes» antes de que vuelva a cero.

## Solución de problemas

- **«Dawarich rechazó la clave de API»**: copie de nuevo la clave desde la
  página **Account**. Una clave cambia cuando se regenera.
- **«Dawarich no responde»**: compruebe la dirección y el puerto desde el equipo
  de Gladys (`http://<dirección>:3000/api/v1/health` responde
  `{"status":"ok"}`) y que Dawarich esté en marcha.
- **«Esta dirección no responde como Dawarich»**: la dirección lleva a otro
  servicio o a la página de inicio de sesión de un proxy inverso.
- **El mes o el año no cambian**: Dawarich recalcula estas estadísticas una vez
  por hora, en segundo plano (Sidekiq). «Distancia hoy» la calcula la
  integración en cada lectura.
- **Las ciudades quedan en 0**: la geocodificación inversa está desactivada en
  Dawarich (Photon, Geoapify… en sus ajustes). Los países vienen de las
  fronteras y funcionan sin ella; **Probar la conexión** indica cuando está
  desactivada.
- Registros: en la pestaña **Registros** de la integración. Más detalles con
  `LOG_LEVEL=debug`. Nunca se escriben en ellos coordenadas ni nombres de
  lugares.

## Límites

- Solo lectura: la integración nunca escribe en Dawarich. No puede enviar a
  Dawarich las posiciones de otros dispositivos de Gladys (una integración no
  lee los dispositivos de las demás).
- Los kilómetros del mes, del año y el total son números enteros, tal como los
  da Dawarich; «Distancia hoy» se redondea a 0,1 km y descarta los saltos de GPS
  más rápidos que un avión.
- Los disparadores reaccionan en la lectura siguiente: con hasta el intervalo
  elegido de retraso.
- Un solo usuario de Dawarich por integración: el de la clave de API.
- La opción de las coordenadas muestra su posición a todos los usuarios de
  Gladys: déjela desactivada si no la necesita.
- Sin relación con Dawarich. Desarrollada con el servidor real, sin teléfono en
  carretera: sus comentarios son bienvenidos.
