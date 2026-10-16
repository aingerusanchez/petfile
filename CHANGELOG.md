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

## [v0.12.0] — 2026-10-16

### Nuevo

- **Un tratamiento apuntado en Salud sale en el diario del día en que se
  puso.** Se volvía del veterinario con la pastilla, se apuntaban el peso y el
  "Milbemax 125mg" en Salud, y ni el diario ni el calendario sabían nada: el
  mismo hecho se tecleaba otra vez como Medicación, y dos filas para un dato
  quedaban a un descuido de contradecirse en cuanto alguien corrigiera la dosis
  en una sola. Ahora el pie del registro de ese día lista los tratamientos
  puestos en él, **debajo de las entradas con hora y separados por una línea
  fina**. Es una lectura de la misma fila, así que no hay segunda copia que
  pueda quedarse vieja: corregir la dosis en Salud la corrige en el diario.
- **No tienen hora, y no se inventa una.** `administered_on` es un día, no un
  instante: nadie apuntó a qué hora fue, y ponerla delante sería mentir en una
  app cuya promesa es que el registro es cierto. La columna de la izquierda
  lleva solo el icono del tipo —el mismo de Salud, en el ámbar del anillo que
  ese día lleva en el calendario— y la fila dice el nombre y debajo el tipo con
  su próxima fecha: "Desparasitación (Int.) · próxima 14 ene". Si no hay
  próxima, solo el tipo. **Es de solo lectura aquí, y un chevron lo dice:**
  tocarla lleva a Salud, abierta sobre la hoja de ese tratamiento y no sobre la
  pestaña, que es donde se corrige o se borra. El parámetro se suelta en cuanto
  se usa, así que ir y volver no la reabre.
- **El calendario marca el día de un tratamiento con el anillo de medicación.**
  Para una casilla un tratamiento es el mismo hecho que una Medicación —algo
  médico pasó ese día—, así que se suma a esa marca en vez de estrenar otra:
  una marca, un significado. Se comprobó contra la regla de la frecuencia antes
  de aceptarlo: un antiparasitario mensual son doce días de ámbar al año, que
  es puntuación y no fondo. La marca de vacuna no cambia. Los tratamientos solo
  marcan dentro del año que el calendario lee, porque fuera de él no sabe qué
  se paseó y dibujaría ese día como "objetivo sin conseguir"; y no marcan nada
  hasta que ese año de entradas llega, por lo mismo.

### Cambiado

- **Un día cuyo único registro es un tratamiento ya no dice que no pasó nada.**
  La pantalla decidía que el día estaba vacío mirando solo las entradas con
  hora, así que el día del Milbemax mostraba el tratamiento y a la vez
  afirmaba "Ese día no se apuntó nada". Ahora el día está vacío cuando no hay ni
  entradas ni tratamientos. Y si los tratamientos no se han podido leer, no se
  dice "vacío" tampoco: se dice que no se han podido leer, con Reintentar.
- **Los tratamientos se leen una vez, no al abrir el calendario.** Hasta ahora
  la lista solo se pedía al abrirlo, para pintar las vacunas; el diario la
  necesita siempre, así que se lee al entrar en la pestaña y cada vez que se
  vuelve a ella —que es como se entera de lo corregido en Salud— y alimenta a
  la vez el pie del día, las marcas y las vacunas. Una sola lectura no puede
  contradecirse a sí misma. Sigue sin haber tabla nueva ni migración.
- **El registro del día no espera a los tratamientos para pintarse.** Son dos
  peticiones a la vez, y poner la segunda por delante dejaba un día cuyas
  entradas habían llegado en un suspiro esperando hasta doce segundos —y, peor,
  escondía detrás de esa espera el aviso de que el registro no se había podido
  leer, con su Reintentar—. Las entradas salen en cuanto llegan y el pie del
  día aparece debajo cuando puede. Lo único que espera es decir que el día está
  vacío, porque eso sí depende de la respuesta que falta.
- **Reintentar vuelve a leerlo todo**, tratamientos incluidos. Recuperada la
  conexión, el botón de la pantalla traía la mascota, el registro y el
  calendario y dejaba el pie del día roto con su propio botón aparte, que se
  lee como que el reintento no funcionó.

