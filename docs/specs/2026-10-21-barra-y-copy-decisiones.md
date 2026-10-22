# La barra, el copy y el rótulo — decisiones del 21 de octubre

**Estado:** acordado con el tutor tras probar la v0.17.0 en un paseo real.
Sin construir. Se empieza el 22 de octubre.

El origen de todo esto es un paseo cerrado en el ascensor del portal, sin
cobertura, grabado en vídeo. Vale la pena saber por qué: **es el caso
habitual, no el raro** — llegas al portal, entras en el ascensor, abres la app
y paras el paseo mientras subes.

## 1. El copy del botón de paseo

`Guardando…` se sustituye por lenguaje de la casa:

- al empezar → **`En marcha…`**
- al parar → **`A casa…`**

`A casa` entronca con el par que la app ya usa, _"¡Vamos, Loki!"_ / _"¡Loki ya
está contigo!"_.

**Por qué importa más de lo que parece.** En el vídeo, la etiqueta estuvo en
pantalla **más de nueve segundos** — el ascensor dejó la escritura colgada.
No es una palabra que se vislumbra, es una palabra que se mira.

Anchos medidos a `font_scale` 1,45: `Guardando…` y `En marcha…` ocupan lo
mismo, y `A casa…` es **más corto**, así que en la parada reduce la elipsis
que aceptamos a sabiendas.

**La pega, asumida:** `En marcha…` afirma el estado del perro mientras lo que
ocurre es una escritura que puede fallar. Si falla, el botón dijo "En marcha"
y vuelve a "Paseo". Encaja con la actualización optimista decidida para el
modo sin red.

## 2. La leyenda del calendario

`Objetivo conseguido` / `Objetivo conseguido x2` se sustituyen por:

- TIER 1 → **`Día cumplido`**
- TIER 2 → **`Día de campeonato`**

"Día de campeonato" es la frase del propio tutor, dicha al explicar los dos
niveles. "Cumplido" dice que el día hizo lo que tenía que hacer sin el tono de
formulario del texto anterior.

**El filtro que descartó otras opciones:** estas palabras viven en **tres
sitios** — la leyenda, el rótulo de la barra y el nombre accesible de la
celda. "10, día de campeonato" se lee bien. "Buen día" se descartó porque en
el nombre de una celda suena a saludo.

## 3. El rótulo se queda donde está

**Enmendado el 22 de octubre.** El 21 se decidió subirlo encima de la barra y
que su hueco existiera siempre. La mañana siguiente el tutor cerró la mitad
que faltaba: **no se muestra nada un día que no alcanza ningún nivel** — "no
hace falta mostrar nada cuando no hay nada que celebrar".

Y sin hueco permanente, subirlo pierde su razón y conserva su coste: la barra
bajaría una línea **justo en el instante en que se anima el cierre**, que es
la única animación de este proyecto medida frame a frame. Así que el rótulo
se queda debajo de la barra y solo aparece al cumplir. Solo cambian sus
palabras, en el punto 2.

**Lo que esto cerró, y conviene tenerlo escrito:** hoy, un día por debajo del
objetivo no tiene ese rótulo oculto ni vacío — el nodo no se monta
(`GoalBlock.tsx`, el ternario cierra en `null`). Subirlo con hueco permanente
no habría sido mover un texto: habría sido inventar un estado que nunca ha
existido, y con él una frase que decir los martes a las once con veinte
minutos paseados. Esa frase ya no hace falta.

## 4. El degradado: descartado

Se propuso pintar el rótulo con un degradado violeta/aqua al mismo porcentaje
que la barra. Descartado por tres razones, en orden de peso:

- **Parte las letras por sitios arbitrarios.** Al 60 % de la segunda vuelta el
  corte cae dentro de una palabra. Eso no transmite un porcentaje, transmite
  ruido.
- La queja de origen era que `Objetivo conseguido x2` resultaba **básico y
  redundante**. Con `Día de campeonato` la redundancia desaparece y el
  degradado queda como adorno.
