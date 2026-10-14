/**
 * PANEL DE ADMINISTRACIÓN DEL SITIO WEB — U.E. Constantino I
 * Web app de Apps Script (se publica con acceso solo para cuentas @ueconstantino.com).
 *
 * - Quién entra: hoja "Usuarios" de esta misma planilla (correo, nombre, rol, activo).
 * - Qué guarda: archivos JSON y fotos en el repositorio de GitHub; el sitio los lee solo.
 * - La clave de GitHub se guarda en las Propiedades del script (menú "Panel web").
 *
 * Módulos: Noticias y Fotos del carrusel. Los demás (textos del sitio, accesos, videos) se agregan después.
 */

const CONFIG = {
  OWNER: 'UEConstantinoI',
  REPO: 'ueci-sitio-web',
  BRANCH: 'main',
  SITIO_URL: 'https://ueconstantinoi.github.io/ueci-sitio-web/',
  PAGINA_SITIO: 'sitio.html',            // cuando sea el sitio oficial: cambiar a '' (ver LEEME)
  ARCHIVO_NOTICIAS: 'data/noticias.json',
  CARPETA_IMG: 'assets/noticias',
  ARCHIVO_GALERIA: 'data/galeria.json',
  CARPETA_GAL: 'assets/galeria',
  MAX_GALERIA: 20,
  MAX_IMG_BYTES: 1500000,                // tope de seguridad por imagen (ya reducida en el navegador)
  VISIBLES_EN_SITIO: 6,
  ICONO: 'https://raw.githubusercontent.com/UEConstantinoI/constantino-recursos/main/escudo.png'
};

const HOJA_USUARIOS = 'Usuarios';
const HOJA_REGISTRO = 'Registro';

/* ───────────────────────── ENTRADA WEB ───────────────────────── */

