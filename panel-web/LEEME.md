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
- Todo lo que se publica es **público**. Las noticias ocultas también están en el código del repo (que es público); no escribir nada privado.
- La clave solo la ve quien edita la planilla: por eso la planilla no se comparte. El resto entra solo a la URL del panel.
- Si hay dudas: revocar el token en GitHub, crear otro y repetir el paso 4.2.

## Cuando el sitio pase a ser el oficial
1. En el repo: `index.html` (carátula) se renombra a `construccion.html`; `sitio.html` pasa a ser `index.html`; se quita la línea `noindex` de `index.html`.
2. En `Codigo.gs`: `PAGINA_SITIO: ''` (para que "Ver el sitio" apunte a la portada) y nueva versión.
