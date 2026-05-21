// ═══════════════════════════════════════════════════════════════
// APPS SCRIPT — CÉLULAS J&L  (v4 — Acceso por roles / ministerio)
// ═══════════════════════════════════════════════════════════════
//
// CAMBIOS vs v3:
//   1. Hoja "Usuarios": cada persona tiene su propia clave.
//   2. resolverUsuario(pass) → identifica rol y alcance por la clave.
//   3. getReportes / getInscripciones / getDashboard / getCelulasPorLider
//      ahora FILTRAN del lado del servidor según el ministerio del
//      usuario. Un Líder de 12 nunca recibe datos de otros ministerios.
//   4. La clave maestra (DASHBOARD_PASSWORD) sigue funcionando como
//      admin total, por compatibilidad mientras montas la hoja Usuarios.
//
// ROLES:
//   - "admin"   → ve TODO (Pastores + Juan David Correa).
//   - "lider12" → ve su ministerio (Líder de 12 = su nombre) + su
//                  propia célula (Nombre Líder = su nombre).
//
// HOJA "Usuarios" (en el spreadsheet de Inscripciones), columnas:
//   Clave | Rol | Lider12 | Nombre
//   ej:  claveAleja | lider12 | Aleja Leiva | Aleja Leiva
//        clavePastor | admin  |             | Ps Jhonatan y Leidy
// ═══════════════════════════════════════════════════════════════

const SHEET_INSCRIPCIONES_ID = "1YNV9G05L6ZdD0G3SfqKurGIIlSRWCHzO_zJIc_VEcAU";
const SHEET_REPORTES_ID      = "1DJuDbsuTT408BAHLOhrjbvdyUiFUKJiqsPHLiufxKJ8";

const PESTAÑA_INSCRIPCIONES  = "datos";
const PESTAÑA_REPORTES       = "datos";
const PESTAÑA_USUARIOS       = "Usuarios";   // hoja nueva con credenciales

const DASHBOARD_PASSWORD = "celulas2025";    // clave maestra = admin total

const COLS_INSCRIPCION = [
  "Timestamp",
  "Nombre Líder",
  "WhatsApp",
  "Líder de 12",
  "Co-lider",
  "Nombre Célula",
  "Red",
  "Tipo",
  "Modalidad",
  "Días",
  "Hora",
  "Comuna",
  "Barrio",
  "Dirección",
  "Lat",
  "Lng"
];

const COLS_REPORTE = [
  "Timestamp",
  "Líder de 12",
  "Nombre Líder",
  "Red Célula",
  "Fecha Célula",
  "Se Realizó",
  "Motivo No Realizada",
  "Próxima Fecha",
  "Modalidad",
  "Tipo Reunión",
  "Día Semana",
  "Hora",
  "Total Asistentes",
  "Miembros Regulares",
  "Visitantes Nuevos",
  "Asistieron Iglesia",
  "Tema",
  "Material",
  "Otro Material",
  "Peticiones y Notas"
];


// ═══════════════════════════════════════════════════════════════
// USUARIOS Y ALCANCE (control de acceso)
// ═══════════════════════════════════════════════════════════════

// Lee la hoja "Usuarios". Devuelve [] si no existe o está vacía.
function getUsuarios() {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_INSCRIPCIONES_ID).getSheetByName(PESTAÑA_USUARIOS);
    if (!sheet) return [];
    const raw = sheet.getDataRange().getValues();
    if (raw.length <= 1) return [];

    const headers = raw[0].map(h => h.toString().trim());
    const iClave = headers.indexOf("Clave");
    const iRol   = headers.indexOf("Rol");
    const iL12   = headers.indexOf("Lider12");
    const iNom   = headers.indexOf("Nombre");
    if (iClave < 0) return [];

    const users = [];
    for (let i = 1; i < raw.length; i++) {
      const clave = (raw[i][iClave] || "").toString().trim();
      if (!clave) continue;
      users.push({
        clave:   clave,
        rol:     ((iRol >= 0 ? raw[i][iRol] : "") || "").toString().trim().toLowerCase() || "lider12",
        lider12: ((iL12 >= 0 ? raw[i][iL12] : "") || "").toString().trim(),
        nombre:  ((iNom >= 0 ? raw[i][iNom] : "") || "").toString().trim()
      });
    }
    return users;
  } catch (e) {
    Logger.log("Error leyendo Usuarios: " + e);
    return [];
  }
}

