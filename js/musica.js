/* Música de fondo del sitio (canción del colegio) y reproductor del himno.
   - Empieza en cuanto la persona toca/desplaza/pulsa algo (los navegadores no permiten sonido antes).
   - Volumen bajo, en bucle, con botón para silenciar; la elección se recuerda.
   - Se pausa sola al ocultar la pestaña o al reproducir un video o el himno.
   Para que NO arranque sola (solo con el botón) poner AUTO = false. */
(function () {
  'use strict';
  var AUTO = true, VOL = 0.3;
  var btn = document.getElementById('musicaBtn');
  var SRC = btn ? btn.getAttribute('data-src') : '';   // sin data-src no hay música de fondo (solo el himno)
  var audio = null, silenciada = false, arrancada = false, pausaTemporal = false, anim = 0;

  function leer() { try { return localStorage.getItem('ueci_musica') === 'off'; } catch (e) { return false; } }
  function guardar(off) { try { localStorage.setItem('ueci_musica', off ? 'off' : 'on'); } catch (e) { /* sin almacenamiento */ } }
  silenciada = leer();

  function estado() {
    if (!btn) return;
    var suena = !!audio && !audio.paused;
    btn.classList.toggle('suena', suena);
    btn.setAttribute('aria-pressed', suena ? 'true' : 'false');
    btn.setAttribute('aria-label', suena ? 'Pausar la música del colegio' : 'Escuchar la música del colegio');
    btn.title = suena ? 'Pausar música' : 'Escuchar música';
    var t = btn.querySelector('.mt'); if (t) t.textContent = suena ? 'Música' : 'Activar música';
  }
  function crear() {
    if (audio) return audio;
    audio = new Audio(SRC); audio.loop = true; audio.preload = 'auto'; audio.volume = 0;
    audio.addEventListener('play', estado); audio.addEventListener('pause', estado);
    return audio;
  }
  function subir() {
    clearInterval(anim);
    anim = setInterval(function () {
      if (!audio) return clearInterval(anim);
      audio.volume = Math.min(VOL, audio.volume + 0.03);
      if (audio.volume >= VOL) clearInterval(anim);
    }, 80);
  }
  function tocar() {
    var a = crear(); a.volume = 0;
    var p = a.play();
    if (p && p.then) p.then(function () { arrancada = true; subir(); estado(); }, function () { /* el navegador lo bloqueó: queda el botón */ estado(); });
    else { arrancada = true; subir(); }
  }
  function pausar() { if (audio) { clearInterval(anim); audio.pause(); } }

  if (btn && SRC) {
    btn.hidden = false;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (audio && !audio.paused) { silenciada = true; guardar(true); pausar(); }
      else { silenciada = false; guardar(false); tocar(); }
      estado();
    });
    estado();
  }

  // Arranque con el primer gesto de la persona.
  if (AUTO && !silenciada && SRC) {
    var evs = ['pointerdown', 'keydown', 'touchstart', 'wheel'];
    var primero = function (e) {
      evs.forEach(function (n) { document.removeEventListener(n, primero, true); });
      if (silenciada || arrancada) return;
      if (e.target && e.target.closest && e.target.closest('#musicaBtn')) return;
      tocar();
    };
    evs.forEach(function (n) { document.addEventListener(n, primero, true); });
  }

  // Pestaña oculta → pausa; vuelve → continúa si estaba sonando.
  document.addEventListener('visibilitychange', function () {
    if (!audio) return;
    if (document.hidden) { if (!audio.paused) { pausaTemporal = true; pausar(); } }
    else if (pausaTemporal && !silenciada) { pausaTemporal = false; audio.play().then(function () { subir(); }, function () {}); }
  });

  // Al reproducir un video del sitio o el himno, la música de fondo se detiene.
  function otroSonido() { if (audio && !audio.paused) { pausaTemporal = true; pausar(); } }
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-yt],[data-video],.video-thumb')) otroSonido(); }, true);

  /* ---- Himno: el reproductor aparece solo cuando el <audio> trae data-src (ej. assets/audio/himno.mp3) ---- */
  var cont = document.getElementById('himnoPlayer'), h = document.getElementById('himnoAudio');
  if (cont && h && h.getAttribute('data-src')) {
    h.addEventListener('loadedmetadata', function () { cont.hidden = false; });
    h.addEventListener('play', otroSonido);
    h.addEventListener('pause', function () { if (pausaTemporal && !silenciada && !document.hidden && audio && audio.paused) { pausaTemporal = false; audio.play().then(function () { subir(); }, function () {}); } });
    h.addEventListener('ended', function () { if (pausaTemporal && !silenciada && audio) { pausaTemporal = false; audio.play().then(function () { subir(); }, function () {}); } });
    h.src = h.getAttribute('data-src'); h.load();
  }
})();