## [v0.11.0] — 2026-10-16

### Cambiado

- **La duración de un paseo ya no se teclea, y los botones -15 / +15 se
  van.** La duración podía escribir en una hora, y de ese acoplamiento salieron
  los dos defectos graves del cronómetro: uno destruía el inicio real de un
  paseo en marcha y el otro lo iba retrasando a cada pulsación. En tres semanas
  de uso real nadie tocó los botones; el camino rápido resultó ser teclear las
  dos horas. El campo **sigue ahí y se lee solo**: se calcula a partir de DESDE
  y HASTA, con el aspecto de un valor y no de un control apagado. Un paseo que
  ya estaba guardado con una duración y una sola hora —el que cruzó la
  medianoche— se abre y se guarda igual que antes.
- **Un paseo en marcha no deja cambiar sus horas.** Con la hoja abierta sobre
  el paseo que este móvil tiene en curso, DESDE, HASTA y la duración quedan
  bloqueados —y se ven bloqueados los tres, que la duración se quedara con el
  tono normal hacía que el único campo que nunca se teclea pareciera el más
  editable—, y los relojes de al lado también: un campo bloqueado cuyo reloj
  se abre es peor que no bloquearlo. La nota y la kaka siguen libres, que es
  para lo que se toca la fila a mitad de paseo. El precio, aceptado: si se
  pulsó Empezar cinco minutos tarde, no se corrige hasta parar el paseo.
- **"En marcha" lleva el acento**, como la hora y el icono que tiene al lado.
  Las palabras no cambian.
- **El botón del paseo se lee como un botón.** Con la letra al 130 % era texto
  en Aqua junto a texto en blanco, y nada decía que se pudiera pulsar. Ahora es
  una píldora: **con borde cuando no hay paseo, rellena mientras lo hay**, la
  misma regla que ya aplican el día seleccionado, la pestaña activa y el tramo
  elegido de un selector —lo elegido es lo relleno—. El borde está siempre, de
  modo que al rellenarse no cambia de tamaño. **El triángulo y el cuadrado son
  macizos**: el cuadrado hueco se leía como una casilla de verificación sobre
  fondo oscuro, y un control de reproducción se reconoce por la forma llena. En
  la píldora rellena el cuadrado es del color del fondo, como un agujero
  hecho en ella.
- **Un punto que late sustituye a la barra que respiraba.** Contra un objetivo
  de 3 h en una barra de 327 dp, el tramo del paseo en marcha mide 3,6 dp a los
  dos minutos y 38 a los veintiuno: ahí no cabe una animación, y justo en los
  primeros minutos es cuando más se quiere saber si el paseo se ha anotado.
  Un punto Aqua de 8 dp delante de "De paseo" mide lo mismo dure lo que dure el
  paseo. El tramo de la barra se queda, quieto, porque dice cuánto se está
  acumulando. Con "quitar animaciones" el punto se queda a opacidad completa:
  el caso estático tiene que verse más, no menos. Para un lector de pantalla es
  decoración, porque "De paseo" ya lo dice. **Late sin apagarse y suelta una
  onda**: fotografiado en el móvil, el punto se pillaba en lo más bajo del
  latido y se leía gris, porque con el 30 % de opacidad el Aqua mide 2,04:1
  contra el fondo; ahora baja solo hasta el 55 % (4,09:1). Del punto sale un
  anillo que se abre y se desvanece, en el mismo ciclo, y no mueve nada: crece
  por transformación dentro de un hueco fijo de 8 dp. Con "quitar animaciones"
  no hay anillo y el punto queda a opacidad completa.

### Arreglado

- **Parar un paseo justo después de anotarlo podía borrarlo.** Al parar dentro
  del primer minuto, la app decide si el paseo es un toque por error mirando la
  fila tal como llegó la última vez, y entre guardar la nota y recargar el día
  —casi siempre menos de un segundo— esa fila aún no tenía la nota. Ahora
  guardar la hoja sobre el paseo en marcha lo cuenta como escrito, y se cierra
  con un minuto en vez de desaparecer.
