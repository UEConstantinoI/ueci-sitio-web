/**
 * PANEL DE ADMINISTRACIÓN DEL SITIO WEB — U.E. Constantino I
 *
 * Esta planilla es el "panel" del sitio. Cada fila de la hoja "Noticias" es un
 * comunicado. Con el menú "🌐 Sitio web > Publicar noticias" el script sube las
 * noticias y sus imágenes al repositorio de GitHub y el sitio se actualiza solo.
 *
 * La clave de GitHub NO está en este código: se guarda aparte (menú > Guardar clave).
 */

const CONFIG = {
  OWNER: 'UEConstantinoI',
  REPO: 'ueci-sitio-web',
  BRANCH: 'main',
  HOJA: 'Noticias',
  RUTA_JSON: 'data/noticias.json',
  CARPETA_IMG: 'assets/noticias',
  ANCHO_MAX_IMG: 1200,   // las fotos se reducen a este ancho para que el sitio cargue rápido
  MAX_NOTICIAS: 50
};

// Columnas de la hoja (A..I)
const COL = { ID: 1, FECHA: 2, TITULO: 3, RESUMEN: 4, IMAGEN: 5, PUBLICAR: 6, ESTADO: 7, RUTA: 8, HUELLA: 9 };

/* ───────────────────────── MENÚ ───────────────────────── */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🌐 Sitio web')
    .addItem('Publicar noticias', 'publicarNoticias')
    .addSeparator()
    .addItem('Preparar planilla (solo la primera vez)', 'prepararPlanilla')
    .addItem('Guardar clave de GitHub', 'guardarClave')
    .addItem('Probar conexión con GitHub', 'probarConexion')
    .addToUi();
}

/* ─────────────────── PREPARAR LA PLANILLA ─────────────────── */

function prepararPlanilla() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(CONFIG.HOJA) || ss.insertSheet(CONFIG.HOJA, 0);

  const encabezados = ['ID (automático)', 'Fecha', 'Título', 'Resumen (2-3 líneas)',
    'Imagen (opcional)', 'Publicar', 'Estado (automático)', 'ruta', 'huella'];
  sh.getRange(1, 1, 1, encabezados.length).setValues([encabezados])
    .setFontWeight('bold').setBackground('#1f5631').setFontColor('#ffffff')
    .setVerticalAlignment('middle').setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  sh.setFrozenRows(1);
  sh.setRowHeight(1, 40);

  const filas = 200;
  sh.getRange(2, COL.FECHA, filas, 1).setNumberFormat('dd/mm/yyyy')
    .setDataValidation(SpreadsheetApp.newDataValidation().requireDate()
      .setHelpText('Escribe la fecha así: 14/10/2026').build());
  sh.getRange(2, COL.PUBLICAR, filas, 1)
    .setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['SÍ', 'NO'], true).build())
    .setHorizontalAlignment('center');
  sh.getRange(2, COL.ID, filas, 1).setBackground('#f1f1f1').setFontColor('#777777');
  sh.getRange(2, COL.ESTADO, filas, 1).setBackground('#f1f1f1').setFontColor('#555555');
  sh.getRange(2, 1, filas, encabezados.length).setVerticalAlignment('top');
  sh.getRange(2, COL.RESUMEN, filas, 1).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  sh.getRange(2, COL.TITULO, filas, 1).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  sh.setRowHeights(2, filas, 110);

  const anchos = [110, 95, 220, 340, 170, 80, 200, 40, 40];
  anchos.forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.hideColumns(COL.RUTA, 2); // columnas técnicas

  // Hoja de instrucciones para Secretaría
  let ins = ss.getSheetByName('Instrucciones');
  if (!ins) ins = ss.insertSheet('Instrucciones');
  ins.clear();
  const texto = [
    ['CÓMO PUBLICAR UNA NOTICIA EN EL SITIO WEB'],
    [''],
    ['1. Ve a la hoja "Noticias" y escribe una fila nueva (no dejes filas vacías en medio).'],
    ['2. Fecha: escríbela como 14/10/2026.   Título: corto y claro.   Resumen: 2 o 3 líneas.'],
    ['3. Imagen (opcional): haz clic en la celda de "Imagen" > menú Insertar > Imagen > "Imagen en la celda" y súbela desde tu computadora.'],
    ['   Usa una sola imagen por noticia, en la misma fila de esa noticia.'],
    ['4. Publicar: elige SÍ para que aparezca en el sitio, NO para que no aparezca (o para retirarla).'],
    ['5. Menú superior "🌐 Sitio web" > "Publicar noticias". Espera el mensaje de confirmación.'],
    ['6. En 1 o 2 minutos la noticia ya se ve en el sitio. La columna "Estado" dice si salió bien o qué falló.'],
    [''],
    ['IMPORTANTE'],
    ['• Todo lo que publicas es PÚBLICO en internet. No pongas datos de alumnos, números de carnet ni información privada.'],
    ['• El sitio muestra las 6 noticias más recientes (por fecha).'],
    ['• Para corregir una noticia: cambia el texto en su fila y vuelve a publicar.'],
    ['• Para retirar una noticia: cambia Publicar a NO y vuelve a publicar.']
  ];
  ins.getRange(1, 1, texto.length, 1).setValues(texto).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  ins.setColumnWidth(1, 760);
  ins.getRange('A1').setFontWeight('bold').setFontSize(14);
  ins.getRange('A11').setFontWeight('bold');

  SpreadsheetApp.getUi().alert('Planilla lista. Siguiente paso: menú "Sitio web" > "Guardar clave de GitHub".');
}

