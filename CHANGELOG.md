# Changelog

Lo que ha cambiado en cada versión, en el orden en que pasó.

<!-- Este párrafo se borra al desplegar el MVP: explica una regla que deja de
     existir en cuanto la versión llegue a v1.0.0. -->

Mientras el MVP no esté montado la versión se queda en `0.x`, para que llegar
a `1.0.0` signifique algo: todas las pantallas en pie, y de momento falta
Salud como mínimo. `versionCode` se deriva de aquí
(`major * 10000 + minor * 100 + patch`), así que sube sola y de forma monótona
hasta el 1.0.0 — pero **bajar la versión a mano obliga a desinstalar**, porque
Android rechaza la instalación.

Las versiones 0.3.0 y 0.4.x se anotan **en retrospectiva**: ese trabajo entró a
`main` en un solo merge, antes de que este fichero existiera. De 0.5.0 en
adelante cada entrada corresponde a lo que se construyó bajo ese número.

## [v0.8.0] — 2026-09-11

### Nuevo

- **La pestaña de Salud deja de ser un título.** Una sola pantalla con
  secciones y sin sub-navegación: dos tutores y un perro producen un puñado de
  filas al año, y partir eso en pestañas sería inventarse una jerarquía para
  esconder un vacío. El orden responde a la pregunta con la que se abre la
  pestaña — **¿hay algo pendiente?** — antes que a ninguna otra.
- **Lo que toca, primero, y casi todo el año no es nada.** Las próximas fechas
  ordenadas por cercanía, en rojo solo cuando ya vencieron: "dentro de nueve
  días" no es un fallo, es un recordatorio. Un vacío aquí es una buena noticia
  y se dice con palabras, no dejando un hueco.
- **El peso, con su línea.** El último valor grande, cuánto ha cambiado desde
  la medición anterior, y una línea **espaciada por fecha y no por posición**:
  puntos equidistantes dibujarían igual una rutina semanal y un salto de seis
  meses, que es justo lo que una curva de crecimiento no puede hacer.
- **Un peso por día.** Volver a pesarle porque el primer número parecía raro es
  una corrección, no dos datos: guardar sobre el mismo día reemplaza en vez de
  duplicar, y el botón lo dice ("Corregir el peso de hoy").
- **Los tratamientos proponen su próxima fecha y guardan la que confirmes.**
  Un año para la vacuna, tres meses para la desparasitación, un mes para el
  antiparasitario — y la propuesta sigue al tipo hasta que alguien la cambia,
  momento en el que deja de moverse: lo que dijo el veterinario es el dato.
  "Sin fecha" también es una respuesta; un tratamiento de una sola vez no está
  pendiente, está hecho.
- **"Desparasitación (Int.)" y "Antiparasitario (Ext.)", con su apellido.** A
  secas nombran la misma idea dos veces para quien no ha tenido la explicación
  del veterinario delante: la pipeta del cuello y la pastilla de los gusanos se
  leen como sinónimos. Y el campo del nombre propone ejemplos por tipo —
  "Seresto, Frontline… (pulgas, garrapatas)" —, que es la mitad de la
  explicación que de verdad se reconoce: la de la caja del armario. Cada tipo
  lleva además su icono, y nombran para qué sirven y no a qué se parecen: una
  jeringuilla, un gusano para lo que vive dentro y una garrapata para lo que
  vive fuera.
- **Las vacunas sugieren de una lista; las desparasitaciones se escriben.** En
  las vacunas el nombre _es_ la pauta, así que el texto libre la parte en
  tantas como formas haya de escribirla — "Rabia", "rabia ", "Vacuna
  antirrábica" — y cada trozo se queda con un cacho del historial sin recordar
  nada a nadie. Polivalente · Rabia · Bivalente · Tos de las perreras ·
  Leishmaniosis — en el mismo combo que usan las razas, porque ninguna lista de
  vacunas está completa y rechazar lo que no está en ella sería rechazar la
  verdad. Lo que evita que el texto libre deshaga la pauta es **guardar la
  grafía de la lista**: "rabia" y "Rabia " se guardan como "Rabia", y lo que de
  verdad está fuera se guarda tal cual. **Las valencias son una sola entrada**:
  penta, hexa y octovalente son el mismo refuerzo anual, y separarlas rompería
  justo la pauta que la lista existe para mantener unida.
