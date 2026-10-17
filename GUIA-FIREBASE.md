# Conectar varios equipos con Firebase

Con esta conexión, las tablets de todos los salones y la computadora de dirección comparten los registros en tiempo real:

- Cada maestro ve su grupo y dirección ve los reportes de todos.
- Si dos alumnos vinculados de salones distintos salen al mismo tiempo, suena el aviso en las tablets de **ambos** salones.
- Si se cae el internet, cada tablet sigue registrando y envía todo al volver la conexión.

Firebase es un servicio de Google. El plan gratuito alcanza para una escuela mediana. Los datos quedan en la cuenta de Google de la escuela; nadie más tiene acceso.

> Hazlo una sola vez, desde una computadora. Toma unos 15 minutos.

## 1. Crear el proyecto

1. Con la cuenta de Google de la escuela (de preferencia la institucional, no una personal), entra a <https://console.firebase.google.com>.
2. Toca **Crear un proyecto** (o **Agregar proyecto**).
3. Ponle un nombre, por ejemplo `pase-al-bano-est12`.
4. Puedes desactivar Google Analytics; no se usa. Toca **Crear proyecto**.

## 2. Activar las cuentas con correo y contraseña

1. En el menú de la izquierda: **Compilación → Authentication → Comenzar**.
2. En la pestaña **Método de acceso**, elige **Correo electrónico/contraseña**, actívalo y toca **Guardar**.

## 3. Crear la base de datos y sus reglas

1. En el menú: **Compilación → Firestore Database → Crear base de datos**.
2. Elige la ubicación más cercana (por ejemplo `nam5 (United States)`) y el **modo de producción**.
3. Cuando termine, abre la pestaña **Reglas**.
4. Borra todo lo que hay ahí, abre el archivo `firestore.rules` de esta carpeta con el Bloc de notas, copia todo su contenido, pégalo y toca **Publicar**.

Las reglas hacen que solo el personal aprobado por dirección pueda ver o cambiar los datos.

## 4. Copiar los datos del proyecto a la app

1. Toca el engrane ⚙ junto a «Descripción general del proyecto» y elige **Configuración del proyecto**.
2. Baja hasta **Tus apps** y toca el ícono web **</>**.
3. Escribe el apodo `Pase al Baño` y toca **Registrar app**. No marques Firebase Hosting.
4. Aparece un bloque que empieza con `const firebaseConfig = {`. Copia ese bloque completo, hasta la llave `};`.
5. En esta carpeta, abre `firebase-config.txt` con el Bloc de notas, pega el bloque al final y guarda.
6. Vuelve a publicar la carpeta completa (Netlify o GitHub Pages, como en `LEEME.md`).

Estos datos no son contraseñas: identifican el proyecto y es normal que vayan dentro de la app. La seguridad la dan las reglas del paso 3.

## 5. Primer uso

**Dirección** (una sola vez):

1. Abre la app y entra a **Ajustes → Conectar varios equipos → Crear cuenta**.
2. Toca **Registrar escuela**. Aparece un **código de 6 letras**: es el que darás a los maestros.
3. Si ese equipo ya tenía grupos guardados, toca **Subir a la escuela**.
4. Llena los datos de la escuela en **Ajustes → Escuela**: logotipo, CCT, turno, ciclo, firmas y hora del aviso del viernes.

**Cada maestro**, en la tablet de su salón:

1. **Ajustes → Conectar varios equipos → Crear cuenta** con su correo.
2. Escribe el código de la escuela y toca **Unirme**.
3. Dirección verá la solicitud en su pantalla y tocará **Aprobar**. La tablet se conecta sola.
4. Elige el grupo en la barra de arriba, crea un **PIN** en Ajustes y toca **Bloquear** antes de dejar la tablet a los alumnos.

## Preguntas frecuentes

**¿Qué pasa si el maestro cambia de tablet?** Entra con su misma cuenta en la nueva tablet; los datos ya están en la nube.

**¿Quién recibe los avisos de alumnos vinculados?** Las tablets donde se usan los grupos de esos alumnos. Dirección los ve en el reporte semanal.

**¿Dirección puede quitar el acceso a alguien?** Sí: en **Ajustes → Conectar varios equipos**, junto a cada persona, toca **Quitar acceso**.

**¿Cuánto cuesta?** El plan gratuito de Firebase permite decenas de miles de lecturas y escrituras al día, suficiente para una escuela mediana. Si la escuela es muy grande y Firebase avisa que se acerca al límite, se puede activar el plan de pago por uso, que cuesta muy poco a esta escala.

**Aparece «No tienes permiso».** Revisa que las reglas del paso 3 estén publicadas y que dirección haya aprobado al maestro.

**Aparece «Falta activar Correo electrónico/contraseña».** Repite el paso 2.