function doGet() {
  const u = usuarioActual_();
  if (!u) {
    const correo = Session.getActiveUser().getEmail() || '(no se pudo leer tu correo)';
    return HtmlService.createHtmlOutput(
      '<div style="font-family:system-ui,sans-serif;max-width:460px;margin:12vh auto;padding:0 20px;text-align:center">' +
      '<h2 style="color:#1f5631">Sin acceso al panel</h2>' +
      '<p>La cuenta <b>' + escapeHtml_(correo) + '</b> no está autorizada para administrar el sitio web.</p>' +
      '<p style="color:#666">Pide a Dirección que agregue tu correo a la lista de usuarios.</p></div>')
      .setTitle('Sin acceso').setFaviconUrl(CONFIG.ICONO);
  }
  return HtmlService.createHtmlOutputFromFile('Panel')
    .setTitle('Panel del sitio · Constantino I')
    .setFaviconUrl(CONFIG.ICONO)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function escapeHtml_(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* ───────────────────────── USUARIOS ───────────────────────── */

// Hoja Usuarios: A correo | B nombre | C rol | D activo (SÍ/NO)
function usuarioActual_() {
  const email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (!email) return null;
  const sh = SpreadsheetApp.getActive().getSheetByName(HOJA_USUARIOS);
  if (!sh || sh.getLastRow() < 2) return null;
  const filas = sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues();
  for (let i = 0; i < filas.length; i++) {
    if (String(filas[i][0]).trim().toLowerCase() !== email) continue;
    const activo = String(filas[i][3] || 'SÍ').trim().toUpperCase();
    if (activo === 'NO') return null;
    return { email: email, nombre: String(filas[i][1] || '').trim(), rol: String(filas[i][2] || 'EDITOR').trim().toUpperCase() };
  }
  return null;
}

function exigir_() {
  const u = usuarioActual_();
  if (!u) throw new Error('No tienes acceso a este panel.');
  return u;
}

/* ───────────────────────── API PARA LA PANTALLA ───────────────────────── */

function panelCargar() {
  const u = exigir_();
  return {
    usuario: u,
    noticias: leerNoticias_().lista,
    galeria: galeriaLeer_().lista,
    imgBase: 'https://raw.githubusercontent.com/' + CONFIG.OWNER + '/' + CONFIG.REPO + '/' + CONFIG.BRANCH + '/',
    sitioUrl: CONFIG.SITIO_URL + CONFIG.PAGINA_SITIO,
    visibles: CONFIG.VISIBLES_EN_SITIO,
    hoy: Utilities.formatDate(new Date(), 'America/La_Paz', 'yyyy-MM-dd')
  };
}

/**
 * datos = { id?, fecha:'yyyy-mm-dd', titulo, resumen, publicar:bool,
 *           imagen: { accion:'mantener'|'quitar'|'nueva', base64?, mime? } }
 */
function noticiaGuardar(datos) {
  const u = exigir_();
  const n = validarNoticia_(datos);
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const act = leerNoticias_();
    const lista = act.lista;
    let idx = -1;
    if (datos.id) {
      if (!ID_RE.test(String(datos.id))) throw new Error('Identificador inválido.');
      idx = lista.findIndex(function (x) { return x.id === datos.id; });
      if (idx < 0) throw new Error('Esa noticia ya no existe (alguien más la eliminó). Recarga el panel.');
    }
    const nueva = idx < 0;
    const id = nueva ? nuevoId_(n.fecha) : lista[idx].id;
    const previa = nueva ? '' : lista[idx].imagen;

    let rutaImg = previa;
    let borrar = '';
    const im = datos.imagen || { accion: 'mantener' };
    if (im.accion === 'nueva') {
      const bytes = validarImagen_(im);
      rutaImg = CONFIG.CARPETA_IMG + '/' + id + '-' + Date.now().toString(36) + '.' + extension_(im.mime);
      ghPonerBytes_(rutaImg, bytes, 'Noticias: imagen de "' + n.titulo + '" (' + u.email + ')');
      borrar = previa;
    } else if (im.accion === 'quitar') {
      rutaImg = '';
      borrar = previa;
    }

    const item = { id: id, fecha: n.fecha, titulo: n.titulo, resumen: n.resumen, imagen: rutaImg, publicar: n.publicar };
    if (nueva) lista.push(item); else lista[idx] = item;
    ordenar_(lista);
    guardarNoticias_(lista, act.sha, 'Noticias: ' + (nueva ? 'nueva' : 'editada') + ' "' + n.titulo + '" (' + u.email + ')');

    if (borrar) borrarImagen_(borrar, u.email);
    registrar_(u, nueva ? 'Noticia creada' : 'Noticia editada', n.titulo + (n.publicar ? ' [publicada]' : ' [oculta]'));
    return lista;
  } finally {
    lock.releaseLock();
  }
}

function noticiaEliminar(id) {
  const u = exigir_();
  if (!ID_RE.test(String(id))) throw new Error('Identificador inválido.');
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const act = leerNoticias_();
    const idx = act.lista.findIndex(function (x) { return x.id === id; });
    if (idx < 0) throw new Error('Esa noticia ya no existe. Recarga el panel.');
    const quitada = act.lista.splice(idx, 1)[0];
    guardarNoticias_(act.lista, act.sha, 'Noticias: eliminada "' + quitada.titulo + '" (' + u.email + ')');
    if (quitada.imagen) borrarImagen_(quitada.imagen, u.email);
    registrar_(u, 'Noticia eliminada', quitada.titulo);
    return act.lista;
  } finally {
    lock.releaseLock();
  }
}

/* ───────────────────────── NOTICIAS (datos) ───────────────────────── */

const ID_RE = /^n\d{8}-[0-9a-f]{5}$/;

function validarNoticia_(d) {
  if (!d || typeof d !== 'object') throw new Error('Datos vacíos.');
  const titulo = String(d.titulo || '').replace(/\s+/g, ' ').trim();
  const resumen = String(d.resumen || '').replace(/[ \t]+/g, ' ').trim();
  const fecha = String(d.fecha || '').trim();
  if (!titulo) throw new Error('Falta el título.');
  if (titulo.length > 120) throw new Error('El título es muy largo (máximo 120 letras).');
  if (resumen.length > 600) throw new Error('El resumen es muy largo (máximo 600 letras).');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error('La fecha no es válida.');
  const t = new Date(fecha + 'T12:00:00Z');
  if (isNaN(t) || t.toISOString().slice(0, 10) !== fecha) throw new Error('La fecha no existe en el calendario.');
  return { titulo: titulo, resumen: resumen, fecha: fecha, publicar: d.publicar === true };
}