- **Apuntar sale de las secciones y baja al pulgar.** Cada sección tenía su
  botón, lo que dejaba lo único a lo que se entra a hacer al final de un bloque
  que había que recorrer — y, peor, hacía que las secciones parecieran
  formularios. Ahora hay una acción flotante con sus dos opciones, como en el
  Diario: las secciones se leen, el botón flotante escribe.
- **Un sheet que crece ya no se sale de la pantalla.** El formulario de
  tratamiento ganó una fila y el panel entero se fue por encima del reloj del
  sistema: sin scrim visible dejaba de leerse como un panel, y no había forma
  de volver a lo de arriba. Ahora tiene tope — la ventana menos la barra de
  estado y una franja de scrim — y su contenido se desplaza dentro. Medido en
  el dispositivo.
- **La fecha que se rellena sola dice cada cuánto toca.** "Suele tocar cada 3
  meses" bajo el campo: una fecha que aparece de la nada invita o a confiar a
  ciegas o a corregirla sin saber por qué. La frase sale del mismo constante
  que rellena la fecha, así que no pueden acabar diciendo cosas distintas — y
  habla de lo habitual y no de lo puesto, así que sigue siendo cierta cuando
  el tutor escribe encima la fecha que dijo el veterinario.
- **Una pauta pertenece al par tipo+nombre, no al tipo.** "Rabia" y
  "Polivalente" son las dos vacunas y corren en relojes distintos: agruparlas
  dejaría que la última puesta borrase la fecha de la otra, y la que se borra
  es precisamente de la que nadie volvería a acordarse.
- **Las horas siempre se pudieron escribir sin los dos puntos, y ahora se
  sabe.** `915` y `0915` son las 09:15 desde el primer día: el separador es
  opcional en el analizador y no lo decía nadie. Los dos campos de hora lo
  enseñan en su placeholder y Ajustes lo dice con palabras, junto al formato
  de hora, que es donde alguien ya está pensando en eso. Anunciarlo lo
  convierte en un compromiso, así que el atajo tiene ahora su propia prueba.
- El campo de fecha aprende dos cosas que una fecha de nacimiento nunca
  necesitó: **mirar al futuro** y **quedarse vacío**.
- Y una tercera: **su título es de quien pregunta.** Estaba escrito a fuego
  ("Fecha de nacimiento"), correcto mientras solo hubo una fecha en la app, y
  el primer tratamiento que lo reutilizó abrió un selector titulado con otro
  asunto.

- **Los títulos de sección anclan.** Eran más apagados que las filas que
  encabezan, que es la jerarquía del revés: en una pantalla que hay que
  recorrer, lo que se busca es dónde empieza cada bloque. Pasan al acento
  secundario en toda la app. Probadas las tres variantes en pantalla de móvil:
  subir el gris un escalón no se distinguía de no hacer nada.
- En Salud, "LO QUE TOCA" pasa a **"PRÓXIMOS TRATAMIENTOS"** y "TRATAMIENTOS" a
  **"HISTORIAL DE TRATAMIENTOS"**, que dicen cuál mira adelante y cuál atrás.

### Arreglado

- **"Lo que toca" listaba recordatorios ya superados.** Una pauta estaba
  identificada por tipo **y nombre**, y eso solo es cierto en las vacunas:
  Rabia y Pentavalente corren en relojes distintos, pero "Panacur", "Panacur
  500mg" y "Milbemax" son lo que tocó ese mes para la misma costumbre. Con
  nueve meses de historial real salían cinco filas, tres de ellas la misma
  desparasitación interna, y una gritando en rojo que había vencido en abril —
  cinco meses después de la dosis que ya la había sustituido. Un registro
  superado que se presenta como pendiente es peor que no avisar: enseña a
  desconfiar justo de la sección que existe para confiar en ella.