// Dada una clave, devuelve { rol, lider12, nombre } o null si no es válida.
function resolverUsuario(pass) {
  if (!pass) return null;

  // Compatibilidad: la clave maestra es admin total.
  if (pass === DASHBOARD_PASSWORD) {
    return { rol: "admin", lider12: "", nombre: "Administrador" };
  }

  const usuarios = getUsuarios();
  for (let i = 0; i < usuarios.length; i++) {
    if (usuarios[i].clave === pass) {
      const u = usuarios[i];
      return {
        rol:     u.rol === "admin" ? "admin" : "lider12",
        lider12: u.lider12,
        nombre:  u.nombre
      };
    }
  }
  return null;
}

// ¿La fila (su Líder de 12 y su Nombre Líder) está dentro del alcance del usuario?
function dentroDeAlcance(user, lider12Fila, nombreLiderFila) {
  if (!user || user.rol === "admin") return true;
  const l12 = (lider12Fila || "").toString().trim();
  const nom = (nombreLiderFila || "").toString().trim();
  return (user.lider12 && l12 === user.lider12) ||
         (user.nombre  && nom === user.nombre);
}


// ═══════════════════════════════════════════════════════════════
// GET — Endpoints de lectura
// ═══════════════════════════════════════════════════════════════
function doGet(e) {
  const action = e.parameter.action;
  const pass   = e.parameter.pass || "";

  // getLideres es público (lo usa el formulario de inscripción).
  if (action === "getLideres") {
    return getLideresPorMinisterio();
  }

  const user = resolverUsuario(pass);
  if (!user) {
    return jsonResponse({ success: false, error: "No autorizado" });
  }

  if (action === "getDashboard")       return getDashboard(user);
  if (action === "getReportes")        return getReportes(user);
  if (action === "getInscripciones")   return getInscripciones(user);
  if (action === "getCelulasPorLider") return getCelulasPorLider(e.parameter.lider, user);

  return jsonResponse({ error: "Acción no reconocida" });
}

function getCelulasPorLider(nombreLider, user) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_INSCRIPCIONES_ID).getSheetByName(PESTAÑA_INSCRIPCIONES);
    const raw   = sheet.getDataRange().getValues();
    const headers = raw[0];

    const idxNombre    = headers.indexOf("Nombre Líder");
    const idxLider12   = headers.indexOf("Líder de 12");
    const idxRed       = headers.indexOf("Red");
    const idxNombreCel = headers.indexOf("Nombre Célula");

    const celulas = [];
    for (let i = 1; i < raw.length; i++) {
      const nombre = (raw[i][idxNombre] || "").toString().trim();
      if (nombre !== nombreLider) continue;
      if (!dentroDeAlcance(user, raw[i][idxLider12], nombre)) continue;
      celulas.push({
        red:          (raw[i][idxRed]       || "").toString().trim(),
        nombreCelula: (raw[i][idxNombreCel] || "").toString().trim()
      });
    }

    return jsonResponse({ success: true, data: celulas });
  } catch (e) {
    return jsonResponse({ success: false, error: e.toString() });
  }
}


// ═══════════════════════════════════════════════════════════════
// POST — Endpoints de escritura
// ═══════════════════════════════════════════════════════════════
function doPost(e) {
  try {
    const data   = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === "inscripcion") return guardarInscripcion(data);
    if (action === "reporte")     return guardarReporte(data);

    return jsonResponse({ success: false, error: "Acción no reconocida" });
  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}


