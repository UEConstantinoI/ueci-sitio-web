/* ---------- Carrusel desde data/galeria.json ---------- */
(function () {
  var sec = document.getElementById('galeria');
  var track = document.getElementById('carTrack');
  var dotsWrap = document.getElementById('carDots');
  if (!sec || !track || !dotsWrap) return;
  var RUTA_OK = /^assets\/[\w\-\/.]+$/;   // solo imágenes propias del sitio

  function slide(f, primera) {
    var s = document.createElement('div');
    s.className = 'car-slide';
    var bg = document.createElement('div');
    bg.className = 'cs-bg';
    if (primera) bg.style.backgroundImage = 'url("' + f.imagen + '")';
    else bg.setAttribute('data-bg', f.imagen);
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
      lista.forEach(function (f, n) { track.appendChild(slide(f, n === 0)); });
      sec.hidden = false;
      iniciarCarrusel();
      // el resto de las fotos se baja cuando la primera ya se vio
      var resto = function () {
        track.querySelectorAll('.cs-bg[data-bg]').forEach(function (d) {
          var u = d.getAttribute('data-bg'); d.removeAttribute('data-bg');
          d.style.backgroundImage = 'url("' + u + '")';
        });
      };
      var im = new Image(); im.onload = im.onerror = function () { setTimeout(resto, 300); }; im.src = lista[0].imagen;
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
    var sh = document.createElement('a');
    sh.className = 'noticia-compartir';
    sh.target = '_blank'; sh.rel = 'noopener';
    sh.textContent = 'Compartir por WhatsApp';
    sh.href = 'https://wa.me/?text=' + encodeURIComponent((n.titulo || 'Comunicado') + ' - Unidad Educativa Constantino I\n' + location.origin + location.pathname.replace(/[^\/]*$/, '') + '#noticias');
    body.appendChild(sh);
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

  var RUTA_IMG = /^assets\/[\w\-\/.]+$/;
  function rutaOk(r) { return typeof r === 'string' && RUTA_IMG.test(r) && r.indexOf('..') < 0; }
  // devuelve true si la foto queda visible; '' = sin foto; cualquier otra cosa = se deja la que ya trae la página
  function ponerFoto(img, ruta) {
    if (!img) return false;
    if (ruta === '') { img.hidden = true; return false; }
    if (rutaOk(ruta)) { img.src = ruta; img.hidden = false; return true; }
    return !img.hidden;
  }

  function hero(h) {
    if (!h) return;
    var f1 = ponerFoto(document.getElementById('heroImg1'), h.imagen1);
    var f2 = ponerFoto(document.getElementById('heroImg2'), h.imagen2);
    var caja = document.getElementById('heroFotos'), hi = $('.hero-inner');
    if (caja) {
      caja.hidden = !f1 && !f2;
      caja.classList.toggle('solo-1', f1 && !f2);
      caja.classList.toggle('solo-2', !f1 && f2);
      if (hi) hi.classList.toggle('sin-fotos', caja.hidden);
    }
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
    document.querySelectorAll('.nos-foto').forEach(function (fig) {
      var img = fig.querySelector('img');
      fig.hidden = !ponerFoto(img, n.imagen);
    });
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
    txt($('#transporte .tr-publico b'), t.publico_titulo);
    txt($('#transporte .tr-publico small'), t.publico_texto);
    var fig = document.getElementById('trFoto'), lay = document.getElementById('trLayout');
    if (fig && lay && typeof t.imagen === 'string' && /^assets\/[\w\-\/.]+$/.test(t.imagen) && t.imagen.indexOf('..') < 0) {
      document.getElementById('trImg').src = t.imagen;
      fig.hidden = false; lay.classList.add('con-foto');
    }
  }

  function requisitos(r) {
    if (!r) return;
    [['reqReserva', r.reserva], ['reqInscripcion', r.inscripcion]].forEach(function (x) {
      var ul = document.getElementById(x[0]);
      if (!ul || !Array.isArray(x[1]) || !x[1].length) return;
      ul.textContent = '';
      x[1].forEach(function (t) { if (typeof t === 'string' && t) { var li = document.createElement('li'); li.textContent = t; ul.appendChild(li); } });
    });
    var n = document.getElementById('reqNota');
    if (n && typeof r.nota === 'string' && r.nota) { n.textContent = r.nota; n.hidden = false; }
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
    fila('ctCel', '📱', 'Celular / WhatsApp', c.celular);
    if (/^\d{8,15}$/.test(String(c.whatsapp || ''))) {
      document.querySelectorAll('a[href^="https://wa.me/"]:not(.noticia-compartir)').forEach(function (a) { a.href = 'https://wa.me/' + c.whatsapp + (a.search || ''); });
      document.querySelectorAll('a[href^="tel:"]').forEach(function (a) { a.href = 'tel:+' + c.whatsapp; });
    }
  }

  function aviso(a) {
    var box = document.getElementById('avisoTop');
    if (!box || !a || a.activo !== true || typeof a.texto !== 'string' || !a.texto.trim()) return;
    document.getElementById('avisoTxt').textContent = a.texto;
    var l = document.getElementById('avisoLink');
    if (l && typeof a.enlace === 'string' && /^https:\/\/\S+$/.test(a.enlace)) { l.href = a.enlace; l.hidden = false; }
    box.hidden = false;
  }

  function horarios(h) {
    if (!h) return;
    var ul = document.getElementById('ctHorAt'), cl = document.getElementById('ctHorCl');
    if (ul && Array.isArray(h.atencion) && h.atencion.length) {
      ul.textContent = '';
      h.atencion.forEach(function (t) { if (typeof t === 'string' && t) { var li = document.createElement('li'); li.textContent = t; ul.appendChild(li); } });
    }
    if (cl && typeof h.clases_turno === 'string') {
      cl.textContent = '';
      var partes = [h.clases_turno].concat(Array.isArray(h.clases) ? h.clases : []).filter(function (x) { return typeof x === 'string' && x; });
      if (!partes.length) { cl.hidden = true; return; }
      var b = document.createElement('b'); b.textContent = 'Horario de clases: ';
      cl.appendChild(b); cl.appendChild(document.createTextNode(partes.join(' · ')));
    }
  }

  fetch('data/textos.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (t) { hero(t.hero); nosotros(t.nosotros); pilares(t.pilares); transporte(t.transporte); requisitos(t.requisitos); contacto(t.contacto); aviso(t.aviso); horarios(t.horarios); })
    .catch(function () { /* se queda el texto que ya trae la página */ });
})();

/* ---------- Videos y accesos directos desde data/videos.json y data/accesos.json ---------- */
(function () {
  var NOMBRES = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram', facebook: 'Facebook' };
  var CODIGO_OK = {
    youtube: /^[\w-]{11}$/, tiktok: /^\d{15,25}$/,
    instagram: /^(reel|p)\/[\w-]{5,20}$/, facebook: /^(reel\/\d{6,}|watch\/\?v=\d{6,})$/
  };
  var URL_OK = /^https:\/\/([\w-]+\.)*(youtube\.com|youtu\.be|tiktok\.com|instagram\.com|facebook\.com)\/\S*$/;

  // La dirección del reproductor se arma aquí a partir de plataforma + código (nunca de un texto libre).
  function embed(p, c) {
    if (p === 'youtube') return 'https://www.youtube-nocookie.com/embed/' + c + '?autoplay=1&rel=0';
    if (p === 'tiktok') return 'https://www.tiktok.com/embed/v2/' + c;
    if (p === 'instagram') return 'https://www.instagram.com/' + c + '/embed';
    return 'https://www.facebook.com/plugins/video.php?href=' + encodeURIComponent('https://www.facebook.com/' + c) + '&show_text=false&autoplay=true';
  }

  // Visor: el video se abre en una ventana centrada, con el tamaño que le corresponde (vertical u horizontal)
  function abrirVisor(v, p, c, origen) {
    var vert = p === 'instagram' || (p === 'facebook' && c.indexOf('reel/') === 0);
    var ov = document.createElement('div'); ov.className = 'visor';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', v.titulo || ('Video de ' + NOMBRES[p]));
    var caja = document.createElement('div'); caja.className = 'visor-caja' + (vert ? ' vert' : '');
    var fr = document.createElement('iframe');
    fr.src = embed(p, c); fr.title = v.titulo || ('Video de ' + NOMBRES[p]);
    fr.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; fr.allowFullscreen = true;
    var x = document.createElement('button'); x.type = 'button'; x.className = 'visor-x'; x.setAttribute('aria-label', 'Cerrar video'); x.textContent = '×';
    caja.appendChild(fr); ov.appendChild(caja); ov.appendChild(x);
    function cerrar() {
      document.removeEventListener('keydown', tecla);
      ov.remove(); document.body.classList.remove('visor-abierto');
      if (origen && origen.focus) origen.focus();
    }
    function tecla(e) { if (e.key === 'Escape') cerrar(); }
    x.addEventListener('click', cerrar);
    ov.addEventListener('click', function (e) { if (e.target === ov) cerrar(); });
    document.addEventListener('keydown', tecla);
    document.body.classList.add('visor-abierto');
    document.body.appendChild(ov); x.focus();
  }

  function tarjeta(v) {
    var p = v.plataforma, c = v.codigo;
    if (!NOMBRES[p] || !CODIGO_OK[p].test(String(c))) return null;
    var item = document.createElement('div');
    item.className = 'vitem';
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'vcard p-' + p;
    b.setAttribute('aria-label', 'Reproducir: ' + (v.titulo || NOMBRES[p]));
    if (p === 'youtube') {
      var img = document.createElement('img');
      img.loading = 'lazy'; img.alt = ''; img.src = 'https://i.ytimg.com/vi/' + c + '/hqdefault.jpg';
      b.appendChild(img);
    } else {
      var f = document.createElement('div'); f.className = 'vfondo'; f.textContent = p === 'tiktok' ? 'Ver en TikTok' : NOMBRES[p]; b.appendChild(f);
    }
    var play = document.createElement('span'); play.className = 'play'; play.textContent = '▶'; b.appendChild(play);
    b.addEventListener('click', function () {
      if (p === 'tiktok') {   // el reproductor incrustado de TikTok falla con frecuencia: se abre el video en TikTok
        if (typeof v.url === 'string' && URL_OK.test(v.url)) window.open(v.url, '_blank', 'noopener,noreferrer');
        return;
      }
      abrirVisor(v, p, c, b);
    });
    item.appendChild(b);
    var meta = document.createElement('div'); meta.className = 'vmeta';
    var ETQ = { testimonios: 'Testimonio', vida: 'Vida escolar' };
    if (ETQ[v.categoria]) { var e = document.createElement('small'); e.className = 'vetq'; e.textContent = ETQ[v.categoria]; meta.appendChild(e); }
    if (v.titulo) { var t = document.createElement('b'); t.textContent = v.titulo; meta.appendChild(t); }
    if (typeof v.url === 'string' && URL_OK.test(v.url)) {
      var a = document.createElement('a'); a.href = v.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'Abrir en ' + NOMBRES[p] + ' ↗';
      meta.appendChild(a);
    }
    item.appendChild(meta);
    return item;
  }

  function llenar(cont, lista) {
    cont.textContent = '';
    var n = 0;
    lista.forEach(function (v) { var t = tarjeta(v); if (t) { cont.appendChild(t); n++; } });
    return n;
  }

  function cargar(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }

  cargar('data/videos.json').then(function (todos) {
    if (!Array.isArray(todos)) return;
    var vis = todos.filter(function (v) { return v && v.publicar !== false; });
    var vid = document.getElementById('gridVideos');
    if (vid) {
      vid.className = 'vgrid';
      var m = llenar(vid, vis);
      if (!m) document.getElementById('videos').hidden = true;
    }
  }).catch(function () { /* se queda lo que ya trae la página */ });

  var COLORES = {
    rojo: 'linear-gradient(135deg,#ea4335,#c5221f)', verde: 'linear-gradient(135deg,#1e8e3e,#188038)',
    sol: 'linear-gradient(135deg,var(--sun),var(--sun-deep))', azul: 'linear-gradient(135deg,#4c5fd7,#2f3ea8)',
    royal: 'linear-gradient(135deg,var(--royal),#142a5c)', gris: 'linear-gradient(135deg,#5f6b7c,#3a4453)'
  };
  cargar('data/accesos.json').then(function (lista) {
    var g = document.getElementById('gridAccesos');
    if (!g || !Array.isArray(lista)) return;
    lista = lista.filter(function (x) { return x && x.publicar !== false && typeof x.url === 'string' && /^https:\/\/\S+$/.test(x.url); });
    g.textContent = '';
    lista.forEach(function (x) {
      var a = document.createElement('a'); a.className = 'acceso-card'; a.href = x.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      var ico = document.createElement('div'); ico.className = 'acceso-ico'; ico.setAttribute('aria-hidden', 'true');
      ico.style.background = COLORES[x.color] || COLORES.gris; ico.textContent = x.icono || '';
      var b = document.createElement('b'); b.textContent = x.titulo || '';
      a.appendChild(ico); a.appendChild(b);
      if (x.detalle) { var s = document.createElement('small'); s.textContent = x.detalle; a.appendChild(s); }
      g.appendChild(a);
    });
    document.getElementById('accesos').hidden = !lista.length;
  }).catch(function () { /* se queda lo que ya trae la página */ });
})();

/* ---------- Aparición suave al desplazarse ---------- */
(function () {
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var items = document.querySelectorAll('section > .section-head, .pilar-card, .noticia-card, .cta-final, .nivel-panel.active');
  document.documentElement.classList.add('anim');
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('visto'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  items.forEach(function (x) { x.classList.add('rev'); io.observe(x); });
  setTimeout(function () { document.querySelectorAll('.rev:not(.visto)').forEach(function (x) { x.classList.add('visto'); }); }, 4000);
})();

/* ---------- Calendario escolar desde data/calendario.json (se oculta si no hay fechas próximas) ---------- */
(function () {
  var sec = document.getElementById('calendario'), cont = document.getElementById('calLista');
  if (!sec || !cont) return;
  var MES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  var ISO = /^\d{4}-\d{2}-\d{2}$/;
  function hoyBolivia() {
    var d = new Date(Date.now() - 4 * 3600 * 1000);   // UTC-4
    return d.toISOString().slice(0, 10);
  }
  function partes(iso) { var p = iso.split('-'); return { d: parseInt(p[2], 10), m: MES[parseInt(p[1], 10) - 1] }; }
  function mk(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; }

  fetch('data/calendario.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (lista) {
      var hoy = hoyBolivia();
      lista = (Array.isArray(lista) ? lista : []).filter(function (x) {
        return x && x.publicar !== false && ISO.test(String(x.fecha || '')) && typeof x.titulo === 'string' && x.titulo &&
               (ISO.test(String(x.fin || '')) ? x.fin : x.fecha) >= hoy;
      }).sort(function (a, b) { return a.fecha.localeCompare(b.fecha); }).slice(0, 8);
      if (!lista.length) return;
      cont.textContent = '';
      lista.forEach(function (x) {
        var a = partes(x.fecha), fin = ISO.test(String(x.fin || '')) && x.fin > x.fecha ? partes(x.fin) : null;
        var card = mk('div', 'cal-item');
        var f = mk('div', 'cal-fecha');
        f.appendChild(mk('b', '', fin && fin.m === a.m ? a.d + '–' + fin.d : String(a.d)));
        f.appendChild(mk('span', '', a.m + (fin && fin.m !== a.m ? ' – ' + fin.d + ' ' + fin.m : '')));
        var t = mk('div', 'cal-texto');
        t.appendChild(mk('h3', '', x.titulo));
        if (typeof x.detalle === 'string' && x.detalle) t.appendChild(mk('p', '', x.detalle));
        card.appendChild(f); card.appendChild(t); cont.appendChild(card);
      });
      sec.hidden = false;
    })
    .catch(function () { /* sin calendario: la sección queda oculta */ });
})();