/* ───────────────────── CLAVE DE GITHUB ───────────────────── */

function guardarClave() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('Clave de GitHub',
    'Pega aquí la clave (token) de GitHub. Se guarda en el script, no en la hoja.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const t = r.getResponseText().trim();
  if (!t) { ui.alert('No se guardó nada: la clave estaba vacía.'); return; }
  PropertiesService.getScriptProperties().setProperty('GITHUB_TOKEN', t);
  ui.alert('Clave guardada. Ahora prueba "Probar conexión con GitHub".');
}

function probarConexion() {
  const ui = SpreadsheetApp.getUi();
  try {
    const r = gh_('get', '/repos/' + CONFIG.OWNER + '/' + CONFIG.REPO);
    const code = r.getResponseCode();
    if (code !== 200) { ui.alert('GitHub respondió ' + code + ': ' + r.getContentText().slice(0, 300)); return; }
    const j = JSON.parse(r.getContentText());
    const puedeEscribir = j.permissions && j.permissions.push;
    ui.alert(puedeEscribir
      ? '✔ Conexión correcta. Se puede escribir en ' + j.full_name + '.'
      : '⚠ Se conectó, pero la clave NO tiene permiso de escritura en el repositorio.');
  } catch (e) {
    ui.alert('Error: ' + e.message);
  }
}

/* ───────────────────── PUBLICAR NOTICIAS ───────────────────── */

