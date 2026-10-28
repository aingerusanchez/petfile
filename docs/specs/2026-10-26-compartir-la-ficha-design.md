# Compartir la ficha — diseño

**Estado:** acordado con el tutor el 26 de octubre de 2026. Sin construir.

**Por qué ahora:** `PRODUCT.md` lleva desde el 13 de septiembre diciendo que
ésta es la ruta a la 1.0 — «the household is two tutors with a phone each and
the app currently serves one account; sharing is the feature that makes it
true». Hoy la deuda ya no es teórica: la casa funciona con una fila metida a
mano en el panel de Supabase.

**Este documento pasó por un revisor** —un agente que lo leyó como si fuera a
construirlo, sin haber estado en la conversación— y volvió con que el
pensamiento de producto aguantaba y el dimensionado no. Lo que encontró está
incorporado; lo que corrigió de lo que este documento afirmaba está marcado
donde ocurrió, porque un error sobre el repositorio que nadie ve es el que se
repite.

## El porqué

**La pareja del tutor tiene acceso porque alguien editó la base de datos.**
Funciona —dos días de uso real lo demuestran, y las políticas RLS resuelven
tanto las filas como la foto a través de `pet_owners`— pero ese camino tiene
tres problemas: solo lo puede recorrer quien tenga el panel, no deja rastro
dentro de la app, y **no se puede deshacer desde la app**. Si mañana hubiera
que retirar ese acceso, se retira a mano, igual que se dio.

**Y hay un caso que no es la pareja.** Algunos fines de semana el perro se
queda con el hermano del tutor. Lo que pasó la última vez es el argumento
entero de esta funcionalidad:

> Me lo fue contando por WhatsApp y lo apunté yo en la app.

Eso no falló por falta de lectura: falló por falta de escritura. Y el dato
que acaba en el diario **llega tarde y redondeado** — «un paseo largo por la
tarde» no es «54 min a las 17:12». El diario existe para tener el dato real,
y pasarlo por una persona lo degrada. Con el registro automático de paseos la
pérdida es mayor todavía: quien lleva al perro es quien pulsa, así que basta
con que pueda pulsar.

## Objetivos

- Dar y retirar acceso **desde la app**, sin tocar el panel.
- Cuatro niveles de acceso que se correspondan con personas reales de esta
  casa, no con una matriz de permisos inventada.
- Un acceso que **termine solo** y se pueda prorrogar.
- Saber **quién apuntó cada cosa**.

## No-objetivos

- **Transferir la propiedad de la ficha.** Dar el rol de quien la abrió es
  otra cosa, más rara y más grave, y tiene su propia conversación.
- **Un histórico de cambios campo a campo.** Es JIRA, no esto. La app sirve
  para saber qué le pasó al perro, no para auditar quién corrigió una errata.
- **Mover la medicación a Salud.** Es una funcionalidad aparte; lo que este
  documento sí hace es dejar los roles escritos de forma que ese movimiento
  no los obligue a cambiar.
- **Publicar en Play.** Va después, y este diseño no depende de ello.

## Anti-objetivos

Lo que haría fracasar esto aunque funcionara:

- **Un rol de cuidador que no pueda escribir.** Sería exactamente lo que ya
  hay —contarlo por WhatsApp— con una pantalla de más.
- **Una caducidad que solo exista en la interfaz.** Si el acceso sigue
  abierto en la base de datos y solo está escondido, es peor que no tenerla:
  la gente se la cree.
- **Un reparto de permisos que haya que explicar.** Si una regla no se dice
  en una frase, se trabaja alrededor de ella.
- **Esconder pestañas según el rol.** Dos personas con mapas distintos de la
  misma app no pueden ayudarse por teléfono.

## Lo decidido

### 1. Cuatro roles, tres repartibles

| Rol                          | Diario              | Peso            | Vacunas · tratamientos | Ficha · vets  | Accesos                     |
| ---------------------------- | ------------------- | --------------- | ---------------------- | ------------- | --------------------------- |
| **Tutor** _(abrió la ficha)_ | leer · escribir     | leer · escribir | leer · escribir        | leer · editar | **reparte, retira, caduca** |
| **Tutor**                    | leer · escribir     | leer · escribir | leer · escribir        | leer · editar | —                           |
| **Cuidador**                 | leer · **escribir** | solo leer       | solo leer              | solo leer     | —                           |
| **Familiar**                 | solo leer           | solo leer       | —                      | solo leer     | —                           |

Y lo que cada uno añade sobre el anterior, que es como se explica:

- **Familiar** — ve cómo le va: los paseos con sus notas, la foto, el
  cumpleaños, la curva del peso.
- **Cuidador** — además apunta lo que pasa mientras lo tiene, y lee la pauta
  de medicación para poder seguirla.
- **Tutor** — además escribe el historial de salud y edita la ficha.
- **Quien abrió la ficha** — además reparte accesos y puede borrarla.