- **Un DESDE vaciado dejaba una duración que no se podía quitar.** Con el campo
  de duración ya sin teclado, vaciar el inicio y escribir otra hora de vuelta
  dejaba detrás una duración medida desde un inicio que ya no estaba en el
  formulario. Ahora la duración se va con el inicio de donde se leyó; con un
  DESDE y sin HASTA se queda, porque ahí la duración es el dato.
- **El reloj no recalculaba la duración.** Cambiar una hora con la esfera en
  vez de con el teclado la escribía directamente en el campo, así que un paseo
  guardado de 10:00 a 10:45 al que se le movía la vuelta a las 11:00 seguía
  diciendo "45 min" mientras se guardaban 60. Con la duración ya sin teclado
  ese número equivocado se veía y no se podía corregir.
- **Un campo de solo lectura no decía que lo fuera.** La duración se anunciaba
  como un campo normal que se niega a recibir texto; ahora dice "solo lectura"
  en su nombre accesible, que es el único sitio donde cabe decirlo en los dos
  sistemas.
- **Un paseo que cruzó la medianoche podía perder su duración.** Escribir en
  HASTA la hora de vuelta real —las 00:10 de un paseo que empezó a las 23:40—
  vaciaba el campo, y volver a dejar HASTA en blanco lo dejaba vacío: al
  guardar, el paseo se quedaba sin los treinta minutos que sí estaban
  grabados. Una hora de vuelta anterior a la de salida es un dígito mal
  tecleado a medio escribir, no un error: la última lectura buena se queda.
- **Empezar un paseo no daba señal de estar trabajando.** El botón ya no
  desaparecía durante la escritura, pero se quedaba quieto y apagado: con una
  sola raya de wifi en el portal son varios segundos de un botón que parece
  muerto, y un control presente pero inerte es lo que hace que alguien lo pulse
  otra vez, que es justo cómo se empieza dos veces el mismo paseo. Ahora el
  icono se cambia por un indicador de actividad mientras dura la escritura, en
  su misma caja, y la etiqueta sigue siendo "Paseo": el bloque no se mueve.

## [v0.10.0] — 2026-10-15

### Nuevo

- **Los paseos se pueden cronometrar.** El bloque del objetivo gana un botón:
  al salir de casa se pulsa y el paseo queda abierto con su hora de inicio
  real, al volver se pulsa otra vez y la fila recibe su duración. Hasta ahora
  la única forma de no perder esa hora era crear el paseo en la calle con una
  hora de vuelta provisional y corregirla al llegar. **No hay esquema nuevo:**
  un paseo en marcha es una fila con inicio y sin duración, y el móvil solo
  recuerda su identificador, de modo que el inicio sigue viviendo donde está el
  dato.
- **El paseo en marcha se puede anotar sin esperar.** Aparece en el registro
  como una fila más —"En marcha"—, así que la kaka de mitad de paseo se apunta
  donde se apunta siempre. Una pulsación y otra dentro del mismo minuto es un
  toque por error, y lo honrado es no dejar nada: la fila se va con ella —
  **salvo que lleve algo escrito**. Si en ese minuto se ha anotado una nota o
  una kaka, borrarla se llevaría por delante algo que alguien tecleó, así que
  el paseo se cierra con un minuto, que es lo más corto que admite la ficha.

### Arreglado

- **Un paseo que cruza medianoche no se podía guardar.** La hoja exigía la
  hora de vuelta sin condiciones y la leía contra el día en pantalla, así que
  un paseo de 23:40 a 00:10 se rechazaba a sí mismo: bastaba abrirlo, cambiar
  cualquier cosa y pulsar Guardar para oír que el inicio tenía que ir antes de
  la vuelta. Ahora **un paseo necesita dos horas, o una hora y una duración**.
- **Una hora de vuelta mal escrita se descartaba en silencio.** Al relajar la
  regla anterior, un HASTA que no se entendía quedaba como "sin hora de vuelta"
  y el paseo se guardaba sin el único dato que se había tecleado. Solo un HASTA
  _vacío_ puede sustituirlo el DESDE; uno escrito y ilegible se rechaza en su
  campo. Y un inicio en el futuro, que ahora es lo que se guarda cuando no hay
  vuelta, recibe la misma comprobación que ya tenía la vuelta: "¿Todavía no
  habéis salido?".