function nuevoId_(fecha) {
  return 'n' + fecha.replace(/-/g, '') + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 5);
}

function ordenar_(lista) {
  lista.sort(function (a, b) {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });
}

function leerNoticias_() {
  const r = ghLeer_(CONFIG.ARCHIVO_NOTICIAS);
  let crudo = [];
  if (r) {
    try { crudo = JSON.parse(r.texto); } catch (e) { throw new Error('El archivo de noticias del sitio está dañado: ' + e.message); }
    if (!Array.isArray(crudo)) throw new Error('El archivo de noticias del sitio no tiene el formato esperado.');
  }
  const lista = crudo.map(function (x, i) {
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(x.fecha)) ? String(x.fecha) : '2000-01-01';
    return {
      id: ID_RE.test(String(x.id || '')) ? x.id : 'n' + fecha.replace(/-/g, '') + '-' + ('00000' + i).slice(-5),
      fecha: fecha,
      titulo: String(x.titulo || ''),
      resumen: String(x.resumen || ''),
      imagen: String(x.imagen || ''),
      publicar: x.publicar !== false
    };
  });
  ordenar_(lista);
  return { lista: lista, sha: r ? r.sha : null };
}

function guardarNoticias_(lista, sha, mensaje) {
  ghPonerTexto_(CONFIG.ARCHIVO_NOTICIAS, JSON.stringify(lista, null, 2) + '\n', mensaje, sha);
}

/* ───────────────────────── IMÁGENES ───────────────────────── */

function extension_(mime) {
  return { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mime] || 'jpg';
}

function validarImagen_(im) {
  if (['image/jpeg', 'image/png', 'image/webp'].indexOf(im.mime) < 0) throw new Error('La imagen debe ser JPG, PNG o WebP.');
  if (!im.base64 || typeof im.base64 !== 'string') throw new Error('No llegó la imagen.');
  const bytes = Utilities.base64Decode(im.base64);
  if (bytes.length > CONFIG.MAX_IMG_BYTES) throw new Error('La imagen es muy pesada. Prueba con otra más pequeña.');
  const b = bytes.map(function (x) { return x & 0xff; });
  const jpg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const webp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  if (!(jpg || png || webp)) throw new Error('El archivo no parece ser una imagen válida.');
  return bytes;
}

function borrarImagen_(ruta, email) {
  try {
    const r0 = String(ruta);
    if (r0.indexOf(CONFIG.CARPETA_IMG + '/') !== 0 && r0.indexOf(CONFIG.CARPETA_GAL + '/') !== 0) return;
    if (r0.indexOf('..') >= 0) return;
    const r = ghLeer_(ruta);
    if (r) ghBorrar_(ruta, r.sha, 'Noticias: se retira imagen sin uso (' + email + ')');
  } catch (e) { /* si no se puede borrar, no pasa nada: solo queda un archivo sin uso */ }
}


/* ───────────────────────── CARRUSEL DE FOTOS ───────────────────────── */

const ID_G_RE = /^g\d{8}-[0-9a-f]{5}$/;

function galeriaLeer_() {
  const r = ghLeer_(CONFIG.ARCHIVO_GALERIA);
  let crudo = [];
  if (r) {
    try { crudo = JSON.parse(r.texto); } catch (e) { throw new Error('El archivo del carrusel está dañado: ' + e.message); }
    if (!Array.isArray(crudo)) throw new Error('El archivo del carrusel no tiene el formato esperado.');
  }
  const hoy = Utilities.formatDate(new Date(), 'America/La_Paz', 'yyyyMMdd');
  const lista = crudo.map(function (x, i) {
    return {
      id: ID_G_RE.test(String(x.id || '')) ? x.id : 'g' + hoy + '-' + ('00000' + i).slice(-5),
      etiqueta: String(x.etiqueta || ''),
      titulo: String(x.titulo || ''),
      descripcion: String(x.descripcion || ''),
      imagen: String(x.imagen || ''),
      publicar: x.publicar !== false
    };
  });
  return { lista: lista, sha: r ? r.sha : null };
}