**Los veterinarios los ve todo el mundo**, y es una decisión del tutor que
además quita el único problema caro de esta tabla. La primera versión de este
documento se los escondía al familiar, y el revisor señaló por qué eso no se
puede: `vet_primary` y `vet_emergency` son dos columnas `jsonb` de la fila del
perro —la misma fila que el familiar necesita leer para ver nombre, foto y
cumpleaños— y Postgres protege filas, no columnas. Habría hecho falta una
vista o una función `security definer` solo para esas dos columnas, es decir
reescribir el camino de lectura más usado de la app. **Con esta decisión la
fila del perro se lee entera y por igual**, y el reparto solo gobierna
escrituras más una tabla completa (`pet_treatments`, que el familiar no lee).
Esa simetría es la que hace que lo demás quepa.

**«Familiar» es la palabra del tutor, y la eligió con una prueba que vale
para las cuatro:** «[Persona] es [Rol] de [Mascota]». _Julen es familiar de
Loki_ se sostiene donde _Julen es invitado de Loki_ sonaba a visita y
_seguidor_ a Instagram. El borde conocido es que un amigo que no es de la
familia también cae aquí; se acepta, porque describe a quien va a usarlo.

**Esa prueba es para elegir la palabra, no para escribirla en pantalla**, y de
ahí sale la convención, acordada: **la etiqueta va en masculino genérico y
nunca con barra.** `Tutor`, `Cuidador`, `Familiar`; jamás `Tutor/a`.

Tres razones, en orden de peso:

- **La barra es el registro de un impreso**, y esta app dice «¡Vamos, Loki!» y
  «¿Todavía no has vuelto?». Son dos voces que no caben en la misma
  pantalla.
- **No se queda en la lista.** Si el rol lleva barra, la lleva en todos los
  sitios donde aparezca, y dentro de una frase `Cuidador/a` es ilegible.
- **En la lista el rol va al lado del nombre, no dentro de una oración sobre
  la persona.** `Laura — Tutor` es una categoría, como una cabecera de tabla,
  y es el único sitio donde los cuatro roles se escriben.

**La salida, si algún día molesta, no es la barra: son palabras invariables.**
`Familiar` ya lo es, y para la primera existe una que el tutor consideró y
descartó por otro motivo — `Responsable`. Queda escrito para no volver a
buscarla.

### 2. «Tutor» es la palabra que este proyecto ya usa

No se inventa vocabulario: `PRODUCT.md` y todos los documentos de diseño
llevan meses llamando _tutor_ a quien lleva al perro. Lo que había era dos
palabras para lo mismo.

### 3. Los dos son tutores, y uno además abrió la ficha

El tutor lo zanjó así: su pareja y él son **los dos tutores** de Loki, y lo
que los separa no es el rango sino el origen — **uno abrió la ficha**, y es el
único que reparte accesos. Y eso **tiene que verse en la app**, no quedarse
como una regla que solo conoce la base de datos.

**No es un rol más del selector**, porque no se reparte: dárselo a alguien es
transferir el perro, que es un no-objetivo de este documento. Es una marca
sobre un rol que ya existe.

**Y la marca es un icono con una leyenda, no una palabra en cada fila:**

```
Aingeru  🔑   Tutor                              (tú)
Laura         Tutor
Julen         Cuidador · hasta el dom 12:00     editar
Ane           Familiar                          editar
Mikel         Cuidador · invitación pendiente   anular
Unai          Cuidador · invitación caducada    volver a invitar

🔑 reparte los accesos
```

**`Propietario` se descartó, y la razón no es solo que tenga femenino.** Es
que reintroduce el vocabulario que la §2 acaba de quitar: el documento
argumenta que nadie es administrador de un perro, y _propietario_ dice lo
mismo con otra palabra, pegada además a `Tutor`, que es la que se eligió para
decir lo contrario. El icono solo tampoco vale — `Button.tsx` lleva escrito
que un icono no es una explicación —, así que la llave la explica una línea, y
una sola para toda la lista. Lo que se nombra es **la capacidad**, que es lo
único que esa marca tiene que comunicar, y de paso es invariable.

**Y esa lista no es informativa: es el mando.** Es donde se cambia un rol, se
prorroga una caducidad, se anula una invitación que nadie ha reclamado y se
retira un acceso. Hoy no existe ninguna pantalla así, y es la que convierte
«dar acceso» en algo que también se puede deshacer — que es el tercero de los
tres problemas de la fila metida a mano.

**Tiene filas de dos clases**, y eso importa al construirla: personas con
acceso, e invitaciones. La segunda clase es lo único que queda de la idea de
«cuándo empieza» (§7): no hay fecha de inicio, hay un código entregado que
alguien ha canjeado o no.

