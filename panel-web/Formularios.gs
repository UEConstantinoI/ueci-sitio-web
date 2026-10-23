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

// Versión de este archivo (se ve al abrir la dirección /exec en el navegador).
const VERSION_FORMULARIOS = '2026.10.23-1';

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
  return salida_({ ok: true, mensaje: 'Formularios del colegio en línea.', version: VERSION_FORMULARIOS });
}

function doPost(e) {
  try {
    const crudo = e && e.postData && e.postData.contents ? String(e.postData.contents) : '';
    if (!crudo || crudo.length > 8000) return salida_({ ok: false, error: 'El envío no es válido.' });
    let d;
    try { d = JSON.parse(crudo); } catch (x) { return salida_({ ok: false, error: 'El envío no es válido.' }); }
    if (!d || typeof d !== 'object') return salida_({ ok: false, error: 'El envío no es válido.' });
    if (d.api) return salida_(apiSistema_(d));
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
      mensaje: mayus_(txt_(d.mensaje, 600, 'Consulta', false))
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
      colegio: mayus_(txt_(d.colegio, 90, 'Colegio anterior', colegioOpcional_(nivel, grado))),
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

// Colegio anterior: opcional en Inicial (Pre-Kinder ni se pregunta) y en 1.º de primaria; obligatorio desde 2.º.
function colegioOpcional_(nivel, grado) { return nivel === 'INICIAL' || (nivel === 'PRIMARIA' && grado === 'Primero'); }


/* ───────────────────────── API PARA EL SISTEMA DEL COLEGIO ─────────────────────────
 * Permite que el sistema (otra planilla) vea las consultas/admisiones y las marque como atendidas.
 * Se protege con una clave secreta guardada en Propiedades del script: CLAVE_SISTEMA
 * (Configuración del proyecto → Propiedades del script → Agregar). Nunca va en el código.
 * Pedido: POST JSON { api:'buzon', clave:'...', accion:'resumen'|'listar'|'marcar', ... }
 */
function apiSistema_(d) {
  const clave = PropertiesService.getScriptProperties().getProperty('CLAVE_SISTEMA') || '';
  const dada = String(d.clave || '');
  let dif = clave.length < 16 || dada.length !== clave.length ? 1 : 0;
  for (let i = 0; i < clave.length && i < dada.length; i++) dif |= clave.charCodeAt(i) ^ dada.charCodeAt(i);
  if (dif) return { ok: false, error: 'No autorizado.' };
  const ss = SpreadsheetApp.openById(CONFIG.HOJA_ID);
  const TIPOS = { consultas: { hoja: 'Consultas', pref: 'CON' }, admisiones: { hoja: 'Admisiones', pref: 'ADM' } };
  const leer = function (tipo) {
    const sh = ss.getSheetByName(TIPOS[tipo].hoja);
    if (!sh || sh.getLastRow() < 2) return { cab: [], filas: [] };
    const v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
    return { cab: v[0].map(String), filas: v.slice(1), sh: sh };
  };
  if (d.accion === 'resumen') {
    const r = { ok: true };
    Object.keys(TIPOS).forEach(function (t) {
      const x = leer(t), c = x.cab.indexOf('Estado'), k = x.cab.indexOf('Código');
      r[t] = x.filas.filter(function (f) { return f[k] && String(f[c]) !== 'Atendido'; }).length;
    });
    r.nuevos = r.consultas + r.admisiones;
    const hoy = ahora_().slice(0, 10); r.seguimiento = 0;
    Object.keys(TIPOS).forEach(function (t) {
      const x = leer(t), cE = x.cab.indexOf('Estado'), cV = x.cab.indexOf('Volver a contactar');
      if (cV < 0) return;
      r.seguimiento += x.filas.filter(function (f) { return String(f[cV] || '') && String(f[cV]) <= hoy && String(f[cE]) !== 'Atendido'; }).length;
    });
    return r;
  }
  if (d.accion === 'listar') {
    const r = { ok: true };
    Object.keys(TIPOS).forEach(function (t) {
      const x = leer(t), k = x.cab.indexOf('Código');
      r[t] = x.filas.filter(function (f) { return f[k]; }).reverse().slice(0, 300).map(function (f) {
        const o = {}; x.cab.forEach(function (c, j) { o[c] = String(f[j] === null || f[j] === undefined ? '' : f[j]); });
        o['Estado'] = o['Estado'] === 'Atendido' ? 'Atendido' : 'Nuevo';
        return o;
      });
    });
    return r;
  }
  if (d.accion === 'marcar' || d.accion === 'nota') {
    try {
      const op = { por: d.por, nota: d.nota };
      if (d.accion === 'marcar') op.atendido = d.atendido === true;
      if (d.volver !== undefined && d.volver !== null) op.volver = d.volver;
      bzAplicar_(ss, d.tipo, String(d.codigo || ''), op, ahora_(), 'Sistema: ' + String(d.por || '').slice(0, 60));
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e.message || e) }; }
  }
  return { ok: false, error: 'Acción no válida.' };
}