function galeriaGuardarArchivo_(lista, sha, mensaje) {
  ghPonerTexto_(CONFIG.ARCHIVO_GALERIA, JSON.stringify(lista, null, 2) + '\n', mensaje, sha);
}

function validarFoto_(d) {
  if (!d || typeof d !== 'object') throw new Error('Datos vacíos.');
  const etiqueta = String(d.etiqueta || '').replace(/\s+/g, ' ').trim();
  const titulo = String(d.titulo || '').replace(/\s+/g, ' ').trim();
  const descripcion = String(d.descripcion || '').replace(/\s+/g, ' ').trim();
  if (etiqueta.length > 30) throw new Error('La etiqueta es muy larga (máximo 30 letras).');
  if (titulo.length > 80) throw new Error('El título es muy largo (máximo 80 letras).');
  if (descripcion.length > 160) throw new Error('La descripción es muy larga (máximo 160 letras).');
  return { etiqueta: etiqueta, titulo: titulo, descripcion: descripcion, publicar: d.publicar === true };
}

/**
 * datos = { id?, etiqueta, titulo, descripcion, publicar:bool,
 *           imagen: { accion:'mantener'|'nueva', base64?, mime? } }   (la foto es obligatoria)
 */
function galeriaGuardar(datos) {
  const u = exigir_();
  const f = validarFoto_(datos);
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const act = galeriaLeer_();
    const lista = act.lista;
    let idx = -1;
    if (datos.id) {
      if (!ID_G_RE.test(String(datos.id))) throw new Error('Identificador inválido.');
      idx = lista.findIndex(function (x) { return x.id === datos.id; });
      if (idx < 0) throw new Error('Esa foto ya no existe (alguien más la eliminó). Recarga el panel.');
    }
    const nueva = idx < 0;
    if (nueva && lista.length >= CONFIG.MAX_GALERIA) throw new Error('Ya hay ' + CONFIG.MAX_GALERIA + ' fotos. Elimina alguna antes de agregar otra.');
    const im = datos.imagen || { accion: 'mantener' };
    if (nueva && im.accion !== 'nueva') throw new Error('Falta elegir la foto.');
    if (im.accion === 'quitar') throw new Error('Una foto del carrusel no puede quedar sin imagen. Elige otra foto o elimina esta.');

    const id = nueva ? 'g' + Utilities.formatDate(new Date(), 'America/La_Paz', 'yyyyMMdd') + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 5) : lista[idx].id;
    const previa = nueva ? '' : lista[idx].imagen;
    let ruta = previa, borrar = '';
    if (im.accion === 'nueva') {
      const bytes = validarImagen_(im);
      ruta = CONFIG.CARPETA_GAL + '/' + id + '-' + Date.now().toString(36) + '.' + extension_(im.mime);
      ghPonerBytes_(ruta, bytes, 'Carrusel: foto "' + (f.titulo || f.etiqueta || id) + '" (' + u.email + ')');
      borrar = previa;
    }
    const item = { id: id, etiqueta: f.etiqueta, titulo: f.titulo, descripcion: f.descripcion, imagen: ruta, publicar: f.publicar };
    if (nueva) lista.push(item); else lista[idx] = item;
    galeriaGuardarArchivo_(lista, act.sha, 'Carrusel: ' + (nueva ? 'nueva' : 'editada') + ' foto "' + (f.titulo || f.etiqueta || id) + '" (' + u.email + ')');
    if (borrar) borrarImagen_(borrar, u.email);
    registrar_(u, nueva ? 'Foto agregada' : 'Foto editada', (f.titulo || f.etiqueta || id) + (f.publicar ? ' [visible]' : ' [oculta]'));
    return lista;
  } finally {
    lock.releaseLock();
  }
}