function publicarNoticias() {
  const ui = SpreadsheetApp.getUi();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) { ui.alert('Otra publicación está en curso. Espera un momento.'); return; }

  try {
    const sh = SpreadsheetApp.getActive().getSheetByName(CONFIG.HOJA);
    if (!sh) { ui.alert('No existe la hoja "' + CONFIG.HOJA + '". Usa "Preparar planilla".'); return; }
    const ultima = sh.getLastRow();
    if (ultima < 2) { ui.alert('No hay noticias para publicar.'); return; }

    const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
    const rango = sh.getRange(2, 1, ultima - 1, COL.HUELLA);
    const valores = rango.getValues();
    const estados = [];
    const items = [];
    let subidas = 0, errores = 0;

    valores.forEach(function (fila, i) {
      const filaHoja = i + 2;
      const estado = { fila: filaHoja, texto: '' };
      estados.push(estado);

      const titulo = String(fila[COL.TITULO - 1] || '').trim();
      const resumen = String(fila[COL.RESUMEN - 1] || '').trim();
      const fechaRaw = fila[COL.FECHA - 1];
      const imagenVal = fila[COL.IMAGEN - 1];
      const publicar = esSi_(fila[COL.PUBLICAR - 1]);

      if (!titulo && !fechaRaw && !resumen && !esImagen_(imagenVal)) { estado.texto = ''; return; }

      try {
        const fecha = aFechaISO_(fechaRaw, tz);
        if (!titulo) throw new Error('Falta el título');
        if (!fecha) throw new Error('Falta la fecha o no se entiende (usa 14/10/2026)');

        let id = String(fila[COL.ID - 1] || '').trim();
        if (!id) { id = nuevoId_(fecha); sh.getRange(filaHoja, COL.ID).setValue(id); }

        if (!publicar) { estado.texto = 'No publicada (Publicar = NO)'; return; }

        // ----- imagen -----
        let ruta = '';
        if (esImagen_(imagenVal) || (typeof imagenVal === 'string' && imagenVal.trim())) {
          const blobOriginal = obtenerBlobImagen_(imagenVal);
          const huella = md5_(blobOriginal.getBytes());
          const rutaPrev = String(fila[COL.RUTA - 1] || '');
          if (rutaPrev && huella === String(fila[COL.HUELLA - 1])) {
            ruta = rutaPrev; // misma imagen de siempre: no se vuelve a subir
          } else {
            const blob = reducirImagen_(blobOriginal);
            const ext = extension_(blob.getContentType());
            ruta = CONFIG.CARPETA_IMG + '/' + id + '.' + ext;
            subirArchivo_(ruta, Utilities.base64Encode(blob.getBytes()), 'Noticias: imagen ' + id);
            sh.getRange(filaHoja, COL.RUTA).setValue(ruta);
            sh.getRange(filaHoja, COL.HUELLA).setValue(huella);
            subidas++;
          }
        } else {
          sh.getRange(filaHoja, COL.RUTA, 1, 2).clearContent();
        }

        items.push({ fecha: fecha, titulo: titulo, resumen: resumen, imagen: ruta, publicar: true });
        estado.texto = '✔ Publicada';
      } catch (e) {
        errores++;
        estado.texto = '⚠ ' + e.message;
      }
    });

    items.sort(function (a, b) { return a.fecha < b.fecha ? 1 : (a.fecha > b.fecha ? -1 : 0); });
    const lista = items.slice(0, CONFIG.MAX_NOTICIAS);

    subirArchivo_(CONFIG.RUTA_JSON,
      Utilities.base64Encode(Utilities.newBlob(JSON.stringify(lista, null, 2)).getBytes()),
      'Noticias: actualizadas desde la planilla (' + lista.length + ' publicadas)');

    const ahora = Utilities.formatDate(new Date(), tz, 'dd/MM HH:mm');
    estados.forEach(function (e) {
      if (!e.texto) return;
      const t = e.texto.indexOf('✔') === 0 ? e.texto + ' ' + ahora : e.texto;
      sh.getRange(e.fila, COL.ESTADO).setValue(t);
    });

    ui.alert('Listo. ' + lista.length + ' noticia(s) publicada(s)' +
      (subidas ? ', ' + subidas + ' imagen(es) nueva(s)' : '') +
      (errores ? '. Hubo ' + errores + ' fila(s) con problemas: revisa la columna Estado.' : '.') +
      '\nEl sitio se actualiza en 1 o 2 minutos.');
  } catch (e) {
    ui.alert('No se pudo publicar: ' + e.message);
  } finally {
    lock.releaseLock();
  }
}

/* ───────────────────── IMÁGENES ───────────────────── */

function esImagen_(v) {
  return v && typeof v === 'object' && typeof v.getContentUrl === 'function';
}

