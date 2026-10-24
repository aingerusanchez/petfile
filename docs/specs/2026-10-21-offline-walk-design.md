# El paseo no depende de la cobertura — diseño

**Estado:** construido en la v0.23.0, el 23 de octubre de 2026. Las cuatro
decisiones de abajo siguen siendo las vigentes; lo que ha cambiado es que las
cuatro preguntas que este documento dejaba abiertas ya tienen respuesta, y
están escritas más abajo donde estaban las preguntas. **El alcance que se
acordó al escribir el plan, y que esta spec no decía, es solo la parada.**
**Origen:** la v0.15.0 arregló que un fallo de red no se llevara el diario por
delante, y la v0.16.0 y la v0.17.0 arreglaron cómo lo cuenta. Ninguna de las
tres arregla el problema de fondo: **el paseo de Loki se pierde si el teléfono
no llega al servidor en el momento de pulsar.**

## El porqué

El tutor pasea al perro en el monte y en el pueblo de al lado, y el móvil
pierde el wifi de casa al salir por la puerta. Es decir: **la cobertura falla
exactamente donde y cuando se usa el cronómetro.** Hoy un paseo que no se
puede escribir es un paseo que no existe, y la reacción natural —volver a
pulsar, o apuntarlo a mano al llegar— produce duplicados en el único registro
que esta app existe para mantener correcto.

## El principio que ordena todo lo demás

**La app usa lo que sabe y no rellena lo que no sabe.**

Las cuatro decisiones de abajo salen de aplicar esa frase. Donde el teléfono
tiene un dato registrado, lo usa sin preguntar; donde tendría que suponer, se
calla y deja la corrección al tutor. Esa línea es la que separa un diario
fiable de uno que inventa.

## Lo decidido

### 1. Actualización optimista, con la pendencia visible

El paseo aparece en el diario **como cualquier otro**, inmediatamente. Se da
por hecho el camino feliz porque es el que ocurre casi siempre y porque un
registro que aparece a medias es peor que uno que aparece y se corrige.

Pero lleva **alguna marca de que está pendiente de subir**. Dos razones, y la
segunda es la que la hace obligatoria: por honestidad, y porque esta ficha la
llevan dos tutores desde dos teléfonos — **cuando aparezca una incongruencia
entre lo que ve uno y lo que ve el otro, la marca es lo que la explica.** Sin
ella, el segundo tutor ve un diario que le falta algo y no tiene forma de
saber por qué.

La forma de la marca queda al diseño visual, no a este documento.

### 2. Un paseo en marcha sobrevive a la muerte de la app

Si el teléfono se queda sin batería con un paseo corriendo, **el paseo sigue
corriendo** al volver. No se cancela ni se cierra solo.

El tutor lo corrige si hace falta. Es un caso lo bastante infrecuente y
circunstancial como para que corregirlo a mano sea más barato —y más
honesto— que cualquier regla automática que acabe cerrando paseos buenos.

### 3. Dos teléfonos grabando a la vez no es un conflicto que resolver

Los dos tutores pueden empezar el mismo paseo desde sus móviles en momentos
distintos: uno al ponerle la correa, el otro al salir por la puerta. **Eso ya
puede pasar hoy**, sin nada de esto construido.

**Se quedan los dos registros.** No hay fusión, no hay detección de
solapamiento, no hay nadie que gane. El tutor lo ve y lo arregla.

La razón es la del principio: resolverlo automáticamente exige decidir cuál de
los dos es el bueno, y la app no lo sabe. **Gestionar ese error genera otros.**

### 4. La hora de fin es la del intento de parar, sin preguntar

Cuando se pulsa parar sin red, el teléfono **registra ese instante**. Al
sincronizar más tarde, el paseo se anota con esa hora, directamente.

Se consideró ofrecerlo y que decidiera el tutor, y se descartó: **es un dato
guardado, no una suposición**, y el diario ya es corregible en todas partes —
tocar la fila reabre la hoja que la creó. Añadir una pregunta a un dato que la
app tiene sería pedir permiso para acertar. Si la hora resulta estar mal, el
tutor la corrige después, como cualquier otro registro.