// ═══════════════════════════════════════════════════════════════
// GUARDAR INSCRIPCIÓN
// ─ Guarda la fila y geocodifica AL MOMENTO de inscribir.
// ─ El dashboard nunca tendrá que geocodificar nada.
// ═══════════════════════════════════════════════════════════════
function guardarInscripcion(data) {
  const sheet = getOrCreateSheet(SHEET_INSCRIPCIONES_ID, PESTAÑA_INSCRIPCIONES, COLS_INSCRIPCION);

  // Primero intentamos geocodificar antes de guardar
  const { lat, lng } = geocodificarDireccion(
    data.direccion || "",
    data.barrio    || "",
    data.comuna    || ""
  );

  const fila = [
    new Date().toLocaleString("es-CO"),
    data.nombreLider       || "",
    data.whatsapp          || "",
    data.lider12           || "",
    data.coLider           || "",
    data.nombreCelula      || "",
    data.red               || "",
    data.tipo              || "",
    data.modalidad         || "",
    (data.dias || []).join(", "),
    data.hora              || "",
    data.comuna            || "",
    data.barrio            || "",
    data.direccion         || "",
    lat,   // ← coordenadas guardadas desde el primer momento
    lng
  ];

  sheet.appendRow(fila);
  Logger.log("✅ Inscripción guardada con coordenadas: " + data.nombreLider + " [" + lat + ", " + lng + "]");
  return jsonResponse({ success: true, message: "Inscripción guardada correctamente" });
}


// ═══════════════════════════════════════════════════════════════
// GEOCODIFICAR UNA DIRECCIÓN (función auxiliar central)
// ─ Intenta con dirección completa primero, luego solo barrio.
// ─ Retorna { lat, lng } — nunca lanza excepción.
// ═══════════════════════════════════════════════════════════════
function geocodificarDireccion(direccion, barrio, comuna) {
  const partes = [direccion, barrio, comuna, "Medellín, Colombia"].filter(Boolean);
  const query  = partes.join(", ");

  try {
    Utilities.sleep(300);
    const geo = Maps.newGeocoder().geocode(query);
    if (geo.results && geo.results.length > 0) {
      return {
        lat: geo.results[0].geometry.location.lat,
        lng: geo.results[0].geometry.location.lng
      };
    }
  } catch (e1) {
    Logger.log("⚠️ Geocoding detallado falló: " + e1.toString());
  }

  // Fallback: solo barrio + ciudad
  if (barrio) {
    try {
      Utilities.sleep(500);
      const geo2 = Maps.newGeocoder().geocode(barrio + ", Medellín, Colombia");
      if (geo2.results && geo2.results.length > 0) {
        return {
          lat: geo2.results[0].geometry.location.lat,
          lng: geo2.results[0].geometry.location.lng
        };
      }
    } catch (e2) {
      Logger.log("⚠️ Geocoding simplificado falló: " + e2.toString());
    }
  }

  // Si todo falla, retornar vacío (no el centro de Medellín, para distinguir errores)
  return { lat: "", lng: "" };
}


