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

**Esa prueba es para elegir la palabra, no para escribirla en pantalla**, y es
mi criterio: la lista pone etiquetas —`Tutor`, `Cuidador`, `Familiar`— y no
frases. En cuanto el rol entra en una oración hay que concordarlo —_Laura es
cuidadora_— y la app no sabe el género de nadie: Google da un nombre para
mostrar, no un género, y adivinarlo por el nombre es justo lo que no se hace.
`Familiar` no tiene ese problema; `Cuidador` y `Tutor` sí.

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
sobre un rol que ya existe. La palabra «administrador» se queda fuera por
donde vino —nadie es administrador de un perro— y lo que la sustituye es
decir qué hizo:

```
Aingeru   Tutor · abrió la ficha           (tú)
Laura     Tutor
Julen     Cuidador · hasta el dom 12:00    editar
Ane       Familiar                         editar
```

**Y esa lista no es informativa: es el mando.** Es donde se cambia un rol, se
prorroga una ventana y se retira un acceso, y de paso donde se ve de un
vistazo quién puede hacerlo. Hoy no existe ninguna pantalla así, y es la que
convierte «dar acceso» en algo que también se puede deshacer — que es el
tercero de los tres problemas de la fila metida a mano.

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

A cambio, la app gana una puerta por el lado de quien entra —**«Pedir
acceso»**— y los dos caminos acaban en el mismo campo de texto:

- **Delante del otro:** quien invita enseña el QR; el otro lo escanea.
- **Por WhatsApp:** quien invita copia el código; el otro lo pega.

> Dale esto a quien vaya a cuidar a Loki: **7K4P-2M9X-R3TD**

**El QR no lleva nada que el código no lleve.** Un mecanismo, dos formas de
introducirlo, y escanear es siempre opcional: un código que solo entra por la
cámara es un código que falla cuando la cámara no enfoca.

**«Pedir acceso» no pide nada**, y hay que decirlo porque el nombre invita a
construir otra cosa. No hay cola de solicitudes ni aprobación al otro lado:
quien tiene el código ya está autorizado, y esa pantalla es solo donde se
escribe. El nombre funciona desde el lado de quien entra —«quiero acceso al
perro de mi hermano»— y es exactamente la parte que hay que vigilar al
construirla.

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
   **Y no es la ventana de acceso:** son dos relojes distintos y conviene no
   confundirlos al construir. Éste mide cuánto vive una invitación _sin usar_;
   el de §7 mide cuánto dura el acceso que concede, y puede empezar días
   después de canjearse.
4. **Límite de intentos**, por código y por cuenta que prueba. Sin esto, 1 y 3
   solo suben el precio de la fuerza bruta; no la impiden.
5. **Revocable y visible.** Quien invita ve las invitaciones pendientes y
   puede anular una antes de que se use. Un código dado por error hoy no se
   puede retirar de ninguna manera.

Si algún día se quiere la versión fuerte, es un campo: atar el código a un
correo de Google. Queda escrito para no tener que redescubrir que era barato.

### 7. El acceso tiene ventana, y al terminar baja de rol

Un acceso se concede **desde una fecha-hora hasta otra fecha-hora**,
prorrogable. No «hasta el domingo»: hasta el domingo a las 12:00.

**La referencia la trajo el tutor y es la correcta:** la cerradura Nuki
reparte así sus accesos temporales —un interruptor que activa la ventana, y
debajo inicio y fin con día y hora cada uno—, que es exactamente la forma de
este problema. **Lo recurrente de esa misma pantalla queda fuera**: «todos los
sábados de 10:00 a 14:00» no describe a nadie de esta casa, y es la clase de
campo que se añade el día que alguien lo pide.

**La ventana es opcional**, como ese interruptor. Un tutor no la lleva; un
cuidador de fin de semana sí.

**Al vencer no desaparece: pasa a familiar.** Así la caducidad deja de ser
una pérdida y es un cambio de rol — que es lo que el tutor describe de su
hermano: mientras cuida, escribe; el resto del año, mira los paseos. La única
excepción se explica sola: un familiar con ventana no tiene a dónde bajar, así
que al terminar pierde el acceso. **Es mi criterio** decir la regla en ese
orden —la caída primero, el suelo después—, porque al revés son dos reglas y
así es una con un borde.

**Y con fecha-hora de inicio existe un estado nuevo: la ventana que aún no ha
empezado.** La misma regla lo cubre sin inventar nada: **antes de abrirse,
familiar; dentro, el rol concedido; después, familiar otra vez.** El hermano
puede canjear el código el martes para un acceso que abre el viernes, y hasta
el viernes ve los paseos sin poder escribirlos.

**La caducidad se aplica en la política de base de datos, no en la pantalla.**
Es la diferencia entre una promesa y un decorado — y con dos extremos son dos
comparaciones, no una.

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
asc limit 1` en `lib/pets.ts`— y seis pantallas lo preguntan por su cuenta.
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
- **Escanear un QR es un módulo nativo; dibujarlo no.** Pintarlo es una
  librería JS y no cambia nada. Leerlo pide cámara: dependencia nativa, permiso
  en el manifiesto, y **un dev build recompilado** (`pnpm android`) en vez de
  recargado — la misma lección que dejó `expo-image-manipulator`. Como teclear
  el código es siempre posible (§6), la cámara puede llegar la última sin
  bloquear nada.
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
