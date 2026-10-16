/**
 * PANEL DE ADMINISTRACIÓN DEL SITIO WEB — U.E. Constantino I
 * Web app de Apps Script (se publica con acceso solo para cuentas @ueconstantino.com).
 *
 * - Quién entra: hoja "Usuarios" de esta misma planilla (correo, nombre, rol, activo).
 * - Qué guarda: archivos JSON y fotos en el repositorio de GitHub; el sitio los lee solo.
 * - La clave de GitHub se guarda en las Propiedades del script (menú "Panel web").
 *
 * Módulos: Noticias, Fotos del carrusel, Videos, Calendario escolar, y (solo ADMIN) Textos del sitio y Accesos directos.
 */

const CONFIG = {
  OWNER: 'UEConstantinoI',
  REPO: 'ueci-sitio-web',
  BRANCH: 'main',
  SITIO_URL: 'https://ueconstantinoi.github.io/ueci-sitio-web/',
  PAGINA_SITIO: '',                      // el sitio oficial es la portada del repositorio
  ARCHIVO_NOTICIAS: 'data/noticias.json',
  CARPETA_IMG: 'assets/noticias',
  ARCHIVO_TEXTOS: 'data/textos.json',
  ARCHIVO_VIDEOS: 'data/videos.json',
  ARCHIVO_ACCESOS: 'data/accesos.json',
  ARCHIVO_REDES: 'data/redes.json',
  MAX_REDES: 10,
  ARCHIVO_CALENDARIO: 'data/calendario.json',
  MAX_CALENDARIO: 40,
  MAX_VIDEOS: 24,
  MAX_ACCESOS: 12,
  ARCHIVO_GALERIA: 'data/galeria.json',
  CARPETA_GAL: 'assets/galeria',
  CARPETA_SITIO: 'assets/sitio',         // fotos de los textos del sitio (ej. transporte)
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
    videos: listaLeer_(listaVideos_()).lista,
    accesos: u.rol === 'ADMIN' ? accesosParaPanel_() : null,
    buzon: buzonParaPanel_(),
    redes: u.rol === 'ADMIN' ? redesParaPanel_() : null,
    calendario: calendarioParaPanel_(),
    textos: textosParaPanel_(u),   // los textos solo los ve y edita un ADMIN
    imgBase: 'https://raw.githubusercontent.com/' + CONFIG.OWNER + '/' + CONFIG.REPO + '/' + CONFIG.BRANCH + '/',
    sitioUrl: CONFIG.SITIO_URL + CONFIG.PAGINA_SITIO,
    visibles: CONFIG.VISIBLES_EN_SITIO,
    espacio: espacioRepo_(),
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
    if (r0.indexOf(CONFIG.CARPETA_IMG + '/') !== 0 && r0.indexOf(CONFIG.CARPETA_GAL + '/') !== 0 && r0.indexOf(CONFIG.CARPETA_SITIO + '/') !== 0) return;
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

/* ───────────────────────── TEXTOS DEL SITIO (solo ADMIN) ───────────────────────── */

function exigirAdmin_() {
  const u = exigir_();
  if (u.rol !== 'ADMIN') throw new Error('Solo un administrador puede cambiar los textos del sitio.');
  return u;
}

// Para el panel: solo ADMIN; si el archivo falla, no se cae todo el panel (Noticias y Fotos siguen andando)
function textosParaPanel_(u) {
  if (u.rol !== 'ADMIN') return null;
  try { return { datos: textosLeer_().textos }; } catch (e) { return { error: String(e.message || e) }; }
}

function textosLeer_() {
  const r = ghLeer_(CONFIG.ARCHIVO_TEXTOS);
  if (!r) throw new Error('No existe ' + CONFIG.ARCHIVO_TEXTOS + ' en el repositorio.');
  let t;
  try { t = JSON.parse(r.texto); } catch (e) { throw new Error('El archivo de textos está dañado: ' + e.message); }
  return { textos: t, sha: r.sha };
}

// Una sola línea, sin caracteres de control; devuelve el texto limpio o lanza un error entendible
function cad_(v, max, nombre, opcional) {
  if (v === undefined || v === null) v = '';
  if (typeof v !== 'string') throw new Error('“' + nombre + '” no es texto.');
  const t = v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t && !opcional) throw new Error('Falta completar “' + nombre + '”.');
  if (t.length > max) throw new Error('“' + nombre + '” es muy largo (máximo ' + max + ' letras, tiene ' + t.length + ').');
  return t;
}

function lista_(v, min, max, nombre) {
  if (!Array.isArray(v)) throw new Error('“' + nombre + '” no tiene el formato esperado.');
  if (v.length < min) throw new Error('“' + nombre + '” necesita al menos ' + min + '.');
  if (v.length > max) throw new Error('“' + nombre + '” admite como máximo ' + max + '.');
  return v;
}