- Dos colores a la vez en una marca van contra la Regla de la Marca
  Compartida, que esta misma versión acaba de aplicar.

El rótulo conserva el color sólido de su nivel: Aqua en TIER 1, Aurora Boreal
en TIER 2.

## 5. El salto de la primera a la segunda vuelta

**El problema, confirmado en el paseo:** al cruzar el objetivo ocurren **dos
sustituciones a la vez** — el fondo gana color (oscuro → Aqua) y el relleno
cambia de tono (Mist → violeta). Cada una sería legible; juntas se leen como
un cambio de escena.

Solo molesta cuando el cruce ocurre **durante** el paseo. Al cerrar, la
animación del cierre ya lo cubre, y el tutor la describió como «genial,
incluso cuando salta de tier».

### El mapeo escalonado que se propuso, y por qué no

Se propuso desplazar los colores un escalón, de modo que el color de cada
nivel apareciera primero como relleno y luego como fondo:

|        | fondo  | barra   |
| ------ | ------ | ------- |
| TIER 0 | oscuro | Mist    |
| TIER 1 | Mist   | Aqua    |
| TIER 2 | Aqua   | Violeta |

La idea es elegante —cada color se gana como relleno y se asienta como
suelo— y se descarta por dos medidas:

- **Aqua sobre Mist mide 1,14:1.** Es la peor pareja de toda la paleta: no
  solo comparten claridad, comparten familia de tono, así que no hay distancia
  cromática que rescate lo que la luminancia no da.
- **Un día que alcanza justo el objetivo quedaría todo Mist** — fondo Mist al
  100 %, relleno Aqua al 0 %. 119 minutos y 120 minutos se verían casi igual, y
  el momento que la barra existe para anunciar desaparecería. Hoy cruzar
  vuelve la barra entera Aqua, que es inconfundible y es el estado más común
  que la app va a tener.

**Una suposición mía que la medición corrigió:** violeta sobre Aqua también
mide bajo (**1,60:1**) y sin embargo funciona en el dispositivo, comprobado en
el paseo. La distancia de _tono_ hace el trabajo que la luminancia no hace, y
por eso el umbral numérico no vale como veto. Aqua sobre Mist falla justamente
porque ahí tampoco hay tono que rescate.

### Lo acordado

Se conserva el mapeo actual y **se ordenan las dos sustituciones en el
tiempo**: el fondo gira primero, el relleno cambia unos 150 ms después. Mismo
estado final, leído como una consecuencia en vez de como un corte.

Solo aplica al cruce en marcha.

### La regla que nada de esto puede romper

**El fondo solo refleja lo guardado.** Un paseo que se quedó en marcha sin
cerrar no puede pintar el fondo de un nivel que no se ha alcanzado. Es lo que
hace que una barra dando su segunda vuelta en gris sea, por sí sola, la señal
de que algo no se ha guardado.

## Lo que el tutor confirmó que ya funciona

Dicho tras un paseo real, no en una maqueta:

- La barra «se ve muy bien con la animación y con la combinación de colores»;
  los tonos menos saturados de Mist y violeta para el paseo en marcha tras la
  muesca, «muy bien, animación incluida».
- La animación de fin de paseo, «genial, incluso cuando salta de tier».
- La transición del botón y la animación de error al guardar, «estupenda».

## Pendiente de las versiones anteriores

- Ocho pantallas siguen dibujando su párrafo de error en rojo entero
  (`app/index.tsx`, `app/onboarding.tsx`, `app/auth/callback.tsx`,
  `app/(auth)/login.tsx`, `app/(tabs)/health.tsx` ×2, `app/(tabs)/profile.tsx`,
  `app/treatments.tsx`, `app/weights.tsx`). Mecánico, una línea cada una.
- El repaso en dispositivo que falta: TIER 2 en la barra, la banda de segunda
  vuelta, el confeti violeta, y TalkBack leyendo las etiquetas en voz alta.