function obtenerBlobImagen_(v) {
  const auth = { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() };
  // Caso 1: imagen puesta "en la celda"
  if (esImagen_(v)) {
    const url = v.getContentUrl();
    if (!url) throw new Error('No se pudo leer la imagen de la celda. Vuelve a insertarla (Insertar > Imagen > Imagen en la celda)');
    const r = UrlFetchApp.fetch(url, { headers: auth, muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) throw new Error('No se pudo descargar la imagen de la celda (' + r.getResponseCode() + ')');
    return r.getBlob();
  }
  // Caso 2: texto con un enlace de Google Drive o una dirección web
  const txt = String(v).trim();
  const m = txt.match(/[-\w]{25,}/);
  if (/drive\.google\.com|docs\.google\.com/.test(txt) && m) return DriveApp.getFileById(m[0]).getBlob();
  if (/^https?:\/\//.test(txt)) {
    const r2 = UrlFetchApp.fetch(txt, { muteHttpExceptions: true });
    if (r2.getResponseCode() !== 200) throw new Error('No se pudo descargar la imagen del enlace');
    return r2.getBlob();
  }
  throw new Error('La celda de imagen no contiene una imagen ni un enlace válido');
}

// Reduce el tamaño usando la miniatura de Drive. Si algo falla, se usa la imagen original.
function reducirImagen_(blob) {
  try {
    const f = DriveApp.createFile(blob.copyBlob().setName('tmp_' + Date.now()));
    const id = f.getId();
    const r = UrlFetchApp.fetch('https://drive.google.com/thumbnail?id=' + id + '&sz=w' + CONFIG.ANCHO_MAX_IMG,
      { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    f.setTrashed(true);
    if (r.getResponseCode() === 200) {
      const b = r.getBlob();
      if (String(b.getContentType()).indexOf('image/') === 0 && b.getBytes().length < blob.getBytes().length * 1.2) return b;
    }
  } catch (e) { /* se usa la original */ }
  return blob;
}

function extension_(tipo) {
  tipo = String(tipo).toLowerCase();
  if (tipo.indexOf('png') >= 0) return 'png';
  if (tipo.indexOf('webp') >= 0) return 'webp';
  if (tipo.indexOf('gif') >= 0) return 'gif';
  return 'jpg';
}

function md5_(bytes) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, bytes)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

/* ───────────────────── UTILIDADES ───────────────────── */

function esSi_(v) {
  const s = String(v || '').trim().toUpperCase();
  return s === 'SÍ' || s === 'SI' || s === 'TRUE' || s === 'VERDADERO';
}

function aFechaISO_(v, tz) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  const m = String(v).trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return '';
}

function nuevoId_(fechaISO) {
  const azar = Utilities.getUuid().replace(/-/g, '').slice(0, 5);
  return 'n' + fechaISO.replace(/-/g, '') + '-' + azar;
}

/* ───────────────────── GITHUB ───────────────────── */

function gh_(metodo, rutaApi, payload) {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('Falta la clave de GitHub. Usa el menú "Sitio web" > "Guardar clave de GitHub".');
  const opts = {
    method: metodo,
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    muteHttpExceptions: true
  };
  if (payload) { opts.contentType = 'application/json'; opts.payload = JSON.stringify(payload); }
  return UrlFetchApp.fetch('https://api.github.com' + rutaApi, opts);
}

function subirArchivo_(ruta, base64, mensaje) {
  const base = '/repos/' + CONFIG.OWNER + '/' + CONFIG.REPO + '/contents/' + ruta;
  const g = gh_('get', base + '?ref=' + CONFIG.BRANCH);
  let sha;
  if (g.getResponseCode() === 200) sha = JSON.parse(g.getContentText()).sha;
  else if (g.getResponseCode() !== 404) throw new Error('GitHub (' + g.getResponseCode() + '): ' + g.getContentText().slice(0, 200));

  const cuerpo = { message: mensaje, content: base64, branch: CONFIG.BRANCH };
  if (sha) cuerpo.sha = sha;
  const p = gh_('put', base, cuerpo);
  if (p.getResponseCode() !== 200 && p.getResponseCode() !== 201) {
    throw new Error('No se pudo guardar ' + ruta + ' (' + p.getResponseCode() + '): ' + p.getContentText().slice(0, 200));
  }
}
