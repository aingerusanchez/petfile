# La barra también se mueve cuando el paseo se edita a mano — diseño

**Estado:** acordado con el tutor el 23 de octubre de 2026. Sin construir.

**Origen:** lo levantó el tutor al cerrar la v0.23.0, y la frase es suya:
«hemos pulido las animaciones en muchos de los casos […] sin embargo,
rompemos todo eso en las ediciones manuales que ya existían».

## El porqué

La barra del objetivo se mueve con cuidado cuando un paseo **en marcha**
termina: hincha la pista, cruza un destello, aterriza en su nuevo sitio y se
asienta. Cuatro tiempos, medidos en el dispositivo, que costaron dos
versiones.

Las otras tres formas de cambiar los minutos del día **saltan**:

- añadir un paseo que no se pudo apuntar por la mañana;
- borrar un duplicado, que en esta casa pasa porque son dos tutores y a
  veces lo apuntan los dos;
- editar la duración de uno que ya está.

El mismo dato cambia de la misma manera y la barra lo cuenta de dos maneras
distintas según cómo haya llegado. Eso ya tiene una regla escrita en
PRODUCT.md que lo resuelve sin discusión:

> _a description follows the data; a celebration follows the viewer._

**La barra es una descripción.** Debe seguir a los datos vengan de donde
vengan. El confeti es una celebración y no se mueve de donde está.

## Lo decidido

### 1. El signo del cambio decide el movimiento, no la acción

Esta es la decisión, y está escrita así a propósito: **no es una taxonomía de
acciones, es el signo**. Añadir, borrar y editar no son tres casos que
recordar; son un número que sube o baja.

- **Sube** (un paseo añadido, una duración alargada) → **los cuatro tiempos
  del cierre**, los mismos que ya existen. El perro anduvo: lo que estaba mal
  era el registro, no el día.
- **Baja** (un paseo borrado, una duración acortada) → **el viaje de vuelta y
  nada más**. El relleno recorre hasta su nuevo valor y el fondo gira con el
  barrido que ya existe. Sin hinchado y sin destello.

La asimetría es deliberada y se puede decir en una frase: **quitar un paseo
es quitar algo que nunca ocurrió**, y darle la misma función que a conseguir
el objetivo dramatizaría la contabilidad. El proyecto ya distingue el logro
del papeleo — es la razón de que el confeti no salte al rellenar un martes
olvidado — y esto es la misma distinción en el registro de al lado.

El tutor eligió esta opción sobre dos alternativas que se le pusieron
delante: el viaje honesto en los dos sentidos (más barato, menos superficie)
y la ceremonia en los dos sentidos (máxima coherencia, al precio de celebrar
un borrado).

### 2. Solo lo que ha hecho este tutor en este teléfono

Un paseo que aparece porque **el otro móvil** lo escribió llega dentro de una
relectura, y una relectura no es una acción. La pantalla entera cambia de
golpe en ese momento y animar un trozo de ella sería señalar como un
acontecimiento algo que nadie de este lado ha hecho.

Es la misma frontera que esta rama lleva tres versiones defendiendo: **una
lectura que nadie pidió no se comporta como una acción.** La animación cuelga
de lo que se pulsa aquí, igual que `justClosed`.

### 3. El confeti no se mueve

Queda dicho porque es la pregunta que viene detrás. Lo que cambia es la
barra. El confeti sigue donde PRODUCT.md lo dejó.

## Lo que esto obliga a construir, y lo que no

**Lo que ya está y se reutiliza:** subir es exactamente lo que
`closeMotion` ya calcula, y el bloque ya sabe dibujarlo. El trabajo de ese
lado es alimentarlo desde las ediciones en vez de solo desde la parada.

**Lo que no existe:** bajar. `closeMotion` rechaza por construcción cualquier
cosa que no sume (`if (closedMinutes <= 0) return none`) y su documentación
dice que el cierre «convierte una banda y nunca gira un fondo». Bajar obliga
a girar un fondo **hacia atrás**.

Y hay un detalle que se midió al decidir esto y conviene no perder: **los
anchos del relleno no están animados hoy**. Se recalculan en cada render y
saltan; lo único que anima es el fondo, por `GroundTurn`. Así que el viaje de
vuelta no es «quitarle la ceremonia al cierre», es una pieza nueva — más
simple que el cierre, pero nueva: un ancho que viaja.

## Lo que este documento no decide

- La duración y la curva del viaje de vuelta. El cierre son 760 ms en cuatro
  tiempos; el barrido del fondo son 700 ms con `inOut(cubic)`, medido en el
  dispositivo. El viaje de vuelta probablemente quiera parecerse al segundo
  más que al primero, pero eso se decide viéndolo.
- Qué pasa si dos cambios se solapan — dos borrados seguidos, o un borrado
  mientras un cierre está en el aire.
- Si el aterrizaje del cierre reutilizado desde una edición debe empezar
  donde empieza hoy (al pie de la vuelta en la que cae) o en los minutos
  grabados. Hoy esa decisión está tomada para un paseo en marcha, donde el
  fondo ya había girado por los minutos vividos; en una edición no hay nada
  vivido, así que la premisa cambia y hay que volver a mirarla.

## Lo que hay que respetar al construirlo

- **`GoalBlock` es el componente con más historia medida del proyecto.** Lo
  que se añada se verifica en el dispositivo con una grabación, no en el
  navegador: los anchos animados en porcentaje sí animan en nativo, pero eso
  se sabe porque se midió, no porque se dedujera.
- Una animación no se prueba contra un reloj en Playwright. Hoy mismo una
  aserción así costó una suite entera y dos versiones de confusión.
- La lógica de qué movimiento toca va en `lib/goalbar.ts` y se prueba con
  Jest, por la razón de siempre: un movimiento equivocado no lanza, pinta mal.