function validarTextos_(d) {
  if (!d || typeof d !== 'object') throw new Error('Datos vacíos.');
  const h = d.hero || {}, n = d.nosotros || {}, tr = d.transporte || {}, c = d.contacto || {};

  const titulo = cad_(h.titulo, 120, 'Portada · título');
  if ((titulo.split('*').length - 1) % 2 !== 0) throw new Error('En el título de la portada, las palabras resaltadas van entre dos asteriscos: *así*.');
  const datos = lista_(h.datos, 4, 4, 'Portada · datos destacados').map(function (x, i) {
    x = x || {};
    return { valor: cad_(x.valor, 32, 'Dato ' + (i + 1) + ' · titular'), texto: cad_(x.texto, 60, 'Dato ' + (i + 1) + ' · detalle') };
  });
  const hero = { imagen1: '', imagen2: '', etiqueta: cad_(h.etiqueta, 40, 'Portada · etiqueta'), titulo: titulo, descripcion: cad_(h.descripcion, 400, 'Portada · descripción'), datos: datos };

  const nosotros = { imagen: '' };   // las fotos se manejan aparte (ver textosGuardar)
  [['vision', 'Visión'], ['mision', 'Misión'], ['objetivo', 'Objetivo']].forEach(function (k) {
    const x = n[k[0]] || {};
    nosotros[k[0]] = {
      titulo: cad_(x.titulo, 90, k[1] + ' · título'),
      texto: cad_(x.texto, 500, k[1] + ' · texto'),
      puntos: lista_(x.puntos || [], 0, 6, k[1] + ' · puntos').map(function (p, i) { return cad_(p, 140, k[1] + ' · punto ' + (i + 1)); }),
      claves: lista_(x.claves || [], 0, 6, k[1] + ' · palabras clave').map(function (p, i) { return cad_(p, 30, k[1] + ' · palabra clave ' + (i + 1)); })
    };
  });

  const pilares = lista_(d.pilares, 1, 8, 'Pilares').map(function (p, i) {
    p = p || {};
    return { icono: cad_(p.icono, 8, 'Pilar ' + (i + 1) + ' · ícono', true), titulo: cad_(p.titulo, 40, 'Pilar ' + (i + 1) + ' · título'), texto: cad_(p.texto, 320, 'Pilar ' + (i + 1) + ' · texto') };
  });

  const transporte = {
    imagen: '',   // la foto se maneja aparte (ver textosGuardar); lo que llegue desde la pantalla se ignora
    titulo: cad_(tr.titulo, 90, 'Transporte · título'), texto: cad_(tr.texto, 300, 'Transporte · texto'),
    publico_titulo: cad_(tr.publico_titulo, 40, 'Transporte público · título'), publico_texto: cad_(tr.publico_texto, 100, 'Transporte público · detalle')
  };

  const rq = d.requisitos || {};
  const requisitos = {
    reserva: lista_(rq.reserva || [], 1, 12, 'Requisitos de reserva de cupo').map(function (x, i) { return cad_(x, 200, 'Reserva de cupo · requisito ' + (i + 1)); }),
    inscripcion: lista_(rq.inscripcion || [], 1, 14, 'Requisitos de inscripción').map(function (x, i) { return cad_(x, 200, 'Inscripción · requisito ' + (i + 1)); }),
    nota: cad_(rq.nota, 240, 'Requisitos · nota', true)
  };

  const wa = String(c.whatsapp || '').replace(/[\s+()-]/g, '');
  if (!/^\d{8,15}$/.test(wa)) throw new Error('El número de WhatsApp debe tener solo dígitos con el código de país, por ejemplo 59171798840.');
  const correo = cad_(c.email, 80, 'Contacto · correo', true);
  if (correo && !/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(correo)) throw new Error('El correo de contacto no parece válido.');
  const contacto = {
    titulo: cad_(c.titulo, 90, 'Contacto · título'), direccion: cad_(c.direccion, 160, 'Contacto · dirección'),
    telefono: cad_(c.telefono, 40, 'Contacto · teléfono fijo'), celular: cad_(c.celular, 40, 'Contacto · celular'), email: correo, whatsapp: wa
  };
  const av = d.aviso || {};
  const avActivo = av.activo === true;
  const avTexto = cad_(av.texto, 140, 'Aviso destacado · texto', !avActivo);
  const avEnlace = cad_(av.enlace, 300, 'Aviso destacado · enlace', true);
  if (avEnlace && !/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?([\/?#]\S*)?$/i.test(avEnlace)) throw new Error('El enlace del aviso debe empezar con https:// y ser una dirección web completa.');
  const aviso = { activo: avActivo, texto: avTexto, enlace: avEnlace };

  const hr = d.horarios || {};
  const horarios = {
    atencion: lista_(hr.atencion || [], 0, 6, 'Horario de atención').map(function (x, i) { return cad_(x, 80, 'Horario de atención · renglón ' + (i + 1)); }),
    clases_turno: cad_(hr.clases_turno, 40, 'Horario de clases · turno', true),
    clases: lista_(hr.clases || [], 0, 6, 'Horario de clases').map(function (x, i) { return cad_(x, 80, 'Horario de clases · renglón ' + (i + 1)); })
  };
  return { hero: hero, nosotros: nosotros, pilares: pilares, transporte: transporte, requisitos: requisitos, contacto: contacto, aviso: aviso, horarios: horarios };
}

const FOTOS_TEXTOS = {
  transporte: { pref: 'transporte', rot: 'foto de transporte',
                leer: function (t) { return (t.transporte && t.transporte.imagen) || ''; }, poner: function (t, r) { t.transporte.imagen = r; } },
  hero1:      { pref: 'portada-1', rot: 'foto principal de la portada',
                leer: function (t) { return (t.hero && t.hero.imagen1) || ''; }, poner: function (t, r) { t.hero.imagen1 = r; } },
  hero2:      { pref: 'portada-2', rot: 'foto pequeña de la portada',
                leer: function (t) { return (t.hero && t.hero.imagen2) || ''; }, poner: function (t, r) { t.hero.imagen2 = r; } },
  nosotros:   { pref: 'nosotros', rot: 'foto de Acerca de nosotros',
                leer: function (t) { return (t.nosotros && t.nosotros.imagen) || ''; }, poner: function (t, r) { t.nosotros.imagen = r; } }
};

/**
 * Recibe el documento completo de textos; devuelve el documento ya limpio y guardado.
 * imagenes = { transporte|hero1|hero2|nosotros: { accion:'mantener'|'quitar'|'nueva', base64?, mime? } }  (opcional)
 */
function textosGuardar(datos, imagenes) {
  const u = exigirAdmin_();
  const t = validarTextos_(datos);
  imagenes = imagenes || {};
  const cambios = [];   // { clave, im, bytes }
  Object.keys(FOTOS_TEXTOS).forEach(function (clave) {
    const im = imagenes[clave] || { accion: 'mantener' };
    if (['mantener', 'quitar', 'nueva'].indexOf(im.accion) < 0) throw new Error('Acción de imagen no válida.');
    cambios.push({ clave: clave, im: im, bytes: im.accion === 'nueva' ? validarImagen_(im) : null });
  });
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const act = textosLeer_();
    const aBorrar = [], hechos = [];
    cambios.forEach(function (c) {
      const f = FOTOS_TEXTOS[c.clave];
      const previa = String(f.leer(act.textos) || '');   // siempre la que ya está guardada
      let ruta = previa;
      if (c.im.accion === 'nueva') {
        ruta = CONFIG.CARPETA_SITIO + '/' + f.pref + '-' + Date.now().toString(36) + '.' + extension_(c.im.mime);
        ghPonerBytes_(ruta, c.bytes, 'Textos del sitio: ' + f.rot + ' (' + u.email + ')');
        if (previa) aBorrar.push(previa);
        hechos.push(f.rot + ': nueva');
      } else if (c.im.accion === 'quitar') {
        ruta = ''; if (previa) aBorrar.push(previa);
        hechos.push(f.rot + ': quitada');
      }
      f.poner(t, ruta);
    });
    ghPonerTexto_(CONFIG.ARCHIVO_TEXTOS, JSON.stringify(t, null, 2) + '\n', 'Textos del sitio actualizados (' + u.email + ')', act.sha);
    aBorrar.forEach(function (r) { if (r) borrarImagen_(r, u.email); });
    registrar_(u, 'Textos del sitio', 'Se guardaron cambios' + (hechos.length ? ' (' + hechos.join('; ') + ')' : ''));
    return t;
  } finally {
    lock.releaseLock();
  }
}

/* ───────────────────────── LISTAS GENÉRICAS (videos y accesos) ───────────────────────── */

const ID_V_RE = /^v\d{8}-[0-9a-f]{5}$/;
const ID_A_RE = /^a\d{8}-[0-9a-f]{5}$/;
const ID_R_RE = /^r\d{8}-[0-9a-f]{5}$/;
// red → expresión que debe cumplir el enlace (evita pegar el enlace de otra red por error)
const REDES_SOCIALES = {
  facebook: /^https:\/\/([a-z0-9-]+\.)*(facebook\.com|fb\.com)\//i,
  instagram: /^https:\/\/([a-z0-9-]+\.)*instagram\.com\//i,
  tiktok: /^https:\/\/([a-z0-9-]+\.)*tiktok\.com\//i,
  youtube: /^https:\/\/([a-z0-9-]+\.)*(youtube\.com|youtu\.be)\//i,
  x: /^https:\/\/([a-z0-9-]+\.)*(x\.com|twitter\.com)\//i,
  linkedin: /^https:\/\/([a-z0-9-]+\.)*linkedin\.com\//i,
  threads: /^https:\/\/([a-z0-9-]+\.)*threads\.(net|com)\//i,
  telegram: /^https:\/\/(t\.me|telegram\.me)\//i,
  canalwa: /^https:\/\/(www\.)?(whatsapp\.com|wa\.me)\//i,
  otra: /^https:\/\/\S+\.\S+/i
};
const CATEGORIAS_VIDEO = ['testimonios', 'vida'];
const ID_C_RE = /^c\d{8}-[0-9a-f]{5}$/;
const COLORES_ACCESO = ['rojo', 'verde', 'sol', 'azul', 'royal', 'gris'];

function listaVideos_() {
  return {
    archivo: CONFIG.ARCHIVO_VIDEOS, idRe: ID_V_RE, pref: 'v', max: CONFIG.MAX_VIDEOS, nombre: 'video', plural: 'videos',
    leer: function (x) {
      return { titulo: String(x.titulo || ''), url: String(x.url || ''), plataforma: String(x.plataforma || ''), codigo: String(x.codigo || ''),
               categoria: CATEGORIAS_VIDEO.indexOf(x.categoria) >= 0 ? x.categoria : 'vida', publicar: x.publicar !== false };
    },
    rotulo: function (x) { return x.titulo; }
  };
}

function listaAccesos_() {
  return {
    archivo: CONFIG.ARCHIVO_ACCESOS, idRe: ID_A_RE, pref: 'a', max: CONFIG.MAX_ACCESOS, nombre: 'acceso', plural: 'accesos',
    leer: function (x) {
      return { icono: String(x.icono || ''), titulo: String(x.titulo || ''), detalle: String(x.detalle || ''), url: String(x.url || ''),
               color: COLORES_ACCESO.indexOf(x.color) >= 0 ? x.color : 'gris', publicar: x.publicar !== false };
    },
    rotulo: function (x) { return x.titulo; }
  };
}

function listaRedes_() {
  return {
    archivo: CONFIG.ARCHIVO_REDES, idRe: ID_R_RE, pref: 'r', max: CONFIG.MAX_REDES, nombre: 'red social', plural: 'redes sociales',
    leer: function (x) {
      return { red: REDES_SOCIALES[x.red] ? x.red : 'otra', nombre: String(x.nombre || ''), usuario: String(x.usuario || ''), url: String(x.url || ''), publicar: x.publicar !== false };
    },
    rotulo: function (x) { return x.red === 'otra' ? x.nombre : x.red; }
  };
}

function listaCalendario_() {
  return {
    archivo: CONFIG.ARCHIVO_CALENDARIO, idRe: ID_C_RE, pref: 'c', max: CONFIG.MAX_CALENDARIO, nombre: 'evento', plural: 'eventos',
    leer: function (x) {
      return { fecha: String(x.fecha || ''), fin: String(x.fin || ''), titulo: String(x.titulo || ''), detalle: String(x.detalle || ''), publicar: x.publicar !== false };
    },
    rotulo: function (x) { return x.titulo + ' (' + x.fecha + ')'; },
    ordenar: function (a, b) { return String(a.fecha).localeCompare(String(b.fecha)); }
  };
}

function nuevoIdLista_(pref) {
  return pref + Utilities.formatDate(new Date(), 'America/La_Paz', 'yyyyMMdd') + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 5);
}

function listaLeer_(cfg) {
  const r = ghLeer_(cfg.archivo);
  let crudo = [];
  if (r) {
    try { crudo = JSON.parse(r.texto); } catch (e) { throw new Error('El archivo de ' + cfg.plural + ' está dañado: ' + e.message); }
    if (!Array.isArray(crudo)) throw new Error('El archivo de ' + cfg.plural + ' no tiene el formato esperado.');
  }
  const hoy = Utilities.formatDate(new Date(), 'America/La_Paz', 'yyyyMMdd');
  const lista = crudo.map(function (x, i) {
    x = x || {};
    const n = cfg.leer(x);
    n.id = cfg.idRe.test(String(x.id || '')) ? x.id : cfg.pref + hoy + '-' + ('00000' + i.toString(16)).slice(-5);
    return n;
  });
  return { lista: lista, sha: r ? r.sha : null };
}

function listaEscribir_(cfg, lista, sha, mensaje) {
  ghPonerTexto_(cfg.archivo, JSON.stringify(lista, null, 2) + '\n', mensaje, sha);
}

// datos.id (opcional) = editar; item = datos ya validados (sin id)
function listaGuardarItem_(cfg, u, datos, item) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const act = listaLeer_(cfg);
    let idx = -1;
    if (datos.id) {
      if (!cfg.idRe.test(String(datos.id))) throw new Error('Identificador inválido.');
      idx = act.lista.findIndex(function (x) { return x.id === datos.id; });
      if (idx < 0) throw new Error('Ese ' + cfg.nombre + ' ya no existe (alguien más lo eliminó). Recarga el panel.');
    }
    const nuevo = idx < 0;
    if (nuevo && act.lista.length >= cfg.max) throw new Error('Ya hay ' + cfg.max + ' ' + cfg.plural + '. Elimina alguno antes de agregar otro.');
    item.id = nuevo ? nuevoIdLista_(cfg.pref) : act.lista[idx].id;
    if (nuevo) act.lista.push(item); else act.lista[idx] = item;
    if (cfg.ordenar) act.lista.sort(cfg.ordenar);
    listaEscribir_(cfg, act.lista, act.sha, cfg.nombre[0].toUpperCase() + cfg.nombre.slice(1) + ': ' + (nuevo ? 'nuevo' : 'editado') + ' "' + cfg.rotulo(item) + '" (' + u.email + ')');
    registrar_(u, cfg.nombre[0].toUpperCase() + cfg.nombre.slice(1) + (nuevo ? ' agregado' : ' editado'), cfg.rotulo(item) + (item.publicar ? ' [visible]' : ' [oculto]'));
    return act.lista;
  } finally { lock.releaseLock(); }
}