**Y una invitación tiene tres finales, no dos.** Se reclama —y entonces deja
de ser una invitación y pasa a ser una persona—, se anula, o **caduca sin que
nadie la use**, que es lo que pasa cuando mandas el código y el otro lo lee al
día siguiente. Ese tercer caso **tiene que verse en la lista**: una invitación
que desaparece en silencio es exactamente cómo se acaba creyendo que alguien
tiene acceso cuando no lo tiene. Caducada se queda, con otro botón.

**El botón dice «volver a invitar», y no «reactivar» ni «reenviar».** No es
una preferencia de estilo: las tres palabras describen tres mecanismos
distintos y solo una es la que ocurre. _Reenviar_ dice que la app manda algo,
y no manda nada — el código se enseña o se copia. _Reactivar_ dice que el
código muerto vuelve a la vida, y eso es justo lo que no debe pasar: ese
código lleva un día en un hilo de WhatsApp, y darle una segunda vida es
regalar a quien lo tenga la ventana que ya se le había cerrado. Lo que hace el
botón es **emitir uno nuevo con el mismo rol y la misma caducidad** —el ajuste
ya estaba hecho, así que es una pulsación— y el viejo se queda muerto para
siempre. _Volver a invitar_ es lo único que describe eso.

Una caducada también se puede **anular**, que ahí solo significa quitarla de
la lista.

**Esa lista no se puede dibujar hoy, y conviene saberlo antes de empezar.**
Son dos políticas que no existen: `pet_owners` solo deja ver _tu propia_
membresía (`user_id = auth.uid()`), y `profiles` solo deja leer _tu propio_
perfil (`id = auth.uid()`). Sin tocarlas, la lista de accesos no tiene filas y
«lo apuntó la pareja» no tiene nombre que enseñar. Las dos se amplían a
«quien comparte perro contigo», que es exactamente el alcance de la lista.

**Y `PRODUCT.md` afirma que no hay tabla `profiles`.** La hay desde la primera
migración. Esa línea hay que corregirla en el mismo cambio, porque es la clase
de afirmación de la que alguien deduce un diseño entero.

### 4. La frontera no es «Salud contra diario», es «plan contra hecho»

> **Un cuidador registra hechos y consulta planes. Un tutor además escribe
> los planes.**

Esa regla es la que hace que el reparto sobreviva a mover la medicación de
sitio:

- **La pauta** —«media pastilla cada doce horas durante una semana»— es algo
  de lo que la app calcula, así que vive donde viven las cosas con columnas.
  La escribe un tutor.
- **La toma** —«a las 10:00 se la he dado»— es un hecho con una hora. La
  apunta cualquiera que pueda escribir el diario, incluido el cuidador.

**Marcar una toma como dada no es editar el plan.** El cuidador afirma el
hecho; que la próxima fecha se mueva es una derivación de la app, no una
autoría suya. Él nunca elige cuándo toca la siguiente.

Y una toma suelta sigue siendo posible sin pauta detrás: «le he dado un
antihistamínico porque se rascaba» no debe obligar a crear una enfermedad.

**Esta sección describe algo que todavía no existe.** Las migraciones llegan a
`0006` y `pet_treatments` no tiene pauta: no hay dosis, ni intervalo, ni
próxima toma. La regla de arriba está escrita para que el reparto no haya que
rehacerlo cuando la pauta llegue — **no es trabajo de esta rama**, y un
constructor que busque dónde engancharla no la va a encontrar.

### 5. La app esconde acciones, no sitios

Las tres pestañas están para los cuatro roles. Lo que cambia es qué bloques
traen y qué se puede tocar. Para el familiar, lo único que desaparece es el
bloque de vacunas y tratamientos dentro de Salud.

Es del tutor esta regla, y la razón es práctica: dos personas con mapas
distintos de la app no pueden ayudarse por teléfono.

### 6. La invitación es un código, y el QR lo lleva dentro

**Un enlace de esquema propio no sobrevive a la instalación.**
`petfile://pet-share/00072` solo funciona si la app ya está puesta; si no, el
navegador da error. Y aunque se use un enlace `https` que abra Play cuando
falta la app, **después de instalar el enlace original se ha perdido**:
Android no lo arrastra hasta la primera apertura salvo montando el Install
Referrer de Play o un servicio de enlaces diferidos. O sea que falla justo en
el camino más común — quien recibe la invitación no tiene la app.

**El tutor lo cerró por el otro lado, y así se cierra entero:** el QR se
dibuja en la pantalla de quien invita, y quien lo escanea **ya tiene la app
puesta**. Eso no resuelve el problema del enlace — lo hace desaparecer. No hay
nada que arrastrar a través de Play porque no hay enlace.

A cambio, la app gana una puerta por el lado de quien entra —**«Tengo un
código de acceso»**— y los dos caminos acaban en el mismo campo de texto:

- **Delante del otro:** quien invita enseña el QR; el otro lo escanea.
- **Por WhatsApp:** quien invita copia el código; el otro lo pega.

