# Criterios de aceptación — Sprint 3

Criterios para copiar en Jira. Las historias no tenían criterios definidos; estos describen lo que
hace el sistema y cada escenario está cubierto por `backend/tests/sprint2.test.js` (`npm test`).

---

## AN-15 — Cancelar citas por veterinario

*Yo como veterinario quiero poder cancelar las citas que tengo agendadas para ajustar mi disponibilidad.*

* **Escenario 1: Cancelación con motivo**
  * **Dado que** el veterinario ve una cita próxima (pendiente o confirmada) en "Mi agenda",
  * **Cuando** presiona "Cancelar cita", escribe un motivo opcional y confirma,
  * **Entonces** la cita pasa a "Cancelada", el horario queda libre en su agenda y el cliente recibe una notificación con el motivo.
* **Escenario 2: Motivo demasiado largo**
  * **Dado que** el veterinario está cancelando una cita,
  * **Cuando** el motivo supera los 200 caracteres,
  * **Entonces** el sistema no cancela la cita y muestra el error correspondiente.
* **Escenario 3: Citas que no se pueden cancelar**
  * **Dado que** la cita ya está cancelada, fue atendida o su hora ya pasó,
  * **Cuando** el veterinario intenta cancelarla,
  * **Entonces** el sistema lo impide e indica el motivo.
* **Escenario 4: Citas de otro veterinario**
  * **Dado que** una cita pertenece a la agenda de otro veterinario,
  * **Cuando** se intenta cancelar,
  * **Entonces** el sistema responde que la cita no existe.

---

## AN-16 — Modificar citas por veterinario

*Yo como veterinario quiero poder modificar las citas que tengo agendadas para ajustar mi disponibilidad.*

* **Escenario 1: Reprogramar a un horario libre**
  * **Dado que** el veterinario tiene una cita próxima,
  * **Cuando** presiona "Reprogramar", elige una nueva fecha y una hora de las que el sistema ofrece como libres y guarda,
  * **Entonces** la cita queda en el nuevo horario, el horario anterior se libera y el cliente recibe una notificación con la fecha anterior, la nueva y el motivo (si lo escribió).
* **Escenario 2: Horario no válido**
  * **Dado que** el veterinario está reprogramando,
  * **Cuando** elige un horario ocupado por otra cita, bloqueado, fuera de su horario de atención, igual al actual o en el pasado,
  * **Entonces** el sistema no hace el cambio y muestra el motivo.
* **Escenario 3: Confirmar una cita**
  * **Dado que** la cita está "Pendiente" y su hora no ha pasado,
  * **Cuando** el veterinario presiona "Confirmar",
  * **Entonces** la cita pasa a "Confirmada" y el cliente recibe una notificación.
* **Escenario 4: Iniciar y terminar la atención**
  * **Dado que** la hora de la cita ya llegó,
  * **Cuando** el veterinario presiona "Iniciar atención",
  * **Entonces** la cita pasa a "En atención" (sigue ocupando la agenda, no se puede reprogramar ni cancelar) y lo lleva a la historia clínica de la mascota con esa cita elegida. La cita pasa a "Completada" solo al terminar la atención desde la historia clínica (con mascota) o con "Terminar atención" (sin mascota), y se avisa al dueño.
* **Escenario 5: Permisos**
  * **Dado que** un cliente intenta confirmar, reprogramar o completar una cita,
  * **Cuando** envía la acción,
  * **Entonces** el sistema la rechaza: son acciones exclusivas del veterinario.

---

## AN-17 — Visualizar citas pendientes por veterinario

*Yo como veterinario quiero poder visualizar las citas pendientes de un día específico para organizar mi agenda y gestionar mejor mi tiempo.*

* **Escenario 1: Agenda del día**
  * **Dado que** el veterinario entra a "Mi agenda",
  * **Cuando** la página carga,
  * **Entonces** ve las citas del día de hoy ordenadas por hora, con un resumen de cuántas están pendientes y cuántas confirmadas.
