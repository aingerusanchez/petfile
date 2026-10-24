# Dónde acaba cada paseo — diseño

**Estado:** acordado con el tutor el 24 de octubre de 2026. Sin construir.
Las tres variantes están dibujadas en el tablero, en la columna de
experimentos, con los tres días que las deciden.

**Origen:** idea del tutor al cerrar la v0.24.0. La propuso como marcadores
sobre la barra —«tipo los de Google Maps pero minimalistas»— y la conversación
la convirtió en otra cosa.

## El porqué

La barra dice **cuánto**. No dice **en qué trozos**. Y hay una asimetría que
ya existe: las palabras de encima cuentan los paseos —«1h 25m en 3 paseos»— y
la barra de debajo no los distingue.

Para esta casa eso es información que no está en ningún sitio glanceable. Tres
o cuatro paseos al día, dos tutores: ver de un vistazo que el día fue «uno
largo y dos cortos» frente a «tres iguales» dice algo sobre cómo ha ido el día
que el total no dice.

El registro, justo debajo, lo lista todo. Pero listarlo no es verlo.

## El principio que ordena todo lo demás

**No es una marca nueva: es la que ya hay, generalizada.**

El tick que hoy dibuja la barra marca **dónde acaban los minutos grabados**
mientras un paseo corre. Ese punto es, exactamente, la frontera entre el
paseo anterior y el que está en marcha. Cuando el paseo se guarda, ese mismo
punto pasa a ser la frontera entre dos paseos grabados.

Dicho de otra forma: **el tick ya es un corte**, dibujado en un solo sitio y
solo durante un rato. Lo que esta funcionalidad hace es dejarlo dibujado en
todas las fronteras y todo el tiempo.

Eso convierte la pregunta «¿cómo conviven las marcas nuevas con el tick?» —que
era la objeción más seria contra la idea— en «no hay marcas nuevas».

## Lo decidido

### 1. Un corte en cada frontera entre paseos

Una línea vertical de **2 dp** que atraviesa la barra en el punto donde acaba
cada paseo. El último paseo no lleva corte: su final es el filo del relleno,
que ya se ve.

**2 dp y no 2,5**, que es lo que el prototipo dibujó. El tick mide 2 y está
verificado en el dispositivo; inventar un ancho nuevo para la misma marca
sería tener dos.

### 2. El corte va al color de la pista, y eso cambia el tick

`#131C2E`. Contrasta contra las cuatro superficies sobre las que puede caer
—Mist, el tono del tramo en curso, el fondo Aqua del objetivo cumplido y el
violeta de la segunda vuelta— y dice «aquí no hay nada» con el color que la
barra ya usa para eso.

**No es transparente, es pintado**, y la diferencia importa: un hueco de
verdad enseñaría lo que haya debajo, que en la segunda vuelta es Aqua detrás
del violeta. Poco contraste, y además una marca que cambia de color según la
capa.

Tampoco al color de la pantalla, que es lo que el prototipo hizo primero: eso
ata la barra a estar siempre sobre ese fondo.

**Y esto cambia el tick que hoy existe, que es blanco (`#F1F5F9`).** El
cambio es a mejor y conviene decir por qué: hoy el tick es _más claro_ que
las dos cosas que separa, y contra Mist eso es un contraste de alrededor de
1,4:1. Un corte oscuro contra Mist es muy superior. El tick era blanco porque
solo tenía que vivir sobre dos tonos claros; el corte tiene que vivir sobre
cuatro.

**Es un cambio de comportamiento sobre algo enviado, así que se verifica en
el dispositivo antes de darlo por bueno.** Es lo primero que hay que mirar.

### 3. Los cortes de una vuelta cumplida se quedan sobre el fondo

Aquí está lo que salva la idea, y es el refinamiento del tutor.

La primera versión dibujaba los cortes **dentro del relleno**. Cuando el día
cruza el objetivo, el relleno se vacía y vuelve a empezar — y se lleva con él
los paseos que lo llenaron. Tres paseos y una sola marca visible. En esta
casa, con un objetivo de 2h, cruzar es el día normal.

Dibujados **sobre el fondo**, se quedan. Y entonces:

**La capa desambigua la vuelta.** Un corte dentro del relleno de la vuelta en
curso es esta vuelta; un corte sobre el fondo de la vuelta cumplida es la
anterior. La misma x no significa dos cosas, que era la objeción de fondo
contra marcar posiciones sobre una escala que gira.

Eso resuelve el caso que el tutor mismo vio venir: con dos vueltas, el cuarto
paseo acaba **a la izquierda** del primero. No es un desorden que haya que
tolerar — es que no hay un orden que leer de izquierda a derecha. Se lee por
capas.

### 4. El tick deja de existir como mecanismo aparte

Si el corte hace su trabajo, el tick sobra: durante un paseo, el corte de la
última frontera **es** el tick. Un mecanismo menos.

Lo que el tick dice y hay que comprobar que el corte sigue diciendo: Mist y
el tono del tramo en curso miden **1,71:1** entre sí y sin una marca en la
junta no se distinguen. Un corte oscuro ahí las separa mejor que la línea
clara de hoy.

Las reglas del tick que el corte hereda tal cual, porque son de la frontera y
no de la marca: **no hay corte donde no hay junta** —nada grabado en la
vuelta en curso es un corte colgando del filo izquierdo— y **no pulsa**. Lo
que pulsa dice «esto está vivo»; un corte dice «aquí acabó algo».

### 5. Una relectura no cambia nada de esto

Los cortes son una descripción del día, como la barra. Se dibujan de los
datos que haya, vengan de donde vengan. No hay animación propia: aparecen y
desaparecen con el relleno que los contiene.

### 6. No se dice en voz alta

La medida de encima ya dice «en 3 paseos», que es la misma información y
mejor dicha. Los cortes son decorativos en el árbol de accesibilidad, como el
tick.

## Lo que este documento no decide

- **Si cuatro cortes en una vuelta leen como barra a rayas.** Es el riesgo
  que esta variante ha tenido desde el principio y no se puede contestar
  discutiendo. Un día de cinco paseos cortos es el caso límite.
- Qué pasa con dos paseos tan seguidos que sus cortes caigan a menos de 2 dp
  uno de otro — dos paseos de dos minutos contra un objetivo de 3h.
- Si el corte debe tener alguna holgura contra el filo del relleno cuando el
  último paseo es muy corto, o si puede tocarlo.

## Lo que hay que respetar al construirlo

- **Los cortes se dibujan por encima de las capas del cierre.** La ceremonia
  pinta sobre toda la barra durante 760 ms; unos cortes por debajo
  desaparecerían ese rato y volverían al acabar. Un parpadeo que nadie pidió,
  y de los que no se ven leyendo el código.
- **`GoalBlock` es el componente con más historia medida del proyecto**, y
  esto toca su parte más delicada: el modelo de capas y el tick. Se verifica
  en el teléfono con grabación, no en el navegador.
- **Lo que decide dónde va cada corte vive en `lib/goalbar.ts`** y se prueba
  con Jest, por la razón de siempre: una posición mal calculada no lanza,
  dibuja una marca donde no hubo ningún paseo.
- El cálculo tiene que salir de las mismas funciones que ya parten el día en
  vueltas. Una frontera calculada por segunda vía es una barra que corta
  donde la medida dice otra cosa.
- No se prueba una animación contra un reloj en Playwright.