> Dale esto a quien vaya a cuidar a Loki: **7K4P-2M9X-R3TD**

**El QR no lleva nada que el código no lleve.** Un mecanismo, dos formas de
introducirlo, y escanear es siempre opcional: un código que solo entra por la
cámara es un código que falla cuando la cámara no enfoca.

**Las dos mitades del QR cuestan cosas muy distintas, y por eso se construyen
por separado.** Dibujarlo es casi gratis: `react-native-svg` ya es una
dependencia de este proyecto, así que encima solo va una librería JS pequeña —
sin módulo nativo, sin permiso, sin recompilar, y funciona en el target web
donde corre la suite. Escanearlo pide cámara, que es otra historia (ver «lo
que hay que respetar»).

**El orden acordado es código, luego dibujar, luego escanear** — y la última
puede caerse a la versión siguiente sin arrastrar nada, porque teclear o pegar
el código funciona siempre. Lo que **no** se pospone es el QR entero a la
versión de Play: allí sirve de menos, no de más. Lo que de verdad espera a
Play es el paseo completo enlace → tienda → login → aceptar, y el QR es justo
lo que no lo necesita, porque ya asume la app instalada — que es la condición
que esta casa cumple hoy, con las dos instalaciones puestas a mano por ADB.

**La puerta se llamó «Pedir acceso» durante dos días y ya no.** Se cambia
porque el nombre describía mal el mecanismo —no hay cola de solicitudes ni
aprobación al otro lado; quien tiene el código ya está autorizado— y el
documento tenía que llevar un aviso para que nadie construyera esa cola. Con
**«Tengo un código de acceso»** el aviso sobra: la frase es del que entra,
está en primera persona como el resto de la voz de la app, y no promete una
respuesta de nadie. **El título de la pantalla repite esas mismas palabras**,
que es mi criterio y la razón es tonta y vale: quien pulsa una frase y
aterriza en otra duda si llegó donde quería.

### 6.2 Dónde está esa puerta: en el alta, y es la única entrada

**Hoy la pantalla de alta no tiene segunda puerta, y ese es el agujero.** Quien
canjea un código entra con Google, aterriza en `Preséntame a tu compi 🐶` con
el formulario entero debajo —nombre, sexo, fecha, raza, salud— y **la única
salida es inventarse un perro**. Es el caso del hermano, y hoy se rompe en
silencio.

La forma es la de una pantalla de inicio de sesión, que es donde todo el mundo
la ha visto: **una acción primaria y un enlace secundario.** Dar de alta tu
mascota es lo primario —es el camino por defecto de quien se descarga la app
por su cuenta— y quien llega con un código llega buscándolo.

**El enlace va arriba, bajo el titular, y no al pie.** En una pantalla de login
el «¿no tienes cuenta?» va abajo porque encima hay dos campos; aquí encima hay
un formulario largo, y al pie obligaría a recorrerlo entero para encontrar la
puerta de salida. Se mantiene la jerarquía y se invierte la posición, por el
tamaño del formulario.

```
Preséntame a tu compi 🐶

Tengo un código de acceso  →

  Nombre
  ┌────────────────────────┐
```

### 6.3 Las cuatro casillas, y la que faltaba

El tutor las ordenó así, y el cuadro vale la pena porque hace comprobable la
cobertura:

|                            | Mascota propia                      | Ya registrada por otra persona            |
| -------------------------- | ----------------------------------- | ----------------------------------------- |
| **Primer acceso a la app** | el formulario de alta               | el enlace del alta (§6.2)                 |
| **Ya tiene una mascota**   | «Añadir otra mascota», desde Perfil | «Tengo un código de acceso», desde Perfil |

**La cuarta no estaba**, y es la que describe a quien ya entró por invitación
—el hermano con acceso a Loki— y mañana recibe el código de otro animal.
Desde Perfil solo había una puerta y daba al formulario.

**Desde Perfil son dos enlaces hermanos, no uno con el otro escondido
detrás.** En el primer acceso la jerarquía de la §6.2 está ganada: quien se
descarga la app por su cuenta viene a dar de alta su perro, abrumadoramente.
**Desde Perfil esa mayoría no existe** — quien navega a propósito hasta ahí
puede estar en cualquiera de los dos casos por igual, y una jerarquía que no
se ha ganado es una preferencia disfrazada de diseño. Van juntos y por encima
de lo que ya hay:

```
  Añadir otra mascota
  Tengo un código de acceso
  ──────────────
  Ajustes
  Cerrar sesión
```

**Eso no cuesta mecanismo nuevo**, que es lo que había que cuidar: los dos
destinos ya existen y la pantalla del código se enlaza desde dos sitios. Lo
que la §6.2 evita es un segundo _mecanismo_, no un segundo enlace.

