/* ---------- Carrusel desde data/galeria.json ---------- */
(function () {
  var sec = document.getElementById('galeria');
  var track = document.getElementById('carTrack');
  var dotsWrap = document.getElementById('carDots');
  if (!sec || !track || !dotsWrap) return;
  var RUTA_OK = /^assets\/[\w\-\/.]+$/;   // solo imágenes propias del sitio

  function slide(f) {
    var s = document.createElement('div');
    s.className = 'car-slide';
    var bg = document.createElement('div');
    bg.className = 'cs-bg';
    bg.style.backgroundImage = 'url("' + f.imagen + '")';
    s.appendChild(bg);
    if (f.etiqueta || f.titulo || f.descripcion) {
      var c = document.createElement('div');
      c.className = 'cs-content';
      if (f.etiqueta) { var t = document.createElement('span'); t.className = 'cs-tag'; t.textContent = f.etiqueta; c.appendChild(t); }
      if (f.titulo) { var h = document.createElement('h3'); h.textContent = f.titulo; c.appendChild(h); }
      if (f.descripcion) { var p = document.createElement('p'); p.textContent = f.descripcion; c.appendChild(p); }
      s.appendChild(c);
    }
    return s;
  }

  function iniciarCarrusel() {
    var slides = track.children.length;
    var idx = 0, timer;
    var multi = slides > 1;
    for (var i = 0; i < slides; i++) {
      (function (n) {
        var b = document.createElement('button');
        b.setAttribute('aria-label', 'Ir a la imagen ' + (n + 1));
        if (n === 0) b.classList.add('active');
        b.addEventListener('click', function () { goTo(n); });
        dotsWrap.appendChild(b);
      })(i);
    }
    function render() {
      track.style.transform = 'translateX(-' + (idx * 100) + '%)';
      Array.prototype.forEach.call(dotsWrap.children, function (d, n) { d.classList.toggle('active', n === idx); });
    }
    function restart() { clearInterval(timer); if (multi) timer = setInterval(function () { goTo(idx + 1); }, 5000); }
    function goTo(n) { idx = (n + slides) % slides; render(); restart(); }
    var prev = sec.querySelector('.car-arrow.prev'), next = sec.querySelector('.car-arrow.next');
    prev.addEventListener('click', function () { goTo(idx - 1); });
    next.addEventListener('click', function () { goTo(idx + 1); });
    if (!multi) { prev.hidden = true; next.hidden = true; dotsWrap.hidden = true; }
    restart();
  }

  fetch('data/galeria.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (lista) {
      lista = (Array.isArray(lista) ? lista : []).filter(function (f) {
        return f && f.publicar !== false && typeof f.imagen === 'string' && RUTA_OK.test(f.imagen) && f.imagen.indexOf('..') < 0;
      });
      if (!lista.length) return;           // sin fotos visibles: la sección sigue oculta
      lista.forEach(function (f) { track.appendChild(slide(f)); });
      sec.hidden = false;
      iniciarCarrusel();
    })
    .catch(function () { /* sin galería: la sección sigue oculta */ });
})();

/* ---------- Pestañas de niveles ---------- */
(function () {
  var tabs = document.querySelectorAll('.nivel-tab');
  var panels = document.querySelectorAll('.nivel-panel');
  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      tabs.forEach(function (x) { x.classList.remove('active'); });
      panels.forEach(function (p) { p.classList.remove('active'); });
      t.classList.add('active');
      document.querySelector('.nivel-panel[data-nivel="' + t.dataset.nivel + '"]').classList.add('active');
    });
  });
})();