- **Borrar la duración borraba la hora de salida.** Mientras la vuelta era
  siempre el ancla, vaciar la duración vaciaba el DESDE que se había calculado
  a partir de ella, y eso era lo correcto. Con la vuelta vacía —un paseo en
  marcha, uno que cruzó medianoche— el ancla es justo la otra, así que lo que
  se borraba era el inicio real y lo que quedaba en pie era la hora derivada:
  Guardar archivaba el paseo bajo una hora que nadie había tecleado. Ahora se
  vacía el campo derivado y nunca el ancla.

### Cambiado

- **El bloque del objetivo aparece aunque no haya objetivo.** La actividad
  diaria es un campo opcional, y quien no lo había rellenado no veía el bloque
  —ni, por tanto, habría tenido dónde empezar un paseo—. Sin objetivo se lee
  "30 min paseados", sin el día: el bloque también sale en días pasados y la
  cabecera ya dice cuál es. No hay barra; el esqueleto de carga lo respeta.
- **"Objetivo conseguido" pasa de al lado de la medida a debajo de la barra.**
  El hueco de la derecha ya es del botón, y una etiqueta que a veces está al
  lado y a veces debajo serían dos diseños para una misma frase. Ahora tiene un
  solo sitio, todos los días.

## [v0.9.0] — 2026-09-13

### Cambiado

- **La paleta tenía dos acentos y en realidad era uno.** Ice Blue Glacial y
  Aqua Glaciar median **1,34:1 entre sí y 23° de tono**: un color con dos
  nombres, y por eso "primario" y "secundario" no se leían nunca como dos
  decisiones. **Ice Blue Glacial se retira.**
- **Aqua Glaciar pasa a ser el único color de cada día**: enlaces, títulos de
  sección, barra de objetivo cumplido, pestaña activa y todos los estados
  seleccionados —un chip, un día, un segmento, un número en la esfera del
  reloj—. Un color, un nombre: el token es `accent` a secas, porque
  `accent-primary` y `accent-secondary` dejaban de nombrar dos cosas en cuanto
  valían lo mismo.
