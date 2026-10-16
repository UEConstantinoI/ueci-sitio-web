/**
 * FORMULARIOS DEL SITIO — Unidad Educativa Constantino I
 * ─────────────────────────────────────────────────────────────────────────────
 * Recibe lo que escriben las familias en los formularios del sitio
 * (“Contáctenos” y “Admisiones”), lo valida, lo guarda en la hoja de cálculo
 * del colegio y avisa por correo.
 *
 * ES UN PROYECTO APARTE del panel (script.google.com → Nuevo proyecto), porque
 * debe ser público (cualquier persona puede enviar el formulario), mientras que
 * el panel solo lo abre gente del colegio.
 *
 * Instalación (una sola vez):
 *  1. script.google.com → Nuevo proyecto → pegar este archivo completo.
 *  2. Abajo, en CONFIG, poner HOJA_ID = el ID de la hoja de cálculo del PANEL
 *     (es el texto largo de su dirección: docs.google.com/spreadsheets/d/ESTE_TEXTO/edit).
 *  3. Implementar → Nueva implementación → tipo “Aplicación web”
 *        Ejecutar como: Yo        Quién tiene acceso: Cualquier persona
 *     Autorizar los permisos y copiar la dirección que termina en /exec.
 *  4. Pasar esa dirección a quien mantiene el sitio (va una sola vez en js/main.js).
 *  Si luego se cambia este código: Implementar → Administrar implementaciones →
 *  editar → Versión: Nueva versión (la dirección /exec no cambia).
 *
 * Se crean solas las pestañas “Consultas” y “Admisiones” en la hoja del panel,
 * y desde el panel (menú “Consultas y admisiones”) se leen y se marcan atendidas.
 */

const CONFIG = {
  HOJA_ID: '',                                   // ← ID de la hoja de cálculo del panel
  AVISO_A: 'javier.lopez@ueconstantino.com',     // correo de respaldo; el que vale se cambia desde el panel (pestaña “Ajustes” de la hoja)
  MAX_POR_DIA: 150,                              // tope de envíos por día y por formulario
  MIN_MS: 3000,                                  // un formulario no se envía en menos de 3 s
  ZONA: 'America/La_Paz'
};

const HOJA_AJUSTES = 'Ajustes';
const HOJA_CONSULTAS = 'Consultas';
const HOJA_ADMISIONES = 'Admisiones';
const CAB_CONSULTAS = ['Fecha', 'Código', 'Nombre', 'Teléfono', 'Correo', 'Mensaje', 'Estado', 'Atendido por', 'Atendido el'];
const CAB_ADMISIONES = ['Fecha', 'Código', 'Estudiante', 'Nacimiento', 'Nivel', 'Grado', 'Colegio anterior', 'Tutor', 'Teléfonos', 'WhatsApp', 'Correo', 'Comentario', 'Estado', 'Atendido por', 'Atendido el'];

const GRADOS = {
  INICIAL: ['Pre-Kinder', 'Kinder'],
  PRIMARIA: ['Primero', 'Segundo', 'Tercero', 'Cuarto', 'Quinto', 'Sexto'],
  SECUNDARIA: ['Primero', 'Segundo', 'Tercero', 'Cuarto', 'Quinto', 'Sexto']
};

/* ───────────────────────── Entrada ───────────────────────── */

function doGet() {
  return salida_({ ok: true, mensaje: 'Formularios del colegio en línea.' });
}

function doPost(e) {
  try {
    const crudo = e && e.postData && e.postData.contents ? String(e.postData.contents) : '';
    if (!crudo || crudo.length > 8000) return salida_({ ok: false, error: 'El envío no es válido.' });
    let d;
    try { d = JSON.parse(crudo); } catch (x) { return salida_({ ok: false, error: 'El envío no es válido.' }); }
    if (!d || typeof d !== 'object') return salida_({ ok: false, error: 'El envío no es válido.' });
    return salida_(procesar_(d));
  } catch (err) {
    if (err && err.esValidacion) return salida_({ ok: false, error: err.message });
    console.error(err && err.stack || err);
    return salida_({ ok: false, error: 'No pudimos guardar tu mensaje en este momento. Escríbenos por WhatsApp o inténtalo más tarde.' });
  }
}