**Y es trabajo del plan de compartir, no del selector.** El plan del selector
pone «Añadir otra mascota» en Perfil porque lo necesita para existir; su
hermano llega después, cuando haya una pantalla de código a la que llevar. Que
el pie de Perfil se toque dos veces es correcto: son dos razones distintas.

**Lo que no hay que construir**, y conviene saberlo antes de presupuestarlo:
qué pasa después de canjear. Quien canjea queda en `pet_owners`, y como las
fichas se leen _a través_ de esa tabla, para la app ya tiene mascota y entra
en las pestañas como cualquiera. Ningún caso especial. Si algún día saca su
propio perro, tendrá dos y le aparecerá el conmutador de la §12.

**Lo que sí:** si el código falla o ha caducado, esa persona se queda en la
pantalla del código **sin ficha y sin salida**. Tiene que poder volver al
formulario. Es solo navegación, pero sin escribirlo no se construye.

### 6.1 El código no va atado a una persona, y eso fija cinco requisitos

Decisión del tutor: lo canjea **quien lo tenga**, sin escribir el correo de
nadie al generarlo. Es lo que hace que darlo sea enseñar una pantalla.

**El precio es que el código _es_ la credencial**, y `PRODUCT.md` ya dice qué
hay al otro lado: esto decide quién puede entregarle a un desconocido el
historial médico de un perro. Los cinco requisitos de abajo son lo que
sustituye al correo, y **ninguno es opcional** — quitar uno convierte esto en
una llave maestra corta:

1. **Largo y de alfabeto no ambiguo.** Doce caracteres sobre un alfabeto sin
   `0/O` ni `1/I/L`. Un código de cinco dígitos como el del boceto
   (`pet-share/00072`) se agota probando. El tutor dejó el alfabeto de mi
   cuenta con una condición que resulta ser la que manda: **tiene que poder
   pegarse desde el portapapeles.** Un código que hay que transcribir mirando
   obliga a ser corto; uno que se pega puede ser tan largo como haga falta. La
   longitud no sale de la criptografía, sale de ahí.
2. **Un solo uso.** Se consume al canjearlo, dentro de la misma transacción
   que crea la membresía.
3. **Caduca en horas, no en días.** El caso real es «te lo mando ahora».
   **Y no es la caducidad del acceso:** son dos relojes distintos y conviene
   no confundirlos al construir. Éste mide cuánto vive una invitación _sin
   usar_; el de §7 mide hasta cuándo dura el acceso que concede, una vez
   usada.
4. **Límite de intentos**, por código y por cuenta que prueba. Sin esto, 1 y 3
   solo suben el precio de la fuerza bruta; no la impiden.
5. **Revocable y visible.** Quien invita ve sus invitaciones en la lista de
   accesos —pendientes y caducadas— y puede anular una antes de que se use. Un
   código dado por error hoy no se puede retirar de ninguna manera. Y porque
   el punto 3 hace que caducar sea lo normal y no la excepción, la caducada
   **se queda a la vista con un botón para volver a invitar** (§3), en vez de
   desaparecer y dejar al tutor preguntándose si su hermano entró.

Si algún día se quiere la versión fuerte, es un campo: atar el código a un
correo de Google. Queda escrito para no tener que redescubrir que era barato.

### 7. El acceso tiene fecha-hora de fin, y al terminar baja de rol

Un acceso se concede **hasta una fecha-hora**, prorrogable. No «hasta el
domingo»: hasta el domingo a las 12:00. **Empieza cuando se canjea el código**,
y eso no se configura: es un hecho que la fila ya guarda.

**Hubo un inicio en este documento y se quitó, con el razonamiento escrito
porque es más útil que la decisión.** La referencia era buena —la cerradura
Nuki reparte sus accesos temporales con un interruptor y dos fecha-hora, que
es exactamente la forma de este problema— y aun así el extremo izquierdo no
servía aquí. Una cerradura necesita inicio porque la llave se entrega el lunes
a quien llega el martes a las nueve; **Petfile no puede tener ese caso**, por
algo que dice el propio documento dos secciones más arriba: la invitación
caduca en horas, porque «el caso real es te lo mando ahora». Si el código no
sobrevive al día, un acceso no puede abrirse el viernes que viene: el campo
solo podría contener «más o menos ahora», siempre. Ceremonia sin trabajo, y
pagando un estado entero —«canjeado pero aún no»— con su pantalla, su
comparación en la política y una prueba por cada borde. **Vuelve el día que se
quiera conceder con antelación, y ese día será un campo.**

**Lo que sí interesa saber de ese lado es otra cosa: si la persona ha
reclamado el acceso o la invitación sigue pendiente.** Eso no es una fecha, es
el estado del código, y vive en la lista (§3).

**Lo recurrente de la pantalla de Nuki también queda fuera**: «todos los
sábados de 10:00 a 14:00» no describe a nadie de esta casa, y es la clase de
campo que se añade el día que alguien lo pide.