- **El botón del peso decía "Corregir el peso de hoy"**, que es cierto de lo
  que propone y falso del botón: lo primero que se hace con una línea vacía es
  meter meses de pesajes del más reciente al más antiguo, y todos pasaban por
  un botón que hablaba de hoy. Ahora dice siempre "Anotar peso" y abre sobre
  el registro del día cuando lo hay, para que un guardado no pueda sustituir
  un peso que nunca llegó a enseñar.
- Los botones de añadir quedaban pegados al borde inferior de su sección.
- El changelog generado y Prettier se peleaban por las comillas en cada
  ejecución del script, dejando un fichero modificado que el hook volvía a
  formatear. Ahora el generador escribe ya formateado.

## [v0.7.0] — 2026-09-11

### Nuevo

- **El paseo registra las kakas, con una escala de cinco.** Dura · Perfecta ·
  Blanda · Sin forma · Diarrea, **con la salud en el 2 y no en un extremo**: la
  escala que sale sola va de "perfecta" a "diarrea", así que lo peor siempre
  sería lo más líquido — y pasar a comida natural endurece. Una kaka seca y
  costosa se habría anotado como perfecta, justo al revés de lo que pasa.
- **Varias por paseo, y la segunda en un toque.** El botón vive en la fila de
  la nota y no añade: despliega una paleta, y cada opción añade sin cerrarla.
  Nunca se rellena un valor por defecto. Un toque en la ficha ya añadida la
  quita, que es toda la reparación que necesita un toque equivocado.
- **La escala corre del 5 al 1**, para que "Perfecta" — la que se toca casi
  todos los paseos — caiga bajo el pulgar y no al otro lado del móvil. Y las
  fichas crecen **por encima** de la paleta: un sheet inferior crece hacia
  arriba, así que cualquier cosa que aparezca debajo levantaría los botones
  justo cuando vas a tocar el segundo. Medido en el móvil: tres adiciones
  seguidas, la paleta en el mismo píxel.
- **La escala marca cuál es la buena.** Cinco peldaños se leen como si tuvieran
  un solo extremo, y la suposición natural es que la mejor es la más lejana a
  la diarrea — le pasó a quien diseñó la escala. Una frase debajo se lee una
  vez y nunca más; una marca está siempre. El peldaño sano lleva el filete más
  fuerte y su dibujo en el tono primario, sin color nuevo.
- **Cada peldaño es un dibujo, no un número.** Bolitas sueltas, un tronco
  segmentado, ese mismo tronco sin aristas, una masa extendida y rota, y un
  charco con algo cayendo todavía: lo que la escala mide es **cómo se sostiene**,
  y eso es una silueta. El número y la palabra estaban de paso. Los dibujos
  siguen la misma retícula de 24 y el mismo trazo de 2 que los iconos de la
  app, así que no parecen pegatinas caídas sobre el formulario.
- Las kakas salen a la derecha de la fila del paseo en el registro del día, con
  el mismo dibujo a 20 dp.
- Moco y sangre **no se registran en el paseo**. Estuvieron un rato como dos
  casillas y era fricción en el camino que todo el mundo recorre por culpa del
  que casi nunca ocurre: lo que merece atención veterinaria es una incidencia
  hoy, y la pestaña de Salud cuando exista.

### Cambiado

- **La tarta del cumpleaños se ve por fin.** A 22 dp no se reconocía: velas,
  piso y bandeja son tres detalles metidos en el hueco de un dígito. Ahora mide
  32 y cruza el anillo del día actual — que era justo lo que la obligaba a ser
  pequeña —, así que **el anillo cambia de color en vez de la tarta de
  tamaño**: toma el acento, y dos formas que se cruzan con tonos distintos se
  leen como dos formas y no como un garabato. De paso, el día de hoy se ve; en
  Steel Frost apenas estaba.