// ═══════════════════════════════════════════════════════════════
// GET INSCRIPCIONES — SOLO LECTURA, SIN GEOCODIFICACIÓN
// ─ Lee lat/lng del Sheet directamente.
// ─ Filtra por el alcance del usuario (ministerio + célula propia).
// ═══════════════════════════════════════════════════════════════
function getInscripciones(user) {
  try {
    const ss    = SpreadsheetApp.openById(SHEET_INSCRIPCIONES_ID);
    const sheet = ss.getSheetByName(PESTAÑA_INSCRIPCIONES);
    if (!sheet) return jsonResponse({ success: false, error: "Hoja no encontrada" });

    const raw  = sheet.getDataRange().getValues();
    if (raw.length <= 1) return jsonResponse({ success: true, data: [] });

    const headers      = raw[0];
    const idxNombre    = headers.indexOf("Nombre Líder");
    const idxLider12   = headers.indexOf("Líder de 12");
    const idxCoLider   = headers.indexOf("Co-lider");
    const idxRed       = headers.indexOf("Red");
    const idxTipo      = headers.indexOf("Tipo");
    const idxModalidad = headers.indexOf("Modalidad");
    const idxDias      = headers.indexOf("Días");
    const idxHora      = headers.indexOf("Hora");
    const idxComuna    = headers.indexOf("Comuna");
    const idxBarrio    = headers.indexOf("Barrio");
    const idxDireccion = headers.indexOf("Dirección");
    const idxNombreCel = headers.indexOf("Nombre Célula");
    const idxWa        = headers.indexOf("WhatsApp");
    const idxLat       = headers.indexOf("Lat");
    const idxLng       = headers.indexOf("Lng");

    const celulas = [];

    for (let i = 1; i < raw.length; i++) {
      const row    = raw[i];
      const nombre = (row[idxNombre] || "").toString().trim();
      if (!nombre) continue;

      // ── Control de acceso: solo lo del ministerio del usuario ──
      if (!dentroDeAlcance(user, row[idxLider12], nombre)) continue;

      const latGuardado = parseFloat(row[idxLat]);
      const lngGuardado = parseFloat(row[idxLng]);
      const tieneCoords = !isNaN(latGuardado) && !isNaN(lngGuardado) && latGuardado !== 0;

      celulas.push({
        nombre:       nombre,
        nombreCelula: (row[idxNombreCel] || "").toString().trim(),
        lider12:      (row[idxLider12]   || "").toString().trim(),
        whatsapp:     (row[idxWa]        || "").toString().trim(),
        coLider:      (row[idxCoLider]   || "").toString().trim(),
        red:          (row[idxRed]       || "").toString().trim(),
        tipo:         (row[idxTipo]      || "").toString().trim(),
        modalidad:    (row[idxModalidad] || "").toString().trim(),
        dias:         (row[idxDias]      || "").toString().trim(),
        hora:         (row[idxHora]      || "").toString().trim(),
        comuna:       (row[idxComuna]    || "").toString().trim(),
        barrio:       (row[idxBarrio]    || "").toString().trim(),
        direccion:    (row[idxDireccion] || "").toString().trim(),
        lat:          tieneCoords ? latGuardado : 6.2442,   // centro Medellín como fallback visual
        lng:          tieneCoords ? lngGuardado : -75.5812,
        geocoded:     tieneCoords  // el dashboard puede mostrar un ícono diferente si es false
      });
    }

    return jsonResponse({ success: true, data: celulas });

  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}


// ═══════════════════════════════════════════════════════════════
// GEOCODIFICAR TODAS — Ejecutar MANUALMENTE una sola vez
// ─ Recorre el Sheet y geocodifica solo las filas sin coordenadas.
// ─ En el editor de Apps Script: Ejecutar > geocodificarTodas
// ─ Con muchas filas: ejecutar varias veces (el sleep de 1s evita
//   superar la cuota de Maps API).
// ═══════════════════════════════════════════════════════════════
function geocodificarTodas() {
  const ss    = SpreadsheetApp.openById(SHEET_INSCRIPCIONES_ID);
  const sheet = ss.getSheetByName(PESTAÑA_INSCRIPCIONES);
  const raw   = sheet.getDataRange().getValues();
  const headers = raw[0];

  const idxNombre    = headers.indexOf("Nombre Líder");
  const idxBarrio    = headers.indexOf("Barrio");
  const idxComuna    = headers.indexOf("Comuna");
  const idxDireccion = headers.indexOf("Dirección");
  const idxLat       = headers.indexOf("Lat");
  const idxLng       = headers.indexOf("Lng");

  let procesadas = 0;
  let omitidas   = 0;
  let errores    = 0;

  for (let i = 1; i < raw.length; i++) {
    const row    = raw[i];
    const nombre = (row[idxNombre] || "").toString().trim();
    if (!nombre) continue;

    // Si ya tiene coordenadas válidas, omitir
    const latExiste = parseFloat(row[idxLat]);
    const lngExiste = parseFloat(row[idxLng]);
    if (!isNaN(latExiste) && latExiste !== 0 && !isNaN(lngExiste)) {
      omitidas++;
      continue;
    }

    const { lat, lng } = geocodificarDireccion(
      (row[idxDireccion] || "").toString().trim(),
      (row[idxBarrio]    || "").toString().trim(),
      (row[idxComuna]    || "").toString().trim()
    );

    if (lat !== "" && lng !== "") {
      sheet.getRange(i + 1, idxLat + 1).setValue(lat);
      sheet.getRange(i + 1, idxLng + 1).setValue(lng);
      Logger.log("✅ [" + (i) + "] " + nombre + ": " + lat + ", " + lng);
      procesadas++;
    } else {
      Logger.log("❌ [" + (i) + "] Sin resultado: " + nombre);
      errores++;
    }

    // Pausa de 1 segundo entre llamadas para respetar límites de la API
    Utilities.sleep(1000);
  }

  Logger.log("════════════════════════════════");
  Logger.log("✅ Geocodificación completada");
  Logger.log("   Procesadas: " + procesadas);
  Logger.log("   Omitidas (ya tenían coords): " + omitidas);
  Logger.log("   Sin resultado: " + errores);
}


// ═══════════════════════════════════════════════════════════════
// GUARDAR REPORTE (sin cambios)
// ═══════════════════════════════════════════════════════════════
function guardarReporte(data) {
  const sheet = getOrCreateSheet(SHEET_REPORTES_ID, PESTAÑA_REPORTES, COLS_REPORTE);

  const fila = [
    new Date().toLocaleString("es-CO"),
    data.lider12             || "",
    data.nombreLider         || "",
    data.red || "",
    data.fechaCelula         || "",
    data.seRealizo           || "",
    data.motivoNoRealizada   || "",
    data.proximaFecha        || "",
    data.modalidad           || "",
    data.tipoReunion         || "",
    data.diaSemana           || "",
    data.hora                || "",
    data.totalAsistentes     || 0,
    data.miembrosRegulares   || 0,
    data.visitantesNuevos    || 0,
    data.asisitieronIglesia  || 0,
    data.tema                || "",
    data.material            || "",
    data.otroMaterial        || "",
    data.peticiones          || ""
  ];

  sheet.appendRow(fila);
  Logger.log("✅ Reporte guardado: " + data.nombreLider);
  return jsonResponse({ success: true, message: "Reporte guardado correctamente" });
}


// ═══════════════════════════════════════════════════════════════
// GET LÍDERES (público — sin cambios)
// ═══════════════════════════════════════════════════════════════
function getLideresPorMinisterio() {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_INSCRIPCIONES_ID).getSheetByName(PESTAÑA_INSCRIPCIONES);
    if (!sheet) return jsonResponse({ success: false, error: "Hoja no encontrada" });

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return jsonResponse({ success: true, data: {} });

    const headers    = data[0];
    const idxNombre  = headers.indexOf("Nombre Líder");
    const idxLider12 = headers.indexOf("Líder de 12");
    const idxRed     = headers.indexOf("Red");

    const mapa = {};   // { lider12: [nombre, ...] }
    const reds = {};   // { nombre: [red, ...] }  → para que el formulario sepa las células de cada líder
    for (let i = 1; i < data.length; i++) {
      const nombre  = (data[i][idxNombre]  || "").toString().trim();
      const lider12 = (data[i][idxLider12] || "").toString().trim();
      if (nombre && lider12) {
        if (!mapa[lider12]) mapa[lider12] = [];
        if (!mapa[lider12].includes(nombre)) mapa[lider12].push(nombre);
      }
      if (nombre && idxRed >= 0) {
        const red = (data[i][idxRed] || "").toString().trim();
        if (red) {
          if (!reds[nombre]) reds[nombre] = [];
          if (!reds[nombre].includes(red)) reds[nombre].push(red);
        }
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, data: mapa, reds: reds }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}


// ═══════════════════════════════════════════════════════════════
// GET REPORTES — filtrado por alcance del usuario
// ═══════════════════════════════════════════════════════════════
function getReportes(user) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_REPORTES_ID).getSheetByName(PESTAÑA_REPORTES);
    if (!sheet) return jsonResponse({ success: false, error: "Hoja no encontrada" });

    const raw = sheet.getDataRange().getValues();
    if (raw.length <= 1) return jsonResponse({ success: true, data: [] });

    const headers  = raw[0];
    const idxL12   = headers.indexOf("Líder de 12");
    const idxLider = headers.indexOf("Nombre Líder");

    const reportes = [];
    for (let i = 1; i < raw.length; i++) {
      const row = raw[i];

      // ── Control de acceso: solo reportes del ministerio del usuario ──
      if (!dentroDeAlcance(user, row[idxL12], row[idxLider])) continue;

      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = row[idx] !== undefined ? row[idx].toString().trim() : "";
      });
      reportes.push(obj);
    }

    return jsonResponse({ success: true, data: reportes });

  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}