function galeriaEliminar(id) {
  const u = exigir_();
  if (!ID_G_RE.test(String(id))) throw new Error('Identificador inválido.');
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const act = galeriaLeer_();
    const idx = act.lista.findIndex(function (x) { return x.id === id; });
    if (idx < 0) throw new Error('Esa foto ya no existe. Recarga el panel.');
    const q = act.lista.splice(idx, 1)[0];
    galeriaGuardarArchivo_(act.lista, act.sha, 'Carrusel: eliminada foto "' + (q.titulo || q.etiqueta || q.id) + '" (' + u.email + ')');
    if (q.imagen) borrarImagen_(q.imagen, u.email);
    registrar_(u, 'Foto eliminada', q.titulo || q.etiqueta || q.id);
    return act.lista;
  } finally {
    lock.releaseLock();
  }
}

// dir = -1 (subir, antes en el carrusel) o 1 (bajar, después)
function galeriaMover(id, dir) {
  const u = exigir_();
  if (!ID_G_RE.test(String(id))) throw new Error('Identificador inválido.');
  if (dir !== -1 && dir !== 1) throw new Error('Movimiento inválido.');
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const act = galeriaLeer_();
    const i = act.lista.findIndex(function (x) { return x.id === id; });
    if (i < 0) throw new Error('Esa foto ya no existe. Recarga el panel.');
    const j = i + dir;
    if (j < 0 || j >= act.lista.length) return act.lista;
    const t = act.lista[i]; act.lista[i] = act.lista[j]; act.lista[j] = t;
    galeriaGuardarArchivo_(act.lista, act.sha, 'Carrusel: se cambia el orden de las fotos (' + u.email + ')');
    registrar_(u, 'Foto movida', (t.titulo || t.etiqueta || t.id) + (dir < 0 ? ' ← antes' : ' → después'));
    return act.lista;
  } finally {
    lock.releaseLock();
  }
}

/* ───────────────────────── GITHUB ───────────────────────── */

function gh_(metodo, rutaApi, payload) {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('Falta configurar la clave de GitHub (menú "Panel web" de la planilla).');
  const opts = {
    method: metodo,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    muteHttpExceptions: true
  };
  if (payload) { opts.contentType = 'application/json'; opts.payload = JSON.stringify(payload); }
  return UrlFetchApp.fetch('https://api.github.com' + rutaApi, opts);
}

function rutaContenido_(ruta) {
  return '/repos/' + CONFIG.OWNER + '/' + CONFIG.REPO + '/contents/' + ruta;
}

// Devuelve { texto, sha } o null si el archivo no existe
function ghLeer_(ruta) {
  const r = gh_('get', rutaContenido_(ruta) + '?ref=' + CONFIG.BRANCH);
  const c = r.getResponseCode();
  if (c === 404) return null;
  if (c !== 200) throw new Error('GitHub respondió ' + c + ' al leer ' + ruta + '.');
  const j = JSON.parse(r.getContentText());
  const bytes = Utilities.base64Decode(String(j.content || '').replace(/\n/g, ''));
  return { texto: Utilities.newBlob(bytes).getDataAsString('UTF-8'), sha: j.sha };
}

function ghPonerBytes_(ruta, bytes, mensaje, sha) {
  const cuerpo = { message: mensaje, content: Utilities.base64Encode(bytes), branch: CONFIG.BRANCH };
  if (sha) cuerpo.sha = sha;
  const r = gh_('put', rutaContenido_(ruta), cuerpo);
  const c = r.getResponseCode();
  if (c === 200 || c === 201) return;
  if (c === 409 || c === 422) throw new Error('Otra persona guardó cambios al mismo tiempo. Recarga el panel y vuelve a intentar.');
  throw new Error('No se pudo guardar en GitHub (' + c + ').');
}

function ghPonerTexto_(ruta, texto, mensaje, sha) {
  ghPonerBytes_(ruta, Utilities.newBlob(texto, 'text/plain').getBytes(), mensaje, sha);
}

