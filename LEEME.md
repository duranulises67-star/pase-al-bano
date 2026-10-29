# Pase al Baño · app independiente

Registro de salidas al sanitario por alumno, con cronómetro, bitácora diaria y reporte semanal de lunes a viernes. Funciona en tablets, celulares y computadoras, y sin internet una vez instalada.

## Qué hace

- **Lista de asistencia táctil:** el alumno toca su nombre (con su foto, si la agregaste) al salir y otra vez al regresar.
- **PIN del maestro:** con la pantalla bloqueada, los alumnos solo ven la Lista.
- **Reporte semanal automático:** el viernes, a la hora que elijas, aparece un aviso para descargarlo en PDF (hoja carta, con logotipo y firmas) o imprimirlo. Si no se atiende, vuelve a salir el lunes.
- **Alumnos vinculados:** si dos alumnos vinculados están fuera al mismo tiempo, suena un aviso. Con la conexión entre equipos funciona aunque sean de salones distintos.
- **Posibles acuerdos:** el reporte señala a los alumnos de salones distintos que coinciden fuera 3 veces o más en la semana.
- **Logotipo y datos de la escuela** en la barra y en el reporte.

## Qué hay en esta carpeta

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La página de la app |
| `app.js` | El funcionamiento de la app |
| `nube.js` | La conexión entre varios equipos (solo se usa si configuras Firebase) |
| `firebase-config.txt` | Aquí se pegan los datos de Firebase; vacío = cada equipo trabaja por su cuenta |
| `firestore.rules` | Reglas de seguridad para Firebase |
| `GUIA-FIREBASE.md` | Pasos para conectar varios equipos |
| `manifest.webmanifest`, `sw.js`, `icons/` | Lo que permite instalarla y usarla sin internet |

Sube siempre **la carpeta completa**, sin cambiar los nombres de los archivos.

## 1. Publicarla gratis

Para instalarse y funcionar sin internet, la app necesita una dirección `https://`. Las dos opciones son gratuitas.

### Opción A · Netlify Drop (la más sencilla)

1. En una computadora, entra a <https://app.netlify.com/drop>.
2. Arrastra la carpeta `pase-al-bano-app` completa a la página.
3. Crea una cuenta gratuita o inicia sesión cuando te lo pida, para que el sitio no se borre.
4. Netlify te da una dirección como `https://nombre-al-azar.netlify.app`. Puedes cambiar el nombre en la configuración del sitio.

### Opción B · GitHub Pages

1. En <https://github.com>, crea un repositorio público (por ejemplo `pase-al-bano`).
2. Usa **Add file → Upload files** y sube todo el contenido de la carpeta, incluida la carpeta `icons`.
3. Entra a **Settings → Pages**, elige la rama `main` y la carpeta `/ (root)`, y guarda.
4. En un par de minutos queda en `https://TU-USUARIO.github.io/pase-al-bano/`.

## 2. Instalarla en cada dispositivo

- **Android (Chrome):** abre la dirección, entra a **Ajustes** y toca **Instalar en este dispositivo**. Si no aparece el botón, usa el menú ⋮ → **Instalar app**.
- **iPad o iPhone (Safari):** abre la dirección en Safari, toca **Compartir** y elige **Agregar a pantalla de inicio**.
- **Computadora (Chrome o Edge):** abre la dirección y usa el ícono de instalar en la barra de direcciones.

Ábrela una vez con internet: así guarda todo lo que necesita, incluida la herramienta del PDF, y después funciona sin conexión.

## 3. Configurarla

En **Ajustes**:

1. **Escuela:** sube el logotipo y escribe el nombre, CCT, turno, ciclo escolar, las firmas del reporte y la hora del aviso del viernes.
2. **Grupos:** crea cada grupo y pega su lista de asistencia. Toca la cámara de cada alumno para tomarle una foto o elegirla de la galería.
3. **PIN del maestro:** crea un PIN y **anota el código de recuperación** que aparece. Toca **Bloquear** antes de dejar la tablet a los alumnos; también se bloquea sola a los 3 minutos sin uso.
4. **Alumnos vinculados:** elige a dos alumnos y, si quieres, el motivo.

Las fotos son de menores de edad: úsalas solo con autorización de las familias. Si no la tienes, desactiva **Mostrar fotos de los alumnos**.

## 4. Conectar varios equipos (opcional)

Sin configurar nada, cada tablet guarda sus propios datos. Para que todas las tablets y dirección compartan la información, y para que los avisos de vínculos lleguen entre salones distintos, sigue **GUIA-FIREBASE.md**.

## Dónde quedan los datos

- **Sin Firebase:** solo en el dispositivo y navegador donde se usa la app. Haz un respaldo cada viernes en **Ajustes → Descargar respaldo**; con **Restaurar o combinar…** pasas los datos a otro equipo o juntas los de dos tablets.
- **Con Firebase:** en el proyecto de Firebase de la escuela, al que solo entra el personal aprobado por dirección.
- Publicar la carpeta en internet solo publica la app vacía; los nombres, fotos y registros nunca van dentro de la carpeta.
- En iPad o iPhone, instálala en la pantalla de inicio: Safari puede borrar los datos de las páginas web que no se abren durante varios días.

## Publicar una versión nueva

Si cambias `index.html`, `app.js` o `nube.js`, abre `sw.js` y cambia el número de `VERSION` (por ejemplo, `pase-al-bano-v3` por `pase-al-bano-v4`). Luego vuelve a subir la carpeta. Cada dispositivo toma la versión nueva la próxima vez que abra la app con internet; los registros no se pierden.

Cambiar solo `firebase-config.txt` no requiere cambiar la versión.