* **Escenario 2: Cambiar de día**
  * **Dado que** el veterinario está en "Mi agenda",
  * **Cuando** usa las flechas, el calendario o el botón "Hoy",
  * **Entonces** el sistema muestra las citas del día elegido. Con "Todas las próximas" ve las citas futuras de todos los días.
* **Escenario 3: Filtrar por estado**
  * **Dado que** el veterinario ve un día de su agenda,
  * **Cuando** elige "Pendientes y confirmadas", "Pendientes" o "Todas",
  * **Entonces** la lista muestra solo las citas de ese estado.
* **Escenario 4: Día sin citas**
  * **Dado que** el día elegido no tiene citas con el filtro aplicado,
  * **Cuando** carga la lista,
  * **Entonces** el sistema muestra "No tienes citas para este día con este filtro."
* **Escenario 5: Datos de cada cita**
  * **Dado que** el veterinario ve una cita,
  * **Cuando** revisa la tarjeta,
  * **Entonces** ve hora, cliente, correo, servicio, duración, modalidad, mascota, dirección (si es a domicilio) y el motivo de consulta.

---

## AN-22 — Visualizar notificaciones por usuario

*Yo como usuario quiero poder visualizar mis notificaciones que me envía el sistema, para estar informado sobre mis citas.*

* **Escenario 1: Contador en la cabecera**
  * **Dado que** el dueño de mascota tiene notificaciones sin leer,
  * **Cuando** navega por la plataforma,
  * **Entonces** la campana de la barra superior muestra la cantidad sin leer.
* **Escenario 2: Listado de notificaciones**
  * **Dado que** el dueño entra a "Notificaciones",
  * **Cuando** la página carga,
  * **Entonces** ve sus avisos del más reciente al más antiguo, con fecha y hora, y puede filtrar "Todas" o "Sin leer".
* **Escenario 3: Avisos que recibe**
  * **Dado que** ocurre un cambio en una de sus citas,
  * **Cuando** el veterinario la confirma, la reprograma o la cancela, o se acerca la cita (24 horas antes),
  * **Entonces** el dueño recibe una notificación con el detalle.
* **Escenario 4: Marcar como leídas**
  * **Dado que** el dueño tiene notificaciones sin leer,
  * **Cuando** presiona "Marcar como leída" en una o "Marcar todas como leídas",
  * **Entonces** el contador baja y la notificación aparece como leída. Solo afecta a sus propias notificaciones.
* **Escenario 5: Sin notificaciones**
  * **Dado que** el dueño no tiene notificaciones,
  * **Cuando** entra a la página,
  * **Entonces** el sistema muestra "Todavía no tienes notificaciones."

---

## AN-23 — Visualizar notificaciones por veterinario

*Yo como veterinario quiero poder visualizar las notificaciones que el sistema me envía sobre mis citas y cancelaciones, para estar informado en tiempo real.*

* **Escenario 1: Avisos que recibe**
  * **Dado que** ocurre algo en su agenda o en su cuenta,
  * **Cuando** un cliente agenda una cita, la cancela o la califica, se acerca una cita (24 horas antes) o el administrador aprueba, suspende o reactiva su cuenta,
  * **Entonces** el veterinario recibe una notificación con el detalle.
* **Escenario 2: Contador, listado y marcar como leídas**
  * Igual que los escenarios 1, 2 y 4 de AN-22.

* **Escenario 3: Emergencias (urgencias)**
  * **Dado que** un dueño pide atención urgente para su mascota,
  * **Cuando** el veterinario está dentro de su horario de atención (Mi horario), sin bloqueos, y la modalidad pedida (veterinaria o domicilio) es una de las que atiende,
  * **Entonces** recibe una notificación "URGENCIA…" con el nombre del dueño, la mascota y un resumen de los síntomas, y la ve en la sección "Urgencias".
