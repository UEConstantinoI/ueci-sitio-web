/* Formularios del sitio: “Contáctenos” y “Admisiones” (por pasos).
   Envían los datos al Apps Script público del colegio (panel-web/Formularios.gs),
   que los guarda en la hoja y avisa por correo.

   Mientras FORM_URL esté vacío NO se hace nada: los botones siguen abriendo los
   formularios de Google que traen en su enlace. Todo texto de personas se escribe
   con textContent / value (nunca innerHTML). */
(function () {
  'use strict';

  // Dirección de la aplicación web (termina en /exec). Se pone una sola vez.
  var FORM_URL = 'https://script.google.com/macros/s/AKfycbwKAwSYwHssGj9T2-nYq3hXLTLwakk3PSkR1jBkBiIEjcPBlSjGtCAHpexUllBUIJ_1/exec';

  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(FORM_URL)) return;
  if (typeof HTMLDialogElement === 'undefined') return;

  var NIVELES = [
    { v: 'INICIAL', t: 'Inicial', s: 'Pre-Kinder y Kinder', g: ['Pre-Kinder', 'Kinder'] },
    { v: 'PRIMARIA', t: 'Primaria', s: '1.º a 6.º', g: ['Primero', 'Segundo', 'Tercero', 'Cuarto', 'Quinto', 'Sexto'] },
    { v: 'SECUNDARIA', t: 'Secundaria', s: '1.º a 6.º', g: ['Primero', 'Segundo', 'Tercero', 'Cuarto', 'Quinto', 'Sexto'] }
  ];

  var dlg, cuerpo, tituloEl, subEl, abierto = null, t0 = 0, disparador = null;
  var forms = {};

  /* ---------- utilidades ---------- */
  function h(tag, a, kids) {
    var e = document.createElement(tag);
    if (a) Object.keys(a).forEach(function (k) {
      var v = a[k];
      if (v === false || v === null || v === undefined) return;
      if (k === 'text') e.textContent = v;
      else if (k === 'class') e.className = v;
      else e.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }

  function numeroWhatsApp() {
    var a = document.querySelector('a[href^="https://wa.me/"]:not(.noticia-compartir)');
    var m = a && /wa\.me\/(\d{8,15})/.exec(a.getAttribute('href'));
    return m ? m[1] : '59144289388';
  }

  /* ---------- validación (misma lógica que el servidor) ---------- */
  var V = {
    txt: function (v, max, req, nombre) {
      v = String(v || '').replace(/[ \t]+/g, ' ').trim();
      if (!v) return req ? 'Falta completar “' + nombre + '”.' : '';
      if (v.length > max) return '“' + nombre + '” es muy largo (máximo ' + max + ' letras).';
      return '';
    },
    tel: function (v, nombre) {
      v = String(v || '').trim();
      if (!v) return 'Falta completar “' + nombre + '”.';
      if (!/^[0-9+()\-\s\/.,y]{6,}$/i.test(v) || (v.match(/\d/g) || []).length < 6) return 'Revisa el número.';
      return '';
    },
    mail: function (v, req) {
      v = String(v || '').trim();
      if (!v) return req ? 'Falta completar el correo.' : '';
      return /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/.test(v) ? '' : 'Revisa el correo electrónico.';
    },
    fecha: function (v) {
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || ''));
      if (!m) return 'Elige la fecha de nacimiento.';
      var y = +m[1], mo = +m[2], d = +m[3], f = new Date(Date.UTC(y, mo - 1, d));
      if (f.getUTCMonth() !== mo - 1 || f.getUTCDate() !== d) return 'Revisa la fecha de nacimiento.';
      var edad = (Date.now() - f.getTime()) / (365.25 * 24 * 3600 * 1000);
      return edad < 2 || edad > 19 ? 'Revisa la fecha de nacimiento.' : '';
    }
  };

  /* ---------- campos ---------- */
  function campo(o) {
    var id = 'f_' + o.name;
    var inp = o.rows
      ? h('textarea', { id: id, name: o.name, rows: o.rows, maxlength: o.max, placeholder: o.ph })
      : h('input', { id: id, name: o.name, type: o.type || 'text', maxlength: o.max, placeholder: o.ph, autocomplete: o.auto, inputmode: o.mode, min: o.min, max: o.maxv });
    inp.setAttribute('aria-describedby', id + '_e');
    var err = h('div', { class: 'ff-err', id: id + '_e', role: 'alert' });
    var wrap = h('div', { class: 'ff' + (o.cls ? ' ' + o.cls : '') }, [
      h('label', { for: id }, [o.label, o.req ? h('span', { class: 'req', text: ' *' }) : h('span', { class: 'opt', text: ' (opcional)' })]),
      inp,
      o.hint ? h('div', { class: 'ff-hint', text: o.hint }) : null,
      err
    ]);
    var mayus = !o.type || o.type === 'text';
    if (mayus) inp.classList.add('mayus');
    inp.addEventListener('input', function () {
      err.textContent = ''; inp.removeAttribute('aria-invalid');
      if (mayus) {   // todo en mayúsculas, sin mover el cursor
        var v = inp.value, u = v.toLocaleUpperCase('es');
        if (u !== v) { var a = inp.selectionStart, b = inp.selectionEnd; inp.value = u; try { inp.setSelectionRange(a, b); } catch (e) { /* sin cursor */ } }
      }
    });
    return { el: wrap, inp: inp, err: err };
  }

  function marcar(c, msg) {
    c.err.textContent = msg || '';
    if (msg) c.inp.setAttribute('aria-invalid', 'true'); else c.inp.removeAttribute('aria-invalid');
    return !msg;
  }

  function trampa() {
    return h('div', { class: 'ff-trampa', 'aria-hidden': 'true' }, [
      h('label', { for: 'f_web', text: 'No llenar este campo' }),
      h('input', { id: 'f_web', name: 'web', type: 'text', tabindex: '-1', autocomplete: 'off' })
    ]);
  }

  function chips(name, items, onChange) {
    var wrap = h('div', { class: 'chips', role: 'radiogroup' });
    items.forEach(function (it, i) {
      var id = 'f_' + name + '_' + i;
      var r = h('input', { type: 'radio', name: name, id: id, value: it.v });
      r.addEventListener('change', function () { if (onChange) onChange(it.v); });
      wrap.appendChild(h('div', { class: 'chip' }, [r, h('label', { for: id }, [h('b', { text: it.t }), it.s ? h('small', { text: it.s }) : null])]));
    });
    return wrap;
  }

  /* ---------- envío ---------- */
  function enviar(payload, btn, errBox, alOk) {
    errBox.textContent = '';
    payload.t = Date.now() - t0;
    var txtBtn = btn.textContent;
    btn.disabled = true; btn.classList.add('cargando'); btn.textContent = 'Enviando…';
    var fin = function () { btn.disabled = false; btn.classList.remove('cargando'); btn.textContent = txtBtn; };
    var wa = 'https://wa.me/' + numeroWhatsApp();
    fetch(FORM_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload), redirect: 'follow' })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        fin();
        // Si el servidor dice ok, el envío YA quedó guardado: nunca se muestra como error.
        if (r && r.ok === true) alOk(/^[A-Z]{3}-\d{2}-[A-Z0-9]{4}$/.test(String(r.codigo)) ? String(r.codigo) : '');
        else {
          try { console.warn('Formularios: respuesta inesperada', r); } catch (e) { /* sin consola */ }
          errBox.textContent = (r && typeof r.error === 'string' && r.error) ? r.error : 'No pudimos enviar el formulario.';
          errBox.appendChild(document.createTextNode(' '));
          errBox.appendChild(h('a', { href: wa, target: '_blank', rel: 'noopener', text: 'Escríbenos por WhatsApp' }));
        }
      })
      .catch(function () {
        fin();
        errBox.textContent = 'No pudimos conectar. Revisa tu internet e inténtalo otra vez, o ';
        errBox.appendChild(h('a', { href: wa, target: '_blank', rel: 'noopener', text: 'escríbenos por WhatsApp' }));
        errBox.appendChild(document.createTextNode('.'));
      });
  }

  function exito(titulo, texto, codigo, mensajeWa) {
    cuerpo.textContent = '';
    var wa = 'https://wa.me/' + numeroWhatsApp() + '?text=' + encodeURIComponent(mensajeWa);
    cuerpo.appendChild(h('div', { class: 'exito' }, [
      h('div', { class: 'exito-ico', 'aria-hidden': 'true', text: '✓' }),
      h('h3', { text: titulo }),
      h('p', { text: texto }),
      codigo ? h('p', { class: 'exito-cod' }, ['Tu código de seguimiento: ', h('b', { text: codigo })]) : null,
      h('a', { class: 'btn-wa', href: wa, target: '_blank', rel: 'noopener', text: 'Avisar también por WhatsApp' }),
      h('button', { type: 'button', class: 'btn-sec', text: 'Cerrar' })
    ]));
    cuerpo.querySelector('.btn-sec').addEventListener('click', function () { dlg.close(); });
    var sub = cuerpo.querySelector('h3'); sub.setAttribute('tabindex', '-1'); sub.focus();
  }

  /* ---------- formulario de contacto ---------- */
  function formContacto() {
    var f = h('form', { class: 'ff-form', novalidate: true, autocomplete: 'on' });
    var c = {
      nombre: campo({ name: 'nombre', label: 'Tu nombre', req: true, max: 80, auto: 'name' }),
      telefono: campo({ name: 'telefono', label: 'Teléfono o WhatsApp', req: true, max: 25, type: 'tel', auto: 'tel', mode: 'tel' }),
      email: campo({ name: 'email', label: 'Correo electrónico', max: 80, type: 'email', auto: 'email' }),
      mensaje: campo({ name: 'mensaje', label: '¿En qué podemos ayudarte?', req: true, max: 600, rows: 4, ph: 'Cuéntanos qué necesitas saber.' })
    };
    var err = h('div', { class: 'ff-envio-err', role: 'alert' });
    var btn = h('button', { type: 'submit', class: 'btn-env', text: 'Enviar consulta' });
    [c.nombre, c.telefono, c.email, c.mensaje].forEach(function (x) { f.appendChild(x.el); });
    f.appendChild(trampa()); f.appendChild(err);
    f.appendChild(h('div', { class: 'ff-acc' }, [btn]));
    f.appendChild(h('p', { class: 'ff-nota', text: 'Usaremos tus datos solo para responder tu consulta.' }));
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true;
      ok = marcar(c.nombre, V.txt(c.nombre.inp.value, 80, true, 'Nombre')) && ok;
      ok = marcar(c.telefono, V.tel(c.telefono.inp.value, 'Teléfono')) && ok;
      ok = marcar(c.email, V.mail(c.email.inp.value, false)) && ok;
      ok = marcar(c.mensaje, V.txt(c.mensaje.inp.value, 600, true, 'Consulta')) && ok;
      if (!ok) { var p = f.querySelector('[aria-invalid="true"]'); if (p) p.focus(); return; }
      var nombre = c.nombre.inp.value.trim();
      enviar({ tipo: 'contacto', nombre: nombre, telefono: c.telefono.inp.value.trim(), email: c.email.inp.value.trim(), mensaje: c.mensaje.inp.value.trim(), web: f.web.value }, btn, err, function (cod) {
        f.reset();
        exito('¡Recibimos tu mensaje!', 'Te responderemos por teléfono o WhatsApp en nuestro horario de atención.', cod,
          'Hola, soy ' + nombre + '. Acabo de enviar una consulta desde el sitio web (' + (cod ? 'código ' + cod : 'sin código') + ').');
        forms.contacto.hecho = true;
      });
    });
    return { el: f, primero: c.nombre.inp };
  }

  /* ---------- formulario de admisiones (3 pasos) ---------- */
  function formAdmision() {
    var f = h('form', { class: 'ff-form', novalidate: true, autocomplete: 'on' });
    var hoy = new Date(), iso = function (d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
    var c = {
      estudiante: campo({ name: 'estudiante', label: 'Nombre completo del estudiante', req: true, max: 90, auto: 'off' }),
      nacimiento: campo({ name: 'nacimiento', label: 'Fecha de nacimiento', req: true, type: 'date', min: iso(new Date(hoy.getFullYear() - 19, hoy.getMonth(), hoy.getDate())), maxv: iso(new Date(hoy.getFullYear() - 2, hoy.getMonth(), hoy.getDate())), cls: 'ff-corto', auto: 'off' }),
      colegio: campo({ name: 'colegio', label: 'Colegio anterior', max: 90, hint: 'Escribe el colegio del que viene el estudiante.', auto: 'off' }),
      tutor: campo({ name: 'tutor', label: 'Nombre completo del padre, madre o tutor', req: true, max: 90, auto: 'name' }),
      whatsapp: campo({ name: 'whatsapp', label: 'Celular (WhatsApp)', req: true, max: 25, type: 'tel', auto: 'tel', mode: 'tel' }),
      telefonos: campo({ name: 'telefonos', label: 'Otro número (fijo o celular)', max: 40, type: 'tel', auto: 'off', mode: 'tel' }),
      email: campo({ name: 'email', label: 'Correo electrónico', max: 80, type: 'email', auto: 'email' }),
      comentario: campo({ name: 'comentario', label: 'Algún comentario que desee dejarnos', max: 600, rows: 3 })
    };
    var nivelErr = h('div', { class: 'ff-err', role: 'alert' }), gradoErr = h('div', { class: 'ff-err', role: 'alert' });
    var gradoBox = h('div', { class: 'ff ff-grado', hidden: true });
    var nivelSel = '', gradoSel = '';
    // Pre-Kinder: no se pide colegio anterior. Kinder y 1.º de primaria: opcional. Resto: obligatorio.
    function reglaColegio() {
      var n = radio('nivel'), g = radio('grado');
      var oculto = n === 'INICIAL' && g === 'Pre-Kinder';
      var opc = oculto || (n === 'INICIAL' && g === 'Kinder') || (n === 'PRIMARIA' && g === 'Primero');
      c.colegio.el.hidden = oculto;
      var l = c.colegio.el.querySelector('label'); l.textContent = '';
      l.appendChild(document.createTextNode('Colegio anterior'));
      l.appendChild(h('span', opc ? { class: 'opt', text: ' (opcional)' } : { class: 'req', text: ' *' }));
      c.colegio.inp.value = oculto ? '' : c.colegio.inp.value;
      c.colegio.err.textContent = '';
      return { oculto: oculto, req: !opc };
    }
    var nivelChips = chips('nivel', NIVELES.map(function (n) { return { v: n.v, t: n.t, s: n.s }; }), function (v) {
      nivelSel = v; nivelErr.textContent = '';
      var n = NIVELES.filter(function (x) { return x.v === v; })[0];
      gradoBox.textContent = '';
      gradoBox.appendChild(h('div', { class: 'lbl', text: n.v === 'INICIAL' ? 'Curso' : 'Curso de ' + n.t.toLowerCase() }, [h('span', { class: 'req', text: ' *' })]));
      gradoBox.appendChild(chips('grado', n.g.map(function (g) { return { v: g, t: g }; }), function () { gradoErr.textContent = ''; reglaColegio(); }));
      gradoBox.appendChild(gradoErr);
      gradoBox.hidden = false;
      reglaColegio();
    });

    var pasos = [
      h('fieldset', { class: 'paso' }, [h('legend', { text: 'Datos del estudiante' }), c.estudiante.el, c.nacimiento.el,
        h('div', { class: 'ff' }, [h('div', { class: 'lbl' }, ['Nivel al que desea ingresar', h('span', { class: 'req', text: ' *' })]), nivelChips, nivelErr]), gradoBox, c.colegio.el]),
      h('fieldset', { class: 'paso', hidden: true }, [h('legend', { text: 'Padre, madre o tutor' }), c.tutor.el, c.whatsapp.el, c.telefonos.el, c.email.el]),
      h('fieldset', { class: 'paso', hidden: true }, [h('legend', { text: 'Revisa y envía' }), c.comentario.el, h('div', { class: 'resumen', 'aria-live': 'polite' })])
    ];
    var marcador = h('ol', { class: 'pasos', 'aria-label': 'Pasos' }, ['Estudiante', 'Familia', 'Revisión'].map(function (t, i) {
      return h('li', { class: i === 0 ? 'act' : '' }, [h('span', { text: String(i + 1) }), h('em', { text: t })]);
    }));
    var err = h('div', { class: 'ff-envio-err', role: 'alert' });
    var atras = h('button', { type: 'button', class: 'btn-sec', text: 'Atrás', hidden: true });
    var sig = h('button', { type: 'submit', class: 'btn-env', text: 'Siguiente' });
    var paso = 0;

    function radio(name) { var r = f.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : ''; }
    function validar(p) {
      var ok = true;
      if (p === 0) {
        ok = marcar(c.estudiante, V.txt(c.estudiante.inp.value, 90, true, 'Nombre del estudiante')) && ok;
        ok = marcar(c.nacimiento, V.fecha(c.nacimiento.inp.value)) && ok;
        if (!radio('nivel')) { nivelErr.textContent = 'Elige el nivel.'; ok = false; } else if (!radio('grado')) { gradoErr.textContent = 'Elige el curso.'; ok = false; }
        ok = marcar(c.colegio, V.txt(c.colegio.inp.value, 90, reglaColegio().req, 'Colegio anterior')) && ok;
      } else if (p === 1) {
        ok = marcar(c.tutor, V.txt(c.tutor.inp.value, 90, true, 'Nombre del padre, madre o tutor')) && ok;
        ok = marcar(c.whatsapp, V.tel(c.whatsapp.inp.value, 'Celular (WhatsApp)')) && ok;
        ok = marcar(c.telefonos, c.telefonos.inp.value.trim() ? V.tel(c.telefonos.inp.value, 'Otro número') : '') && ok;
        ok = marcar(c.email, V.mail(c.email.inp.value, false)) && ok;
      } else {
        ok = marcar(c.comentario, V.txt(c.comentario.inp.value, 600, false, 'Comentario')) && ok;
      }
      return ok;
    }
    function resumen() {
      var box = pasos[2].querySelector('.resumen'); box.textContent = '';
      var n = NIVELES.filter(function (x) { return x.v === radio('nivel'); })[0];
      var filas = [['Estudiante', c.estudiante.inp.value.trim()], ['Nacimiento', c.nacimiento.inp.value], ['Curso', radio('grado') + (n ? ' de ' + n.t.toLowerCase() : '')], ['Colegio anterior', (c.colegio.el.hidden ? 'No aplica' : c.colegio.inp.value.trim() || '—')],
        ['Padre, madre o tutor', c.tutor.inp.value.trim()], ['Celular (WhatsApp)', c.whatsapp.inp.value.trim()], ['Otro número', c.telefonos.inp.value.trim() || '—'], ['Correo', c.email.inp.value.trim() || '—']];
      var dl = h('dl');
      filas.forEach(function (x) { dl.appendChild(h('dt', { text: x[0] })); dl.appendChild(h('dd', { text: x[1] })); });
      box.appendChild(dl);
    }
    function ir(n) {
      paso = n;
      pasos.forEach(function (p, i) { p.hidden = i !== n; });
      Array.prototype.forEach.call(marcador.children, function (li, i) { li.className = i === n ? 'act' : (i < n ? 'hecho' : ''); });
      atras.hidden = n === 0;
      sig.textContent = n === 2 ? 'Enviar solicitud' : 'Siguiente';
      if (n === 2) resumen();
      err.textContent = '';
      var primero = pasos[n].querySelector('input:not([type=radio]),textarea'); if (primero) primero.focus();
      dlg.querySelector('.dlg-cuerpo').scrollTop = 0;
    }
    atras.addEventListener('click', function () { if (paso > 0) ir(paso - 1); });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validar(paso)) { var p = pasos[paso].querySelector('[aria-invalid="true"]'); if (p) p.focus(); return; }
      if (paso < 2) { ir(paso + 1); return; }
      var estudiante = c.estudiante.inp.value.trim(), tutor = c.tutor.inp.value.trim();
      enviar({
        tipo: 'admision', estudiante: estudiante, nacimiento: c.nacimiento.inp.value, nivel: radio('nivel'), grado: radio('grado'), colegio: c.colegio.inp.value.trim(),
        tutor: tutor, telefonos: c.telefonos.inp.value.trim(), whatsapp: c.whatsapp.inp.value.trim(), email: c.email.inp.value.trim(), comentario: c.comentario.inp.value.trim(), web: f.web.value
      }, sig, err, function (cod) {
        f.reset(); gradoBox.hidden = true; c.colegio.el.hidden = false; ir(0);
        exito('¡Recibimos tu solicitud!', 'Gracias por elegirnos. Nos comunicaremos contigo para continuar con el proceso de admisión de ' + estudiante + '.', cod,
          'Hola, soy ' + tutor + '. Acabo de enviar la solicitud de admisión de ' + estudiante + ' desde el sitio web (' + (cod ? 'código ' + cod : 'sin código') + ').');
        forms.admision.hecho = true;
      });
    });
    f.appendChild(marcador);
    pasos.forEach(function (p) { f.appendChild(p); });
    f.appendChild(trampa()); f.appendChild(err);
    f.appendChild(h('div', { class: 'ff-acc' }, [atras, sig]));
    f.appendChild(h('p', { class: 'ff-nota', text: 'Usaremos estos datos solo para el proceso de admisión.' }));
    return { el: f, primero: c.estudiante.inp, reiniciar: function () { ir(0); } };
  }

  /* ---------- ventana ---------- */
  var TEXTOS = {
    contacto: ['Contáctenos', 'Déjanos tus datos y te respondemos a la brevedad.'],
    admision: ['Admisiones', 'Completa los datos en tres pasos. Tarda unos 3 minutos.']
  };

  function construir() {
    tituloEl = h('h2', { id: 'dlgTitulo' });
    subEl = h('p', { id: 'dlgSub' });
    var cerrar = h('button', { type: 'button', class: 'dlg-x', 'aria-label': 'Cerrar', text: '✕' });
    cuerpo = h('div', { class: 'dlg-cuerpo' });
    dlg = h('dialog', { class: 'form-dlg', 'aria-labelledby': 'dlgTitulo' }, [
      h('div', { class: 'dlg-caja' }, [
        h('div', { class: 'dlg-cab' }, [h('img', { src: 'assets/escudo.png', alt: '', width: 40, height: 40 }), h('div', null, [tituloEl, subEl]), cerrar]),
        cuerpo
      ])
    ]);
    cerrar.addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('close', function () {
      document.documentElement.classList.remove('dlg-abierto');
      // Si ya se envió, la próxima vez se abre limpio.
      Object.keys(forms).forEach(function (k) { if (forms[k].hecho) { forms[k] = null; } });
      cuerpo.textContent = ''; abierto = null;
      if (disparador && disparador.focus) disparador.focus();
    });
    document.body.appendChild(dlg);
  }

  function abrir(tipo, origen) {
    if (!dlg) construir();
    if (!forms[tipo]) forms[tipo] = tipo === 'contacto' ? formContacto() : formAdmision();
    disparador = origen; abierto = tipo; t0 = Date.now();
    tituloEl.textContent = TEXTOS[tipo][0]; subEl.textContent = TEXTOS[tipo][1];
    cuerpo.textContent = ''; cuerpo.appendChild(forms[tipo].el);
    document.documentElement.classList.add('dlg-abierto');
    if (!dlg.open) dlg.showModal();
    if (forms[tipo].primero) forms[tipo].primero.focus();
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-form]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    var tipo = a.getAttribute('data-form');
    if (tipo !== 'contacto' && tipo !== 'admision') return;
    e.preventDefault();
    abrir(tipo, a);
  });
})();