- **Y entra Aurora Boreal (#A78BFA), que se gasta en tres sitios y en ninguno
  más**: el botón principal, el botón flotante y el cumpleaños. **La
  exclusividad es la función entera**: no gana por ser más brillante —mide
  menos que Aqua contra el fondo, 6,92:1 frente a 11,08:1— sino por ser lo
  único en la pantalla que lo lleva. Un cuarto sitio valdría la mitad; un
  décimo lo convertiría en un color de marca, que es en lo que Ice Blue Glacial
  se había convertido sin que nadie lo decidiera.
- **Se probaron tres repartos de la pareja en el móvil antes de elegir.** Los
  dos descartados ponían el tono nuevo en los títulos y la barra de objetivo, o
  en todos los estados seleccionados; en los dos dejaba de ser puntuación y
  pasaba a ser la textura de fondo de la app. **El contraste no fue la puerta**
  —todos los candidatos pasaban de sobra en las dos superficies—, lo fue la
  frecuencia: cuántos días al mes lleva un color cada cosa.
- **La tarta del calendario estrena color y casi cuesta la fecha.** Opaca,
  Aurora Boreal deja el número del día a **2,48:1** sobre sus trazos: por
  debajo del mínimo, y medido en el móvil contra la ficha real la casilla se
  leía como una tarta que además tiene una fecha dentro. Al **60%** la tarta
  queda en 3,11:1 —el doble de presente que el Steel Frost que llevaba— y el
  número vuelve a 4,99:1. El cumpleaños se queda el color escaso; la fecha se
  queda la casilla.

## [v0.8.0] — 2026-09-12

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
- **La curva de peso dice cuánto y desde cuándo.** Salió sin un solo número
  encima, y una línea que solo dice "hacia arriba" responde a una pregunta que
  nadie hizo: de una curva de crecimiento se leen _cuánto_ subió y _en cuánto
  tiempo_. Los extremos del rango a la izquierda, el primer y el último mes
  debajo, y un punto por pesaje — que es lo único que distingue siete medidas
  de una curva dibujada a mano. Sin ejes ni rejilla: el marco de un gráfico
  cuesta más sitio del que devuelve a este tamaño.
- **Las notas admiten Markdown.** Negrita, listas y párrafos en las notas de
  paseo, de peso y de tratamiento — que es donde acaba "**Cojea** de la pata
  derecha" o la lista de síntomas de una visita. Quien escriba una frase normal
  recibe su frase tal cual, que es todo el trato de escribir Markdown a mano.
  **No hay editor**: el campo es un textarea de tres líneas, sin barra de
  herramientas ni vista previa. El renderizador es el que ya tenía el
  changelog, extraído el día que una nota lo necesitó.
- **Y cada lado lleva su icono: un fonendoscopio y una sirena.** El par tiene
  que leerse como un contraste —atención de siempre contra urgencia— y no como
  dos iconos médicos; una luz de emergencia es lo único en una pantalla oscura
  que no hay que descifrar. Le costó el fonendoscopio a la línea de la persona,
  que era el mismo icono diciendo "a quién preguntáis" seis líneas más abajo:
  una persona con nombre es un `User`. Y la pestaña se llama **Veterinaria**,
  que es la clínica; el veterinario o la veterinaria con nombre es el campo de
  dentro. De paso, "Urgencias guardado" pasa a "Urgencias guardadas": la app
  estaba hablando de un femenino plural en masculino singular.
- **El horario de la clínica se escribe en varias líneas.** "L-V 10:30-14:00,
  15:00-19:30, S 10:00-13:00" es una línea que hay que descifrar cada vez que
  se lee; lo mismo hacia abajo se ojea. El campo pasa a ser un textarea con
  Markdown y su misma ayuda —un guion por día es una lista—, y el icono del
  reloj se alinea con la primera línea en vez de quedarse flotando a la altura
  del miércoles. **Aquí un salto de línea sí es un salto de línea**: en una
  nota escrita en el móvil los saltos son accidentes del ancho de la pantalla y
  se unen, que es lo que hace el propio Markdown; en un horario no hay ni uno
  accidental.
- **El selector de las dos clínicas invierte el lado activo.** Empezó como dos
  fichas con borde, que mantenían las dos etiquetas en pantalla pero lo decían
  como dos botones grandes —el acontecimiento principal de la tarjeta— cuando
  son un ajuste con dos lados. Ahora es una pista unida en la que el lado vivo
  se rellena de Ice Blue Glacial con el texto oscuro. **Un selector sutil no
  existe en esta paleta**: Elevated Frost sobre Fjord Slate mide 1,16:1, el
  mismo escalón imperceptible que obligó a las fichas a cambiar de grosor en
  vez de de fondo, así que invertir es lo único que de verdad se lee. Y no es
  una idea nueva: el día elegido del calendario y el número elegido del reloj
  ya son un relleno del acento con el texto en oscuro.
- **Las dos clínicas en una tarjeta, con un selector.** Salud es larga —lo que
  toca, el peso y su línea, el historial, las enfermedades— y dos clínicas al
  pie eran dos bloques más que recorrer; son la misma pregunta hecha dos veces.
  **Y "Copiar de la veterinaria"** en el hueco de urgencias, porque una clínica
  con 24h contesta a las dos y teclear los mismos cuatro campos otra vez es la
  tarea que acaba con la segunda ficha vacía.
- **El marcador estaba invisible para la app.** Android 11 oculta lo que no se
  declara en `<queries>`, el manifiesto que genera Expo solo declara `https`, y
  `Linking.openURL("tel:…")` no podía resolver ninguna actividad: la promesa se
  rechazaba y el toque en el teléfono de la clínica no hacía absolutamente
  nada. Sin fallo, sin log, sin marcador. Un plugin de configuración declara el
  esquema, y lo que no se pueda abrir ahora lo dice en vez de callarse.
- **Las dos clínicas, siempre en pantalla.** Veterinario y Urgencias, con el
  teléfono pulsable para llamar y la dirección para abrir el mapa. Vacías
  preguntan en los términos de la casa — "la clínica de siempre, la que conoce
  a Loki" — porque nombrar al perro es lo que convierte un campo en una
  pregunta que alguien puede contestar, y se ofrecen a rellenarse — **no están detrás del botón
  flotante**: un veterinario es una propiedad del animal, no un registro que
  se acumula, son exactamente dos, y la de urgencias la lee alguien asustado.
  Una tarjeta que hay que descubrir antes de poder rellenarla es una tarjeta
  vacía la noche que hace falta.
- **El teléfono no se inventa prefijo.** "944 26 00 51" marca desde una SIM
  española tal cual está escrito; ponerle +34 a un número que alguien escribió
  sin él es adivinar en qué país está el móvil, y equivocarse una vez es que
  la llamada falle en el momento que más importa. El que se escriba con
  prefijo lo conserva.
- **Y las horas ganan su propio selector: un reloj.** Mismo trato que las
  fechas —el campo sigue escribiéndose, "915" son dos segundos, y el icono al
  lado es la alternativa para el pulgar que prefiere apuntar—, pero la primera
  versión era una tira de fichas de hora y una rejilla de minutos: correcta,
  legible, y un control que nadie había usado nunca. Una esfera con una aguja
  no hay que aprenderla, y contesta "¿mañana o tarde?" con su forma antes que
  con un dígito. Se toca un número o se arrastra la aguja, y elegir la hora
  pasa el turno a los minutos. **Una corona y un interruptor, no dos coronas**:
  el reloj de 24 horas de Material mete un segundo anillo dentro del primero y
  en este móvil eso deja los números a 38 dp, por debajo del suelo de 48 que se
  respeta en toda la app; así que la esfera lleva doce marcas y un interruptor
  dice de qué mitad del día son. La aguja no se mueve al cambiar de mitad —las
  09 y las 21 son el mismo sitio en un reloj—, que es justo por lo que el truco
  funciona. Un minuto sin número —09:47— se conserva en vez de redondearse, con
  la punta de la aguja marcando dónde cayó: abrir un selector no puede editar
  en silencio un valor que nadie le pidió tocar.
- **Las fechas se escriben, y el calendario queda detrás de su icono.** Todas
  pasaban por tres toques en un calendario, incluidas las que uno ya sabe — una
  fecha de nacimiento de hace cuatro años es un año de pasar meses. Ahora el
  campo toma `DD/MM/AAAA` (o los ocho dígitos seguidos, que es lo que da un
  teclado numérico) y el icono abre el calendario para las fechas que es más
  fácil señalar que deletrear. **Sin máscara en vivo**: meter las barras según
  llegan los dígitos se construyó y se retiró aquí para las horas — un
  `TextInput` enfocado en Android ignora lo que la capa JS reescribe —, así que
  se ordena al salir del campo, que es la corrección que la plataforma sí
  respeta. Una fecha que no existe lo dice; el modo aproximado sigue siendo un
  botón, porque un mes y un año no se teclean.
- **La ayuda de Markdown se mete en el propio textarea**, en su esquina
  inferior derecha y difuminada, como el icono de pantalla completa de la
  gráfica. Estaba apilada sobre el botón de la kaka, donde se leía como un
  segundo control del formulario y no como algo del campo — y la suma de los
  dos iconos no cuadraba con el alto del textarea. El icono pasa de una "T" a
  un libro: una letra es lo que parece un control de _formato_, y esto no
  formatea nada, explica. Su sheet gana la X que le faltaba.
- **El teléfono se agrupa como se escribe un teléfono aquí**: "944 26 00 51",
  tanto al leerlo como al salir del campo. Lo que no son nueve dígitos se deja
  intacto — una extensión, dos números en un campo o una clínica extranjera son
  respuestas de verdad, y darles forma sería adivinar una convención que no
  conocemos.
- **El formulario de tratamiento tiene una sola fecha.** Dos campos de fecha
  idénticos, uno encima del otro, y el que se rellenaba era siempre el
  segundo: la fecha que acaba de decir el veterinario es la primera. La
  siguiente pasa a ser una frase — "La siguiente tocará el 12 de diciembre,
  cada 3 meses" — con un "Cambiar" que saca el campo solo para quien no esté
  de acuerdo. Lo que la app calcula deja de pedirse, y lo que dijo el
  veterinario se sigue guardando tal cual.
- **La lista de tratamientos espera con su propia forma**, en Salud y en el
  historial: es la pantalla donde una espera dura más, y un spinner a pantalla
  completa se habría llevado por delante el buscador y los filtros que el
  tutor acaba de usar.
- **La gráfica de peso se abre a pantalla completa.** La miniatura contesta
  "hacia dónde"; la pantalla contesta "cuándo y cuánto", con todos los pesajes
  etiquetados, los meses de referencia y scroll lateral cuando el historial es
  largo. Un icono de maximizar en la esquina dice que la línea es una puerta.
- **Las notas explican su formato.** Un botón junto al textarea abre cuatro
  ejemplos con lo que teclearías y en lo que se convierte — renderizados por
  el mismo componente que pinta las notas, así que un formato que dejara de
  funcionar dejaría de funcionar también en su propia ayuda.
- **Una enfermedad se presenta por su nombre**, no por su nota. El dato ya
  existía: "Qué ha pasado" es el campo de la incidencia en el Diario, y la
  sección de Salud abría con el protocolo del veterinario — contestando "cuál
  fue el tratamiento" a quien preguntaba "qué tuvo".
- **El selector de fecha empieza la semana en lunes**, como el calendario del
  Diario ya hacía. La misma app enseñaba dos semanas distintas.
- El icono de pantalla completa de la gráfica se montaba encima del último mes
  de referencia.
- La frase de la próxima fecha y su botón estaban ni en columna ni en línea: el
  enlace caía donde rompiese la frase. Ahora la frase ocupa lo suyo y el
  control se alinea a la derecha, que es donde está en el resto de la app. Y se
  llama **Editar**.
- **Una pantalla con scroll termina por encima del botón flotante.** El Diario
  se libraba porque el registro de un día es corto; el historial de
  tratamientos no: medido en el dispositivo, las dos últimas filas tenían la
  fecha detrás del botón — la mitad de una fila que a nadie se le ocurre
  desplazar para ver.
- Una nota larga en ENFERMEDADES se corta a tres líneas. El protocolo entero
  del veterinario es justo lo que hay que escribir en una nota, y justo lo que
  no puede ocupar cinco líneas en una sección que resume; el texto completo
  está a un toque, en su día.
- **Las enfermedades se leen en Salud**, aunque se escriban en el Diario. Una
  incidencia pasa a una hora de un día y se apunta donde el tutor ya está;
  pero "¿cuándo fue lo del oído?" es una pregunta de salud, y recorrer un
  calendario hacia atrás no es una respuesta. Cada una lleva a su día, que es
  donde está la medicación que la acompañó.
- **Un solo header para las pantallas fuera de las pestañas.** Ajustes apilaba
  un enlace "Perfil" sobre su título y Tratamientos ponía una flecha al lado
  del suyo: las dos funcionaban y juntas parecían dos apps. Gana la de al
  lado, que gasta una línea donde la otra gasta dos, y el nombre del destino
  no se pierde — se va al nombre accesible, que es quien de verdad lo
  necesita.
- **El calendario del Diario marca los días de vacuna**, puestos y próximos,
  con una jeringuilla detrás del número igual que la tarta del cumpleaños — y
  por la misma razón: una marca se gana una celda siendo la excepción, y
  pasados los primeros meses una vacuna es casi anual. Las desparasitaciones y
  los pesajes no salen: serían doce y veintiséis marcas al año en una rejilla
  cuyas marcas significan "aquí pasó algo". El día que coincida con el
  cumpleaños gana la tarta.
- **El historial de tratamientos tiene pantalla propia, con filtro y
  búsqueda.** Nueve meses de un cachorro ya son quince filas, once de ellas
  abriendo con las mismas tres palabras: una sección no se recorre buscando "la
  del Panacur". El tipo filtra y el texto busca, porque son preguntas
  distintas — una es "enséñame las desparasitaciones" y la otra "dónde sale
  Panacur". La búsqueda entra en el nombre, en la nota (que es donde acaba el
  diagnóstico) y en la palabra del propio tipo, y **se salta los acentos** que
  el teclado no ofreció: buscar "desparasitacion" no puede decir que la palabra
  no aparece en una lista donde sale once veces. La sección se queda con los
  cinco últimos y un "Ver más" para ver el resto.
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
