# Panel de administración del sitio (planilla de Google)

Archivos: `Codigo.gs` (el script) y `appsscript.json` (permisos). No contienen claves: es seguro que estén en el repo público.

## Instalación (una sola vez, la hace Javier)

1. **Crear la clave de GitHub** (con la cuenta del colegio):
   GitHub > foto de perfil > Settings > Developer settings > Personal access tokens > *Fine-grained tokens* > Generate new token.
   - Resource owner: UEConstantinoI
   - Repository access: *Only select repositories* > `ueci-sitio-web`
   - Permissions > Repository permissions > **Contents: Read and write**
   - Expiration: la más larga permitida. Copiar el token (empieza con `github_pat_`).
   - Si la organización no permite tokens fine-grained, usar un token *classic* con el permiso `repo`.
2. **Crear la planilla**: sheets.new > nombrarla "Panel sitio web Constantino I".
3. **Pegar el script**: Extensiones > Apps Script.
   - Borrar el contenido de `Código.gs` y pegar todo `Codigo.gs`.
   - Engranaje (Configuración del proyecto) > activar *Mostrar el archivo de manifiesto "appsscript.json"* > en el editor abrir `appsscript.json` y pegar el contenido del archivo del mismo nombre.
   - Guardar.
4. **Volver a la planilla y recargar** la página. Aparece el menú **🌐 Sitio web**.
5. Menú > **Preparar planilla** (autorizar los permisos la primera vez: "Avanzado" > "Ir a ... (no seguro)" es normal para scripts propios).
6. Menú > **Guardar clave de GitHub** > pegar el token.
7. Menú > **Probar conexión con GitHub** > debe decir "Conexión correcta".
8. Compartir la planilla con Secretaría como *Editor*.

## Uso diario (Secretaría)

Está en la hoja "Instrucciones" de la propia planilla.

## Seguridad

- Todo lo que se publica es **público**. No escribir datos de alumnos o padres.
- Quien tiene permiso de *Editor* en la planilla puede abrir el script y ver la clave. Por eso la clave debe tener permiso **solo sobre este repositorio** y conviene compartir la planilla solo con personas de confianza.
- Si alguna vez hay dudas: en GitHub, revocar el token y crear otro; luego repetir el paso 6.

## Notas

- Las fotos se reducen a 1200 px de ancho para que el sitio cargue rápido.
- Si cambias o quitas la foto de una noticia, la foto vieja queda en el repo (no molesta, solo ocupa espacio).
- El sitio muestra las 6 noticias más recientes por fecha.