// ═══════════════════════════════════════════════════════════════
// GET DASHBOARD — Métricas pre-calculadas (filtradas por alcance)
// ─ El frontend recalcula casi todo, pero igual devolvemos todo
//   recortado al ministerio del usuario + su rol/alcance.
// ═══════════════════════════════════════════════════════════════
function getDashboard(user) {
  try {
    const sheetInsc = SpreadsheetApp.openById(SHEET_INSCRIPCIONES_ID).getSheetByName(PESTAÑA_INSCRIPCIONES);
    const rawInsc   = sheetInsc ? sheetInsc.getDataRange().getValues() : [[]];
    const headersInsc = rawInsc[0] || [];
    const idxRedInsc     = headersInsc.indexOf("Red");
    const idxLider12Insc = headersInsc.indexOf("Líder de 12");
    const idxNombreInsc  = headersInsc.indexOf("Nombre Líder");

    let totalCelulas = 0;
    const porRed = {};
    for (let i = 1; i < rawInsc.length; i++) {
      const nombre = (rawInsc[i][idxNombreInsc] || "").toString().trim();
      if (!nombre) continue;
      if (!dentroDeAlcance(user, rawInsc[i][idxLider12Insc], nombre)) continue;
      totalCelulas++;
      const red = (rawInsc[i][idxRedInsc] || "Sin red").toString().trim();
      porRed[red] = (porRed[red] || 0) + 1;
    }

    const sheetRep   = SpreadsheetApp.openById(SHEET_REPORTES_ID).getSheetByName(PESTAÑA_REPORTES);
    const rawRep     = sheetRep ? sheetRep.getDataRange().getValues() : [[]];
    const headersRep = rawRep[0] || [];

    const idxFecha    = headersRep.indexOf("Fecha Célula");
    const idxRealizo  = headersRep.indexOf("Se Realizó");
    const idxTotal    = headersRep.indexOf("Total Asistentes");
    const idxNuevos   = headersRep.indexOf("Visitantes Nuevos");
    const idxIglesia  = headersRep.indexOf("Asistieron Iglesia");
    const idxLider    = headersRep.indexOf("Nombre Líder");
    const idxLider12R = headersRep.indexOf("Líder de 12");

    const hoy        = new Date();
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - hoy.getDay());
    inicioSemana.setHours(0, 0, 0, 0);
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    let totalAsistentesSemana = 0, totalAsistentesMes = 0;
    let nuevosMes = 0, asistieronIglesiaMes = 0;
    let reportesSemana = 0, reportesMes = 0;
    const tendencia = {};

    for (let i = 1; i < rawRep.length; i++) {
      const row = rawRep[i];

      // ── Control de acceso ──
      if (!dentroDeAlcance(user, row[idxLider12R], row[idxLider])) continue;

      const realizo = (row[idxRealizo] || "").toString().toLowerCase();
      if (!realizo.includes("sí") && !realizo.includes("si")) continue;

      const fechaStr = (row[idxFecha] || "").toString().trim();
      const fecha    = new Date(fechaStr);
      if (isNaN(fecha.getTime())) continue;

      const asistentes = parseInt(row[idxTotal]   || 0) || 0;
      const nuevos     = parseInt(row[idxNuevos]  || 0) || 0;
      const iglesia    = parseInt(row[idxIglesia] || 0) || 0;

      if (fecha >= inicioSemana) { totalAsistentesSemana += asistentes; reportesSemana++; }
      if (fecha >= inicioMes)   { totalAsistentesMes += asistentes; nuevosMes += nuevos; asistieronIglesiaMes += iglesia; reportesMes++; }

      const semanaKey = getSemanaKey(fecha);
      if (!tendencia[semanaKey]) {
        tendencia[semanaKey] = { asistentes: 0, nuevos: 0, reportes: 0, label: getSemanaLabel(fecha) };
      }
      tendencia[semanaKey].asistentes += asistentes;
      tendencia[semanaKey].nuevos     += nuevos;
      tendencia[semanaKey].reportes++;
    }

    const tendenciaArr = Object.entries(tendencia)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, val]) => val);

    const hace30dias = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);
    const celulasActivas = new Set();
    for (let i = 1; i < rawRep.length; i++) {
      const row     = rawRep[i];
      if (!dentroDeAlcance(user, row[idxLider12R], row[idxLider])) continue;
      const realizo = (row[idxRealizo] || "").toString().toLowerCase();
      if (!realizo.includes("sí") && !realizo.includes("si")) continue;
      const fecha = new Date((row[idxFecha] || "").toString().trim());
      if (!isNaN(fecha.getTime()) && fecha >= hace30dias) {
        const lider = (row[idxLider] || "").toString().trim();
        if (lider) celulasActivas.add(lider);
      }
    }

    return jsonResponse({
      success: true,
      data: {
        // Identidad / alcance para el frontend
        rol:     user.rol,
        lider12: user.lider12,
        nombre:  user.nombre,
        // Métricas (ya recortadas al alcance)
        totalCelulas, celulasActivas: celulasActivas.size, porRed,
        asistentesSemana: totalAsistentesSemana, reportesSemana,
        asistentesMes: totalAsistentesMes, nuevosMes,
        asistieronIglesiaMes, reportesMes,
        tendencia: tendenciaArr,
        metaAsistentes: 500
      }
    });

  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}


