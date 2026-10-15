# Panel web del sitio — instalación (una sola vez)

Archivos: `Codigo.gs`, `Panel.html`, `appsscript.json`. No tienen claves: pueden estar en el repo público.

## Paso a paso (con la cuenta @ueconstantino.com de Javier)

1. **Clave de GitHub** (con la cuenta del colegio): GitHub > Settings > Developer settings > Personal access tokens > *Fine-grained* > Generate new token.
   Repositorio: solo `ueci-sitio-web`. Permiso: **Contents: Read and write**. Copiar el token (`github_pat_...`).
2. **Planilla**: crear `sheets.new` y nombrarla "Panel sitio web Constantino I". **No compartirla con nadie** (la clave queda guardada dentro).
3. **Script**: Extensiones > Apps Script.
   - En `Código.gs`: borrar todo y pegar `Codigo.gs`.
   - Botón **+** > **HTML** > nombre exacto `Panel` > pegar `Panel.html`.
   - Configuración del proyecto (engranaje) > activar "Mostrar appsscript.json" > pegar `appsscript.json`.
   - Guardar.
4. **Recargar la planilla**. Aparece el menú **Panel web**:
   - **1. Preparar hojas** (crea "Usuarios" y "Registro"; autorizar permisos: Avanzado > Ir a... es normal).
   - **2. Guardar clave de GitHub** (pegar el token).
   - **3. Probar conexión** (debe decir "Conexión correcta").
5. **Usuarios**: en la hoja "Usuarios" agregar los correos @ueconstantino.com (correo, nombre, rol EDITOR o ADMIN, activo SÍ). Dar de baja = poner NO.
6. **Publicar**: Implementar > Nueva implementación > Aplicación web.
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario de ueconstantino.com**
   - Copiar la URL: es la dirección del panel.
7. **Probar**: abrir la URL (debe entrar) y luego con una cuenta no autorizada (debe decir "Sin acceso").

## Después, al actualizar el código
Implementar > Administrar implementaciones > lápiz > **Nueva versión** (así la URL no cambia).

## Opcional
Una dirección corta como `panel.ueconstantino.com` con una regla de redirección en Cloudflare, igual que `sistema`.

## Seguridad
- "Accesos directos" también es solo para ADMIN. "Videos" lo pueden usar todos los usuarios (los enlaces se limitan a YouTube, TikTok, Instagram y Facebook).
- "Textos del sitio" solo aparece (y solo funciona) para usuarios con rol **ADMIN**; un EDITOR no lo ve ni puede guardar textos aunque lo intente.
- Todo lo que se publica es **público**. Las noticias ocultas también están en el código del repo (que es público); no escribir nada privado.
- La clave solo la ve quien edita la planilla: por eso la planilla no se comparte. El resto entra solo a la URL del panel.
- Si hay dudas: revocar el token en GitHub, crear otro y repetir el paso 4.2.

## Cuando el sitio pase a ser el oficial
1. En el repo: `index.html` (carátula) se renombra a `construccion.html`; `sitio.html` pasa a ser `index.html`; se quita la línea `noindex` de `index.html`.
2. En `Codigo.gs`: `PAGINA_SITIO: ''` (para que "Ver el sitio" apunte a la portada) y nueva versión.

## Escudo en las fotos y requisitos (14/10)
- Al elegir una foto (noticias, carrusel, transporte) el panel le pone el escudo del colegio arriba a la derecha. El casillero "Poner el escudo…" viene marcado; si lo desmarcas se vuelve a procesar la foto sin escudo.
- **Textos del sitio → Requisitos de admisión** (solo ADMIN): un requisito por renglón para "Reserva de cupo" y "Inscripción", y una nota opcional.
- Los videos de TikTok se abren en TikTok (el reproductor incrustado de TikTok falla); YouTube, Instagram y Facebook se ven en la página.

## Fotos de portada y de Nosotros (14/10)
- **Textos del sitio → Portada**: dos fotos (principal grande y pequeña superpuesta). **Acerca de nosotros**: una foto que se ve junto a las palabras clave. Se pueden cambiar o quitar; el escudo se estampa si el casillero está marcado.
- Los videos ahora se abren en una ventana centrada con el tamaño que les corresponde (vertical u horizontal); las tarjetas de la lista son todas iguales.

## Calendario, aviso, horarios, llamar y estadísticas (14/10)
- **Calendario escolar** (menú nuevo; lo pueden usar ADMIN y EDITOR): fechas con título; se ordenan solas, las pasadas dejan de verse y, si no hay próximas, la sección se oculta. Datos en `data/calendario.json`.
- **Aviso destacado** y **Horarios** están en *Textos del sitio* (solo ADMIN). El aviso es una franja arriba de todo el sitio; se activa/desactiva con una casilla.
- Botón **Llamar** (flotante en celular + en Contacto) usa el número de WhatsApp de Textos → Contacto. Botón **Cómo llegar** abre el enlace de Google Maps. Cada noticia tiene **Compartir por WhatsApp**.
- **Estadísticas**: GoatCounter (cuenta `ueci`); enlace en el menú del panel. Script en `index.html`.
- **Vista previa al compartir** (WhatsApp/Facebook): metadatos `og:` y `assets/og.jpg` (1200×630). Datos para Google (JSON-LD) y `sitemap.xml`.
- Al lanzar: quitar `noindex`; si el sitio cambia de dirección, actualizar las URL de `og:image`, JSON-LD y `sitemap.xml`.

## Lanzamiento (14/10)
Hecho: `index.html` es ahora el sitio oficial (sin `noindex`, con verificación de Search Console y `canonical`); la carátula quedó como `construccion.html`; `PAGINA_SITIO` es `''`.