* **Escenario 4: Disponibilidad según Mi horario**
  * **Dado que** el veterinario tiene la cuenta aprobada,
  * **Cuando** la hora actual cae dentro de su horario semanal (los próximos 30 minutos), sin un bloqueo de agenda y sin otra urgencia en curso,
  * **Entonces** está disponible y recibe urgencias, sin ponerse "de turno" aparte. Fuera de su horario, con un bloqueo, o con una cuenta sin aprobar, no recibe ni puede aceptar urgencias.
* **Escenario 5: Aceptar una urgencia**
  * **Dado que** hay una urgencia abierta,
  * **Cuando** el veterinario pulsa "Aceptar",
  * **Entonces** el caso queda a su nombre, ve el teléfono del dueño y el dueño recibe una notificación con su teléfono. Se crea una cita confirmada de 30 minutos que ocupa su agenda. Si otro veterinario la aceptó antes, o venció, se le informa. No puede aceptar otra mientras tiene una en curso.
* **Escenario 5b: Urgencia con citas en ese horario**
  * **Dado que** el veterinario tiene citas que se cruzan con los próximos 30 minutos,
  * **Cuando** pulsa "Aceptar",
  * **Entonces** el sistema le muestra esas citas y le pide confirmar; si confirma ("Aceptar y pedir que reagenden"), esas citas se cancelan y cada cliente recibe una notificación pidiéndole que reagende, porque la urgencia tiene prioridad. Si no confirma, nada cambia.
* **Escenario 6: Cerrar o liberar**
  * **Dado que** el veterinario tiene una urgencia en curso,
  * **Cuando** pulsa "Iniciar atención" va a la historia clínica de la mascota con la cita de la urgencia, y al terminar ahí ("Guardar y terminar atención") la urgencia se cierra y el dueño es notificado (una urgencia sin mascota se termina con "Terminar atención"); mientras no inicie la atención puede pulsar "No puedo atenderla": la urgencia se abre de nuevo para los demás, el dueño es notificado y su agenda queda libre.

## Urgencias — criterios del dueño de mascota

*Yo como dueño de mascota quiero pedir atención urgente para recibir ayuda de un veterinario disponible lo antes posible.*

* **Escenario 1: Aviso de emergencia vital**
  * **Dado que** el dueño entra a "Urgencias",
  * **Cuando** la página carga,
  * **Entonces** ve el aviso de que, si su mascota está inconsciente, convulsiona, no respira o sangra mucho, debe acudir de inmediato a la clínica veterinaria más cercana, y que AnimalCare no garantiza una respuesta.
* **Escenario 2: Veterinarios disponibles**
  * **Dado que** el dueño quiere pedir una urgencia,
  * **Cuando** no hay veterinarios atendiendo en este momento para la modalidad elegida,
  * **Entonces** el sistema lo informa, no crea la solicitud y sugiere acudir a la clínica más cercana.
* **Escenario 3: Pedir la urgencia**
  * **Dado que** hay veterinarios atendiendo ahora,
  * **Cuando** el dueño elige la mascota (obligatoria), describe qué le pasa (mínimo 10 caracteres), elige la modalidad, indica la dirección si es a domicilio y un teléfono válido,
  * **Entonces** se avisa a los veterinarios disponibles compatibles y el dueño ve "Buscando un veterinario disponible…" con la hora límite. Solo puede tener una urgencia en curso.
* **Escenario 4: Veterinario asignado**
  * **Dado que** un veterinario aceptó la urgencia,
  * **Cuando** el dueño mira "Urgencias" (la pantalla se actualiza sola cada 10 segundos),
  * **Entonces** ve el nombre del veterinario, su teléfono y, si es en la veterinaria, la dirección.
* **Escenario 5: Cancelar**
  * **Dado que** la urgencia está abierta o aceptada,
  * **Cuando** el dueño la cancela y confirma,
  * **Entonces** se cierra y, si había un veterinario asignado, se le avisa.