Esto no contradice el punto 2 ni el 3: allí corregir sería inventar, aquí es
usar lo que se tiene. **Esa es la línea, y es la única que hay que defender.**

## Lo que este documento no decidía, y quedó decidido al construirlo

- **La forma de la marca:** una nube tachada en ámbar, a 16, delante del
  título de la fila y dentro de su línea. Se eligió sobre un prototipo en el
  tablero con una fila pendiente entre filas normales, porque aislada no se
  juzga. **El glifo va delante y la palabra va detrás:** el ojo necesita
  dónde engancharse, pero una frase que abriera por la excepción anunciaría
  el fallo antes de nombrar la cosa de la que habla, así que lo que se lee en
  voz alta termina en «no sincronizado». Se dibujaron y se descartaron dos
  variantes: atenuar la fila entera, que obligaba a bajar la hora a un gris
  que no pasa AA, y una escalada a ámbar a las seis horas — **el problema es
  que no ha subido, no desde cuándo**.
- **Dónde vive la cola:** en `AsyncStorage`, junto al paseo en marcha, bajo
  una clave con versión (`petfile.pending.v1`). Es un hecho sobre la app y no
  sobre el perro, y por eso **no lleva día**: añadida entera, la parada de
  anoche aparecería en cualquier día al que lleguen las flechas. Qué paradas
  son de la pantalla lo dicen las filas de ese día. Lo que lee el disco no se
  fía de lo que encuentra y no puede lanzar: esto corre en el arranque, y un
  parseo que lanzara se llevaría el diario por delante.
- **Qué la dispara:** una lectura del día que ha salido bien, que es lo que
  resultaron ser los tres disparadores del plan —volver a la app, el
  `Reintentar` del registro, el gesto de arrastrar— más uno que el plan no
  tenía, **abrir la app en frío**, donde `AppState` no dispara y la cola y la
  lectura llegan en el orden que decida el teléfono. **Ningún detector de
  conectividad**, por lo que esta misma sección ya decía: la app no sabe si
  hay conexión, solo descubre que algo ha funcionado. Y **ningún botón
  manual**, que es la decisión que más conviene poder reabrir: un botón solo
  ayuda si los automáticos no se disparan, y entonces lo que hay que arreglar
  son los disparadores. Lo que reabriría la discusión es ver la marca
  sobrevivir a varias aperturas de la app con cobertura.
- **Un elemento que lleva días sin subir se sigue reintentando y no se tira
  nunca**, porque es un paseo que el perro dio. Lo único que sale de la cola
  sin haberse escrito es lo que ya no puede escribirse —la fila que el otro
  móvil borró— y eso se dice en voz alta. La única excepción, documentada en
  `lib/pending.ts`, es un elemento almacenado que no se puede ni leer: no se
  puede anunciar lo que no se puede leer, porque no queda nada que nombrar.

## Lo que sigue sin estar cubierto

- **El arranque.** Empezar un paseo sin cobertura falla como siempre. Lo que
  hace la parada resoluble es que la fila ya existe en el servidor, así que
  la intención guardada es «cierra esta fila a esta hora» y se reproduce tal
  cual. Un arranque exigiría una identidad inventada por el teléfono y luego
  reconciliarla, que es otro problema.
- **Una carrera estrecha, conocida y abierta a propósito:** si una lectura de
  ese mismo día está en vuelo cuando aterriza el PATCH de la subida, puede
  volver con la fila todavía abierta y pisar el parche local — la medida se
  queda corta hasta la siguiente lectura de ese día. Cerrarla pedía mantener
  la parada en la cola hasta que las filas la confirmasen, bastante más
  maquinaria de la que el defecto merece.

## Lo que hay que respetar al construirlo

- **`start` y `stop` han reescrito el inicio de un paseo real dos veces en la
  historia de este proyecto.** Toda tarea que se acerque a ellos se sostiene en
  "puramente aditivo, ninguna línea existente movida", verificado línea a línea.
- La lógica pura va en `lib/` y se prueba con Jest; los flujos, con Playwright.
- Cuatro defectos de la v0.15.0 salieron del estado de carga del diario y
  **los cuatro fueron invisibles leyendo el código y visibles al ejecutarlo.**
  Cualquier cosa que toque ese estado se comprueba conduciendo la app.