/* ───────────────────────── NOTAS DE SEGUIMIENTO (misma lógica en Codigo.gs y Formularios.gs) ─────────────────────────
 * Cada mensaje tiene "Notas" (historial: una línea por nota, con fecha, hora y quién) y "Volver a contactar" (fecha).
 * Marcar como atendido exige una nota. Las notas solo se agregan: no se editan ni se borran. */
const NOTA_MAX = 500, NOTAS_TOTAL_MAX = 20000;
const COL_NOTAS = 'Notas', COL_VOLVER = 'Volver a contactar';

function bzColumnas_(sh) {
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  [COL_NOTAS, COL_VOLVER].forEach(function (c) {
    if (cab.indexOf(c) < 0) { const r = sh.getRange(1, cab.length + 1); r.setNumberFormat('@'); r.setValue(c); r.setFontWeight('bold'); cab.push(c); }
  });
  return cab;
}

// op = { por, nota?, volver? ('' = quitar), atendido? (true|false) }; ahora = 'yyyy-MM-dd HH:mm' (hora de La Paz)
function bzAplicar_(ss, tipo, codigo, op, ahora, quienAtiende) {
  const T = { consultas: { hoja: 'Consultas', pref: 'CON' }, admisiones: { hoja: 'Admisiones', pref: 'ADM' } }[tipo];
  if (!T) throw new Error('Tipo no válido.');
  if (!new RegExp('^' + T.pref + '-(?:\\d{4}|\\d{2}-[A-Z0-9]{4})$').test(String(codigo || ''))) throw new Error('Código no válido.');
  const por = String(op.por || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!por) throw new Error('Falta saber quién escribe la nota.');
  const nota = String(op.nota || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (nota.length > NOTA_MAX) throw new Error('La nota es muy larga (máximo ' + NOTA_MAX + ' letras).');
  if (op.atendido === true && !nota) throw new Error('Para marcar como atendido escribe una nota: qué pasó con este mensaje.');
  let volver;
  if (op.volver !== undefined && op.volver !== null) {
    volver = String(op.volver).trim();
    if (volver) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(volver), f = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
      if (!f || f.getUTCMonth() !== +m[2] - 1 || f.getUTCDate() !== +m[3]) throw new Error('La fecha para volver a contactar no es válida.');
      if (volver < ahora.slice(0, 10)) throw new Error('La fecha para volver a contactar no puede estar en el pasado.');
    }
  }
  if (op.atendido === undefined && !nota && volver === undefined) throw new Error('Escribe una nota.');

  const lineas = [];
  const pre = ahora + ' · ' + por + ': ';
  if (nota) lineas.push(pre + (op.atendido === true ? '✓ Atendido. ' : '') + nota + (volver ? ' (volver a contactar el ' + volver + ')' : ''));
  else if (op.atendido === true) lineas.push(pre + '✓ Atendido');
  else if (volver !== undefined) lineas.push(pre + (volver ? 'Volver a contactar el ' + volver : 'Se quitó la fecha para volver a contactar'));
  if (op.atendido === false) lineas.push(pre + '↺ Reabierto');

  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const sh = ss.getSheetByName(T.hoja);
    if (!sh || sh.getLastRow() < 2) throw new Error('No hay registros.');
    const cab = bzColumnas_(sh);
    const todo = sh.getRange(1, 1, sh.getLastRow(), cab.length).getValues();
    const c = function (n) { return cab.indexOf(n); };
    const cK = c('Código'), cE = c('Estado'), cP = c('Atendido por'), cL = c('Atendido el'), cN = c(COL_NOTAS), cV = c(COL_VOLVER);
    if (cK < 0 || cE < 0 || cP < 0 || cL < 0) throw new Error('La hoja “' + T.hoja + '” no tiene el formato esperado.');
    let fila = -1;
    for (let i = 1; i < todo.length; i++) { if (String(todo[i][cK]) === codigo) { fila = i; break; } }
    if (fila < 0) throw new Error('No se encontró ese registro.');
    const v = todo[fila].slice();
    while (v.length < cab.length) v.push('');
    const previas = String(v[cN] || '');
    const nuevas = (previas ? previas + '\n' : '') + lineas.join('\n');
    if (lineas.length) {
      if (nuevas.length > NOTAS_TOTAL_MAX) throw new Error('Este mensaje ya tiene demasiadas notas.');
      v[cN] = nuevas;
    }
    if (volver !== undefined) v[cV] = volver;
    if (op.atendido === true) { v[cE] = 'Atendido'; v[cP] = quienAtiende || por; v[cL] = ahora; v[cV] = ''; }
    else if (op.atendido === false) { v[cE] = 'Nuevo'; v[cP] = ''; v[cL] = ''; }
    const r = sh.getRange(fila + 1, 1, 1, v.length);
    r.setNumberFormat('@'); r.setValues([v]);
  } finally { lock.releaseLock(); }
}