- **Un acento responde "qué día" y el otro "qué tal fue".** Ice Blue Glacial
  rellena el día seleccionado, dibuja el anillo de hoy y el borde del botón que
  vuelve a hoy — los dos últimos hablan del mismo día, así que compartir color
  es el mensaje. Aqua Glaciar se queda para una sola cosa en la rejilla: el
  objetivo conseguido. En el botón va al borde y no a la palabra: los enlaces
  de texto de la app son Aqua Glaciar.
- **Y se ve también el día de su cumpleaños**, que era el único día en que no
  se veía: el calendario abre sobre hoy, el relleno del día seleccionado tapaba
  la marca de agua entera, y esa es precisamente la celda por la que existe la
  función. La tarta se dibuja dos veces — detrás en Steel Frost, y encima del
  relleno en la tinta oscura del número, a un quinto — recortada por el propio
  círculo. Las dos comparten centro, así que forman una sola tarta que cambia
  de tono al cruzar el círculo.

### Arreglado

- **Guardar se deshabilita al editar un registro que nadie ha cambiado**, como
  ya hacen los bloques de la ficha. Al añadir uno nuevo no: no hay versión
  guardada con la que comparar, y un paseo sin tocar es un registro completo a
  propósito.
- **Cada sheet metía todos sus controles dentro de un botón.** El scrim ganó el
  nombre accesible que le faltaba, y un `Pressable` con rol de botón se
  renderiza como un `<button>` de verdad en web — así que el panel entero
  quedaba anidado dentro. Solo se ve en web: React Native no tiene esa regla.

## [v0.6.0] — 2026-09-11

### Nuevo

- **El diario espera con la forma de lo que va a llegar.** Cambiar de día ya
  no deja los registros del día anterior bajo una cabecera que dice otra cosa:
  aparecen unos esqueletos en los mismos huecos que ocuparán las filas — hora
  y tipo a la izquierda, líneas de contenido y nota a la derecha — y el título
  "REGISTRO", que es cierto antes de que lleguen los datos. Se quedan quietos
  si el sistema tiene las animaciones desactivadas.
- **Cinco pulsaciones sobre la versión en Ajustes abren esto mismo.** El gesto
  de Android, y deja la línea pareciendo lo que es en vez de gastar una fila
  permanente de una pantalla de ajustes en algo que se lee dos veces al año.
  El texto viaja dentro de la app, leído al compilar: el momento en que
  alguien quiere saber si su móvil tiene el arreglo no es momento de depender
  de la red.

## [v0.5.0] — 2026-09-11

Ronda de revisión sobre la feature del diario, con dos evaluaciones
independientes y el móvil delante.

### Arreglado

- **El calendario mentía al pasar de mes.** Las flechas de la cabecera cambian
  el mes sin avisar a nadie — `onMonthChange` solo se dispara desde la lista de
  meses — así que las marcas se quedaban en el mes anterior y todas las celdas
  caían en la rama de "sin registros": el calendario afirmaba que en agosto no
  había pasado nada. Ahora se lee una ventana de 12 meses de una sola petición.
- **Un mes que no se pudo leer ya lo dice.** Un fallo de red y un mes tranquilo
  se dibujaban igual. En un producto cuya promesa es no perder registros,
  inventarse la pérdida es peor que admitir el fallo.
- **Marcar "Aproximado" en la ficha borraba la fecha de nacimiento.** El perfil
  llamaba a `toApproximateISO(mes, año)` contra una firma `(año, mes)`, que
  TypeScript no podía ver con dos números: producía `0009-2025-01`, que no
  parsea, y el campo se quedaba en su placeholder. La regla vive ahora en un
  solo sitio y la firma toma un objeto, así que el intercambio ya no se puede
  escribir.