// ═══════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════

function getOrCreateSheet(spreadsheetId, sheetName, columns) {
  const ss  = SpreadsheetApp.openById(spreadsheetId);
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(columns);
    sheet.getRange(1, 1, 1, columns.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Crea la hoja "Usuarios" con los encabezados y filas de ejemplo.
// Ejecútala UNA vez desde el editor (Ejecutar > crearHojaUsuarios)
// y luego edita las claves reales en la hoja.
function crearHojaUsuarios() {
  const ss = SpreadsheetApp.openById(SHEET_INSCRIPCIONES_ID);
  let sheet = ss.getSheetByName(PESTAÑA_USUARIOS);
  if (!sheet) sheet = ss.insertSheet(PESTAÑA_USUARIOS);
  sheet.clear();
  sheet.appendRow(["Clave", "Rol", "Lider12", "Nombre"]);
  sheet.getRange(1, 1, 1, 4).setFontWeight("bold");
  sheet.setFrozenRows(1);
  // Filas de ejemplo (cámbialas por las reales):
  sheet.appendRow(["cambia-esta-pastor", "admin",   "",             "Ps Jhonatan y Leidy Herrera"]);
  sheet.appendRow(["cambia-esta-jdc",    "admin",   "",             "Juan David Correa"]);
  sheet.appendRow(["cambia-esta-aleja",  "lider12", "Aleja Leiva",  "Aleja Leiva"]);
  Logger.log("Hoja 'Usuarios' lista. Edita las claves reales.");
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSemanaKey(fecha) {
  const d     = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo    = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return d.getUTCFullYear() + "-W" + String(weekNo).padStart(2, "0");
}

function getSemanaLabel(fecha) {
  const meses  = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const d      = new Date(fecha);
  const dayNum = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dayNum);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo    = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `Sem ${weekNo} ${meses[d.getMonth()]}`;
}