/* ---------- Noticias desde data/noticias.json ---------- */
(function () {
  var cont = document.getElementById('noticiasGrid');
  if (!cont) return;
  var MESES = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'];
  var MAX = 6;

  function fechaBonita(iso) {
    var p = String(iso).split('-');
    if (p.length !== 3) return iso;
    return parseInt(p[2], 10) + ' ' + MESES[parseInt(p[1], 10) - 1] + ' ' + p[0];
  }

  // Siempre se crea texto con textContent (nunca innerHTML) para que
  // un comunicado mal escrito no pueda romper ni alterar la página.
  function tarjeta(n) {
    var art = document.createElement('article');
    art.className = 'noticia-card';
    if (n.imagen) {
      var img = document.createElement('img');
      img.src = n.imagen;
      img.alt = n.titulo || '';
      img.loading = 'lazy';
      art.appendChild(img);
    }
    var body = document.createElement('div');
    body.className = 'noticia-body';
    var f = document.createElement('span');
    f.className = 'noticia-fecha';
    f.textContent = fechaBonita(n.fecha);
    var h = document.createElement('h3');
    h.textContent = n.titulo || '';
    var p = document.createElement('p');
    p.textContent = n.resumen || '';
    body.appendChild(f); body.appendChild(h); body.appendChild(p);
    art.appendChild(body);
    return art;
  }

  fetch('data/noticias.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (lista) {
      lista = lista
        .filter(function (n) { return n.publicar !== false; })
        .sort(function (a, b) { return String(b.fecha).localeCompare(String(a.fecha)); })
        .slice(0, MAX);
      cont.textContent = '';
      if (!lista.length) {
        var v = document.createElement('p');
        v.className = 'noticias-vacio';
        v.textContent = 'Por ahora no hay comunicados publicados.';
        cont.appendChild(v);
        return;
      }
      lista.forEach(function (n) { cont.appendChild(tarjeta(n)); });
    })
    .catch(function () {
      cont.textContent = '';
      var v = document.createElement('p');
      v.className = 'noticias-vacio';
      v.textContent = 'No pudimos cargar los comunicados en este momento.';
      cont.appendChild(v);
    });
})();

/* ---------- Testimonios en video (se carga YouTube solo al hacer clic) ---------- */
(function () {
  document.querySelectorAll('.video-thumb').forEach(function (b) {
    b.addEventListener('click', function () {
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + b.dataset.yt + '?autoplay=1';
      f.title = 'Testimonio de estudiante';
      f.allow = 'autoplay; encrypted-media; picture-in-picture';
      f.allowFullscreen = true;
      b.textContent = '';
      b.appendChild(f);
    }, { once: true });
  });
})();

/* ---------- Facebook: el plugin necesita el ancho exacto del contenedor ---------- */
(function () {
  var viejo = document.getElementById('fbFrame');
  if (!viejo) return;
  var cuerpo = viejo.parentNode;
  var w = Math.floor(cuerpo.clientWidth - 24);           // menos el padding del contenedor
  w = Math.max(280, Math.min(500, w));                   // Facebook acepta de 180 a 500
  var f = document.createElement('iframe');              // iframe nuevo, ya con su dirección final
  f.title = viejo.title;
  f.width = w; f.height = 480;
  f.setAttribute('frameborder', '0');
  f.setAttribute('scrolling', 'no');
  f.setAttribute('allow', 'encrypted-media');
  f.src = 'https://www.facebook.com/plugins/page.php?href=' + encodeURIComponent('https://www.facebook.com/UEConstantinoI') +
    '&tabs=timeline&width=' + w + '&height=480&small_header=true&hide_cover=false&show_facepile=false';
  cuerpo.replaceChild(f, viejo);
})();

/* ---------- Textos editables desde data/textos.json ----------
   El HTML ya trae los textos actuales; si el archivo no carga, la página queda igual. */