- **Las 30 celdas del calendario estaban por debajo del suelo táctil de 48 dp**
  en el eje horizontal, en los dos calendarios de la app. La causa era el
  `p-0.5` del contenedor de celda, que se comía 3,5 dp de una columna que sí
  medía 48,1. Medido en el dispositivo: 44,6 × 42,5 antes, 48,3 × 52,6 después.
- **El scrim de cualquier sheet era el mayor control de la pantalla y no tenía
  nombre**: un lector de pantalla se encontraba un botón sin etiqueta cubriendo
  la página.
- La barra de objetivo del diario medía 3,38 dp y la del calendario 4,00 —
  documentadas como "el mismo elemento". `h-1` es 0.25rem y nativo resuelve
  1rem a 14.
- El calendario anunciaba "Objetivo conseguido" en la leyenda aunque no hubiera
  objetivo puesto, prometiendo una marca que nunca podía aparecer.
- **Pasada la medianoche no se podía volver al día real.** `today` se capturaba
  una vez, así que una sesión abierta a las 22:00 seguía llamando "Hoy" al día
  anterior y bloqueaba la flecha de avanzar. Ahora se relee al volver a primer
  plano, sin arrastrar al tutor fuera del día que estuviera leyendo.

### Cambiado

- Los iconos de sexo vuelven a los chips del perfil, que se habían quedado
  atrás respecto al formulario de alta.

## [v0.4.1] — 2026-09-11

### Arreglado

- **La duración de un paseo se borraba sola al cruzar la medianoche.** Subir
  +15 en un paseo terminado a las 00:20 ponía "23:35" en DESDE, y al salir del
  campo la duración se vaciaba y Guardar culpaba a un campo que nadie había
  escrito. Un paseo puede ser **un final y una duración**: cuando el inicio
  calculado se sale del día, no se escribe y la duración se sostiene sola.
- **Borrar DESDE tecla a tecla también tiraba la duración.** Un teclado real
  dispara un cambio por tecla, así que el campo pasa por "10:" y "1" camino de
  vacío; el `fill("")` de los tests es un solo evento y lo tapaba.

## [v0.4.0] — 2026-09-11

### Nuevo

- **El cumpleaños, en tres superficies y ninguna insiste.** Una tarta detrás
  del número del día en el calendario, la cabecera del diario pasa a ser del
  animal, el estado vacío lo dice, y confeti el día — una vez, recordado en el
  dispositivo para que los dos tutores lo reciban.
- **Cuenta atrás los quince días previos** bajo los datos de la ficha, en el
  acento secundario. Suficiente para comprar algo, poco para ser decoración
  permanente.
- **La tarta de la ficha es un emoji pulsable** que vuelve a lanzar el confeti.

## [v0.3.0] — 2026-09-10

### Nuevo

- **Navegación entre días**: flechas a ambos lados de la cabecera, sin futuro
  más allá de hoy, y un calendario que baja desde arriba al tocar la fecha.
- **El calendario dice qué pasó cada día**: incidencia en rojo, medicación en
  ámbar, objetivo cumplido con la propia barra del diario en miniatura. El tono
  se reserva para lo que es raro.
- **Se puede apuntar en un día pasado**: un diario cuyo martes olvidado no se
  puede rellenar castiga el olvido.
- **Botón "Hoy"** en el calendario, para volver desde cualquier día.
- **Confeti al registrar el paseo que alcanza el objetivo diario.**

### Cambiado

- La barra del objetivo se llena en un neutro claro y pasa al acento secundario
  al cumplirse. El verde salía dieciocho días de cada mes en el calendario, lo
  que lo convertía en el fondo en vez de la excepción.
- El registro y el calendario comparten vocabulario: el color de una marca es
  el color de la fila que la produjo, y el estado se llama igual en los dos
  sitios.

## [v0.2.0] — 2026-09-10

Primera versión numerada. El diario del día, la ficha del animal, los ajustes
y el alta con Google.