function listaEliminarItem_(cfg, u, id) {
  if (!cfg.idRe.test(String(id))) throw new Error('Identificador inválido.');
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const act = listaLeer_(cfg);
    const idx = act.lista.findIndex(function (x) { return x.id === id; });
    if (idx < 0) throw new Error('Ese ' + cfg.nombre + ' ya no existe. Recarga el panel.');
    const q = act.lista.splice(idx, 1)[0];
    listaEscribir_(cfg, act.lista, act.sha, cfg.nombre[0].toUpperCase() + cfg.nombre.slice(1) + ': eliminado "' + cfg.rotulo(q) + '" (' + u.email + ')');
    registrar_(u, cfg.nombre[0].toUpperCase() + cfg.nombre.slice(1) + ' eliminado', cfg.rotulo(q));
    return act.lista;
  } finally { lock.releaseLock(); }
}

function listaMoverItem_(cfg, u, id, dir) {
  if (!cfg.idRe.test(String(id))) throw new Error('Identificador inválido.');
  if (dir !== -1 && dir !== 1) throw new Error('Dirección inválida.');
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const act = listaLeer_(cfg);
    const i = act.lista.findIndex(function (x) { return x.id === id; });
    if (i < 0) throw new Error('Ese ' + cfg.nombre + ' ya no existe. Recarga el panel.');
    const j = i + dir;
    if (j < 0 || j >= act.lista.length) return act.lista;
    const t = act.lista[i]; act.lista[i] = act.lista[j]; act.lista[j] = t;
    listaEscribir_(cfg, act.lista, act.sha, cfg.nombre[0].toUpperCase() + cfg.nombre.slice(1) + ': orden cambiado (' + u.email + ')');
    registrar_(u, cfg.nombre[0].toUpperCase() + cfg.nombre.slice(1) + ' movido', cfg.rotulo(t) + (dir < 0 ? ' ← antes' : ' → después'));
    return act.lista;
  } finally { lock.releaseLock(); }
}