**El fin es opcional**, como ese interruptor. Un tutor no lo lleva; un cuidador
de fin de semana sí.

**Al vencer no desaparece: pasa a familiar.** Así la caducidad deja de ser
una pérdida y es un cambio de rol — que es lo que el tutor describe de su
hermano: mientras cuida, escribe; el resto del año, mira los paseos. La única
excepción se explica sola: un familiar con fecha de fin no tiene a dónde
bajar, así que al terminar pierde el acceso. **Es mi criterio** decir la regla
en ese orden —la caída primero, el suelo después—, porque al revés son dos
reglas y así es una con un borde.

**Una semana es el mismo mecanismo que un fin de semana**, lo cual contesta al
caso del cuidador profesional: solo cambia la fecha. Y la observación del
tutor sobre ese caso es la que debe gobernar el diseño — **esto está pensado
para familia y gente de confianza**, y por eso bajar a familiar al vencer
tiene sentido como suelo. Para alguien que no lo es, la respuesta no es otro
rol: es retirar el acceso desde la lista, que ahora se puede.

**La caducidad se aplica en la política de base de datos, no en la pantalla.**
Es la diferencia entre una promesa y un decorado.

**Un rol se puede cambiar sin un código nuevo.** Estaba implícito en
«prorrogar» y no escrito: subir a un familiar a cuidador el viernes es la
misma operación que prorrogarlo, y obligar a generar otro código para eso
sería un mecanismo de más. Quien abrió la ficha edita la fila; el familiar no
se entera más que por lo que la app le deja hacer.

### 8. Cada entrada guarda quién la apuntó

Se guarda el autor y se enseña en la fila. **No se guarda un histórico de
ediciones.**

**La mitad de esto ya está construida.** `created_by uuid default auth.uid()`
existe en `pet_events`, `pet_weights` y `pet_treatments` desde `0006`, con
`on delete set null` para que borrar una cuenta no se lleve el historial del
perro por delante. Lo que falta no es la columna: es poder convertir ese id en
un nombre (ver §3) y **impedir que se escriba a mano**. Hoy la columna tiene
un valor por defecto pero nada la protege, así que con el reparto puesto pasa
a ser una columna de seguridad: un `insert` puede declarar cualquier autor y
un `update` puede reescribirlo. Se fija en la política.

Con el registro automático de paseos, quien lleva al perro es quien pulsa, así
que el autor _es_ con quién fue el paseo. **Donde eso deja de ser cierto es en
una entrada escrita a mano** —alguien apuntando por otro, que es justo lo que
esta funcionalidad viene a quitar— así que la app enseña quién lo escribió y
no afirma quién fue al paseo.

### 9. Lo que se queda cuando alguien pierde el acceso

**Las entradas que escribió se quedan.** Son lo que le pasó al perro, no
propiedad de quien las tecleó.

### 10. Un cuidador puede corregir lo suyo

Puede editar y borrar **sus propias** entradas mientras le dure el acceso.
`PRODUCT.md` ya dice que toda entrada es una corrección esperando a ocurrir;
si un mis-tap del cuidador obligara a escribir al tutor por WhatsApp,
habríamos reconstruido el problema que esto viene a quitar.

### 11. El paseo de otro se ve en marcha, y no se puede parar

Decisión del tutor: mientras el hermano pasea a Loki, el otro teléfono dice
«de paseo» y cuenta, pero el botón de parar no es suyo.

**Y sale casi gratis, al contrario de lo que este documento supuso primero.**
La primera versión decía que esto obligaba a que el paseo en curso dejara de
ser un dato del dispositivo. No es así: **el paseo abierto ya es un hecho del
servidor** — una fila de `pet_events` con `duration_minutes` nulo, y su
comienzo en `occurred_at`, que es «la verdad» según dice `lib/walk.ts`. Lo que
guarda el teléfono es **solo el id**, y su significado exacto es «este paseo lo
empecé yo».

O sea que la regla que el tutor pidió ya está expresada en la arquitectura:

- **el teléfono que tiene el id** puede pararlo;
- **el que no lo tiene** ve la misma fila abierta y no tiene nada que parar.

Lo que falta es que el segundo la **lea como un paseo en marcha** en vez de
como una fila sin duración que suma cero, y que corra el reloj desde
`occurred_at`. Ni columna nueva, ni almacenamiento nuevo.

Y la carrera ya está resuelta: `closeWalk` cierra con `is("duration_minutes",
null)`, lo que su propio comentario llama «la regla de los dos tutores» —
gana el cierre que llegue primero y nadie pisa a nadie.

### 12. Alguien invitado que ya tiene su propio perro

Decisión del tutor: **se construye el selector de perro.** La alternativa era
rechazar la invitación, y la descartó.

