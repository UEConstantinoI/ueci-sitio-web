/* ---------- Carrusel ---------- */
(function () {
  var track = document.getElementById('carTrack');
  var dotsWrap = document.getElementById('carDots');
  if (!track || !dotsWrap) return;
  var slides = track.children.length;
  var idx = 0, timer;

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
    Array.prototype.forEach.call(dotsWrap.children, function (d, n) {
      d.classList.toggle('active', n === idx);
    });
  }
  function restart() { clearInterval(timer); timer = setInterval(function () { goTo(idx + 1); }, 5000); }
  function goTo(n) { idx = (n + slides) % slides; render(); restart(); }

  document.querySelector('.car-arrow.prev').addEventListener('click', function () { goTo(idx - 1); });
  document.querySelector('.car-arrow.next').addEventListener('click', function () { goTo(idx + 1); });
  restart();
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