function ghBorrar_(ruta, sha, mensaje) {
  const r = gh_('delete', rutaContenido_(ruta), { message: mensaje, sha: sha, branch: CONFIG.BRANCH });
  if (r.getResponseCode() !== 200) throw new Error('No se pudo borrar ' + ruta);
}

/* ───────────────────────── REGISTRO DE CAMBIOS ───────────────────────── */

function registrar_(u, accion, detalle) {
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName(HOJA_REGISTRO);
    if (sh) sh.appendRow([new Date(), u.email, accion, String(detalle).slice(0, 300)]);
  } catch (e) { /* el registro nunca debe impedir guardar */ }
}

/* ───────────────── MENÚ DE LA PLANILLA (configuración) ───────────────── */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Panel web')
    .addItem('1. Preparar hojas (solo la primera vez)', 'prepararHojas')
    .addItem('2. Guardar clave de GitHub', 'guardarClave')
    .addItem('3. Probar conexión con GitHub', 'probarConexion')
    .addToUi();
}

function prepararHojas() {
  const ss = SpreadsheetApp.getActive();
  const ui = SpreadsheetApp.getUi();
  let us = ss.getSheetByName(HOJA_USUARIOS);
  if (!us) {
    us = ss.insertSheet(HOJA_USUARIOS);
    us.getRange(1, 1, 1, 4).setValues([['correo', 'nombre', 'rol', 'activo']])
      .setFontWeight('bold').setBackground('#1f5631').setFontColor('#ffffff');
    const yo = Session.getActiveUser().getEmail();
    if (yo) us.getRange(2, 1, 1, 4).setValues([[yo, 'Administrador', 'ADMIN', 'SÍ']]);
    us.getRange(2, 3, 200, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['ADMIN', 'EDITOR'], true).build());
    us.getRange(2, 4, 200, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['SÍ', 'NO'], true).build());
    us.setColumnWidths(1, 1, 280); us.setColumnWidths(2, 1, 220); us.setColumnWidths(3, 2, 90);
    us.setFrozenRows(1);
  }
  let rg = ss.getSheetByName(HOJA_REGISTRO);
  if (!rg) {
    rg = ss.insertSheet(HOJA_REGISTRO);
    rg.getRange(1, 1, 1, 4).setValues([['fecha y hora', 'usuario', 'acción', 'detalle']])
      .setFontWeight('bold').setBackground('#1f5631').setFontColor('#ffffff');
    rg.getRange(2, 1, 2000, 1).setNumberFormat('dd/mm/yyyy hh:mm');
    rg.setColumnWidths(1, 1, 140); rg.setColumnWidths(2, 1, 240); rg.setColumnWidths(3, 1, 150); rg.setColumnWidths(4, 1, 420);
    rg.setFrozenRows(1);
  }
  ui.alert('Hojas listas. En "Usuarios" escribe los correos @ueconstantino.com de quienes pueden entrar al panel.');
}

function guardarClave() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('Clave de GitHub', 'Pega aquí la clave (token). Se guarda dentro del script, no en la hoja.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const t = r.getResponseText().trim();
  if (!t) { ui.alert('No se guardó nada: estaba vacía.'); return; }
  PropertiesService.getScriptProperties().setProperty('GITHUB_TOKEN', t);
  ui.alert('Clave guardada. Ahora usa "Probar conexión con GitHub".');
}

function probarConexion() {
  const ui = SpreadsheetApp.getUi();
  try {
    const r = gh_('get', '/repos/' + CONFIG.OWNER + '/' + CONFIG.REPO);
    if (r.getResponseCode() !== 200) { ui.alert('GitHub respondió ' + r.getResponseCode() + '. Revisa la clave.'); return; }
    const j = JSON.parse(r.getContentText());
    ui.alert(j.permissions && j.permissions.push
      ? '✔ Conexión correcta: se puede escribir en ' + j.full_name + '.'
      : '⚠ Se conectó, pero la clave NO tiene permiso de escritura (Contents: Read and write).');
  } catch (e) { ui.alert('Error: ' + e.message); }
}
