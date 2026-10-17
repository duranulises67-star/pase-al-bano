// Conexión entre varios equipos con Firebase (Authentication + Firestore).
// Solo se carga cuando firebase-config.txt tiene los datos del proyecto de la escuela.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  updateProfile, signOut, sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache,
  doc, getDoc, setDoc, deleteDoc, collection, onSnapshot, query, where, getDocs, documentId, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const MENSAJES = {
  'auth/invalid-email': 'El correo no es válido.',
  'auth/missing-email': 'Escribe tu correo.',
  'auth/missing-password': 'Escribe tu contraseña.',
  'auth/user-not-found': 'Correo o contraseña incorrectos.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/invalid-login-credentials': 'Correo o contraseña incorrectos.',
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Usa «Entrar».',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/network-request-failed': 'No hay conexión a internet.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos y vuelve a intentar.',
  'auth/operation-not-allowed': 'Falta activar «Correo electrónico/contraseña» en Firebase Authentication.',
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'Los datos de firebase-config.txt no son válidos.',
  'permission-denied': 'No tienes permiso. Revisa las reglas de Firestore o pide a dirección que apruebe tu acceso.',
  'unavailable': 'Sin conexión con el servidor. Revisa el internet.',
  'failed-precondition': 'Abre la app en una sola pestaña e inténtalo de nuevo.'
};
const mensaje = e => (e && (MENSAJES[e.code] || MENSAJES[String(e.code).toLowerCase()])) || (e && e.message) || 'Ocurrió un error.';
const falla = e => { const err = new Error(mensaje(e)); err.code = e && e.code; return err; };
const copia = o => JSON.parse(JSON.stringify(o));