**Esto es lo más grande que hay en este documento, y no es compartir.** Hoy la
app resuelve «el perro» como «el primero que creaste» —`order by created_at
asc limit 1` en `getMyPet`, `lib/pets.ts`— y **siete pantallas lo preguntan
por su cuenta**, cada una con su propio efecto.
`PRODUCT.md` tenía varias mascotas aparcado para la v2. Esta decisión lo trae
a la v1 porque sin él la funcionalidad se rompe en silencio: quien ya tenga
ficha propia y canjee un código aterriza en uno de los dos animales sin aviso
ni forma de cambiar.

**Mi criterio sobre cuándo:** el selector sale **antes**, en su propia versión,
y compartir va detrás. No es orden caprichoso — es que compartir sin él
necesita un camino de rechazo que luego habría que borrar, y porque un cambio
en cómo la app entera decide de qué perro habla merece instalarse y vivirse
unos días sin un reparto de permisos nuevo encima. Si el tutor prefiere lo
contrario, el documento no depende de ello.

#### 12.1 Qué forma tiene, decidido en el tablero

El tutor pidió «un switcher, dropdown o avatar-thumbnail como los de Google», y
preguntó si ese avatar podía ser el icono de la pestaña de Perfil. Las cuatro
variantes están dibujadas a tamaño de teléfono en el artboard `Selector` del
tablero, y la conclusión es **el avatar que pedía, con el tamaño cambiado de
sitio**:

- **Una fila arriba de Perfil**: avatar de 40 dp, el nombre, y un chevron.
  Pulsarla abre una hoja con las mascotas. Es la única de las cuatro que no
  toca ninguna pantalla existente — va arriba de la pantalla que ya trata de
  ese animal.
- **La huella se queda como icono de pestaña.** No es gusto: `tabBarIcon`
  recibe un `color` del navegador y lo aplica al trazo —Aqua activa, gris
  inactiva—, y **una foto no se puede teñir**, así que la pestaña activa
  dejaría de leerse como activa y habría que inventarle un anillo. A 24 dp
  una cara de perro es además una mancha, y la inicial sin foto lee como un
  fallo de carga.
- **Descartada la cabecera del Diario**, que era el sitio obvio: es un
  paginador con la frase centrada entre dos flechas, y el código ya lleva
  escrito que un icono al lado «se pasó del ancho entre las dos flechas y
  rompió la línea».

**Y la regla que gobierna las cuatro: con una sola mascota nada de esto
existe.** Ni fila, ni chevron, ni cambio de icono. Es lo que permite
construirlo antes de compartir sin que en casa cambie nada hasta el día que
haga falta.

#### 12.2 Tres decisiones que el dibujo no contesta

Son mías, y se escriben aquí porque el plan las necesita:

- **Al cambiar de mascota, el Diario se queda en el día que estuviera.** La
  mascota y el día son dos ejes independientes, y reponer uno porque el otro
  se mueve es la app decidiendo por el tutor. Que el segundo animal no
  existiera ese día es una respuesta honesta, no un error.
- **El paseo en curso pasa a guardarse por mascota.** Hoy `lib/walk.ts` tiene
  una sola ranura —`petfile.walk.v1`, con el id del paseo dentro—, y con dos
  animales esa ranura guardaría el paseo del otro: empiezas con Loki, cambias
  a Nala y su botón aparece en marcha. **Es un defecto latente que el selector
  activa**, no una funcionalidad nueva, y el almacenamiento viejo hay que
  migrarlo en vez de descartarlo. Que el paseo del primero siga corriendo sin
  decirlo desde la ficha del segundo se acepta en esta versión.
- **«Añadir otra mascota» va al pie de Perfil, no dentro de la hoja.** Ésta
  la escribí al revés y la corrige la regla de arriba: si la fila está oculta
  mientras haya un solo animal, y la única forma de añadir otro vive dentro de
  su hoja, **nunca se puede tener un segundo**. Va donde Perfil ya guarda sus
  acciones de una vez en la vida —junto a `Ajustes`, `Cerrar sesión` y el
  borrado de la ficha—, visible siempre, y la hoja no la duplica. La regla de
  invisibilidad es sobre el conmutador: lo único que tiene que existir con una
  sola mascota es el camino a la segunda.

  Reutiliza `app/onboarding.tsx`, y eso pide tocar una guarda: esa ruta hoy
  **rechaza** a quien ya tenga mascota, con un comentario que dice por qué
  —evitar un duplicado por navegación hacia atrás—. Tiene que distinguir
  llegar por accidente de pedirlo a propósito.

## Lo que este documento no decide

- Cuántas horas exactamente vive una invitación sin usar. §6.1 fija el orden
  de magnitud y no el número.
- Qué ve quien invita mientras la invitación está pendiente, más allá de poder
  anularla.
- **Qué pasa si se pierde la cuenta de quien abrió la ficha.** El tutor ya
  confirmó que el segundo tutor no reparte ni administra accesos, y así está
  escrito. Lo que cuelga de esa decisión y conviene mirar una vez:
  `pet_owners` cae con `on delete cascade` sobre `auth.users`, así que si esa
  cuenta de Google se pierde, **el perro se queda sin nadie que pueda dar ni
  quitar accesos**, y sin nadie que pueda borrarlo.