* **Escenario 6: Sin respuesta**
  * **Dado que** nadie acepta la urgencia en 30 minutos,
  * **Cuando** vence,
  * **Entonces** la solicitud se cierra como "Sin respuesta" y el dueño puede pedir otra.
* **Escenario 7: Historia clínica**
  * **Dado que** el veterinario aceptó una urgencia indicando una mascota,
  * **Cuando** la atiende o la marca como atendida,
  * **Entonces** puede ver y escribir en la historia clínica de esa mascota; si libera la urgencia, pierde ese acceso.

---

## AN-18 — Crear historia clínica

*Yo como veterinario quiero poder crear una historia clínica para llevar el control de la mascota.*

La historia clínica de una mascota es la lista de sus entradas, una por consulta.

* **Escenario 1: Registrar una consulta atendida**
  * **Dado que** el veterinario inició la atención de una cita con una mascota ("En atención"),
  * **Cuando** llena la historia en esa pantalla (o, para una consulta atendida que quedó sin registrar, usa "Registrar consulta en la historia"), con motivo y diagnóstico (obligatorios) y, si aplica, tratamiento, peso, temperatura, vacunas y observaciones,
  * **Entonces** puede "Guardar avance" (guarda y sigue editando durante la consulta), "Guardar y terminar atención" (guarda, cierra la cita y vuelve a la agenda) o "Terminar sin registrar" (con confirmación, solo si aún no guardó nada). El sistema guarda la entrada con la fecha de la cita, actualiza el peso de la mascota si lo registró y notifica al dueño. Toda entrada pertenece a una cita.
* **Escenario 2: Campos obligatorios y rangos**
  * **Dado que** el veterinario está creando una entrada,
  * **Cuando** deja vacío el motivo o el diagnóstico, escribe una temperatura fuera de 30–45 °C, un peso fuera de 0–200 kg o una fecha futura,
  * **Entonces** el sistema no guarda y muestra los errores.
* **Escenario 3: Una entrada por cita**
  * **Dado que** una cita ya tiene una entrada en la historia,
  * **Cuando** el veterinario intenta registrarla de nuevo,
  * **Entonces** el sistema lo impide.
* **Escenario 4: Acceso del veterinario**
  * **Dado que** un veterinario no tiene ni tuvo citas con una mascota,
  * **Cuando** intenta ver su historia o escribir en ella,
  * **Entonces** el sistema responde que la mascota no existe o que no tiene acceso.
* **Escenario 5: Adjuntar exámenes o radiografías**
  * **Dado que** el veterinario escribió una entrada vigente,
  * **Cuando** presiona "Adjuntar archivo" y elige un PDF, JPG o PNG de hasta 5 MB,
  * **Entonces** el archivo queda en la entrada (hasta 10 por entrada) y se muestra con su nombre, tipo y tamaño.
* **Escenario 6: Archivos no permitidos**
  * **Dado que** el veterinario intenta adjuntar un archivo,
  * **Cuando** el formato no es PDF, JPG o PNG, el contenido no corresponde a su formato, pesa más de 5 MB o la entrada ya tiene 10 archivos,
  * **Entonces** el sistema no lo guarda y explica el motivo.
* **Escenario 7: Quitar un archivo**
  * **Dado que** el veterinario es el autor de la entrada,
  * **Cuando** presiona "Quitar" en un adjunto y confirma,
  * **Entonces** el archivo desaparece de la entrada y se borra del servidor. Otro veterinario o el dueño no pueden quitarlo.

---

## AN-19 — Eliminar historia clínica

*Yo como veterinario, quiero poder eliminar una historia clínica existente para mantener actualizada la información.*

Por tratarse de información médica, eliminar **anula** la entrada: se conserva para auditoría.