export async function iniciarNube(config, { escuelaGuardada = null, alCambiar = () => {}, alError = () => {} } = {}) {
  const app = initializeApp(config);
  const auth = getAuth(app);
  let db;
  try { db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
  catch (e) { db = initializeFirestore(app, { localCache: memoryLocalCache() }); }

  const N = { estado: 'cargando', usuario: null, miembro: null, escuela: null, miembros: [], error: '' };
  let cancelarMiembro = null, cancelarMiembros = null, cancelarEscuela = null;
  const avisar = () => { try { alCambiar(N); } catch (e) {} };
  const eid = () => N.escuela && N.escuela.id;
  const ref = (...p) => doc(db, 'escuelas', eid(), ...p);
  const col = n => collection(db, 'escuelas', eid(), n);
  // Firestore aplica cada escritura en el equipo al instante y la envía cuando hay internet:
  // no se espera la confirmación del servidor para no congelar la app sin conexión.
  const sinEsperar = p => { p.catch(e => alError(falla(e))); return Promise.resolve(); };

  function limpiar() {
    [cancelarMiembro, cancelarMiembros, cancelarEscuela].forEach(f => { if (f) try { f(); } catch (e) {} });
    cancelarMiembro = cancelarMiembros = cancelarEscuela = null;
    N.miembros = [];
  }

  function escucharMiembro() {
    if (cancelarMiembro) cancelarMiembro();
    cancelarMiembro = onSnapshot(ref('miembros', N.usuario.uid), s => {
      if (!s.exists()) { limpiar(); N.miembro = null; N.escuela = null; N.estado = 'sin-escuela'; avisar(); return; }
      N.miembro = s.data();
      if (!N.miembro.aprobado) { N.estado = 'pendiente'; avisar(); return; }
      if (N.estado !== 'miembro') {
        N.estado = 'miembro';
        if (!cancelarEscuela) {
          cancelarEscuela = onSnapshot(doc(db, 'escuelas', eid()), e => {
            if (e.exists()) { const d = e.data(); N.escuela = { id: eid(), nombre: d.nombre || '', codigo: d.codigo || '', director: d.director }; avisar(); }
          }, () => {});
        }
      }
      if (N.miembro.rol === 'director' && !cancelarMiembros) {
        cancelarMiembros = onSnapshot(col('miembros'), q => {
          N.miembros = q.docs.map(d => Object.assign({ uid: d.id }, d.data())).sort((a, b) => String(a.nombre || a.email).localeCompare(String(b.nombre || b.email), 'es'));
          avisar();
        }, () => {});
      }
      avisar();
    }, e => {
      // Sin permiso para leer su registro: el maestro fue quitado o las reglas no están publicadas.
      limpiar();
      N.estado = e && e.code === 'permission-denied' ? 'sin-escuela' : 'error';
      N.error = mensaje(e);
      avisar();
    });
  }

  onAuthStateChanged(auth, async user => {
    limpiar();
    N.miembro = null; N.escuela = null; N.error = '';
    if (!user) { N.usuario = null; N.estado = 'sin-sesion'; avisar(); return; }
    N.usuario = { uid: user.uid, email: user.email || '', nombre: user.displayName || '' };
    let escuela = escuelaGuardada;
    escuelaGuardada = null;
    if (!escuela) {
      try {
        const u = await getDoc(doc(db, 'usuarios', user.uid));
        escuela = u.exists() ? u.data().escuela : null;
      } catch (e) { N.estado = 'error'; N.error = mensaje(e); avisar(); return; }
    }
    if (!escuela) { N.estado = 'sin-escuela'; avisar(); return; }
    N.escuela = { id: escuela };
    N.estado = 'cargando'; avisar();
    escucharMiembro();
  });

  async function codigoLibre() {
    const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let intento = 0; intento < 8; intento++) {
      let c = '';
      for (let i = 0; i < 6; i++) c += letras[Math.floor(Math.random() * letras.length)];
      const s = await getDoc(doc(db, 'codigos', c));
      if (!s.exists()) return c;
    }
    throw new Error('No se pudo generar el código. Intenta de nuevo.');
  }

  N.entrar = async (correo, clave) => {
    if (!correo || !clave) throw new Error('Escribe tu correo y tu contraseña.');
    try { await signInWithEmailAndPassword(auth, correo, clave); } catch (e) { throw falla(e); }
  };
  N.crearCuenta = async (nombre, correo, clave) => {
    if (!nombre) throw new Error('Escribe tu nombre.');
    if (!correo || !clave) throw new Error('Escribe tu correo y una contraseña.');
    try {
      const r = await createUserWithEmailAndPassword(auth, correo, clave);
      await updateProfile(r.user, { displayName: nombre });
      N.usuario = Object.assign({}, N.usuario, { nombre });
      avisar();
    } catch (e) { throw falla(e); }
  };
  N.restablecer = async correo => {
    if (!correo) throw new Error('Escribe tu correo arriba y vuelve a tocar «Olvidé mi contraseña».');
    try { await sendPasswordResetEmail(auth, correo); } catch (e) { throw falla(e); }
  };
  N.salir = async () => { limpiar(); await signOut(auth); };

  N.crearEscuela = async datos => {
    if (!datos || !String(datos.nombre || '').trim()) throw new Error('Escribe el nombre de la escuela.');
    const uid = N.usuario.uid;
    try {
      const id = 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const codigo = await codigoLibre();
      await setDoc(doc(db, 'escuelas', id), {
        nombre: String(datos.nombre).trim(), cct: datos.cct || '', turno: datos.turno || '', ciclo: datos.ciclo || '',
        logo: datos.logo || '', horaReporte: datos.horaReporte || '13:00', firmas: datos.firmas || [], fotos: datos.fotos !== false,
        director: uid, codigo, creado: Date.now()
      });
      await setDoc(doc(db, 'escuelas', id, 'miembros', uid), { nombre: N.usuario.nombre || '', email: N.usuario.email, rol: 'director', aprobado: true, creado: Date.now() });
      await setDoc(doc(db, 'codigos', codigo), { escuela: id });
      await setDoc(doc(db, 'usuarios', uid), { escuela: id });
      N.escuela = { id, nombre: String(datos.nombre).trim(), codigo };
      escucharMiembro();
    } catch (e) { throw falla(e); }
  };

  N.unirse = async codigo => {
    const c = String(codigo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c.length !== 6) throw new Error('El código tiene 6 letras y números.');
    try {
      const s = await getDoc(doc(db, 'codigos', c));
      if (!s.exists()) throw Object.assign(new Error('Ese código no existe. Revisa que esté bien escrito.'), { propio: true });
      const id = s.data().escuela;
      await setDoc(doc(db, 'escuelas', id, 'miembros', N.usuario.uid), { nombre: N.usuario.nombre || '', email: N.usuario.email, rol: 'maestro', aprobado: false, creado: Date.now() });
      await setDoc(doc(db, 'usuarios', N.usuario.uid), { escuela: id });
      N.escuela = { id };
      escucharMiembro();
    } catch (e) { throw e && e.propio ? e : falla(e); }
  };

  N.aprobar = async uid => { try { await setDoc(ref('miembros', uid), { aprobado: true }, { merge: true }); } catch (e) { throw falla(e); } };
  N.rechazar = async uid => { try { await deleteDoc(ref('miembros', uid)); } catch (e) { throw falla(e); } };

  // Almacén con la misma forma que el del dispositivo, pero compartido por toda la escuela.
  N.almacen = () => {
    const E = eid();
    const docsAMapa = s => { const m = {}; s.docs.forEach(d => { m[d.id] = d.data(); }); return m; };
    return {
      tipo: 'nube',
      persistente: true,
      alGrupos(cb, err) { return onSnapshot(col('grupos'), s => cb(s.docs.map(d => Object.assign(d.data(), { id: d.id }))), err); },
      alDia(gid, fecha, cb, err) { return onSnapshot(ref('dias', `${gid}_${fecha}`), s => cb(s.exists() ? s.data() : null), err); },
      alActivos(cb, err) { return onSnapshot(col('activos'), s => cb(s.docs.map(d => Object.assign({ sid: d.id }, d.data()))), err); },
      alEscuela(cb, err) {
        return onSnapshot(doc(db, 'escuelas', E), s => {
          const d = s.exists() ? s.data() : {};
          cb({ nombre: d.nombre, cct: d.cct, turno: d.turno, ciclo: d.ciclo, logo: d.logo, horaReporte: d.horaReporte, firmas: d.firmas, fotos: d.fotos });
        }, err);
      },
      alFotos(cb, err) { return onSnapshot(col('fotos'), s => { const m = {}; s.docs.forEach(d => { const v = d.data(); if (v && v.data) m[d.id] = v.data; }); cb(m); }, err); },
      alVinculos(cb, err) { return onSnapshot(col('vinculos'), s => cb(s.docs.map(d => Object.assign(d.data(), { id: d.id }))), err); },
      async leerDia(gid, fecha) { const s = await getDoc(ref('dias', `${gid}_${fecha}`)); return s.exists() ? s.data() : null; },
      async fechasConDatos(gid, desde) {
        const q = query(col('dias'), where(documentId(), '>=', `${gid}_${desde || ''}`), where(documentId(), '<=', `${gid}_`));
        const s = await getDocs(q);
        return s.docs.filter(d => Object.values(d.data().salidas || {}).some(x => x && x.alumnoId)).map(d => d.id.slice(gid.length + 1));
      },
      guardarGrupo(g) { const c = copia(g); delete c.id; if (!c.creadoPor) c.creadoPor = N.usuario.uid; return sinEsperar(setDoc(ref('grupos', g.id), c)); },
      borrarGrupo(id) { return sinEsperar(deleteDoc(ref('grupos', id))); },
      escribirSalida(gid, fecha, sid, datos) { return sinEsperar(setDoc(ref('dias', `${gid}_${fecha}`), { grupoId: gid, fecha, salidas: { [sid]: datos } }, { merge: true })); },
      marcarActivo(sid, info) { return sinEsperar(info ? setDoc(ref('activos', sid), info) : deleteDoc(ref('activos', sid))); },
      guardarEscuela(p) { return sinEsperar(setDoc(doc(db, 'escuelas', E), copia(p), { merge: true })); },
      guardarFoto(aid, gid, data) { return sinEsperar(data ? setDoc(ref('fotos', aid), { data, grupoId: gid }) : deleteDoc(ref('fotos', aid))); },
      guardarVinculo(v) { const c = copia(v); delete c.id; c.creadoPor = N.usuario.uid; return sinEsperar(setDoc(ref('vinculos', v.id), c)); },
      borrarVinculo(id) { return sinEsperar(deleteDoc(ref('vinculos', id))); },
      async exportar() {
        const [g, d, f, v, e] = await Promise.all([getDocs(col('grupos')), getDocs(col('dias')), getDocs(col('fotos')), getDocs(col('vinculos')), getDoc(doc(db, 'escuelas', E))]);
        const esc = e.exists() ? e.data() : null;
        if (esc) { delete esc.director; delete esc.codigo; }
        return { app: 'pase-al-bano', formato: 2, exportado: Date.now(), grupos: docsAMapa(g), dias: docsAMapa(d), fotos: docsAMapa(f), vinculos: docsAMapa(v), escuela: esc };
      },
      // Sube un respaldo (o los datos que este equipo tenía antes de conectarse) a la escuela.
      async importar(datos) {
        const escrituras = [];
        Object.entries(datos.grupos || {}).forEach(([id, g]) => { if (g && typeof g === 'object') { const c = copia(g); delete c.id; if (!c.creadoPor) c.creadoPor = N.usuario.uid; escrituras.push([ref('grupos', id), c, true]); } });
        Object.entries(datos.dias || {}).forEach(([id, d]) => { if (d && d.salidas) escrituras.push([ref('dias', id), { grupoId: d.grupoId, fecha: d.fecha, salidas: copia(d.salidas) }, true]); });
        Object.entries(datos.fotos || {}).forEach(([id, f]) => { if (f && typeof f.data === 'string') escrituras.push([ref('fotos', id), { data: f.data, grupoId: f.grupoId || '' }, false]); });
        Object.entries(datos.vinculos || {}).forEach(([id, v]) => { if (v && v.a && v.b) { const c = copia(v); delete c.id; escrituras.push([ref('vinculos', id), c, true]); } });
        for (let i = 0; i < escrituras.length; i += 400) {
          const lote = writeBatch(db);
          escrituras.slice(i, i + 400).forEach(([r, data, merge]) => lote.set(r, data, merge ? { merge: true } : {}));
          try { await lote.commit(); } catch (e) { throw falla(e); }
        }
      }
    };
  };

  return N;
}