(function () {
  function $(s) { return document.querySelector(s); }
  function txt(el, v) { if (el && typeof v === 'string') el.textContent = v; }

  function titulo(el, v) {                 // *palabra* = resaltado
    if (!el || typeof v !== 'string') return;
    el.textContent = '';
    v.split('*').forEach(function (parte, i) {
      if (!parte) return;
      if (i % 2 === 1) { var em = document.createElement('em'); em.textContent = parte; el.appendChild(em); }
      else el.appendChild(document.createTextNode(parte));
    });
  }

  function hero(h) {
    if (!h) return;
    txt($('.hero .eyebrow'), h.etiqueta);
    titulo($('.hero h1'), h.titulo);
    txt($('.hero .lede'), h.descripcion);
    var cajas = document.querySelectorAll('.stat-strip > div');
    (h.datos || []).forEach(function (d, i) {
      if (!cajas[i]) return;
      txt(cajas[i].querySelector('strong'), d.valor);
      txt(cajas[i].querySelector('span'), d.texto);
    });
  }

  function nosotros(n) {
    if (!n) return;
    ['vision', 'mision', 'objetivo'].forEach(function (k) {
      var d = n[k], panel = $('.nivel-panel[data-nivel="' + k + '"]');
      if (!d || !panel) return;
      txt(panel.querySelector('h3'), d.titulo);
      txt(panel.querySelector('p'), d.texto);
      var ul = panel.querySelector('ul');
      if (Array.isArray(d.puntos)) {
        if (ul) ul.remove();
        if (d.puntos.length) {
          ul = document.createElement('ul');
          d.puntos.forEach(function (p) { var li = document.createElement('li'); li.textContent = p; ul.appendChild(li); });
          panel.querySelector('p').parentNode.appendChild(ul);
        }
      }
      var kw = panel.querySelector('.keywords');
      if (kw && Array.isArray(d.claves)) {
        kw.textContent = '';
        d.claves.forEach(function (c) { var s = document.createElement('span'); s.textContent = c; kw.appendChild(s); });
      }
    });
  }

  function pilares(lista) {
    var g = $('.pilares-grid');
    if (!g || !Array.isArray(lista) || !lista.length) return;
    g.textContent = '';
    lista.forEach(function (p) {
      var c = document.createElement('div'); c.className = 'pilar-card';
      var i = document.createElement('div'); i.className = 'pilar-ico'; i.setAttribute('aria-hidden', 'true'); i.textContent = p.icono || '';
      var h = document.createElement('h3'); h.textContent = p.titulo || '';
      var t = document.createElement('p'); t.textContent = p.texto || '';
      c.appendChild(i); c.appendChild(h); c.appendChild(t); g.appendChild(c);
    });
  }

  function transporte(t) {
    if (!t) return;
    txt($('#transporte .section-head h2'), t.titulo);
    txt($('#transporte .section-head p'), t.texto);
    txt($('#transporte .acceso-card b'), t.publico_titulo);
    txt($('#transporte .acceso-card small'), t.publico_texto);
    var fig = document.getElementById('trFoto'), lay = document.getElementById('trLayout');
    if (fig && lay && typeof t.imagen === 'string' && /^assets\/[\w\-\/.]+$/.test(t.imagen) && t.imagen.indexOf('..') < 0) {
      document.getElementById('trImg').src = t.imagen;
      fig.hidden = false; lay.classList.add('con-foto');
    }
  }

  function fila(id, icono, rotulo, valor) {
    var el = document.getElementById(id);
    if (!el || typeof valor !== 'string') return;
    el.textContent = icono;
    var b = document.createElement('b'); b.textContent = rotulo;
    el.appendChild(b); el.appendChild(document.createTextNode(valor));
  }

  function contacto(c) {
    if (!c) return;
    txt(document.getElementById('ctTitulo'), c.titulo);
    fila('ctDir', '📍', 'Dirección', c.direccion);
    fila('ctTel', '☎️', 'Teléfono fijo y WhatsApp', c.telefono);
    fila('ctCel', '📱', 'Celular', c.celular);
    if (/^\d{8,15}$/.test(String(c.whatsapp || ''))) {
      document.querySelectorAll('a[href^="https://wa.me/"]').forEach(function (a) { a.href = 'https://wa.me/' + c.whatsapp; });
    }
  }

  fetch('data/textos.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (t) { hero(t.hero); nosotros(t.nosotros); pilares(t.pilares); transporte(t.transporte); contacto(t.contacto); })
    .catch(function () { /* se queda el texto que ya trae la página */ });
})();