/* ───────────────────────── VIDEOS (TikTok, Instagram, YouTube, Facebook) ───────────────────────── */

// Reconoce el enlace de un video y devuelve { plataforma, codigo }. Solo YouTube, TikTok, Instagram y Facebook.
function parsearVideo_(entrada) {
  var u = String(entrada || '').trim();
  if (!u) throw new Error('Pega el enlace del video.');
  if (u.length > 300) throw new Error('El enlace es demasiado largo.');
  if (/\s/.test(u)) throw new Error('El enlace no debe tener espacios.');
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  var m = u.match(/^https?:\/\/([^\/?#:]+)(?::\d+)?([^?#]*)(\?[^#]*)?/i);
  if (!m) throw new Error('El enlace no es válido.');
  var host = m[1].toLowerCase().replace(/^(www|m|web|mobile)\./, '');
  var path = m[2] || '', qs = m[3] || '';
  function q(k) { var r = qs.match(new RegExp('[?&]' + k + '=([^&]+)')); return r ? r[1] : ''; }
  var r;
  if (host === 'youtu.be') {
    r = path.match(/^\/([\w-]{11})(?:\/|$)/);
    if (r) return { plataforma: 'youtube', codigo: r[1] };
  } else if (host === 'youtube.com') {
    var id = path === '/watch' ? q('v') : ((path.match(/^\/(?:shorts|embed|live)\/([\w-]{11})(?:\/|$)/) || [])[1] || '');
    if (/^[\w-]{11}$/.test(id)) return { plataforma: 'youtube', codigo: id };
  } else if (host === 'vm.tiktok.com' || host === 'vt.tiktok.com') {
    throw new Error('Ese es un enlace corto de TikTok. Ábrelo en el navegador y copia la dirección larga (la que tiene /video/ y números).');
  } else if (host === 'tiktok.com') {
    r = path.match(/^\/@[\w.\-]+\/video\/(\d{15,25})(?:\/|$)/);
    if (r) return { plataforma: 'tiktok', codigo: r[1] };
  } else if (host === 'instagram.com') {
    r = path.match(/^\/(?:[\w.]+\/)?(reel|reels|p)\/([\w-]{5,20})(?:\/|$)/);
    if (r) return { plataforma: 'instagram', codigo: (r[1] === 'p' ? 'p' : 'reel') + '/' + r[2] };
  } else if (host === 'fb.watch') {
    throw new Error('Ese es un enlace corto de Facebook. Ábrelo en el navegador y copia la dirección larga.');
  } else if (host === 'facebook.com') {
    r = path.match(/^\/reel\/(\d{6,})(?:\/|$)/);
    if (r) return { plataforma: 'facebook', codigo: 'reel/' + r[1] };
    if (/^\/(?:watch|video\.php)\/?$/.test(path) && /^\d{6,}$/.test(q('v'))) return { plataforma: 'facebook', codigo: 'watch/?v=' + q('v') };
    r = path.match(/\/videos\/(?:[^\/]+\/)?(\d{6,})(?:\/|$)/);
    if (r) return { plataforma: 'facebook', codigo: 'watch/?v=' + r[1] };
  } else {
    throw new Error('Solo se aceptan enlaces de YouTube, TikTok, Instagram o Facebook.');
  }
  throw new Error('No reconozco ese enlace como un video. Copia el enlace desde el botón “Compartir” del video.');
}

/** datos = { id?, titulo, url, categoria:'testimonios'|'vida', publicar:bool } */
function videoGuardar(datos) {
  const u = exigir_();
  if (!datos || typeof datos !== 'object') throw new Error('Datos vacíos.');
  const titulo = cad_(datos.titulo, 80, 'Título');
  const v = parsearVideo_(datos.url);
  if (CATEGORIAS_VIDEO.indexOf(datos.categoria) < 0) throw new Error('Elige la etiqueta del video.');
  let url = String(datos.url).trim(); if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  return listaGuardarItem_(listaVideos_(), u, datos, { titulo: titulo, url: url, plataforma: v.plataforma, codigo: v.codigo, categoria: datos.categoria, publicar: datos.publicar === true });
}
function videoEliminar(id) { return listaEliminarItem_(listaVideos_(), exigir_(), id); }
function videoMover(id, dir) { return listaMoverItem_(listaVideos_(), exigir_(), id, dir); }

/* ───────────────────────── ACCESOS DIRECTOS (solo ADMIN) ───────────────────────── */

function accesosParaPanel_() {
  try { return { datos: listaLeer_(listaAccesos_()).lista }; } catch (e) { return { error: String(e.message || e) }; }
}

function validarUrlAcceso_(v) {
  const t = String(v || '').trim();
  if (!t) throw new Error('Falta completar “Enlace”.');
  if (t.length > 300) throw new Error('El enlace es demasiado largo.');
  if (/\s/.test(t)) throw new Error('El enlace no debe tener espacios.');
  if (!/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?([\/?#]\S*)?$/i.test(t)) throw new Error('El enlace debe empezar con https:// y ser una dirección web completa.');
  return t;
}

/** datos = { id?, icono, titulo, detalle, url, color, publicar:bool } */
function accesoGuardar(datos) {
  const u = exigirAdmin_();
  if (!datos || typeof datos !== 'object') throw new Error('Datos vacíos.');
  if (COLORES_ACCESO.indexOf(datos.color) < 0) throw new Error('Elige un color.');
  return listaGuardarItem_(listaAccesos_(), u, datos, {
    icono: cad_(datos.icono, 8, 'Ícono', true), titulo: cad_(datos.titulo, 30, 'Título'), detalle: cad_(datos.detalle, 50, 'Detalle', true),
    url: validarUrlAcceso_(datos.url), color: datos.color, publicar: datos.publicar === true
  });
}
function accesoEliminar(id) { return listaEliminarItem_(listaAccesos_(), exigirAdmin_(), id); }
function accesoMover(id, dir) { return listaMoverItem_(listaAccesos_(), exigirAdmin_(), id, dir); }

/* ───────────────────────── CONSULTAS Y ADMISIONES (ADMIN y EDITOR) ─────────────────────────
   Las escribe el formulario público del sitio (Formularios.gs) en dos pestañas de ESTA hoja de cálculo:
   “Consultas” y “Admisiones”. Aquí solo se leen y se marca si ya fueron atendidas. */

const HOJA_CONSULTAS = 'Consultas';
const HOJA_ADMISIONES = 'Admisiones';
const MAX_BUZON = 300;
const BUZON = {
  consultas: { hoja: HOJA_CONSULTAS, prefijo: 'CON', claves: { 'Fecha': 'fecha', 'Código': 'codigo', 'Nombre': 'nombre', 'Teléfono': 'telefono', 'Correo': 'email', 'Mensaje': 'mensaje', 'Estado': 'estado', 'Atendido por': 'por', 'Atendido el': 'el' } },
  admisiones: { hoja: HOJA_ADMISIONES, prefijo: 'ADM', claves: { 'Fecha': 'fecha', 'Código': 'codigo', 'Estudiante': 'estudiante', 'Nacimiento': 'nacimiento', 'Nivel': 'nivel', 'Grado': 'grado', 'Colegio anterior': 'colegio', 'Tutor': 'tutor', 'Teléfonos': 'telefonos', 'WhatsApp': 'whatsapp', 'Correo': 'email', 'Comentario': 'comentario', 'Estado': 'estado', 'Atendido por': 'por', 'Atendido el': 'el' } }
};

function buzonLeerTipo_(tipo) {
  const cfg = BUZON[tipo];
  const sh = SpreadsheetApp.getActive().getSheetByName(cfg.hoja);
  if (!sh || sh.getLastRow() < 2) return [];
  const todo = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  const cab = todo[0].map(function (c) { return cfg.claves[String(c)] || null; });
  const lista = [];
  for (let i = todo.length - 1; i >= 1 && lista.length < MAX_BUZON; i--) {
    const o = {};
    cab.forEach(function (k, j) { if (k) o[k] = String(todo[i][j] === undefined || todo[i][j] === null ? '' : todo[i][j]); });
    if (!o.codigo) continue;
    o.estado = o.estado === 'Atendido' ? 'Atendido' : 'Nuevo';
    lista.push(o);
  }
  return lista;
}

const HOJA_AJUSTES = 'Ajustes';
const AVISO_A_DEFECTO = 'javier.lopez@ueconstantino.com';

// Una o varias direcciones separadas por coma (máximo 3), igual que en Formularios.gs.
function correosAviso_(txt) {
  const lista = String(txt || '').split(/[,;\s]+/).filter(function (x) { return x; });
  if (!lista.length) throw new Error('Escribe al menos un correo.');
  if (lista.length > 3) throw new Error('Máximo 3 correos, separados por coma.');
  lista.forEach(function (x) { if (!/^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/.test(x) || x.length > 80) throw new Error('“' + x + '” no parece un correo válido.'); });
  return lista.join(', ');
}

function avisoCorreoLeer_() {
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName(HOJA_AJUSTES);
    if (sh && sh.getLastRow() >= 1) {
      const v = sh.getRange(1, 1, sh.getLastRow(), 2).getValues();
      for (let i = 0; i < v.length; i++) { if (String(v[i][0]).trim() === 'aviso_a') { try { return correosAviso_(v[i][1]); } catch (e) { /* inválido: se usa el de respaldo */ } } }
    }
  } catch (e) { /* sin hoja de ajustes */ }
  return AVISO_A_DEFECTO;
}

function buzonParaPanel_() {
  try {
    return { consultas: buzonLeerTipo_('consultas'), admisiones: buzonLeerTipo_('admisiones'), avisoA: avisoCorreoLeer_() };
  } catch (e) { return { error: String(e.message || e) }; }
}

/** Solo ADMIN. Guarda a qué correo(s) llega el aviso de cada formulario enviado desde el sitio. */
function avisoCorreoGuardar(correos) {
  const u = exigirAdmin_();
  const limpio = correosAviso_(correos);
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const ss = SpreadsheetApp.getActive();
    let sh = ss.getSheetByName(HOJA_AJUSTES);
    if (!sh) { sh = ss.insertSheet(HOJA_AJUSTES); sh.getRange(1, 1, 1, 2).setValues([['Clave', 'Valor']]); sh.getRange(1, 1, 1, 2).setFontWeight('bold'); }
    const n = sh.getLastRow();
    let fila = -1;
    if (n >= 1) { const v = sh.getRange(1, 1, n, 1).getValues(); for (let i = 0; i < v.length; i++) { if (String(v[i][0]).trim() === 'aviso_a') { fila = i + 1; break; } } }
    if (fila < 0) fila = n + 1;
    const r = sh.getRange(fila, 1, 1, 2);
    r.setNumberFormat('@');
    r.setValues([['aviso_a', limpio]]);
    registrar_(u, 'Correo de avisos de formularios', limpio);
  } finally { lock.releaseLock(); }
  return limpio;
}

function buzonCargar() { exigir_(); return buzonParaPanel_(); }

/** tipo = 'consultas' | 'admisiones'; atendido = true/false. Devuelve la lista actualizada de las dos. */
function buzonMarcar(tipo, codigo, atendido) {
  const u = exigir_();
  const cfg = BUZON[tipo];
  if (!cfg) throw new Error('Tipo no válido.');
  if (!new RegExp('^' + cfg.prefijo + '-\\d{4}$').test(String(codigo || ''))) throw new Error('Código no válido.');
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName(cfg.hoja);
    if (!sh || sh.getLastRow() < 2) throw new Error('No hay registros.');
    const todo = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
    const idx = function (nombre) { return todo[0].indexOf(nombre); };
    const cCod = idx('Código'), cEst = idx('Estado'), cPor = idx('Atendido por'), cEl = idx('Atendido el');
    if (cCod < 0 || cEst < 0 || cPor < 0 || cEl < 0) throw new Error('La hoja “' + cfg.hoja + '” no tiene el formato esperado.');
    let fila = -1;
    for (let i = 1; i < todo.length; i++) { if (String(todo[i][cCod]) === codigo) { fila = i + 1; break; } }
    if (fila < 0) throw new Error('No se encontró ese registro.');
    const ahora = Utilities.formatDate(new Date(), 'America/La_Paz', 'yyyy-MM-dd HH:mm');
    const r = sh.getRange(fila, 1, 1, todo[0].length);
    const valores = todo[fila - 1].slice();
    valores[cEst] = atendido === true ? 'Atendido' : 'Nuevo';
    valores[cPor] = atendido === true ? u.email : '';
    valores[cEl] = atendido === true ? ahora : '';
    r.setNumberFormat('@');
    r.setValues([valores]);
    registrar_(u, atendido === true ? 'Marcado como atendido' : 'Reabierto', codigo);
  } finally { lock.releaseLock(); }
  return buzonParaPanel_();
}

/* ───────────────────────── REDES SOCIALES (solo ADMIN) ───────────────────────── */

function redesParaPanel_() {
  try { return { datos: listaLeer_(listaRedes_()).lista }; } catch (e) { return { error: String(e.message || e) }; }
}

/** datos = { id?, red, nombre?, usuario?, url, publicar:bool } */
function redGuardar(datos) {
  const u = exigirAdmin_();
  if (!datos || typeof datos !== 'object') throw new Error('Datos vacíos.');
  if (!REDES_SOCIALES[datos.red]) throw new Error('Elige la red social.');
  const url = validarUrlAcceso_(datos.url);
  if (!REDES_SOCIALES[datos.red].test(url)) throw new Error('Ese enlace no parece ser de la red elegida. Revisa que sea la dirección del perfil, empezando con https://');
  const lista = listaLeer_(listaRedes_()).lista;
  const otras = lista.filter(function (x) { return x.id !== datos.id; });
  if (datos.red === 'facebook' && otras.some(function (x) { return x.red === 'facebook'; })) throw new Error('Ya hay una página de Facebook. Edítala en lugar de agregar otra.');
  return listaGuardarItem_(listaRedes_(), u, datos, {
    red: datos.red, nombre: cad_(datos.nombre, 20, 'Nombre de la red', datos.red !== 'otra'),
    usuario: cad_(datos.usuario, 40, 'Usuario', true), url: url, publicar: datos.publicar === true
  });
}
function redEliminar(id) { return listaEliminarItem_(listaRedes_(), exigirAdmin_(), id); }
function redMover(id, dir) { return listaMoverItem_(listaRedes_(), exigirAdmin_(), id, dir); }

/* ───────────────────────── CALENDARIO ESCOLAR (ADMIN y EDITOR) ───────────────────────── */

function calendarioParaPanel_() {
  try { return { datos: listaLeer_(listaCalendario_()).lista }; } catch (e) { return { error: String(e.message || e) }; }
}

function fechaValida_(v, nombre, opcional) {
  const t = String(v || '').trim();
  if (!t && opcional) return '';
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error('Elige una fecha válida en “' + nombre + '”.');
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) throw new Error('La fecha de “' + nombre + '” no existe.');
  if (+m[1] < 2020 || +m[1] > 2100) throw new Error('Revisa el año de “' + nombre + '”.');
  return t;
}

/** datos = { id?, fecha:'AAAA-MM-DD', fin?:'AAAA-MM-DD', titulo, detalle, publicar:bool } */
function calendarioGuardar(datos) {
  const u = exigir_();
  if (!datos || typeof datos !== 'object') throw new Error('Datos vacíos.');
  const fecha = fechaValida_(datos.fecha, 'Fecha');
  const fin = fechaValida_(datos.fin, 'Hasta (opcional)', true);
  if (fin && fin < fecha) throw new Error('“Hasta” no puede ser antes de la fecha de inicio.');
  return listaGuardarItem_(listaCalendario_(), u, datos, {
    fecha: fecha, fin: fin && fin !== fecha ? fin : '', titulo: cad_(datos.titulo, 70, 'Título'), detalle: cad_(datos.detalle, 120, 'Detalle', true), publicar: datos.publicar === true
  });
}
function calendarioEliminar(id) { return listaEliminarItem_(listaCalendario_(), exigir_(), id); }

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

/**
 * Espacio que usa el repositorio en GitHub (en KB, incluye el historial de cambios).
 * GitHub recomienda no pasar de 1 GB; GitHub Pages publica hasta 1 GB.
 * Si falla, devuelve null y el panel simplemente no muestra el indicador.
 */
function espacioRepo_() {
  try {
    const r = gh_('get', '/repos/' + CONFIG.OWNER + '/' + CONFIG.REPO);
    if (r.getResponseCode() !== 200) return null;
    const kb = Number(JSON.parse(r.getContentText()).size);
    if (!isFinite(kb) || kb < 0) return null;
    return { usadoKB: Math.round(kb), limiteKB: 1024 * 1024 };
  } catch (e) { return null; }
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