function salida_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function procesar_(d) {
  // Trampa para robots: un campo oculto que una persona nunca llena.
  if (d.web) return { ok: true, codigo: 'OK-0000' };
  const t = Number(d.t);
  if (!isFinite(t) || t < CONFIG.MIN_MS) throw err_('Por favor revisa los datos y vuelve a enviar.');

  let fila, cabeceras, hoja, prefijo, resumen, asunto, replyTo;
  if (d.tipo === 'contacto') {
    const v = {
      nombre: mayus_(txt_(d.nombre, 80, 'Nombre')),
      telefono: tel_(d.telefono, 'Teléfono'),
      email: correo_(d.email, 'Correo', true),
      mensaje: mayus_(txt_(d.mensaje, 600, 'Consulta', true))
    };
    hoja = HOJA_CONSULTAS; cabeceras = CAB_CONSULTAS; prefijo = 'CON';
    fila = function (cod) { return [ahora_(), cod, v.nombre, v.telefono, v.email, v.mensaje, 'Nuevo', '', '']; };
    asunto = 'Consulta desde el sitio: ' + v.nombre;
    resumen = 'Nombre: ' + v.nombre + '\nTeléfono: ' + v.telefono + '\nCorreo: ' + (v.email || '(no indicó)') + '\n\nConsulta:\n' + (v.mensaje || '(sin mensaje)');
    replyTo = v.email;
    var clave = ['c', v.nombre, v.telefono, v.mensaje].join('|');
  } else if (d.tipo === 'admision') {
    const nivel = String(d.nivel || '').toUpperCase();
    if (!GRADOS[nivel]) throw err_('Elige el nivel (Inicial, Primaria o Secundaria).');
    const grado = String(d.grado || '');
    if (GRADOS[nivel].indexOf(grado) < 0) throw err_('Elige el curso al que desea ingresar.');
    const v = {
      estudiante: mayus_(txt_(d.estudiante, 90, 'Nombre del estudiante')),
      nacimiento: fecha_(d.nacimiento, 'Fecha de nacimiento'),
      colegio: mayus_(txt_(d.colegio, 90, 'Colegio anterior', true)),
      tutor: mayus_(txt_(d.tutor, 90, 'Nombre del padre, madre o tutor')),
      telefonos: telOpc_(d.telefonos, 'Otro número', 40),
      whatsapp: tel_(d.whatsapp, 'Celular (WhatsApp)'),
      email: correo_(d.email, 'Correo electrónico', true),
      comentario: mayus_(txt_(d.comentario, 600, 'Comentario', true))
    };
    hoja = HOJA_ADMISIONES; cabeceras = CAB_ADMISIONES; prefijo = 'ADM';
    fila = function (cod) { return [ahora_(), cod, v.estudiante, v.nacimiento, nivel, grado, v.colegio, v.tutor, v.telefonos, v.whatsapp, v.email, v.comentario, 'Nuevo', '', '']; };
    asunto = 'Solicitud de admisión: ' + v.estudiante + ' (' + grado + ' ' + nivel.toLowerCase() + ')';
    resumen = 'ESTUDIANTE\n  Nombre: ' + v.estudiante + '\n  Nacimiento: ' + v.nacimiento + '\n  Curso: ' + grado + ' de ' + nivel.toLowerCase() + '\n  Colegio anterior: ' + (v.colegio || '(no indicó)') +
      '\n\nPADRE, MADRE O TUTOR\n  Nombre: ' + v.tutor + '\n  Celular (WhatsApp): ' + v.whatsapp + '\n  Otro número: ' + (v.telefonos || '(no indicó)') + '\n  Correo: ' + (v.email || '(no indicó)') +
      '\n\nComentario: ' + (v.comentario || '(ninguno)');
    replyTo = v.email;
    var clave = ['a', v.estudiante, v.whatsapp, v.nacimiento].join('|');
  } else {
    throw err_('El envío no es válido.');
  }

  // Mismo envío repetido (doble clic, reintento): no se duplica.
  const cache = CacheService.getScriptCache();
  const ck = 'f' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, clave)).slice(0, 40);
  const previo = cache.get(ck);
  if (previo) return { ok: true, codigo: previo, repetido: true };

  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  let codigo;
  try {
    // Tope diario (frena a quien intente llenar la hoja o los correos).
    const props = PropertiesService.getScriptProperties();
    const kd = 'n_' + prefijo + '_' + Utilities.formatDate(new Date(), CONFIG.ZONA, 'yyyyMMdd');
    const n = Number(props.getProperty(kd) || 0);
    if (n >= CONFIG.MAX_POR_DIA) throw err_('Hoy recibimos muchos envíos. Escríbenos por WhatsApp para atenderte enseguida.');
    props.setProperty(kd, String(n + 1));

    const sh = hojaDe_(hoja, cabeceras);
    const num = sh.getLastRow();                         // fila 1 = encabezados → el primer registro es 1
    codigo = codigo_(prefijo, num);
    const datos = fila(codigo);
    const rango = sh.getRange(num + 1, 1, 1, datos.length);
    rango.setNumberFormat('@');                          // todo como texto: nada se interpreta como fórmula
    rango.setValues([datos]);
  } finally {
    lock.releaseLock();
  }
  cache.put(ck, codigo, 600);

  try {
    MailApp.sendEmail({
      to: destinoAviso_(),
      subject: limpiarLinea_(asunto) + ' [' + codigo + ']',
      body: 'Código: ' + codigo + '\n\n' + resumen + '\n\n— Recibido por el sitio web. Se puede atender desde el panel (Consultas y admisiones).',
      replyTo: replyTo || destinoAviso_().split(',')[0]
    });
  } catch (x) { console.error('No se pudo enviar el aviso: ' + x); }   // el registro ya quedó guardado
  return { ok: true, codigo: codigo };
}