## Lo que hay que respetar al construirlo

- **Dimensionado, y esto el documento lo tenía mal.** Decía que un permiso es
  «un insert, no un cambio de esquema». El _modelo de datos_ sí es aditivo; la
  _superficie de políticas_ no. `is_pet_owner` responde «¿eres miembro?» y
  **diecinueve políticas lo preguntan** — tres sobre `pets`, doce sobre
  `pet_events`, `pet_weights` y `pet_treatments`, y cuatro sobre Storage.
  Darle nivel a la membresía obliga a decir _qué_ nivel en las diecinueve.
  Esto no es una rama de una versión.
- **Toda escritura sobre `pet_owners` es la frontera de seguridad, no solo el
  `insert`.** Era cierto antes de este diseño, cuando solo se podía entrar.
  Ahora hay retirar, prorrogar y cambiar rol, es decir `UPDATE` y `DELETE`, y
  **un `UPDATE` mal escrito deja que un cuidador se suba a sí mismo el rol** —
  que es el agujero entero de esta funcionalidad en una línea. La forma que
  este proyecto ya conoce es una función `security definer` —como
  `create_pet_with_owner`— que comprueba la invitación y hace el insert en una
  transacción; las tres operaciones nuevas piden el mismo trato.
- **Las políticas de Storage NO heredan el reparto, y el documento decía que
  sí.** Era el único sitio donde le decía al constructor que no hiciera nada, y
  era el peor sitio para equivocarse: `0005_pet_photos_bucket.sql` define
  cuatro políticas —leer, subir, reemplazar, borrar— y **las cuatro preguntan
  solo si existes en `pet_owners`**. Tal cual, un familiar puede reemplazar o
  borrar la foto del perro. Leer sí se hereda; escribir hay que cerrarlo a
  tutor. La cabecera de esa migración promete que compartir «gives them the
  photo too without touching storage» — es verdad a medias y hay que
  reescribirla, porque es de donde salió el error.
- **El `check` de `role` solo admite dos valores.** `role text not null default
'owner' check (role in ('owner', 'member'))`. Cuatro son una migración de la
  restricción, y `'member'` no sobrevive a ella: hoy lo lleva —o debería— la
  fila metida a mano, que es un tutor. Los cuatro valores los nombra quien
  construya; lo que no puede pasar es que el de quien abrió la ficha y el del
  segundo tutor sean el mismo, porque es justo la distinción que la lista de
  accesos tiene que enseñar (§3).
- **La fila metida a mano hay que migrarla**, y no se puede distinguir por el
  rol: lo más probable es que las dos digan `'owner'`, porque el insert a mano
  habrá tomado el valor por defecto. Se distingue por `joined_at` —quien abrió
  la ficha es el primero— y conviene no descubrirlo en producción.
- **`created_by` se fija en la política** (§8): escribible hoy, columna de
  seguridad mañana.
- **Escanear un QR es un módulo nativo; dibujarlo no.** Pintarlo se apoya en
  `react-native-svg`, que ya está en `package.json`, así que es una librería JS
  encima y no cambia nada. Leerlo pide cámara: dependencia nativa, permiso en
  el manifiesto, y **un dev build recompilado** (`pnpm android`) en vez de
  recargado — la misma lección que dejó `expo-image-manipulator`. Por eso el
  orden acordado deja escanear para el final, y por eso puede caerse a la
  versión siguiente sin arrastrar nada (§6).
- **La suite e2e necesita una segunda cuenta.** Todo lo que este documento
  describe ocurre entre dos personas, y `e2e/auth.ts` siembra una. Sin la
  segunda no hay forma de probar que un cuidador _no_ puede hacer algo, que es
  justamente lo que no se puede dejar sin probar. Y sigue en pie la regla de
  siempre: **una sola suite a la vez en esta máquina**, porque comparten
  cuenta de Supabase.
- **La cola de pendientes puede sobrevivir al acceso.** `lib/pending.ts`
  reintenta siempre y no descarta nunca, así que un cierre de paseo guardado
  con el móvil sin cobertura puede subir cuando el cuidador ya es familiar. La
  política lo rechazará, y `flushPending` tiene que leer eso como `gone` —algo
  que ya no puede ocurrir— y no como un fallo que se reintenta para siempre.
- Las preferencias de dispositivo —formatos de hora y duración, el cumpleaños
  ya celebrado— siguen siendo del dispositivo. Se pusieron ahí en su día
  pensando exactamente en este caso, así que no necesitan nada.
- La lógica pura va en `lib/` y se prueba con Jest; los flujos, con
  Playwright. **Un permiso mal calculado no lanza**: enseña a alguien algo que
  no debería ver.