* **Escenario 1: Eliminar con motivo**
  * **Dado que** el veterinario escribió una entrada,
  * **Cuando** presiona "Eliminar", escribe el motivo (obligatorio) y confirma,
  * **Entonces** la entrada queda como "Eliminada": el dueño deja de verla y el veterinario la ve aparte, con el motivo.
* **Escenario 2: Solo el autor**
  * **Dado que** la entrada la escribió otro veterinario,
  * **Cuando** se intenta eliminar,
  * **Entonces** el sistema lo impide.
* **Escenario 3: Entrada ya eliminada**
  * **Dado que** la entrada ya fue eliminada,
  * **Cuando** se intenta eliminar o modificar de nuevo,
  * **Entonces** el sistema lo impide.

---

## AN-20 — Modificar historia clínica

*Yo como veterinario quiero poder modificar una historia clínica existente para actualizar los datos de la mascota, del diagnóstico o del dueño.*

* **Escenario 1: Modificar una entrada propia**
  * **Dado que** el veterinario escribió una entrada vigente,
  * **Cuando** presiona "Modificar", cambia los datos y guarda,
  * **Entonces** la entrada se actualiza y queda marcada como "editada". Si cambió el peso, se actualiza el peso de la mascota.
* **Escenario 2: Entradas de otros veterinarios**
  * **Dado que** otro veterinario que también atiende a la mascota ve la historia,
  * **Cuando** revisa las entradas,
  * **Entonces** puede leerlas, pero no modificarlas.
* **Escenario 3: Validaciones**
  * Mismas reglas de campos obligatorios y rangos que AN-18.

> Nota: los datos del dueño los administra el propio dueño desde su cuenta; el veterinario modifica
> los datos clínicos y el peso de la mascota.

---

## AN-21 — Acceder a la historia clínica de la mascota por usuario

*Yo como usuario quiero poder acceder a la historia clínica de mi mascota para ver el estado de esta.*

* **Escenario 1: Consultar la historia**
  * **Dado que** el dueño está en "Mis mascotas",
  * **Cuando** presiona "Historia clínica" en una de ellas,
  * **Entonces** ve los datos de la mascota y sus consultas de la más reciente a la más antigua, con fecha, veterinario, motivo, diagnóstico, tratamiento, signos y vacunas.
* **Escenario 2: Solo lectura y sin entradas eliminadas**
  * **Dado que** el dueño consulta la historia,
  * **Cuando** revisa las entradas,
  * **Entonces** no puede modificarlas y no ve las entradas eliminadas por el veterinario.
* **Escenario 3: Historia vacía**
  * **Dado que** la mascota aún no tiene registros,
  * **Cuando** el dueño abre la historia,
  * **Entonces** el sistema indica que el veterinario agrega los registros después de cada consulta.
* **Escenario 4: Privacidad**
  * **Dado que** la mascota pertenece a otro usuario,
  * **Cuando** se intenta abrir su historia,
  * **Entonces** el sistema responde que la mascota no existe o que no tiene acceso.
* **Escenario 5: Imprimir**
  * **Dado que** la historia tiene registros,
  * **Cuando** el dueño presiona "Imprimir",
  * **Entonces** se imprime solo el contenido de la historia, sin menús ni botones.
* **Escenario 6: Ver los archivos adjuntos**
  * **Dado que** el veterinario adjuntó archivos a una entrada,
  * **Cuando** el dueño abre la historia y pulsa el nombre de un archivo,
  * **Entonces** el archivo se abre en otra pestaña. Los archivos son privados: solo los ven el dueño de la mascota y los veterinarios que la atienden; con la sesión cerrada, o con la sesión de otro dueño, no se descargan.
* **Escenario 7: Entrada eliminada**
  * **Dado que** el veterinario eliminó una entrada,
  * **Cuando** el dueño consulta la historia,
  * **Entonces** ya no ve la entrada ni puede descargar sus archivos.
