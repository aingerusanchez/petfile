# El paseo no depende de la cobertura — diseño

**Estado:** diseño acordado con el tutor el 21 de octubre de 2026. Sin construir.
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

## Lo que este documento no decide

- La forma visual de la marca de pendiente.
- Dónde vive la cola en el dispositivo y qué garantías da.
- Si la sincronización se dispara por reintento manual, por foco, o por un
  detector de conectividad — y esa última palabra arrastra la discusión que ya
  tuvimos: **la app no sabe hoy si hay conexión**, solo descubre que una
  petición ha fallado.
- Qué pasa con un elemento de la cola que lleva días sin poder subirse.

## Lo que hay que respetar al construirlo

- **`start` y `stop` han reescrito el inicio de un paseo real dos veces en la
  historia de este proyecto.** Toda tarea que se acerque a ellos se sostiene en
  "puramente aditivo, ninguna línea existente movida", verificado línea a línea.
- La lógica pura va en `lib/` y se prueba con Jest; los flujos, con Playwright.
- Cuatro defectos de la v0.15.0 salieron del estado de carga del diario y
  **los cuatro fueron invisibles leyendo el código y visibles al ejecutarlo.**
  Cualquier cosa que toque ese estado se comprueba conduciendo la app.