/* ───────────────────────── Validaciones ───────────────────────── */

function err_(msg) { const e = new Error(msg); e.esValidacion = true; return e; }

function limpiarLinea_(s) { return String(s || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150); }

function txt_(v, max, nombre, opcional) {
  if (v === undefined || v === null) v = '';
  if (typeof v !== 'string') throw err_('Revisa el campo “' + nombre + '”.');
  const t = v.replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ').replace(/[ \t]+/g, ' ').trim();   // se conservan los saltos de línea
  if (!t && !opcional) throw err_('Falta completar “' + nombre + '”.');
  if (t.length > max) throw err_('“' + nombre + '” es muy largo (máximo ' + max + ' letras).');
  return t;
}

function tel_(v, nombre, max) {
  const t = txt_(v, max || 25, nombre);
  if (!/^[0-9+()\-\s\/.,y]{6,}$/i.test(t) || (t.match(/\d/g) || []).length < 6) throw err_('Revisa el número en “' + nombre + '”.');
  return t;
}

function correo_(v, nombre, opcional) {
  const t = txt_(v, 80, nombre, opcional);
  if (t && !/^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/.test(t)) throw err_('Revisa el correo electrónico.');
  return t;
}

function fecha_(v, nombre) {
  const t = txt_(v, 10, nombre);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) throw err_('Revisa la fecha de nacimiento.');
  const y = +m[1], mo = +m[2], d = +m[3];
  const f = new Date(Date.UTC(y, mo - 1, d));
  if (f.getUTCFullYear() !== y || f.getUTCMonth() !== mo - 1 || f.getUTCDate() !== d) throw err_('Revisa la fecha de nacimiento.');
  const hoy = new Date();
  const edad = (hoy.getTime() - f.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (edad < 2 || edad > 19) throw err_('Revisa la fecha de nacimiento.');
  return t;
}

/* ───────────────────────── Correo de aviso (se cambia desde el panel) ───────────────────────── */

// Una o varias direcciones separadas por coma (máximo 3). Devuelve '' si alguna no es válida.
function correosAviso_(txt) {
  const lista = String(txt || '').split(/[,;\s]+/).filter(function (x) { return x; });
  if (!lista.length || lista.length > 3) return '';
  for (let i = 0; i < lista.length; i++) { if (!/^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/.test(lista[i]) || lista[i].length > 80) return ''; }
  return lista.join(', ');
}

function destinoAviso_() {
  try {
    const sh = SpreadsheetApp.openById(CONFIG.HOJA_ID).getSheetByName(HOJA_AJUSTES);
    if (sh && sh.getLastRow() >= 1) {
      const v = sh.getRange(1, 1, sh.getLastRow(), 2).getValues();
      for (let i = 0; i < v.length; i++) {
        if (String(v[i][0]).trim() === 'aviso_a') { const ok = correosAviso_(v[i][1]); if (ok) return ok; }
      }
    }
  } catch (e) { console.error('No se pudo leer el correo de aviso: ' + e); }
  return CONFIG.AVISO_A;
}

/* ───────────────────────── Hoja ───────────────────────── */

function ahora_() { return Utilities.formatDate(new Date(), CONFIG.ZONA, 'yyyy-MM-dd HH:mm'); }

function hojaDe_(nombre, cabeceras) {
  if (!CONFIG.HOJA_ID) throw new Error('Falta CONFIG.HOJA_ID');
  const ss = SpreadsheetApp.openById(CONFIG.HOJA_ID);
  let sh = ss.getSheetByName(nombre);
  if (!sh) {
    sh = ss.insertSheet(nombre);
    const cab = sh.getRange(1, 1, 1, cabeceras.length);
    cab.setNumberFormat('@');
    cab.setValues([cabeceras]);
    cab.setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

// Teléfono opcional (vacío es válido).
function telOpc_(v, nombre, max) {
  const t = txt_(v, max || 25, nombre, true);
  return t ? tel_(t, nombre, max) : '';
}

// Código de seguimiento: PREFIJO-AA-XXXX (ej. ADM-26-7K4Q). Los 4 caracteres salen del
// número de registro mezclado con una operación reversible, así que NUNCA se repiten
// dentro de una misma hoja, pero tampoco se ven como 0001, 0002…
function codigo_(prefijo, num) {
  const ALFA = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';          // 32 símbolos, sin 0/O/1/I
  let m = (Number(num) * 7919 + 104729) % 1048576;          // 32^4; 7919 es impar → no hay choques
  let s = '';
  for (let i = 0; i < 4; i++) { s = ALFA.charAt(m % 32) + s; m = Math.floor(m / 32); }
  return prefijo + '-' + Utilities.formatDate(new Date(), CONFIG.ZONA, 'yy') + '-' + s;
}

function mayus_(s) { return String(s).toLocaleUpperCase('es'); }
