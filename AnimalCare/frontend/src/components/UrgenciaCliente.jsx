// Urgencias, vista del dueño de mascota: pedir atencion urgente y seguir el estado.
import { useState } from "react";

import Alerta from "./Alerta";
import { useSondeo } from "../hooks/useSondeo";
import { listarMascotas } from "../services/pet.service";
import {
  disponibilidadUrgencias,
  pedirUrgencia,
  cancelarUrgencia,
  misUrgencias,
  ESTADOS_URGENCIA,
  INTERVALO_SONDEO_MS,
  MIN_SINTOMAS,
  MAX_SINTOMAS,
  haceCuanto,
  horaLocal,
  telefonoValido,
} from "../services/emergency.service";
import { MODALIDADES } from "../services/vet.service";
import { obtenerMensajesDeError } from "../services/api";

const FORMULARIO_VACIO = { petId: "", symptoms: "", mode: "CLINIC", address: "", phone: "" };

function UrgenciaCliente() {
  const [estado, setEstado] = useState({ active: null, emergencies: [] });
  const [disponibilidad, setDisponibilidad] = useState(null);
  const [mascotas, setMascotas] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [datos, setDatos] = useState(FORMULARIO_VACIO);
  const [errores, setErrores] = useState([]);
  const [exito, setExito] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);

  async function cargar() {
    try {
      const [mias, disp] = await Promise.all([misUrgencias(), disponibilidadUrgencias()]);
      setEstado(mias);
      setDisponibilidad(disp);
    } catch {
      // Un fallo de red pasajero no debe tapar lo que ya se mostraba.
    } finally {
      setCargado(true);
    }
  }

  // Estado de la urgencia y de los veterinarios de turno, cada 10 segundos.
  useSondeo(cargar, INTERVALO_SONDEO_MS);
  // Las mascotas se piden una sola vez.
  useSondeo(
    () =>
      listarMascotas()
        .then((r) => setMascotas(r.pets))
        .catch(() => setMascotas([])),
    24 * 60 * 60 * 1000
  );

  function cambiar(e) {
    const { name, value } = e.target;
    setDatos((a) => ({ ...a, [name]: name === "phone" ? value.replace(/[^0-9+\s-]/g, "") : value }));
  }

  function validar() {
    const mensajes = [];
    if (datos.symptoms.trim().length < MIN_SINTOMAS) {
      mensajes.push(`Describe qué le pasa a tu mascota (mínimo ${MIN_SINTOMAS} caracteres).`);
    }
    if (datos.mode === "HOME" && datos.address.trim() === "") {
      mensajes.push("Indica la dirección a la que debe ir el veterinario.");
    }
    if (!telefonoValido(datos.phone)) {
      mensajes.push("Escribe un teléfono de contacto válido.");
    }
    return mensajes;
  }

  async function enviar(evento) {
    evento.preventDefault();
    const mensajes = validar();
    if (mensajes.length > 0) {
      setExito([]);
      setErrores(mensajes);
      return;
    }
    setErrores([]);
    setEnviando(true);
    try {
      const r = await pedirUrgencia({
        petId: datos.petId ? Number(datos.petId) : null,
        symptoms: datos.symptoms.trim(),
        mode: datos.mode,
        address: datos.mode === "HOME" ? datos.address.trim() : null,
        phone: datos.phone.trim(),
      });
      setExito([r.message]);
      setDatos(FORMULARIO_VACIO);
      await cargar();
    } catch (error) {
      setErrores(obtenerMensajesDeError(error));
      await cargar();
    } finally {
      setEnviando(false);
    }
  }

  async function cancelar() {
    setErrores([]);
    try {
      const r = await cancelarUrgencia(estado.active.id);
      setExito([r.message]);
    } catch (error) {
      setErrores(obtenerMensajesDeError(error));
    } finally {
      setConfirmandoCancelar(false);
      await cargar();
    }
  }

  const activa = estado.active;
  const sinVeterinarios = disponibilidad && disponibilidad.onDuty === 0;
  const historial = estado.emergencies.filter((e) => !activa || e.id !== activa.id);

  return (
    <>
      <div className="tarjeta">
        <h1>Urgencias</h1>
        <p className="texto-suave">
          Avisamos a los veterinarios que están de turno y te mostramos aquí quién acepta atender a tu mascota.
        </p>
        <div className="alerta-urgencia" role="note">
          <strong>Si tu mascota está inconsciente, convulsiona, no respira o sangra mucho, no esperes:</strong> llévala de
          inmediato a la clínica veterinaria más cercana. AnimalCare conecta con veterinarios de turno, pero no puede
          garantizar una respuesta.
        </div>
      </div>

      <Alerta tipo="exito" mensajes={exito} />
      <Alerta tipo="error" mensajes={errores} />

      {!cargado && <p className="texto-suave">Cargando...</p>}

      {activa && activa.status === "OPEN" && (
        <div className="tarjeta urgencia-estado urgencia-buscando" role="status">
          <span className="pulso" aria-hidden="true" />
          <div>
            <h3>Buscando un veterinario de turno…</h3>
            <p>
              Pedida {haceCuanto(activa.createdAt)}. Si nadie la acepta antes de las{" "}
              <strong>{horaLocal(activa.expiresAt)}</strong>, la solicitud se cierra y podrás intentarlo de nuevo.
            </p>
            <p className="texto-suave">
              {activa.pet ? `${activa.pet.name} · ` : ""}
              {MODALIDADES[activa.mode]} · “{activa.symptoms}”
            </p>
          </div>
        </div>
      )}

      {activa && activa.status === "ACCEPTED" && activa.vet && (
        <div className="tarjeta urgencia-estado urgencia-aceptada" role="status">
          <div>
            <h3>{activa.vet.name} atenderá tu urgencia</h3>
            <p>
              {activa.mode === "CLINIC"
                ? `Te espera en ${activa.vet.address || "su veterinaria"}.`
                : `Va en camino a: ${activa.address}.`}
            </p>
            {activa.vet.phone ? (
              <p>
                Llámalo ahora: <a href={`tel:${activa.vet.phone}`}>{activa.vet.phone}</a>
              </p>
            ) : (
              <p className="texto-suave">Te contactará al número que dejaste: {activa.phone}.</p>
            )}
            <p className="texto-suave">
              {activa.vet.specialty} · aceptada {haceCuanto(activa.acceptedAt)}
            </p>
          </div>
        </div>
      )}

      {activa && (
        <div className="tarjeta">
          {confirmandoCancelar ? (
            <div className="acciones-linea" role="alertdialog">
              <strong>¿Cancelar la urgencia?</strong>
              <button type="button" className="boton boton-peligro boton-auto" onClick={cancelar}>
                Sí, cancelar
              </button>
              <button type="button" className="boton boton-secundario boton-auto" onClick={() => setConfirmandoCancelar(false)}>
                No
              </button>
            </div>
          ) : (
            <button type="button" className="boton boton-secundario boton-auto" onClick={() => setConfirmandoCancelar(true)}>
              {activa.status === "OPEN" ? "Cancelar la solicitud" : "Ya no la necesito"}
            </button>
          )}
        </div>
      )}

      {cargado && !activa && (
        <form className="tarjeta" onSubmit={enviar} noValidate>
          <h3>Pedir atención urgente</h3>

          {disponibilidad && (
            <p className={sinVeterinarios ? "urgencia-sin-turno" : "texto-suave"}>
              {sinVeterinarios
                ? "Ahora mismo no hay veterinarios de turno. Si tu mascota está grave, acude a la clínica veterinaria más cercana."
                : `Hay ${disponibilidad.onDuty} veterinario(s) de turno ahora (${disponibilidad.clinic} en veterinaria, ${disponibilidad.home} a domicilio).`}
            </p>
          )}

          {mascotas.length > 0 && (
            <div className="campo">
              <label htmlFor="urg-mascota">Mascota</label>
              <select id="urg-mascota" name="petId" value={datos.petId} onChange={cambiar}>
                <option value="">Sin elegir</option>
                {mascotas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.species})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="campo">
            <label htmlFor="urg-sintomas">
              ¿Qué le pasa? <span className="obligatorio">*</span>
            </label>
            <textarea
              id="urg-sintomas"
              name="symptoms"
              rows={3}
              maxLength={MAX_SINTOMAS}
              value={datos.symptoms}
              onChange={cambiar}
              placeholder="Ej.: vomita desde hace 2 horas, no quiere moverse y tiene el abdomen duro."
            />
            <span className="ayuda">
              {datos.symptoms.length}/{MAX_SINTOMAS}
            </span>
          </div>

          <fieldset className="selector-rol">
            <legend>
              ¿Dónde la atienden? <span className="obligatorio">*</span>
            </legend>
            {["CLINIC", "HOME"].map((modo) => (
              <label key={modo} className={`opcion-rol ${datos.mode === modo ? "activa" : ""}`}>
                <input
                  type="radio"
                  name="mode"
                  value={modo}
                  checked={datos.mode === modo}
                  onChange={cambiar}
                />
                <span className="opcion-rol-titulo">{MODALIDADES[modo]}</span>
                <span className="opcion-rol-texto">
                  {modo === "CLINIC" ? "Llevas a tu mascota al consultorio." : "El veterinario va hasta tu casa."}
                </span>
              </label>
            ))}
          </fieldset>

          {datos.mode === "HOME" && (
            <div className="campo">
              <label htmlFor="urg-direccion">
                Dirección de la visita <span className="obligatorio">*</span>
              </label>
              <input
                id="urg-direccion"
                name="address"
                maxLength={150}
                value={datos.address}
                onChange={cambiar}
                placeholder="Carrera 7 # 40-15, apto 302"
              />
            </div>
          )}

          <div className="campo">
            <label htmlFor="urg-telefono">
              Teléfono de contacto <span className="obligatorio">*</span>
            </label>
            <input
              id="urg-telefono"
              name="phone"
              inputMode="tel"
              maxLength={15}
              value={datos.phone}
              onChange={cambiar}
              placeholder="3001234567"
            />
            <span className="ayuda">El veterinario que acepte te llamará a este número.</span>
          </div>

          <button type="submit" className="boton boton-peligro-solido boton-enviar" disabled={enviando || sinVeterinarios}>
            {enviando ? "Enviando..." : "Pedir atención urgente"}
          </button>
        </form>
      )}

      {historial.length > 0 && (
        <div className="tarjeta">
          <h3>Mis urgencias anteriores</h3>
          <ul className="urgencia-historial">
            {historial.map((u) => (
              <li key={u.id}>
                <div>
                  <strong>{u.pet ? u.pet.name : "Sin mascota indicada"}</strong>
                  <span className="texto-suave"> · {MODALIDADES[u.mode]}</span>
                  <p className="texto-suave">“{u.symptoms}”</p>
                  {u.vet && <p className="texto-suave">Atendida por {u.vet.name}</p>}
                </div>
                <span className={`etiqueta etiqueta-urgencia-${u.status.toLowerCase()}`}>{ESTADOS_URGENCIA[u.status]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

export default UrgenciaCliente;
