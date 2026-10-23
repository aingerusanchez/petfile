# El calendario vuelve solo al mes de hoy — hallazgo

**Estado:** medido el 23 de octubre de 2026, **sin arreglar**. Pendiente de que
el tutor decida si se acomete y con qué versión.

Salió persiguiendo un test inestable, no buscándolo. El test se arregló por
otro camino; esto es lo que había debajo.

## Qué pasa

Se abre el calendario del diario y se pulsa ‹ para ir al mes pasado. La rejilla
se mueve. Unos instantes después **vuelve sola al mes de hoy**, sin que nadie
haya tocado nada, y lo que el tutor estaba mirando desaparece.

Medido con una sonda en la suite: la pulsación aterriza, la cabecera lee
`septiembre`, y cinco segundos más tarde el calendario está en `octubre`.

## Por qué

La hoja se abre mientras **la lectura de la ventana de marcas sigue en vuelo** —
el año de entradas del que el calendario saca sus puntos. Cuando esa lectura
contesta, el día se vuelve a renderizar con unas marcas nuevas, y
`react-native-ui-datepicker` recalcula el mes que muestra a partir de su prop
`date`, que es el día seleccionado. El día seleccionado nunca salió de hoy:
paginar con las flechas mueve la rejilla y **no** cambia la selección. Así que
la librería «corrige» la pantalla a octubre y tira la navegación.

Encaja con lo que AGENTS.md ya tenía medido sobre esta librería y que conviene
releer antes de tocar nada:

- sus flechas de cabecera cambian el mes **sin avisar a nadie** — `onMonthChange`
  solo dispara desde la lista de meses;
- sus props `month` / `year` **no sirven** para devolverla a un mes: se pliegan
  en un estado construido una sola vez, y fijarlas dejó la rejilla en el mes
  viejo.

Esas dos juntas son la mala noticia: **no hay una forma documentada de decirle
«quédate donde el tutor te dejó»**. Por eso esto es un hallazgo y no un arreglo
de una línea.

## Cuánto importa

Poco y no cero. La ventana suele contestar antes de que a nadie le dé tiempo a
abrir el calendario y pulsar, así que el hueco es estrecho: hace falta abrirlo
en el primer momento tras cargar la app, o con la red lenta. Pero cuando cae
dentro, lo que se pierde es justo la acción deliberada de alguien que estaba
buscando algo — «¿qué día cojeaba?» — y lo pierde sin un mensaje.

Se agrava con la conexión mala, que es el escenario que esta rama lleva toda la
semana tomándose en serio.

## Caminos, ninguno gratis

1. **Congelar las marcas mientras la hoja está abierta.** Lo más pequeño: el
   calendario recibe las marcas que había al abrirlo y no se entera de las que
   llegan después. Cura el salto, y a cambio una marca que aterriza tarde no
   aparece hasta cerrar y volver a abrir. Para una lectura que tarda lo que
   tarda ésta, probablemente invisible.
2. **Que la selección siga a la paginación.** Si `date` acompañara al mes
   mostrado, la librería no tendría nada que corregir. Pero eso cambia lo que
   significa la selección en la rejilla, y el anillo de hoy y el `maxDate`
   cuelgan de ella. Más invasivo de lo que parece.
3. **Dibujar la cabecera y la paginación en casa**, dejando a la librería solo
   la rejilla. Es la salida definitiva y la cara: esta pantalla ya lleva un
   `components.Day` propio por razones parecidas, y cada trozo que se le quita
   a la librería hay que mantenerlo aquí.
4. **No hacer nada**, y dejar escrito que pasa. Es defendible mientras el hueco
   siga siendo estrecho.

La recomendación, si se acomete: la 1. Es la única que no toca la semántica de
la selección ni añade superficie que mantener, y el coste que paga —una marca
que llega tarde no entra hasta la próxima apertura— es más pequeño que el
fallo que quita.

## Lo que la suite hace mientras tanto

`pageBackOneMonth` en `e2e/home.spec.ts` espera a que la lectura aterrice antes
de pulsar, y pulsa hasta que la cabecera se mueve. **No disimula el salto**: lo
esquiva, para que el test siga midiendo lo suyo —que paginar trae las marcas
del mes al que se ha ido— en vez de correr una carrera contra otra cosa. Su
comentario dice esto mismo y apunta aquí.

Dos intentos de quitar esa espera están medidos y documentados allí: sin ella,
el test pasa de fallar una vez de cada quince a fallar nueve, y
`waitForLoadState("networkidle")` tampoco la sustituye.
