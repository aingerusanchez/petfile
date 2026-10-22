# El diario está al día cuando vuelves a él — diseño

**Estado:** acordado con el tutor el 22 de octubre de 2026, después de que él y
su pareja detectaran el fallo en uso. Sin construir.

## El fallo, contado como lo contó quien lo sufre

> «Hemos detectado diarios no sincronizados algunos días porque la app ya
> estaba abierta en segundo plano, y al volver a ella nada ha relanzado una
> actualización del diario actual para añadir esa comida que acaba de añadir,
> o ese paseo que acaba de suceder.»

Dos tutores, dos teléfonos, un diario. Uno apunta la comida; el otro abre su
móvil —que llevaba la app en segundo plano— y ve el día **sin esa comida**, sin
nada que le diga que está mirando algo viejo.

## La causa, que viene con su propia refutación

`app/(tabs)/index.tsx`, el manejador de `AppState`:

```
// Only when the date actually turned: a `setToday` on every foreground
// would refetch the day for nothing.
if (daysAgo(now, today) === 0) return;
```

**«Volvería a leer el día para nada.»** Esa frase es cierta en una app de un
solo usuario y falsa en cuanto son dos. Volver del segundo plano es
precisamente el momento en que puede haber algo nuevo que leer, porque el otro
teléfono ha podido escribir mientras tanto. El supuesto era razonable cuando se
escribió; lo que cambió no es el código, es que la ficha la llevan dos
personas.

Hay una incoherencia que ya lo delataba: **los tratamientos sí se releen al
volver al foco** (`useFocusEffect`); las entradas del día no.

## Lo decidido

### 1. Volver a la app relee el día

El arreglo. Cuesta una petición cada vez que se trae la app al frente — que es
lo que el comentario temía **sin medirlo** — y es lo que mantiene el diario al
día sin que nadie tenga que acordarse.

Lo que ya decide el manejador actual y no cambia: **la pantalla no se mueve de
día sola**. Quien dejó la app leyendo el martes vuelve al martes; y nunca se
arrastra al tutor fuera del día donde tiene un paseo abierto. Esto es una
relectura, no una navegación.

### 2. Y el gesto de arrastrar hacia abajo

Agencia, no corrección. Para cuando el otro tutor dice «ya lo he apuntado» y
se quiere ver ya, sin cambiar de día ni cerrar la app. Es el gesto que todo el
mundo conoce y no hay que enseñarlo.

### Por qué el gesto no basta solo, que es lo que ordena los dos

**No se puede tirar hacia abajo de lo que no sabes que está viejo.** Un diario
desactualizado se ve exactamente igual que uno al día: no hay hueco, no hay
marca, no hay nada que haga sospechar. El gesto sirve cuando ya sospechas; la
relectura al volver existe para los días en que no.

## Lo que este documento no decide

- Si la relectura al volver muestra algún indicio mientras ocurre, o es
  silenciosa.
- Qué hace el gesto cuando la lectura falla — presumiblemente lo mismo que
  cualquier otra lectura fallida, que ya tiene su región de error y su
  Reintentar.
- Si el gesto alcanza también a Salud y a Perfil, o solo al diario.

## Relación con el guardado local del paseo

Ninguna, salvo que comparten fichero. Esto es un fallo del diario de hoy; el
guardado local es una funcionalidad nueva. **Se construye primero esto**,
porque lleva tiempo costando datos invisibles a una casa de dos tutores.

Un efecto lateral útil: la relectura al volver es **uno de los tres
disparadores** que el plan del guardado local ya pensaba usar para subir una
parada pendiente. Construirla aquí la deja hecha para allí.
