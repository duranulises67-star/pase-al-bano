(() => {
'use strict';

/* ================= Configuración ================= */
const LS_LOCAL = 'pase-bano:datos:v1';
const LS_PREF = 'pase-bano:pref:v1';
const UMBRAL_ACUERDO = 3;           // coincidencias en una semana para sugerir un vínculo
const MIN_TRASLAPE = 30000;         // 30 s fuera al mismo tiempo ya cuentan como coincidencia
const BLOQUEO_AUTO = 3 * 60000;     // con PIN, la app se bloquea sola tras 3 min sin uso
const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const AUTOTABLE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
const DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const DIAS_C = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const TURNOS = ['Matutino', 'Vespertino', 'Nocturno', 'Discontinuo', 'Jornada ampliada', 'Tiempo completo'];

/* ================= Utilidades ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = n => String(n).padStart(2, '0');
const rid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clamp = (n, a, b, d) => { n = Math.round(Number(n)); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };
const fechaDe = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseFecha = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDias = (s, n) => { const d = parseFecha(s); d.setDate(d.getDate() + n); return fechaDe(d); };
const lunesDe = s => { const d = parseFecha(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return fechaDe(d); };
const semanaDe = lun => [0, 1, 2, 3, 4].map(i => addDias(lun, i));
const hoyStr = () => fechaDe(new Date());
const diaSem = s => parseFecha(s).getDay();
const fLargo = s => { const d = parseFecha(s); return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`; };
const fCorto = s => { const d = parseFecha(s); return `${DIAS_C[d.getDay()]} ${d.getDate()}`; };
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const fHora = ms => new Date(ms).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
const fReloj = ms => { const t = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`; };
const fMs = ms => { const t = Math.round(ms / 1000); const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`; };
const fDur = ms => { const t = Math.round(ms / 1000); if (t < 60) return `${t} s`; const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; if (h) return `${h} h ${pad(m)} min`; return s ? `${m} min ${s} s` : `${m} min`; };
const fMin = ms => { const m = Math.round(ms / 60000); if (m < 60) return `${m} min`; return `${Math.floor(m / 60)} h ${pad(m % 60)} min`; };
const fMinCorto = ms => { const m = Math.round(ms / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${pad(m % 60)}m`; };
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
const num2 = n => pad(n);
const slug = s => norm(s || 'grupo').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'grupo';
const fechaHumana = ms => { const d = new Date(ms); return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}, ${fHora(ms)}`; };
const diasDesde = ms => Math.floor((Date.now() - ms) / 86400000);
const cicloActual = () => { const d = new Date(), y = d.getFullYear(); return d.getMonth() >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`; };
const escuelaBase = () => ({ nombre: '', cct: '', turno: '', ciclo: cicloActual(), logo: '', horaReporte: '13:00', firmas: ['Docente del grupo', 'Director(a) de la escuela', ''], fotos: true });
// Las fuentes estándar de PDF solo traen Latin-1: se cambian guiones largos y otros signos.
const pdfTxt = s => String(s == null ? '' : s).replace(/[–—]/g, '-').replace(/…/g, '...').replace(/→/g, '->').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[^\x00-\xFF]/g, '');
const conPunto = s => (/[.!?]$/.test(s) ? s : s + '.');   // «p.m.» ya trae su punto
const iniciales = n => nombreCorto(n).split(/\s+/).slice(0, 2).map(p => p.charAt(0)).join('').toUpperCase();

const ICON = {
  alerta: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.2v.1"/></svg>',
  reloj: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
  pregunta: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M9.8 9.6a2.3 2.3 0 0 1 4.4.9c0 1.6-2.2 2-2.2 3.3M12 16.8v.1"/></svg>',
  escudo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  flecha: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  salir: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H10"/><path d="M14 8l4 4-4 4M18 12H9.5"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.1"/></svg>',
  descargar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  cron: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13.5" r="7"/><path d="M12 13.5V10M10 3.5h4M18 6.5l1.3-1.3"/></svg>',
  personas: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9.5" r="2.5"/><path d="M15.8 14.6c2.3-.2 4.1 1.3 4.7 4.4"/></svg>',
  candado: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>',
  abierto: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 7.6-1.8"/></svg>',
  cadena: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  camara: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2L9 5h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.4"/></svg>',
  imprimir: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="7" rx="1.5"/><path d="M7 14h10v6H7z"/></svg>',
  reporte: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/></svg>',
  nube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 .6-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18z"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  campana: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>'
};
const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const kpi = (ic, valor, etiqueta, cls = '') => `<div class="kpi${cls ? ' ' + cls : ''}"><span class="ic">${ic}</span><b>${valor}</b><span class="lbl">${etiqueta}</span></div>`;

const prefs = (() => { try { return JSON.parse(localStorage.getItem(LS_PREF)) || {}; } catch (e) { return {}; } })();
const guardarPrefs = () => { try { localStorage.setItem(LS_PREF, JSON.stringify(prefs)); } catch (e) {} };

/* ================= Almacenamiento en el dispositivo ================= */
// Todo vive en IndexedDB de este navegador: un registro por grupo ("g:<id>"), uno por grupo y día
// ("d:<grupo>_<fecha>"), uno por foto ("f:<alumno>") y uno por vínculo ("v:<id>").
const diaId = (gid, fecha) => `${gid}_${fecha}`;

function abrirBD() {
  return new Promise((ok, mal) => {
    if (!('indexedDB' in window)) { mal(new Error('sin IndexedDB')); return; }
    const r = indexedDB.open('pase-al-bano', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
    r.onblocked = () => mal(new Error('bloqueada'));
  });
}
const pedir = rq => new Promise((ok, mal) => { rq.onsuccess = () => ok(rq.result); rq.onerror = () => mal(rq.error); });

async function almacenDispositivo() {
  let bd = null;
  const mem = { grupos: {}, dias: {}, ajustes: {}, fotos: {}, vinculos: {}, escuela: null };
  try {
    bd = await abrirBD();
    const st = bd.transaction('kv').objectStore('kv');
    const [claves, valores] = await Promise.all([pedir(st.getAllKeys()), pedir(st.getAll())]);
    claves.forEach((k, i) => {
      const v = valores[i];
      if (k.startsWith('g:')) mem.grupos[k.slice(2)] = v;
      else if (k.startsWith('d:')) mem.dias[k.slice(2)] = v;
      else if (k.startsWith('f:')) mem.fotos[k.slice(2)] = v;
      else if (k.startsWith('v:')) mem.vinculos[k.slice(2)] = v;
      else if (k === 'ajustes') mem.ajustes = v || {};
      else if (k === 'escuela') mem.escuela = v || null;
    });
  } catch (e) { bd = null; }

  const copia = o => (o == null ? null : JSON.parse(JSON.stringify(o)));
  // Cada suscripción solo se vuelve a llamar cuando cambia lo que observa.
  const ver = { grupos: 1, dias: 1, fotos: 1, vinculos: 1, escuela: 1 };
  const subs = new Set();
  const avisar = (...claves) => { claves.forEach(k => { ver[k]++; }); subs.forEach(f => f()); };
  const sub = (claves, f) => {
    let visto = -1;
    const w = () => { const v = claves.reduce((t, k) => t + ver[k], 0); if (v === visto) return; visto = v; f(); };
    subs.add(w); setTimeout(w, 0);
    return () => subs.delete(w);
  };
  // Escribe varios pares [clave, valor] en una sola transacción; valor null borra la clave.
  const guardar = pares => {
    if (!bd || !pares.length) return Promise.resolve();
    return new Promise((ok, mal) => {
      const t = bd.transaction('kv', 'readwrite');
      const st = t.objectStore('kv');
      pares.forEach(([k, v]) => (v == null ? st.delete(k) : st.put(v, k)));
      t.oncomplete = () => ok();
      t.onerror = () => mal(t.error || new Error('error'));
      t.onabort = () => mal(t.error || new Error('abortado'));
    });
  };

  // Datos de la primera versión, que guardaba en localStorage
  if (bd && !Object.keys(mem.grupos).length) {
    try {
      const viejo = JSON.parse(localStorage.getItem(LS_LOCAL) || 'null');
      if (viejo && viejo.grupos && Object.keys(viejo.grupos).length) {
        Object.assign(mem.grupos, viejo.grupos);
        Object.assign(mem.dias, viejo.dias || {});
        await guardar([
          ...Object.keys(mem.grupos).map(id => ['g:' + id, mem.grupos[id]]),
          ...Object.keys(mem.dias).map(id => ['d:' + id, mem.dias[id]])
        ]);
      }
    } catch (e) {}
  }

  const activosHoy = () => {
    const hoy = hoyStr(), out = [];
    Object.keys(mem.dias).forEach(k => {
      const d = mem.dias[k];
      if (!d || d.fecha !== hoy) return;
      salidasDe(d, hoy).forEach(x => { if (!x.fin) out.push({ sid: x.id, alumnoId: x.alumnoId, grupoId: d.grupoId, inicio: x.inicio }); });
    });
    return out;
  };

  return {
    tipo: 'local',
    persistente: !!bd,
    alGrupos(cb) { return sub(['grupos'], () => cb(Object.keys(mem.grupos).map(id => Object.assign(copia(mem.grupos[id]), { id })))); },
    alDia(gid, fecha, cb) { return sub(['dias'], () => cb(copia(mem.dias[diaId(gid, fecha)] || null))); },
    alActivos(cb) { return sub(['dias'], () => cb(activosHoy())); },
    alEscuela(cb) { return sub(['escuela'], () => cb(copia(mem.escuela) || {})); },
    alFotos(cb) { return sub(['fotos'], () => { const m = {}; Object.keys(mem.fotos).forEach(k => { const f = mem.fotos[k]; if (f && f.data) m[k] = f.data; }); cb(m); }); },
    alVinculos(cb) { return sub(['vinculos'], () => cb(Object.keys(mem.vinculos).map(id => Object.assign(copia(mem.vinculos[id]), { id })))); },
    async leerDia(gid, fecha) { return copia(mem.dias[diaId(gid, fecha)] || null); },
    async fechasConDatos(gid, desde) {
      const p = gid + '_';
      return Object.keys(mem.dias).filter(k => k.startsWith(p) && k.slice(p.length) >= (desde || '') && salidasDe(mem.dias[k], k.slice(p.length)).length).map(k => k.slice(p.length));
    },
    async guardarGrupo(g) { const c = copia(g); mem.grupos[g.id] = c; avisar('grupos'); await guardar([['g:' + g.id, c]]); },
    async borrarGrupo(id) { delete mem.grupos[id]; avisar('grupos'); await guardar([['g:' + id, null]]); },
    async escribirSalida(gid, fecha, sid, datos) {
      const k = diaId(gid, fecha);
      let d = mem.dias[k];
      if (!d) { if (!datos || !datos.alumnoId) return; d = mem.dias[k] = { grupoId: gid, fecha, salidas: {} }; }
      if (datos && d.salidas[sid]) d.salidas[sid] = Object.assign({}, d.salidas[sid], datos);
      else d.salidas[sid] = datos ? Object.assign({}, datos) : null;
      avisar('dias');
      await guardar([['d:' + k, d]]);
    },
    async marcarActivo() {},
    async guardarEscuela(parcial) { mem.escuela = Object.assign({}, mem.escuela || {}, copia(parcial)); avisar('escuela'); await guardar([['escuela', mem.escuela]]); },
    async guardarFoto(aid, gid, data) {
      const v = data ? { data, grupoId: gid } : null;
      if (v) mem.fotos[aid] = v; else delete mem.fotos[aid];
      avisar('fotos');
      await guardar([['f:' + aid, v]]);
    },
    async guardarVinculo(v) { const c = copia(v); delete c.id; mem.vinculos[v.id] = c; avisar('vinculos'); await guardar([['v:' + v.id, c]]); },
    async borrarVinculo(id) { delete mem.vinculos[id]; avisar('vinculos'); await guardar([['v:' + id, null]]); },
    ajustes() { return copia(mem.ajustes) || {}; },
    async guardarAjustes(a) { mem.ajustes = Object.assign({}, mem.ajustes, a); await guardar([['ajustes', mem.ajustes]]); },
    resumen() { return { grupos: Object.keys(mem.grupos).length, dias: Object.keys(mem.dias).length }; },
    async exportar() {
      return { app: 'pase-al-bano', formato: 2, exportado: Date.now(), grupos: copia(mem.grupos), dias: copia(mem.dias), fotos: copia(mem.fotos), vinculos: copia(mem.vinculos), escuela: copia(mem.escuela) };
    },
    // Combina un respaldo con lo que hay en el dispositivo, o lo reemplaza todo.
    async importar(datos, reemplazar) {
      const pares = [];
      if (reemplazar) {
        Object.keys(mem.grupos).forEach(id => pares.push(['g:' + id, null]));
        Object.keys(mem.dias).forEach(id => pares.push(['d:' + id, null]));
        Object.keys(mem.fotos).forEach(id => pares.push(['f:' + id, null]));
        Object.keys(mem.vinculos).forEach(id => pares.push(['v:' + id, null]));
        mem.grupos = {}; mem.dias = {}; mem.fotos = {}; mem.vinculos = {};
      }
      Object.keys(datos.grupos || {}).forEach(id => {
        const g = datos.grupos[id];
        if (!g || typeof g !== 'object') return;
        const ya = mem.grupos[id];
        let res = copia(g);
        if (ya) {
          // Gana la versión editada más recientemente; los alumnos que solo están en la otra se conservan al final.
          const recienteEsNuevo = (g.actualizado || 0) >= (ya.actualizado || 0);
          res = copia(recienteEsNuevo ? g : ya);
          const otra = recienteEsNuevo ? ya : g;
          res.alumnos = Array.isArray(res.alumnos) ? res.alumnos : [];
          const ids = new Set(res.alumnos.map(a => a && a.id));
          (otra.alumnos || []).forEach(a => { if (a && !ids.has(a.id)) res.alumnos.push(copia(a)); });
        }
        res.id = id;
        mem.grupos[id] = res; pares.push(['g:' + id, res]);
      });
      Object.keys(datos.dias || {}).forEach(id => {
        const d = datos.dias[id];
        if (!d || typeof d !== 'object' || !d.salidas || typeof d.salidas !== 'object') return;
        const ya = mem.dias[id];
        if (!ya) { mem.dias[id] = copia(d); pares.push(['d:' + id, mem.dias[id]]); return; }
        Object.keys(d.salidas).forEach(sid => {
          const x = d.salidas[sid], y = ya.salidas[sid];
          if (!(sid in ya.salidas)) ya.salidas[sid] = copia(x);
          else if (x === null || y === null) ya.salidas[sid] = null; // un registro borrado sigue borrado
          else if (x && y && !y.fin && x.fin) ya.salidas[sid] = copia(x);
        });
        pares.push(['d:' + id, ya]);
      });
      Object.keys(datos.fotos || {}).forEach(id => {
        const f = datos.fotos[id];
        if (!f || typeof f.data !== 'string' || !f.data.startsWith('data:image/')) return;
        if (reemplazar || !mem.fotos[id]) { mem.fotos[id] = { data: f.data, grupoId: f.grupoId || '' }; pares.push(['f:' + id, mem.fotos[id]]); }
      });
      Object.keys(datos.vinculos || {}).forEach(id => {
        const v = datos.vinculos[id];
        if (!v || !v.a || !v.b || mem.vinculos[id]) return;
        mem.vinculos[id] = copia(v); delete mem.vinculos[id].id;
        pares.push(['v:' + id, mem.vinculos[id]]);
      });
      if (datos.escuela && typeof datos.escuela === 'object' && (reemplazar || !mem.escuela)) { mem.escuela = copia(datos.escuela); pares.push(['escuela', mem.escuela]); }
      avisar('grupos', 'dias', 'fotos', 'vinculos', 'escuela');
      await guardar(pares);
    }
  };
}

/* ================= Estado ================= */
const S = {
  local: null, store: null, nube: null, cfg: null, puedeEscribir: true, importacion: null,
  todos: null, grupos: null, gid: prefs.gid || null,
  escuela: escuelaBase(), escBorrador: null, fotos: {}, vinculos: [], activosEsc: [],
  hoy: hoyStr(), dia: null, diaListo: false, diaClave: '', cancelarDia: null, cancelar: [],
  vista: 'lista', filtro: 'todos', q: '',
  ver: hoyStr(), verDoc: null, verClave: '', verCargando: false, verToken: 0, borrarSalida: null,
  lunes: lunesDe(hoyStr()), sem: null, semToken: 0, semPromesa: null, orden: prefs.orden || 'lista', abierto: null,
  borrador: null, confirmarBorrarGrupo: false, errorForm: '',
  ocupado: new Set(),
  pinActivo: false, bloqueado: false, ultimoToque: Date.now(), modal: null, alertas: [], alertadas: new Set(),
  cambiandoPin: false, codigoRecuperacion: '', errorPin: '',
  destinoImagen: null, vincForm: { a: '', b: '', nota: '' }, conexion: { vista: 'entrar', error: '', ocupado: false }
};

const grupo = () => (S.grupos || []).find(g => g.id === S.gid) || null;
const activos = g => (g && Array.isArray(g.alumnos) ? g.alumnos : []).filter(a => a && !a.baja);
const limiteMs = g => clamp(g && g.limiteMin, 1, 60, 5) * 60000;
const maxDia = g => clamp(g && g.maxDia, 1, 10, 2);
const nivel = (ms, lim) => ms > 2 * lim ? 'crit' : ms > lim ? 'warn' : 'out';
const enNube = () => !!(S.store && S.store.tipo === 'nube');
const esDirector = () => !!(S.nube && S.nube.miembro && S.nube.miembro.rol === 'director');

function salidasDe(doc, fecha) {
  const o = doc && doc.salidas && typeof doc.salidas === 'object' ? doc.salidas : {};
  return Object.keys(o).map(id => {
    const x = o[id];
    if (!x || typeof x !== 'object' || !x.alumnoId || typeof x.inicio !== 'number') return null;
    return { id, fecha, alumnoId: x.alumnoId, inicio: x.inicio, fin: typeof x.fin === 'number' ? x.fin : null };
  }).filter(Boolean).sort((a, b) => a.inicio - b.inicio);
}
const abiertasHoy = () => salidasDe(S.dia, S.hoy).filter(x => !x.fin);

function mapaAlumnos() {
  const m = new Map();
  (S.todos || []).forEach(g => (g.alumnos || []).forEach(a => { if (a && a.id) m.set(a.id, { a, g }); }));
  return m;
}
const vinculosDe = aid => S.vinculos.filter(v => v.a === aid || v.b === aid);
const fotoDe = aid => (S.escuela.fotos !== false && S.fotos[aid]) || '';
const fotoHtml = (aid, cls) => { const f = fotoDe(aid); return f ? `<img class="${cls}" src="${f}" alt="">` : ''; };
// Grupos cuyos avisos le tocan a este equipo: en la nube, los que se usan aquí; sin nube, todos.
function gruposDelEquipo() {
  if (!enNube()) return S.grupos || [];
  const us = prefs.usados || [];
  return (S.grupos || []).filter(g => us.includes(g.id) || g.id === S.gid);
}
const gruposReporte = () => (enNube() && esDirector() ? (S.grupos || []) : gruposDelEquipo());
function recordarUso(gid) {
  if (!gid) return;
  const us = (prefs.usados || []).filter(x => x !== gid);
  us.unshift(gid); prefs.usados = us.slice(0, 12); guardarPrefs();
}
const puedeEditarEscuela = () => !enNube() || esDirector();

/* ================= Escritura ================= */
function escribir(fecha, sid, datos, gid = S.gid) {
  if (!S.store || !gid) return Promise.resolve();
  return S.store.escribirSalida(gid, fecha, sid, datos).catch(errorGuardar);
}
function marcarActivo(sid, info) { if (S.store) S.store.marcarActivo(sid, info).catch(() => {}); }
function errorGuardar(e) {
  aviso(e && e.name === 'QuotaExceededError'
    ? 'Se llenó el espacio del dispositivo. Descarga un respaldo y borra grupos que ya no uses.'
    : enNube() ? 'No se pudo guardar en la escuela. Revisa tu acceso con dirección.' : 'No se pudo guardar el registro en este dispositivo. Vuelve a tocar.', { error: true });
}

function alternar(aid) {
  const g = grupo();
  if (!g) return;
  if (!S.puedeEscribir) { aviso('Tu acceso es de solo lectura.', { error: true }); return; }
  if (!S.diaListo) { aviso('Cargando el registro de hoy… vuelve a tocar en un momento.'); return; }
  if (S.ocupado.has(aid)) return;
  S.ocupado.add(aid); setTimeout(() => S.ocupado.delete(aid), 700);
  const a = activos(g).find(x => x.id === aid);
  if (!a) return;
  const nombre = nombreCorto(a.nombre);
  const ahora = Date.now();
  const abiertas = abiertasHoy().filter(x => x.alumnoId === aid);
  if (abiertas.length) {
    abiertas.forEach(x => { escribir(x.fecha, x.id, { fin: ahora }, g.id); marcarActivo(x.id, null); });
    const dur = ahora - abiertas[abiertas.length - 1].inicio;
    aviso(`${nombre} regresó · ${fDur(dur)} fuera`, { deshacer: () => abiertas.forEach(x => { escribir(x.fecha, x.id, { fin: null }, g.id); marcarActivo(x.id, { alumnoId: x.alumnoId, grupoId: g.id, inicio: x.inicio }); }) });
  } else {
    const sid = rid('s');
    escribir(S.hoy, sid, { alumnoId: aid, inicio: ahora, fin: null }, g.id);
    marcarActivo(sid, { alumnoId: aid, grupoId: g.id, inicio: ahora });
    aviso(`${nombre} salió a las ${fHora(ahora)}`, { deshacer: () => { escribir(S.hoy, sid, null, g.id); marcarActivo(sid, null); } });
    mantenerPantalla();
  }
  try { navigator.vibrate && navigator.vibrate(25); } catch (e) {}
}

function nombreCorto(n) {
  const p = String(n).trim().split(/\s+/);
  return p.length > 2 ? `${p.slice(2).join(' ')} ${p[0]}` : String(n).trim();
}

let candadoPantalla = null;
async function mantenerPantalla() {
  try {
    if ('wakeLock' in navigator && !candadoPantalla && document.visibilityState === 'visible') {
      candadoPantalla = await navigator.wakeLock.request('screen');
      candadoPantalla.addEventListener('release', () => { candadoPantalla = null; });
    }
  } catch (e) { candadoPantalla = null; }
}

/* ================= Aviso flotante, sonido y notificaciones ================= */
let avisoT = null;
function aviso(msg, o = {}) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>` + (o.deshacer ? '<button type="button">Deshacer</button>' : '');
  t.classList.toggle('is-error', !!o.error);
  t.hidden = false;
  if (o.deshacer) $('button', t).onclick = () => { o.deshacer(); ocultarAviso(); };
  clearTimeout(avisoT);
  avisoT = setTimeout(ocultarAviso, o.deshacer ? 7000 : 4500);
}
function ocultarAviso() { $('#toast').hidden = true; }

let audio = null;
function prepararAudio() {
  try {
    if (!audio) { const C = window.AudioContext || window.webkitAudioContext; if (C) audio = new C(); }
    if (audio && audio.state === 'suspended') audio.resume().catch(() => {});
  } catch (e) { audio = null; }
}
function sonar(urgente) {
  if (!audio) return;
  try {
    const t0 = audio.currentTime;
    (urgente ? [0, 0.22, 0.44, 0.66] : [0, 0.2]).forEach((dt, i) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = 'sine'; o.frequency.value = i % 2 ? 660 : 880;
      g.gain.setValueAtTime(0.0001, t0 + dt);
      g.gain.exponentialRampToValueAtTime(urgente ? 0.35 : 0.2, t0 + dt + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.18);
      o.connect(g); g.connect(audio.destination);
      o.start(t0 + dt); o.stop(t0 + dt + 0.2);
    });
  } catch (e) {}
}
async function notificar(titulo, cuerpo) {
  if (!('Notification' in window) || Notification.permission !== 'granted' || !document.hidden) return;
  try {
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    if (reg) reg.showNotification(titulo, { body: cuerpo, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: titulo });
    else new Notification(titulo, { body: cuerpo });
  } catch (e) {}
}

/* ================= Encabezado y navegación ================= */
const VISTAS = ['lista', 'hoy', 'semana', 'grupos'];
function vistaDeHash() { const h = (location.hash || '').replace('#', ''); return VISTAS.includes(h) ? h : 'lista'; }

function irA(v, forzar) {
  if (!VISTAS.includes(v)) v = 'lista';
  if (S.bloqueado && v !== 'lista' && !forzar) {
    try { history.replaceState(null, '', '#' + S.vista); } catch (e) {}
    pedirDesbloqueo(() => irA(v));
    return;
  }
  if (v === 'grupos' && S.vista !== 'grupos') S.escBorrador = null;
  S.vista = v;
  VISTAS.forEach(x => { $('#view-' + x).hidden = x !== v; });
  $$('.tab[data-view]').forEach(b => { if (b.dataset.view === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  try { history.replaceState(null, '', '#' + v); } catch (e) {}
  renderVista();
  window.scrollTo({ top: 0 });
}

function renderVista() {
  if (S.vista === 'lista') renderLista();
  else if (S.vista === 'hoy') renderHoy();
  else if (S.vista === 'semana') renderSemana();
  else renderAjustes();
}

function renderEncabezado() {
  $('#fechaHoy').textContent = $('#fechaCorta').textContent = cap(fLargo(S.hoy));
  const e = S.escuela;
  const logo = $('#logoEscuela');
  if (e.logo) {
    logo.innerHTML = `<img src="${e.logo}" alt="${esc(e.nombre ? 'Logotipo de ' + e.nombre : 'Logotipo de la escuela')}">`;
    logo.hidden = false;
    $('#logoApp').setAttribute('hidden', '');
  } else {
    logo.hidden = true; logo.innerHTML = '';
    $('#logoApp').removeAttribute('hidden');
  }
  $('#subEscuela').textContent = e.nombre || 'Registro de salidas al sanitario';
  const sel = $('#grupoSel');
  if (S.grupos === null) { sel.innerHTML = '<option>Cargando…</option>'; sel.disabled = true; }
  else if (!S.grupos.length) { sel.innerHTML = '<option>Sin grupos todavía</option>'; sel.disabled = true; }
  else {
    sel.disabled = S.bloqueado;
    sel.innerHTML = S.grupos.map(g => `<option value="${esc(g.id)}"${g.id === S.gid ? ' selected' : ''}>${esc(g.nombre || 'Grupo sin nombre')}</option>`).join('');
  }
  aplicarBloqueo();
}

function renderBanner() {
  const b = $('#banner');
  let html = '';
  if (S.local && !S.local.persistente && !enNube()) html = `<details><summary>${ICON.info}<span><b>Sin guardado</b> · este navegador no permite guardar datos</span><span class="more">Más</span></summary><p>Suele pasar en una ventana privada o de incógnito. Abre la app en una ventana normal para que los registros no se pierdan al cerrarla.</p></details>`;
  else if (enNube() && navigator.onLine === false) html = `<details><summary>${ICON.nube}<span><b>Sin internet</b> · los registros se guardan aquí y se envían al volver la conexión</span><span class="more">Más</span></summary><p>Puedes seguir registrando salidas. Mientras no haya internet, los demás salones no verán estos registros ni recibirás avisos de alumnos vinculados de otros salones.</p></details>`;
  b.innerHTML = html; b.hidden = !html;
}

function renderInsignia() {
  const n = abiertasHoy().length;
  const el = $('#badgeFuera');
  el.textContent = n; el.hidden = !n;
}

/* ================= PIN del maestro ================= */
async function hashTexto(t) {
  const s = 'pase-al-bano|' + t;
  try {
    if (window.crypto && crypto.subtle) {
      const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
      return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {}
  let h = 2166136261;
  for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return 'f' + h.toString(16);
}
const normCodigo = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function aplicarBloqueo() {
  document.body.classList.toggle('is-locked', S.bloqueado);
  const b = $('#btnCandado');
  b.hidden = !S.pinActivo;
  b.innerHTML = `${S.bloqueado ? ICON.candado : ICON.abierto}<span>${S.bloqueado ? 'Desbloquear' : 'Bloquear'}</span>`;
  b.setAttribute('aria-label', S.bloqueado ? 'Desbloquear con el PIN del maestro' : 'Bloquear para que los alumnos solo vean la Lista');
}

async function bloquear(silencioso) {
  if (!S.pinActivo) return;
  S.bloqueado = true; S.borrador = null;
  try { await S.local.guardarAjustes({ bloqueado: true }); } catch (e) {}
  if (S.vista !== 'lista') irA('lista', true);
  renderEncabezado();
  if (!silencioso) aviso('Bloqueado: los alumnos solo ven la Lista.');
}

function pedirDesbloqueo(despues) {
  S.modal = { tipo: 'pin', error: '', recuperar: false, despues, intentos: 0, espera: 0 };
  renderModal();
}

async function comprobarPin() {
  const m = S.modal;
  if (!m || m.tipo !== 'pin') return;
  const input = $('#pinValor');
  const valor = input ? input.value.trim() : '';
  if (m.espera && Date.now() < m.espera) { m.error = `Demasiados intentos. Espera ${Math.ceil((m.espera - Date.now()) / 1000)} segundos.`; renderModal(); return; }
  if (!valor) return;
  const aj = S.local.ajustes();
  if (m.recuperar) {
    if (aj.recuperacion && await hashTexto(normCodigo(valor)) === aj.recuperacion) {
      await S.local.guardarAjustes({ pin: null, recuperacion: null, bloqueado: false });
      S.pinActivo = false; S.bloqueado = false;
      cerrarModal(); renderEncabezado();
      aviso('Se quitó el PIN. Crea uno nuevo en Ajustes.');
      irA('grupos', true);
      return;
    }
  } else if (await hashTexto(valor) === aj.pin) {
    S.bloqueado = false; S.ultimoToque = Date.now();
    try { await S.local.guardarAjustes({ bloqueado: false }); } catch (e) {}
    const despues = m.despues;
    cerrarModal(); renderEncabezado();
    if (despues) despues(); else aviso('Desbloqueado.');
    return;
  }
  m.intentos++;
  if (m.intentos >= 5) { m.espera = Date.now() + 30000; m.intentos = 0; }
  m.error = m.recuperar ? 'El código no coincide.' : 'PIN incorrecto.';
  renderModal();
}

function requiereDesbloqueo(fn) { if (S.bloqueado) pedirDesbloqueo(fn); else fn(); }

/* ================= Ventanas (PIN y reporte del viernes) ================= */
function cerrarModal() { S.modal = null; renderModal(); }

function renderModal() {
  const el = $('#modal');
  const m = S.modal;
  if (!m) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  if (m.tipo === 'pin') {
    el.innerHTML = `<div class="modal pin" role="dialog" aria-modal="true" aria-labelledby="mTitulo">
      <div class="modal-ic">${ICON.candado}</div>
      <h2 id="mTitulo">${m.recuperar ? 'Código de recuperación' : 'PIN del maestro'}</h2>
      <p class="muted">${m.recuperar ? 'Escribe el código que anotaste al crear el PIN. El PIN se quitará y podrás crear uno nuevo.' : 'Escribe el PIN para salir de la Lista.'}</p>
      <input id="pinValor" class="pin-input" type="password" inputmode="${m.recuperar ? 'text' : 'numeric'}" autocomplete="off" maxlength="${m.recuperar ? 12 : 6}" aria-label="${m.recuperar ? 'Código de recuperación' : 'PIN'}">
      ${m.recuperar ? '' : `<div class="pin-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button type="button" data-act="pin-tecla" data-k="${n}">${n}</button>`).join('')}<button type="button" data-act="pin-borrar" aria-label="Borrar">${ICON.x}</button><button type="button" data-act="pin-tecla" data-k="0">0</button><button type="button" class="ok" data-act="pin-ok" aria-label="Aceptar">${ICON.check}</button></div>`}
      ${m.error ? `<p class="form-error" role="alert">${esc(m.error)}</p>` : ''}
      <div class="form-actions">
        ${m.recuperar ? '<button class="btn primary" type="button" data-act="pin-ok">Quitar el PIN</button>' : ''}
        <button class="btn ghost" type="button" data-act="pin-cancelar">Cancelar</button>
        ${m.recuperar ? '' : '<button class="link-btn" type="button" data-act="pin-recuperar">¿Olvidaste el PIN?</button>'}
      </div>
    </div>`;
    setTimeout(() => { const i = $('#pinValor'); if (i) i.focus(); }, 30);
    return;
  }
  if (m.tipo === 'reporte') {
    const lunes = m.pendientes[0].lunes, fechas = semanaDe(lunes);
    const pasada = lunes < lunesDe(S.hoy);
    el.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mTitulo">
      <div class="modal-ic">${ICON.reporte}</div>
      <h2 id="mTitulo">${pasada ? 'Quedó pendiente el reporte de la semana pasada' : 'El reporte de la semana está listo'}</h2>
      <p class="muted">Semana del ${rangoTxt(fechas[0], fechas[4])}. Descárgalo en PDF o imprímelo para tu archivo.${S.bloqueado ? ' Te pediremos el PIN del maestro.' : ''}</p>
      <ul class="rep-lista">${m.pendientes.map(p => `<li>
        <div><b>${esc(p.g.nombre)}</b><span>${plural(p.n, 'salida registrada', 'salidas registradas')}</span></div>
        <div class="acts"><button class="btn primary" type="button" data-act="rep-pdf" data-id="${esc(p.g.id)}" data-lunes="${p.lunes}">${ICON.descargar}PDF</button><button class="btn" type="button" data-act="rep-imprimir" data-id="${esc(p.g.id)}" data-lunes="${p.lunes}">${ICON.imprimir}Imprimir</button></div>
      </li>`).join('')}</ul>
      <div class="form-actions"><button class="btn ghost" type="button" data-act="rep-luego">Recordar más tarde</button></div>
    </div>`;
  }
}

/* ================= Alumnos vinculados: aviso en tiempo real ================= */
function cargarAlertadas() {
  const a = prefs.alertadas;
  S.alertadas = new Set(a && a.fecha === S.hoy ? a.k || [] : []);
}
function guardarAlertadas() { prefs.alertadas = { fecha: S.hoy, k: Array.from(S.alertadas).slice(-200) }; guardarPrefs(); }

function revisarCoincidenciasAhora() {
  if (!S.todos || !S.vinculos.length || !S.activosEsc.length) return;
  const inicioHoy = parseFecha(S.hoy).getTime();
  const abiertos = new Map();
  S.activosEsc.forEach(x => { if (x && x.inicio >= inicioHoy) abiertos.set(x.alumnoId, x); });
  const mios = new Set(gruposDelEquipo().map(g => g.id));
  const mapa = mapaAlumnos();
  let nuevas = 0;
  S.vinculos.forEach(v => {
    const xa = abiertos.get(v.a), xb = abiertos.get(v.b);
    if (!xa || !xb) return;
    const A = mapa.get(v.a), B = mapa.get(v.b);
    if (!A || !B) return;
    if (!mios.has(A.g.id) && !mios.has(B.g.id)) return;
    const k = [xa.sid, xb.sid].sort().join('|');
    if (S.alertadas.has(k)) return;
    S.alertadas.add(k);
    S.alertas.push({ v, A, B, xa, xb });
    nuevas++;
  });
  if (!nuevas) return;
  guardarAlertadas();
  renderAlerta();
  sonar(true);
  try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {}
  const u = S.alertas[S.alertas.length - 1];
  notificar('Alumnos vinculados fuera al mismo tiempo', `${u.A.a.nombre} (${u.A.g.nombre}) y ${u.B.a.nombre} (${u.B.g.nombre})`);
}

function renderAlerta() {
  const el = $('#alerta');
  const a = S.alertas[0];
  if (!a) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  const persona = (P, x) => `<div class="al-persona">${fotoDe(P.a.id) ? `<img src="${fotoDe(P.a.id)}" alt="">` : `<span class="al-ini">${esc(iniciales(P.a.nombre))}</span>`}<div><b>${esc(P.a.nombre)}</b><span>${esc(P.g.nombre)} · salió a las ${fHora(x.inicio)}</span></div></div>`;
  el.innerHTML = `<div class="alerta-card" role="alertdialog" aria-modal="true" aria-labelledby="alTitulo" aria-describedby="alTexto">
    <div class="al-ic">${ICON.cadena}</div>
    <h2 id="alTitulo">Alumnos vinculados fuera al mismo tiempo</h2>
    <p id="alTexto">Están fuera del salón a la vez desde las ${conPunto(fHora(Math.max(a.xa.inicio, a.xb.inicio)))}</p>
    <div class="al-par">${persona(a.A, a.xa)}${persona(a.B, a.xb)}</div>
    ${a.v.nota ? `<p class="muted">Motivo del vínculo: ${esc(a.v.nota)}</p>` : ''}
    <div class="form-actions"><button class="btn primary" type="button" data-act="alerta-ok">Entendido</button>${S.alertas.length > 1 ? `<span class="muted">${plural(S.alertas.length - 1, 'aviso más', 'avisos más')}</span>` : ''}</div>
  </div>`;
  const b = $('[data-act="alerta-ok"]', el); if (b) b.focus();
}

/* ================= Vista: Lista ================= */
function estadoVacio(tipo) {
  const arte = `<svg class="empty-art" viewBox="0 0 44 44" aria-hidden="true"><rect class="logo-pass" x="4" y="10" width="36" height="24" rx="6"/><circle class="logo-hole" cx="12.5" cy="22" r="3.2" style="fill:var(--surface)"/><path class="logo-line" d="M20 17.5h13M20 22h9M20 26.5h11"/></svg>`;
  if (tipo === 'sin-grupos') return `<div class="empty">${arte}
    <h2>Crea tu primer grupo</h2>
    <p>Escribe el nombre del grupo y pega la lista de asistencia. Cada alumno aparecerá como una ficha: se toca cuando sale al sanitario y otra vez cuando regresa.</p>
    ${S.puedeEscribir ? '<button class="btn primary" type="button" data-act="nuevo-grupo">Crear grupo</button>' : ''}
  </div>`;
  return `<div class="empty">${arte}
    <h2>Este grupo aún no tiene alumnos</h2>
    <p>Agrega la lista de asistencia para que aparezcan las fichas. Puedes pegar los nombres desde Excel, uno por renglón.</p>
    ${S.puedeEscribir ? `<button class="btn primary" type="button" data-act="editar-grupo" data-id="${esc(S.gid)}">Agregar alumnos</button>` : ''}
  </div>`;
}

function renderLista() {
  renderInsignia();
  if (S.vista !== 'lista') return;
  const roster = $('#roster');
  const tools = $('#listaTools'), hint = $('#listaHint'), strip = $('#strip'), avisoSem = $('#avisoSemana');
  const g = grupo();
  const mostrarControles = !!(g && activos(g).length);
  tools.hidden = hint.hidden = strip.hidden = !mostrarControles;
  if (S.grupos === null) { roster.innerHTML = '<p class="skeleton">Cargando la lista de asistencia…</p>'; avisoSem.hidden = true; return; }
  if (!S.grupos.length) { roster.innerHTML = estadoVacio('sin-grupos'); avisoSem.hidden = true; return; }
  if (!mostrarControles) { roster.innerHTML = estadoVacio('sin-alumnos'); avisoSem.hidden = true; return; }

  // Aviso de cierre de semana (viernes y fin de semana)
  const ds = diaSem(S.hoy);
  if (ds === 5 || ds === 6 || ds === 0) {
    avisoSem.innerHTML = `<div class="notice"><p>${ds === 5 ? 'Es viernes: el reporte de la semana ya está listo.' : 'Fin de semana: revisa el reporte de la semana que terminó.'}</p><button class="btn primary" type="button" data-act="goto" data-view="semana">Ver reporte semanal</button></div>`;
    avisoSem.hidden = false;
  } else avisoSem.hidden = true;

  const lim = limiteMs(g);
  const alumnos = activos(g);
  const hoy = salidasDe(S.dia, S.hoy);
  const abiertas = new Map();
  const conteo = new Map();
  hoy.forEach(x => {
    if (!x.fin) abiertas.set(x.alumnoId, x);
    const c = conteo.get(x.alumnoId) || { n: 0, ms: 0 };
    c.n++; if (x.fin) c.ms += x.fin - x.inicio;
    conteo.set(x.alumnoId, c);
  });
  const ahora = Date.now();
  const conVinculo = new Set(); S.vinculos.forEach(v => { conVinculo.add(v.a); conVinculo.add(v.b); });

  // Franja de alumnos fuera del salón
  const fuera = alumnos.map((a, i) => ({ a, i, x: abiertas.get(a.id) })).filter(o => o.x).sort((p, q) => p.x.inicio - q.x.inicio);
  if (!fuera.length) strip.innerHTML = `<span class="strip-calm">${ICON.check}Todos están en el salón</span>`;
  else strip.innerHTML = `<span class="strip-label"><b>${fuera.length}</b>fuera</span><div class="strip-chips">${fuera.map(o => {
    const nv = nivel(ahora - o.x.inicio, lim);
    return `<button type="button" class="chip-out${nv !== 'out' ? ' is-' + nv : ''}" data-act="alternar" data-id="${esc(o.a.id)}" data-desde-ficha="${o.x.inicio}" data-nivel="${nv}" aria-label="${esc(o.a.nombre)}, fuera desde ${conPunto(fHora(o.x.inicio))} Toca para registrar su regreso.">
      ${fotoHtml(o.a.id, 'chip-foto') || '<span class="pulse" aria-hidden="true"></span>'}${esc(nombreCorto(o.a.nombre))}<span class="mono" data-desde="${o.x.inicio}">${fReloj(ahora - o.x.inicio)}</span></button>`;
  }).join('')}</div>`;

  // Fichas
  const q = norm(S.q.trim());
  let lista = alumnos.map((a, i) => ({ a, n: i + 1 }));
  if (q) lista = lista.filter(o => norm(o.a.nombre).includes(q) || String(o.n) === q || num2(o.n) === q);
  if (S.filtro === 'fuera') lista = lista.filter(o => abiertas.has(o.a.id));
  if (!lista.length) {
    roster.innerHTML = `<p class="skeleton">${S.filtro === 'fuera' && !q ? 'Nadie está fuera del salón en este momento.' : 'Ningún alumno coincide con la búsqueda.'}</p>`;
    return;
  }
  const ro = !S.puedeEscribir;
  roster.innerHTML = lista.map(({ a, n }) => {
    const x = abiertas.get(a.id);
    const c = conteo.get(a.id);
    const foto = fotoHtml(a.id, 'tile-foto');
    const enlace = conVinculo.has(a.id) ? `<span class="tile-link" title="Alumno vinculado">${ICON.cadena}</span>` : '';
    const ident = `<span class="tile-id">${foto}<span class="tile-num${foto ? ' sm' : ''}">${num2(n)}</span>${enlace}</span>`;
    if (x) {
      const nv = nivel(ahora - x.inicio, lim);
      const est = nv === 'crit' ? 'Tiempo prolongado' : nv === 'warn' ? 'Pasó el tiempo sugerido' : `Salió ${fHora(x.inicio)}`;
      return `<button type="button" class="tile is-on is-${nv}" data-act="alternar" data-id="${esc(a.id)}" data-desde-ficha="${x.inicio}" data-nivel="${nv}" aria-pressed="true"${ro ? ' aria-disabled="true"' : ''}
        aria-label="${num2(n)}, ${esc(a.nombre)}. Fuera desde ${conPunto(fHora(x.inicio))} Toca para registrar su regreso.">
        <span class="tile-top">${ident}<span class="pass-tag"><span class="pulse" aria-hidden="true"></span>Pase</span></span>
        <span class="tile-name">${esc(a.nombre)}</span>
        <span class="perf" aria-hidden="true"></span>
        <span class="tile-timer"><span data-desde="${x.inicio}">${fReloj(ahora - x.inicio)}</span></span>
        <span class="tile-status">${est}</span>
      </button>`;
    }
    const meta = c && c.ms ? `${c.ms < 60000 ? 'Menos de 1 min' : fMin(c.ms)} fuera hoy` : '';
    return `<button type="button" class="tile" data-act="alternar" data-id="${esc(a.id)}" aria-pressed="false"${ro ? ' aria-disabled="true"' : ''}
      aria-label="${num2(n)}, ${esc(a.nombre)}. En el salón${c ? ', ' + plural(c.n, 'salida', 'salidas') + ' hoy' : ''}. Toca para registrar su salida.">
      <span class="tile-top">${ident}${c ? `<span class="tile-count">${plural(c.n, 'salida', 'salidas')}</span>` : ''}</span>
      <span class="tile-name">${esc(a.nombre)}</span>
      <span class="tile-foot"><span class="tile-meta">${meta}</span><span class="tile-go" aria-hidden="true">${ICON.salir}</span></span>
    </button>`;
  }).join('');
}

/* ================= Vista: Registro del día ================= */
function diaHabil(s, paso) { let d = addDias(s, paso); while (diaSem(d) === 0 || diaSem(d) === 6) d = addDias(d, paso); return d; }

async function cargarDiaVisto() {
  const clave = S.gid + '|' + S.ver;
  S.verClave = clave;
  if (S.ver === S.hoy) { S.verDoc = null; S.verCargando = false; return; }
  const tk = ++S.verToken;
  S.verCargando = true;
  let doc = null;
  try { doc = await S.store.leerDia(S.gid, S.ver); } catch (e) { doc = null; aviso('No se pudo leer el registro de ese día.', { error: true }); }
  if (tk !== S.verToken) return;
  S.verDoc = doc; S.verCargando = false;
  renderHoy();
}

function etiquetasSalida(x, lim, esHoy) {
  if (!x.fin) {
    return esHoy ? '<span class="tag out">Fuera ahora</span>' : `<span class="tag neutral">${ICON.pregunta}Sin regreso registrado</span>`;
  }
  const d = x.fin - x.inicio;
  if (d > 2 * lim) return `<span class="tag crit">${ICON.reloj}Más del doble del tiempo sugerido</span>`;
  if (d > lim) return `<span class="tag warn">${ICON.reloj}Pasó el tiempo sugerido</span>`;
  return '';
}

function renderHoy() {
  if (S.vista !== 'hoy') return;
  const body = $('#hoyBody');
  const g = grupo();
  const esHoy = S.ver === S.hoy;
  $('#diaTitulo').innerHTML = `${esHoy ? 'Hoy' : cap(fLargo(S.ver))}<span class="sub">${esHoy ? cap(fLargo(S.ver)) : 'Registro del día'}</span>`;
  $('#diaHoy').hidden = esHoy;
  $('#diaNext').disabled = S.ver >= S.hoy;
  if (!S.grupos) { body.innerHTML = '<p class="skeleton">Cargando…</p>'; return; }
  if (!g) { body.innerHTML = estadoVacio('sin-grupos'); return; }
  if (S.verClave !== S.gid + '|' + S.ver) { cargarDiaVisto(); }
  if (!esHoy && S.verCargando) { body.innerHTML = '<p class="skeleton">Cargando el registro de ese día…</p>'; return; }
  if (esHoy && !S.diaListo) { body.innerHTML = '<p class="skeleton">Cargando el registro de hoy…</p>'; return; }

  const doc = esHoy ? S.dia : S.verDoc;
  const lim = limiteMs(g);
  const alumnos = g.alumnos || [];
  const numero = new Map(activos(g).map((a, i) => [a.id, i + 1]));
  const porId = new Map(alumnos.map(a => [a.id, a]));
  const sal = salidasDe(doc, S.ver).filter(x => porId.has(x.alumnoId));
  const cerradas = sal.filter(x => x.fin);
  const totalMs = cerradas.reduce((t, x) => t + (x.fin - x.inicio), 0);
  const abiertas = sal.filter(x => !x.fin);

  const kpis = `<div class="kpis">
    ${kpi(ICON.salir, sal.length, sal.length === 1 ? 'salida registrada' : 'salidas registradas')}
    ${kpi(ICON.reloj, fMin(totalMs), 'tiempo total fuera')}
    ${kpi(ICON.cron, cerradas.length ? fMs(totalMs / cerradas.length) : '–', 'promedio por salida (min:seg)')}
    ${esHoy
      ? kpi(ICON.personas, abiertas.length, 'fuera del salón ahora', abiertas.length ? 'is-pass' : '')
      : kpi(ICON.pregunta, abiertas.length, 'sin regreso registrado', abiertas.length ? 'is-alert' : '')}
  </div>`;

  let log;
  if (!sal.length) log = `<p class="panel-empty">${esHoy ? 'Todavía no hay salidas hoy. Se registran al tocar un nombre en la Lista.' : 'No hay salidas registradas este día.'}</p>`;
  else log = `<div class="log">${sal.slice().reverse().map(x => {
    const a = porId.get(x.alumnoId);
    const n = numero.get(x.alumnoId);
    const confirmar = S.borrarSalida === x.id;
    const acciones = !S.puedeEscribir ? '' : confirmar
      ? `<span class="confirm">¿Borrar este registro? <button class="btn danger solid" type="button" data-act="borrar-salida-si" data-id="${esc(x.id)}">Borrar</button><button class="btn" type="button" data-act="borrar-salida-no">No</button></span>`
      : `<button class="link-btn" type="button" data-act="borrar-salida" data-id="${esc(x.id)}">Borrar</button>`;
    return `<div class="log-row">
      <span class="log-time">${fHora(x.inicio)}</span>
      <span class="log-name">${n ? `<span class="n">${num2(n)}</span>` : ''}${esc(a.nombre)}</span>
      <span class="log-dur">${x.fin ? fMs(x.fin - x.inicio) : esHoy ? `<span data-desde="${x.inicio}">${fReloj(Date.now() - x.inicio)}</span>` : '–'}</span>
      <span class="log-back">${x.fin ? `Regresó ${fHora(x.fin)}` : ''} ${etiquetasSalida(x, lim, esHoy)}</span>
      <span class="log-act">${acciones}</span>
    </div>`;
  }).join('')}</div>`;

  const md = maxDia(g);
  const agg = new Map();
  sal.forEach(x => {
    const r = agg.get(x.alumnoId) || { n: 0, ms: 0, max: 0 };
    r.n++; if (x.fin) { const d = x.fin - x.inicio; r.ms += d; r.max = Math.max(r.max, d); }
    agg.set(x.alumnoId, r);
  });
  const filas = Array.from(agg.entries()).map(([aid, r]) => ({ a: porId.get(aid), n: numero.get(aid), r }))
    .sort((p, q) => q.r.n - p.r.n || q.r.ms - p.r.ms);
  const resumen = !filas.length ? '<p class="panel-empty">Sin salidas.</p>' : `<div class="mini-list">${filas.map(f => {
    const tags = [];
    if (f.a.permiso) tags.push(`<span class="tag info">${ICON.escudo}Permiso especial</span>`);
    else if (f.r.n > md) tags.push(`<span class="tag warn">${ICON.alerta}Más de ${md} salidas</span>`);
    return `<div class="mini-row"><span class="n">${f.n ? num2(f.n) : '–'}</span><span class="nm">${esc(f.a.nombre)}</span>
      <span class="st">${plural(f.r.n, 'salida', 'salidas')} · ${fMin(f.r.ms)}</span>${tags.length ? `<span class="tags">${tags.join('')}</span>` : ''}</div>`;
  }).join('')}</div>`;

  body.innerHTML = `${kpis}
    <div class="two-col" style="margin-top:16px">
      <div class="panel"><div class="panel-head"><h3>Registro del día</h3><span class="muted" style="font-size:.88rem">Tiempo sugerido: ${clamp(g.limiteMin, 1, 60, 5)} min</span></div>${log}</div>
      <div class="panel"><div class="panel-head"><h3>Por alumno</h3></div>${resumen}</div>
    </div>`;
}

/* ================= Análisis y reporte semanal ================= */
function leerDiaVivo(gid, f) {
  if (gid === S.gid && f === S.hoy && S.diaListo) return Promise.resolve(S.dia);
  return S.store.leerDia(gid, f).catch(() => null);
}

// Coincidencias de la semana: pares de alumnos fuera al mismo tiempo (con vínculo) y
// pares de salones distintos que coinciden seguido sin estar vinculados (posibles acuerdos).
async function calcularCoincidencias(g, fechas) {
  const propios = new Set((g.alumnos || []).map(a => a.id));
  const porFecha = new Map(fechas.map(f => [f, []]));
  for (const h of (S.todos || [])) {
    const docs = await Promise.all(fechas.map(f => leerDiaVivo(h.id, f)));
    docs.forEach((doc, i) => salidasDe(doc, fechas[i]).forEach(x => porFecha.get(fechas[i]).push(Object.assign({ gid: h.id }, x))));
  }
  const ahora = Date.now();
  const fin = x => x.fin || (x.fecha === S.hoy ? ahora : x.inicio);
  const vinc = new Map();
  S.vinculos.forEach(v => { vinc.set(v.a + '|' + v.b, v); vinc.set(v.b + '|' + v.a, v); });
  const vinculadas = [], pares = new Map();
  porFecha.forEach(lista => {
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        const x = lista[i], y = lista[j];
        if (x.alumnoId === y.alumnoId) continue;
        if (!propios.has(x.alumnoId) && !propios.has(y.alumnoId)) continue;
        const ov = Math.min(fin(x), fin(y)) - Math.max(x.inicio, y.inicio);
        if (ov < MIN_TRASLAPE) continue;
        const [p, o] = propios.has(x.alumnoId) ? [x, y] : [y, x];
        const v = vinc.get(x.alumnoId + '|' + y.alumnoId);
        if (v) vinculadas.push({ v, p, o, desde: Math.max(x.inicio, y.inicio), ov });
        else if (x.gid !== y.gid) {
          const k = [p.alumnoId, o.alumnoId].join('|');
          const r = pares.get(k) || { p: p.alumnoId, o: o.alumnoId, veces: 0, ms: 0 };
          r.veces++; r.ms += ov;
          pares.set(k, r);
        }
      }
    }
  });
  const sugeridas = Array.from(pares.values()).filter(r => r.veces >= UMBRAL_ACUERDO).sort((a, b) => b.veces - a.veces);
  return { vinculadas: vinculadas.sort((a, b) => a.desde - b.desde), sugeridas };
}

async function historialDe(gid) {
  const fechas = await S.store.fechasConDatos(gid, addDias(lunesDe(S.hoy), -98));
  const semanas = new Set();
  fechas.forEach(f => { const d = diaSem(f); if (d >= 1 && d <= 5) semanas.add(lunesDe(f)); });
  return Array.from(semanas).filter(l => l < lunesDe(S.hoy)).sort().reverse().slice(0, 10);
}

function cargarSemana() {
  const g = grupo();
  if (!g) return Promise.resolve();
  const fechas = semanaDe(S.lunes), tk = ++S.semToken, lunes = S.lunes, gid = S.gid;
  S.sem = { lunes, gid, cargando: true, dias: {} };
  S.semPromesa = (async () => {
    let docs, coinc = { vinculadas: [], sugeridas: [] }, historial = [];
    try { docs = await Promise.all(fechas.map(f => leerDiaVivo(gid, f))); } catch (e) { docs = fechas.map(() => null); }
    try { coinc = await calcularCoincidencias(g, fechas); } catch (e) {}
    try { historial = await historialDe(gid); } catch (e) {}
    if (tk !== S.semToken) return;
    const dias = {};
    fechas.forEach((f, i) => { dias[f] = docs[i]; });
    S.sem = { lunes, gid, cargando: false, dias, coinc, historial };
    renderSemana();
  })();
  return S.semPromesa;
}
async function asegurarSemana() {
  if (!grupo()) return;
  if (!S.sem || S.sem.lunes !== S.lunes || S.sem.gid !== S.gid) await cargarSemana();
  else if (S.sem.cargando && S.semPromesa) await S.semPromesa;
}
let recargaSemT = null;
function recargarSemanaPronto() {
  clearTimeout(recargaSemT);
  recargaSemT = setTimeout(() => { if (S.vista === 'semana' && S.sem && !S.sem.cargando) cargarSemana(); }, 800);
}

function analizar(g, dias, fechas, coinc) {
  const lim = limiteMs(g), md = maxDia(g);
  const filas = new Map();
  const act = activos(g);
  (g.alumnos || []).forEach(a => {
    const i = act.indexOf(a);
    filas.set(a.id, { a, n: i >= 0 ? i + 1 : null, porDia: fechas.map(() => 0), salidas: 0, totalMs: 0, cerradas: 0, maxMs: 0, sinRegreso: 0, excedidas: 0, coinc: 0, lista: [] });
  });
  const porDia = fechas.map(f => ({ fecha: f, salidas: 0, totalMs: 0 }));
  fechas.forEach((f, di) => {
    salidasDe(dias[f], f).forEach(x => {
      const r = filas.get(x.alumnoId);
      if (!r) return;
      r.porDia[di]++; r.salidas++; r.lista.push(x);
      porDia[di].salidas++;
      if (x.fin) {
        const d = x.fin - x.inicio;
        r.totalMs += d; r.cerradas++; r.maxMs = Math.max(r.maxMs, d);
        if (d > lim) r.excedidas++;
        porDia[di].totalMs += d;
      } else if (f !== S.hoy) r.sinRegreso++;
    });
  });
  if (coinc) coinc.vinculadas.forEach(c => { [c.p.alumnoId, c.o.alumnoId].forEach(id => { const r = filas.get(id); if (r) r.coinc++; }); });
  const rows = [];
  filas.forEach(r => {
    if (r.a.baja && !r.salidas) return;
    r.promMs = r.cerradas ? r.totalMs / r.cerradas : 0;
    r.alertas = [];
    const diaPico = r.porDia.reduce((b, v, i) => (v > r.porDia[b] ? i : b), 0);
    const frecuente = r.porDia.some(v => v > md);
    const prolongado = r.maxMs > 2 * lim || (r.cerradas >= 2 && r.promMs > lim);
    if (r.a.permiso && (frecuente || prolongado)) r.alertas.push({ t: 'info', txt: 'Permiso especial', icon: ICON.escudo });
    else if (r.a.permiso) r.alertas.push({ t: 'info', txt: 'Permiso especial', icon: ICON.escudo, suave: true });
    else {
      if (frecuente) r.alertas.push({ t: 'warn', txt: `Frecuente: ${r.porDia[diaPico]} el ${DIAS[diaSem(fechas[diaPico])]}`, icon: ICON.alerta, cuenta: true });
      if (prolongado) r.alertas.push({ t: 'crit', txt: `Prolongado: máx. ${fMs(r.maxMs)}`, icon: ICON.reloj, cuenta: true });
    }
    if (r.coinc) r.alertas.push({ t: 'crit', txt: `${plural(r.coinc, 'coincidencia', 'coincidencias')} con vinculado`, icon: ICON.cadena, cuenta: true });
    if (r.sinRegreso) r.alertas.push({ t: 'neutral', txt: `${r.sinRegreso} sin regreso`, icon: ICON.pregunta, cuenta: !r.a.permiso });
    r.conAlerta = r.alertas.some(x => x.cuenta);
    rows.push(r);
  });
  const tot = rows.reduce((t, r) => { t.salidas += r.salidas; t.totalMs += r.totalMs; t.cerradas += r.cerradas; if (r.salidas) t.alumnos++; if (r.conAlerta) t.conAlerta++; return t; }, { salidas: 0, totalMs: 0, cerradas: 0, alumnos: 0, conAlerta: 0 });
  tot.promMs = tot.cerradas ? tot.totalMs / tot.cerradas : 0;
  const diaMax = porDia.reduce((b, d) => (!b || d.salidas > b.salidas ? d : b), null);
  return { rows, tot, porDia, diaMax: diaMax && diaMax.salidas ? diaMax : null, totalAlumnos: act.length };
}

function rangoTxt(f1, f5) {
  const a = parseFecha(f1), b = parseFecha(f5);
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} al ${b.getDate()} de ${MESES[b.getMonth()]}`;
  return `${a.getDate()} de ${MESES[a.getMonth()]} al ${b.getDate()} de ${MESES[b.getMonth()]}`;
}

function estadoSemana(fechas) {
  if (fechas[0] > S.hoy) return 'futura';
  if (fechas[4] > S.hoy) return 'en-curso';
  if (fechas[4] === S.hoy) return 'cierra-hoy';
  return 'cerrada';
}

function resumenTxt(A, fechas, coinc) {
  const est = estadoSemana(fechas);
  if (est === 'futura') return 'Esta semana todavía no empieza.';
  if (!A.tot.salidas) return est === 'cerrada' ? 'No hubo salidas registradas en esta semana.' : 'Todavía no hay salidas registradas esta semana.';
  let t = `De lunes a viernes ${est === 'en-curso' ? 'van' : 'hubo'} <b>${plural(A.tot.salidas, 'salida', 'salidas')}</b> al sanitario de ${plural(A.tot.alumnos, 'alumno', 'alumnos')}`;
  t += A.tot.cerradas ? `, con un promedio de <b>${fDur(A.tot.promMs)}</b> por salida.` : '.';
  if (A.diaMax) t += ` El día con más salidas fue el ${DIAS[diaSem(A.diaMax.fecha)]} (${A.diaMax.salidas}).`;
  t += A.tot.conAlerta ? ` <b>${A.tot.conAlerta === 1 ? 'Un alumno tiene' : A.tot.conAlerta + ' alumnos tienen'} alertas</b> para revisar.` : ' Ningún alumno tiene alertas.';
  if (coinc && coinc.vinculadas.length) t += ` Hubo <b>${plural(coinc.vinculadas.length, 'coincidencia', 'coincidencias')}</b> de alumnos vinculados fuera al mismo tiempo.`;
  if (est === 'en-curso') t += ' La semana sigue en curso; el reporte se completa el viernes.';
  return t;
}

function claseCelda(v) { return v <= 0 ? '' : v === 1 ? 'h1' : v === 2 ? 'h2' : v === 3 ? 'h3' : 'h4'; }

function ordenar(rows, orden = S.orden) {
  const r = rows.slice();
  const porNum = (a, b) => (a.n || 999) - (b.n || 999);
  if (orden === 'salidas') r.sort((a, b) => b.salidas - a.salidas || b.totalMs - a.totalMs || porNum(a, b));
  else if (orden === 'tiempo') r.sort((a, b) => b.totalMs - a.totalMs || b.salidas - a.salidas || porNum(a, b));
  else if (orden === 'alertas') r.sort((a, b) => (b.conAlerta - a.conAlerta) || b.salidas - a.salidas || porNum(a, b));
  else r.sort(porNum);
  return r;
}

function estadoReporte(gid, lunes) { const rep = (S.local && S.local.ajustes().reportes) || {}; return rep[gid + '|' + lunes] || {}; }

function llenarImpresion() {
  const g = grupo(), ph = $('#printHead'), pf = $('#printFirmas');
  if (!ph || !pf || !g) return;
  const fechas = semanaDe(S.lunes), e = S.escuela;
  const datos = [e.cct && 'CCT ' + e.cct, e.turno && 'Turno ' + e.turno.toLowerCase(), e.ciclo && 'Ciclo escolar ' + e.ciclo].filter(Boolean).join(' · ');
  ph.innerHTML = `${e.logo ? `<img src="${e.logo}" alt="">` : ''}<div class="ph-txt"><p class="ph-esc">${esc(e.nombre || 'Escuela')}</p>${datos ? `<p class="ph-datos">${esc(datos)}</p>` : ''}<h2>Reporte semanal de salidas al sanitario</h2><p class="ph-grupo">Grupo: <b>${esc(g.nombre)}</b> · Semana del ${rangoTxt(fechas[0], fechas[4])} de ${parseFecha(fechas[4]).getFullYear()}</p></div><p class="ph-fecha">Generado: ${fechaHumana(Date.now())}</p>`;
  const firmas = (e.firmas || []).filter(f => f && String(f).trim());
  pf.innerHTML = firmas.map(f => `<div class="firma"><span></span><b>${esc(f)}</b><small>Nombre y firma</small></div>`).join('');
}

function renderSemana() {
  if (S.vista !== 'semana') return;
  const body = $('#semBody');
  const fechas = semanaDe(S.lunes);
  $('#semTitulo').innerHTML = `Semana del ${rangoTxt(fechas[0], fechas[4])}<span class="sub">Reporte de lunes a viernes · ${parseFecha(fechas[4]).getFullYear()}</span>`;
  const esActual = S.lunes === lunesDe(S.hoy);
  $('#semHoy').hidden = esActual;
  $('#semNext').disabled = S.lunes >= lunesDe(S.hoy);
  const g = grupo();
  if (!S.grupos) { body.innerHTML = '<p class="skeleton">Cargando…</p>'; return; }
  if (!g) { body.innerHTML = estadoVacio('sin-grupos'); return; }
  if (!S.sem || S.sem.lunes !== S.lunes || S.sem.gid !== S.gid) { cargarSemana(); body.innerHTML = '<p class="skeleton">Preparando el reporte de la semana…</p>'; return; }
  if (S.sem.cargando) { body.innerHTML = '<p class="skeleton">Preparando el reporte de la semana…</p>'; return; }

  const coinc = S.sem.coinc || { vinculadas: [], sugeridas: [] };
  const A = analizar(g, S.sem.dias, fechas, coinc);
  S.ultimo = { A, fechas, g, coinc };
  const lim = limiteMs(g), md = maxDia(g);
  const mapa = mapaAlumnos();
  llenarImpresion();

  const kpis = `<div class="kpis">
    ${kpi(ICON.salir, A.tot.salidas, 'salidas en la semana')}
    ${kpi(ICON.reloj, fMin(A.tot.totalMs), 'tiempo total fuera del salón')}
    ${kpi(ICON.cron, A.tot.cerradas ? fMs(A.tot.promMs) : '–', 'promedio por salida (min:seg)')}
    ${kpi(ICON.alerta, `${A.tot.conAlerta}<small> de ${A.totalAlumnos}</small>`, 'alumnos con alertas', A.tot.conAlerta ? 'is-alert' : '')}
  </div>`;

  const maxS = Math.max(1, ...A.porDia.map(d => d.salidas));
  const chart = `<div class="panel"><div class="panel-head"><h3>Salidas por día</h3></div>
    <div class="chart" id="grafica">
      <div class="cols" role="list">${A.porDia.map(d => {
        const futuro = d.fecha > S.hoy;
        const tip = `${cap(fLargo(d.fecha))}: ${futuro ? 'aún no ocurre' : plural(d.salidas, 'salida', 'salidas') + ' · ' + fMin(d.totalMs) + ' fuera'}`;
        return `<div class="col${d.fecha === S.hoy ? ' is-today' : ''}" role="listitem" tabindex="0" data-tip="${esc(tip)}" aria-label="${esc(tip)}">
          <div class="col-plot"><span class="col-val${d.salidas ? '' : ' zero'}">${futuro ? '' : d.salidas}</span><span class="col-bar" style="--h:${Math.round(d.salidas / maxS * 100)}%"></span></div>
          <span class="col-day">${fCorto(d.fecha)}</span><span class="col-sub">${futuro ? '&nbsp;' : fMinCorto(d.totalMs)}</span>
        </div>`;
      }).join('')}</div>
    </div></div>`;

  const filas = ordenar(A.rows);
  const maxTot = Math.max(1, ...filas.map(r => r.totalMs));
  const head = `<div class="wk-head" aria-hidden="true"><span>#</span><span>Alumno</span><span class="h-days">${fechas.map(f => `<span>${DIAS_C[diaSem(f)]}</span>`).join('')}</span><span>Salidas</span><span>Tiempo total</span><span>Promedio</span><span>Más larga</span><span>Alertas</span></div>`;
  const tabla = filas.map(r => {
    const abierto = S.abierto === r.a.id;
    const celdas = r.porDia.map((v, i) => {
      const futuro = fechas[i] > S.hoy;
      const over = v > md && !r.a.permiso;
      return `<span class="cell ${claseCelda(v)}${over ? ' over' : ''}" title="${esc(cap(fLargo(fechas[i])) + ': ' + (futuro ? 'aún no ocurre' : plural(v, 'salida', 'salidas')))}">${futuro ? '' : v || '·'}</span>`;
    }).join('');
    const tags = r.alertas.filter(x => !x.suave || r.salidas).map(x => `<span class="tag ${x.t}">${x.icon}${esc(x.txt)}</span>`).join('');
    let detalle = '';
    if (abierto) {
      detalle = `<div class="wk-detail" id="det-${esc(r.a.id)}">${r.lista.length ? fechas.map(f => {
        const xs = r.lista.filter(x => x.fecha === f);
        if (!xs.length) return '';
        return `<div class="det-day"><h4>${esc(fLargo(f))}</h4>${xs.map(x => `<div class="det-item"><span>${fHora(x.inicio)} → ${x.fin ? fHora(x.fin) : '¿?'}</span><b>${x.fin ? fMs(x.fin - x.inicio) : (f === S.hoy ? 'fuera ahora' : 'sin regreso')}</b>${x.fin && x.fin - x.inicio > lim ? `<span class="tag ${x.fin - x.inicio > 2 * lim ? 'crit' : 'warn'}">${ICON.reloj}${x.fin - x.inicio > 2 * lim ? 'Más del doble del sugerido' : 'Pasó el tiempo sugerido'}</span>` : ''}</div>`).join('')}</div>`;
      }).join('') : '<p class="panel-empty">Sin salidas esta semana.</p>'}</div>`;
    }
    return `<div class="wk-row">
      <button type="button" class="wk-main" data-act="fila" data-id="${esc(r.a.id)}" aria-expanded="${abierto}">
        <span class="c-num">${r.n ? num2(r.n) : '–'}</span>
        <span class="c-name">${ICON.flecha}${fotoHtml(r.a.id, 'c-foto')}<span>${esc(r.a.nombre)}${r.a.baja ? ' <span class="muted">(baja)</span>' : ''}</span></span>
        <span class="c-days">${celdas}</span>
        <span class="c-stat c-sal"><span class="lbl">Salidas</span><span class="val">${r.salidas}</span></span>
        <span class="c-stat c-tot"><span class="lbl">Total</span><span class="val">${r.totalMs ? fMin(r.totalMs) : '–'}</span><span class="bar"><span style="width:${(r.totalMs / maxTot * 100).toFixed(1)}%"></span></span></span>
        <span class="c-stat c-prom"><span class="lbl">Prom.</span><span class="val">${r.cerradas ? fMs(r.promMs) : '–'}</span></span>
        <span class="c-stat c-max"><span class="lbl">Máx.</span><span class="val">${r.cerradas ? fMs(r.maxMs) : '–'}</span></span>
        <span class="c-al">${tags}</span>
      </button>${detalle}</div>`;
  }).join('');

  const leyenda = `<div class="legend" aria-hidden="true"><span>Salidas por día:</span>
    <span class="sw"><i class="cell">·</i>0</span><span class="sw"><i class="cell h1">1</i></span><span class="sw"><i class="cell h2">2</i></span><span class="sw"><i class="cell h3">3</i></span><span class="sw"><i class="cell h4">4+</i></span>
    <span class="sw"><i class="cell legend-over"></i>más de ${md} en un día</span></div>`;

  // Coincidencias entre alumnos
  const nom = id => { const P = mapa.get(id); return P ? `${esc(P.a.nombre)} <small>${esc(P.g.nombre)}</small>` : 'Alumno dado de baja'; };
  let coincHtml = '';
  if (coinc.vinculadas.length || coinc.sugeridas.length) {
    coincHtml = `<div class="panel" id="panelCoinc"><div class="panel-head"><h3>Coincidencias entre alumnos</h3></div>
      ${coinc.vinculadas.length ? `<p class="muted">Alumnos vinculados que estuvieron fuera al mismo tiempo.</p>
        <div class="tabla-wrap"><table class="tabla"><thead><tr><th>Día</th><th>Desde</th><th>Alumno</th><th>Con</th><th>Juntos</th></tr></thead><tbody>
        ${coinc.vinculadas.map(c => `<tr><td>${esc(fCorto(c.p.fecha))}</td><td>${fHora(c.desde)}</td><td>${nom(c.p.alumnoId)}</td><td>${nom(c.o.alumnoId)}</td><td class="mono">${fMs(c.ov)}</td></tr>`).join('')}
        </tbody></table></div>` : ''}
      ${coinc.sugeridas.length ? `<h4 class="sub-h">Posibles acuerdos</h4><p class="muted">Alumnos de salones distintos que coincidieron fuera ${UMBRAL_ACUERDO} veces o más esta semana sin estar vinculados.</p>
        <ul class="sug-lista">${coinc.sugeridas.map(s => `<li><span>${nom(s.p)} <span class="sug-con">y</span> ${nom(s.o)}</span><span class="tag warn">${ICON.alerta}${s.veces} veces · ${fMin(s.ms)} juntos</span>${S.puedeEscribir ? `<button class="btn" type="button" data-act="vinc-sugerido" data-a="${esc(s.p)}" data-b="${esc(s.o)}" data-veces="${s.veces}">${ICON.cadena}Vincular</button>` : ''}</li>`).join('')}</ul>` : ''}
    </div>`;
  }

  // Historial de reportes
  const hist = S.sem.historial || [];
  const histHtml = hist.length ? `<div class="panel no-print"><div class="panel-head"><h3>Reportes de semanas anteriores</h3></div><ul class="hist-lista">${hist.map(l => {
    const f = semanaDe(l), st = estadoReporte(g.id, l);
    const estado = st.descargado ? `Descargado el ${fechaHumana(st.descargado)}` : st.impreso ? `Impreso el ${fechaHumana(st.impreso)}` : 'Sin descargar';
    return `<li><div><b>Semana del ${rangoTxt(f[0], f[4])}</b><span class="${st.descargado || st.impreso ? 'muted' : 'pend'}">${estado}</span></div><div class="acts"><button class="btn ghost" type="button" data-act="hist-ver" data-lunes="${l}">Ver</button><button class="btn" type="button" data-act="hist-pdf" data-lunes="${l}">${ICON.descargar}PDF</button></div></li>`;
  }).join('')}</ul></div>` : '';

  let recordatorio = '';
  if (!enNube()) {
    const ultResp = S.local.ajustes().ultimoRespaldo;
    if (S.local.resumen().dias > 0 && (!ultResp || diasDesde(ultResp) >= 7)) recordatorio = `<div class="notice soft no-print"><p>${ultResp ? `Tu último respaldo fue hace ${plural(diasDesde(ultResp), 'día', 'días')}.` : 'Aún no has respaldado tus registros.'} Guarda una copia para no perderlos si se borra el navegador o cambias de dispositivo.</p><button class="btn" type="button" data-act="respaldo-descargar">${ICON.descargar}Descargar respaldo</button></div>`;
  }

  body.innerHTML = `${recordatorio}<p class="summary">${resumenTxt(A, fechas, coinc)}</p>
    ${kpis}
    ${chart}
    <div class="panel">
      <div class="panel-head"><h3>Por alumno</h3>
        <label for="ordenSem" class="no-print">Ordenar
          <span class="select"><select id="ordenSem">
            <option value="lista"${S.orden === 'lista' ? ' selected' : ''}>Número de lista</option>
            <option value="salidas"${S.orden === 'salidas' ? ' selected' : ''}>Más salidas</option>
            <option value="tiempo"${S.orden === 'tiempo' ? ' selected' : ''}>Más tiempo fuera</option>
            <option value="alertas"${S.orden === 'alertas' ? ' selected' : ''}>Con alertas primero</option>
          </select>${CHEVRON}</span>
        </label>
      </div>
      <div class="wk">${head}${tabla || '<p class="panel-empty">Este grupo no tiene alumnos.</p>'}</div>
      ${leyenda}
      <p class="note">Tiempo sugerido por salida: ${clamp(g.limiteMin, 1, 60, 5)} min. Las alertas son solo una guía para dar seguimiento. Ir al sanitario es un derecho y una salida frecuente o larga puede tener una causa de salud: antes de tomar cualquier medida, platica con el alumno y, si hace falta, con su familia o con orientación. En <b>Ajustes</b> puedes marcar «Permiso especial» para quien tenga indicación médica.</p>
      <div id="copiaFallback"></div>
    </div>
    ${coincHtml}
    ${histHtml}`;
}

/* --- Información emergente de la gráfica --- */
function mostrarTip(col) {
  const chart = col.closest('.chart');
  if (!chart) return;
  let tip = $('.tip', chart);
  if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; chart.appendChild(tip); }
  tip.textContent = col.dataset.tip;
  const cr = chart.getBoundingClientRect(), r = col.getBoundingClientRect();
  const bar = $('.col-val', col).getBoundingClientRect();
  let x = r.left - cr.left + r.width / 2;
  tip.style.left = x + 'px';
  tip.style.top = (bar.top - cr.top - 6) + 'px';
  const tw = tip.offsetWidth;
  x = Math.min(Math.max(x, tw / 2), cr.width - tw / 2);
  tip.style.left = x + 'px';
}
function ocultarTip() { const t = $('.tip'); if (t) t.remove(); }

/* --- Archivos --- */
const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const esApp = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
let avisoInstalar = null;

// Entrega un archivo al usuario: descarga normal, o el menú Compartir en iPad/iPhone con la app instalada.
async function entregarArchivo(nombre, contenido, tipo) {
  const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo });
  if (esIOS && esApp() && navigator.canShare) {
    try {
      const f = new File([blob], nombre, { type: tipo });
      if (navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: nombre }); return true; }
    } catch (e) { if (e && e.name === 'AbortError') return false; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
  return true;
}

function tablaSemana(sep) {
  if (!S.ultimo) return '';
  const { A, fechas, g } = S.ultimo;
  const q = v => { const s = String(v == null ? '' : v); return sep === ',' && /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s.replace(/[\t\n]/g, ' '); };
  const min = ms => (ms / 60000).toFixed(1);
  const L = [];
  L.push([S.escuela.nombre || 'Escuela', `Grupo: ${g.nombre}`, `Semana del ${rangoTxt(fechas[0], fechas[4])} de ${parseFecha(fechas[4]).getFullYear()}`].map(q).join(sep));
  L.push('');
  L.push(['Número', 'Alumno', ...fechas.map(f => cap(fLargo(f))), 'Total de salidas', 'Tiempo total (min)', 'Promedio por salida (min)', 'Salida más larga (min)', 'Sin regreso', 'Alertas', 'Permiso especial'].map(q).join(sep));
  ordenar(A.rows).forEach(r => {
    L.push([r.n || '', r.a.nombre, ...r.porDia, r.salidas, min(r.totalMs), r.cerradas ? min(r.promMs) : '', r.cerradas ? min(r.maxMs) : '', r.sinRegreso, r.alertas.filter(x => x.cuenta).map(x => x.txt).join('; '), r.a.permiso ? 'Sí' : 'No'].map(q).join(sep));
  });
  L.push('');
  L.push(['Detalle de salidas'].map(q).join(sep));
  L.push(['Fecha', 'Número', 'Alumno', 'Salida', 'Regreso', 'Duración (min)'].map(q).join(sep));
  const todas = [];
  A.rows.forEach(r => r.lista.forEach(x => todas.push({ r, x })));
  todas.sort((p, z) => p.x.inicio - z.x.inicio).forEach(({ r, x }) => {
    L.push([x.fecha, r.n || '', r.a.nombre, fHora(x.inicio), x.fin ? fHora(x.fin) : 'Sin regreso', x.fin ? min(x.fin - x.inicio) : ''].map(q).join(sep));
  });
  return L.join('\n');
}

async function descargarCsv() {
  if (!S.ultimo) return;
  try {
    const ok = await entregarArchivo(`salidas-sanitario-${slug(S.ultimo.g.nombre)}-${S.ultimo.fechas[0]}.csv`, '﻿' + tablaSemana(','), 'text/csv;charset=utf-8');
    if (ok) aviso('Archivo CSV listo. Ábrelo con Excel o Google Hojas de cálculo.');
  } catch (e) {
    aviso('No se pudo descargar el archivo. Usa «Copiar para Excel».', { error: true });
  }
}

function copiarTabla() {
  if (!S.ultimo) return;
  const txt = tablaSemana('\t');
  const fallback = () => {
    const box = $('#copiaFallback');
    if (!box) return;
    box.innerHTML = '<p class="note" style="margin-top:12px">No se pudo copiar automáticamente. Selecciona el texto y cópialo:</p><textarea class="copy-fallback" id="copiaTexto" readonly></textarea>';
    const ta = $('#copiaTexto'); ta.value = txt; ta.focus(); ta.select();
  };
  try {
    const p = navigator.clipboard && navigator.clipboard.writeText(txt);
    if (!p) { fallback(); return; }
    p.then(() => aviso('Tabla copiada. Pégala en Excel o en Hojas de cálculo.'), fallback);
  } catch (e) { fallback(); }
}

/* --- Reporte en PDF --- */
function cargarScript(src) {
  return new Promise((ok, mal) => {
    if (document.querySelector(`script[src="${src}"]`)) { ok(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = () => ok(); s.onerror = () => { s.remove(); mal(new Error('No cargó ' + src)); };
    document.head.appendChild(s);
  });
}
async function cargarJsPdf() {
  if (!(window.jspdf && window.jspdf.jsPDF)) await cargarScript(JSPDF_URL);
  if (!window.jspdf.jsPDF.API.autoTable) await cargarScript(AUTOTABLE_URL);
  return window.jspdf.jsPDF;
}

async function datosReporte(gid, lunes) {
  const g = (S.todos || []).find(x => x.id === gid);
  if (!g) return null;
  const fechas = semanaDe(lunes);
  const docs = await Promise.all(fechas.map(f => leerDiaVivo(gid, f)));
  const dias = {}; fechas.forEach((f, i) => { dias[f] = docs[i]; });
  let coinc = { vinculadas: [], sugeridas: [] };
  try { coinc = await calcularCoincidencias(g, fechas); } catch (e) {}
  return { g, fechas, A: analizar(g, dias, fechas, coinc), coinc };
}

async function marcarReporte(gid, lunes, campo) {
  const rep = S.local.ajustes().reportes || {};
  const k = gid + '|' + lunes;
  rep[k] = Object.assign({}, rep[k], { [campo]: Date.now() });
  try { await S.local.guardarAjustes({ reportes: rep }); } catch (e) {}
}

let generandoPdf = false;
async function generarPdf(gid, lunes) {
  if (generandoPdf) return false;
  generandoPdf = true;
  aviso('Preparando el PDF…');
  try {
    const R = await datosReporte(gid, lunes);
    if (!R) { aviso('No se encontró el grupo.', { error: true }); return false; }
    let jsPDF;
    try { jsPDF = await cargarJsPdf(); } catch (e) { aviso('Para crear el PDF la primera vez se necesita internet. Mientras tanto usa «Imprimir» y elige «Guardar como PDF».', { error: true }); return false; }
    const { g, fechas, A, coinc } = R;
    const e = S.escuela, mapa = mapaAlumnos(), md = maxDia(g), t = pdfTxt;
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 14;
    const VERDE = [28, 74, 62], TINTA = [20, 35, 30], GRIS = [95, 110, 104];
    const anio = parseFecha(fechas[4]).getFullYear(), rango = rangoTxt(fechas[0], fechas[4]);
    let y = M, x0 = M;

    if (e.logo) {
      try {
        const props = doc.getImageProperties(e.logo);
        const h = 20, w = Math.min(34, h * props.width / props.height);
        doc.addImage(e.logo, e.logo.startsWith('data:image/png') ? 'PNG' : 'JPEG', M, y, w, h);
        x0 = M + w + 5;
      } catch (err) {}
    }
    doc.setTextColor(...TINTA); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text(t(e.nombre || 'Escuela'), x0, y + 5);
    const datosEsc = [e.cct && 'CCT ' + e.cct, e.turno && 'Turno ' + e.turno.toLowerCase(), e.ciclo && 'Ciclo escolar ' + e.ciclo].filter(Boolean).join('   ·   ');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
    if (datosEsc) doc.text(t(datosEsc), x0, y + 10);
    doc.setTextColor(...VERDE); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text(t('Reporte semanal de salidas al sanitario'), x0, y + 16.5);
    doc.setTextColor(...TINTA); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
    doc.text(t(`Grupo: ${g.nombre}     Semana del ${rango} de ${anio}`), x0, y + 21.5);
    y += 27;
    doc.setDrawColor(...VERDE); doc.setLineWidth(0.6); doc.line(M, y, W - M, y);
    y += 6;

    doc.setFontSize(10); doc.setTextColor(...TINTA);
    const lineas = doc.splitTextToSize(t(resumenTxt(A, fechas, coinc).replace(/<[^>]+>/g, '')), W - 2 * M);
    doc.text(lineas, M, y);
    y += lineas.length * 4.6 + 3;

    const kp = [[String(A.tot.salidas), 'salidas en la semana'], [fMin(A.tot.totalMs), 'tiempo total fuera del salón'], [A.tot.cerradas ? fMs(A.tot.promMs) : '-', 'promedio por salida (min:seg)'], [`${A.tot.conAlerta} de ${A.totalAlumnos}`, 'alumnos con alertas']];
    const bw = (W - 2 * M - 12) / 4;
    kp.forEach(([v, l], i) => {
      const bx = M + i * (bw + 4);
      doc.setFillColor(237, 241, 238); doc.roundedRect(bx, y, bw, 16, 2, 2, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...(i === 3 && A.tot.conAlerta ? [195, 54, 46] : TINTA));
      doc.text(t(v), bx + 4, y + 7);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GRIS);
      doc.text(t(l), bx + 4, y + 12.5);
    });
    y += 22;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...TINTA);
    doc.text(t('Salidas por día'), M, y); y += 3;
    const ch = 30, cw = W - 2 * M, colW = cw / 5, maxS = Math.max(1, ...A.porDia.map(d => d.salidas));
    doc.setDrawColor(215, 222, 218); doc.setLineWidth(0.2);
    [0.5, 1].forEach(k => doc.line(M, y + ch - (ch - 6) * k, M + cw, y + ch - (ch - 6) * k));
    A.porDia.forEach((d, i) => {
      const futuro = d.fecha > S.hoy;
      const bh = d.salidas / maxS * (ch - 6), bx = M + i * colW + colW * 0.3, bwd = colW * 0.4;
      if (bh > 0) { doc.setFillColor(...VERDE); doc.rect(bx, y + ch - bh, bwd, bh, 'F'); }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...TINTA);
      if (!futuro) doc.text(String(d.salidas), bx + bwd / 2, y + ch - bh - 1.5, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRIS);
      doc.text(t(fCorto(d.fecha) + (futuro ? '' : '  ·  ' + fMinCorto(d.totalMs))), bx + bwd / 2, y + ch + 4.5, { align: 'center' });
    });
    doc.setDrawColor(150, 160, 155); doc.setLineWidth(0.4); doc.line(M, y + ch, M + cw, y + ch);
    y += ch + 10;

    const filas = ordenar(A.rows, 'lista');
    doc.autoTable({
      startY: y, margin: { left: M, right: M, bottom: 18 },
      head: [['#', 'Alumno', ...fechas.map(f => t(DIAS_C[diaSem(f)])), 'Salidas', 'Total', 'Prom.', t('Máx.'), 'Alertas']],
      body: filas.map(r => [r.n ? num2(r.n) : '-', t(r.a.nombre + (r.a.baja ? ' (baja)' : '')), ...r.porDia.map((v, i) => (fechas[i] > S.hoy ? '' : String(v || '·'))), String(r.salidas), r.totalMs ? t(fMin(r.totalMs)) : '-', r.cerradas ? fMs(r.promMs) : '-', r.cerradas ? fMs(r.maxMs) : '-', t(r.alertas.filter(x => x.cuenta || (x.t === 'info' && r.salidas)).map(x => x.txt).join('; '))]),
      styles: { font: 'helvetica', fontSize: 7.8, cellPadding: 1.6, textColor: TINTA, lineColor: [215, 222, 218], lineWidth: 0.1, valign: 'middle' },
      headStyles: { fillColor: VERDE, textColor: 255, fontStyle: 'bold', halign: 'center' },
      alternateRowStyles: { fillColor: [247, 249, 248] },
      columnStyles: { 0: { halign: 'center', cellWidth: 8 }, 1: { cellWidth: 46 }, 2: { halign: 'center', cellWidth: 9 }, 3: { halign: 'center', cellWidth: 9 }, 4: { halign: 'center', cellWidth: 9 }, 5: { halign: 'center', cellWidth: 9 }, 6: { halign: 'center', cellWidth: 9 }, 7: { halign: 'center', cellWidth: 13 }, 8: { cellWidth: 17 }, 9: { halign: 'center', cellWidth: 12 }, 10: { halign: 'center', cellWidth: 12 }, 11: { cellWidth: 'auto', fontSize: 7 } },
      didParseCell: data => {
        if (data.section !== 'body' || data.column.index < 2 || data.column.index > 6) return;
        const r = filas[data.row.index], v = r.porDia[data.column.index - 2];
        if (v > md && !r.a.permiso) { data.cell.styles.fillColor = [253, 226, 204]; data.cell.styles.fontStyle = 'bold'; }
      }
    });
    y = doc.lastAutoTable.finalY + 7;

    const nom = id => { const P = mapa.get(id); return P ? t(`${P.a.nombre} (${P.g.nombre})`) : 'Alumno dado de baja'; };
    if (coinc.vinculadas.length || coinc.sugeridas.length) {
      if (y > H - 50) { doc.addPage(); y = M; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...TINTA);
      doc.text(t('Coincidencias entre alumnos'), M, y); y += 2;
      if (coinc.vinculadas.length) {
        doc.autoTable({
          startY: y + 1, margin: { left: M, right: M, bottom: 18 },
          head: [[t('Día'), 'Desde', 'Alumno', 'Coincidió con (vinculado)', 'Juntos']],
          body: coinc.vinculadas.map(c => [t(fCorto(c.p.fecha)), t(fHora(c.desde)), nom(c.p.alumnoId), nom(c.o.alumnoId), fMs(c.ov)]),
          styles: { font: 'helvetica', fontSize: 7.8, cellPadding: 1.6, textColor: TINTA, lineColor: [215, 222, 218], lineWidth: 0.1 },
          headStyles: { fillColor: [195, 54, 46], textColor: 255, fontStyle: 'bold' }
        });
        y = doc.lastAutoTable.finalY + 5;
      }
      if (coinc.sugeridas.length) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
        doc.text(t(`Posibles acuerdos: alumnos de salones distintos que coincidieron fuera ${UMBRAL_ACUERDO} veces o más sin estar vinculados.`), M, y + 2);
        doc.autoTable({
          startY: y + 4, margin: { left: M, right: M, bottom: 18 },
          head: [['Alumno', 'Con', 'Veces', 'Tiempo juntos']],
          body: coinc.sugeridas.map(s => [nom(s.p), nom(s.o), String(s.veces), t(fMin(s.ms))]),
          styles: { font: 'helvetica', fontSize: 7.8, cellPadding: 1.6, textColor: TINTA, lineColor: [215, 222, 218], lineWidth: 0.1 },
          headStyles: { fillColor: [239, 139, 61], textColor: 255, fontStyle: 'bold' }
        });
        y = doc.lastAutoTable.finalY + 6;
      }
    }

    if (y > H - 60) { doc.addPage(); y = M; }
    doc.setFont('helvetica', 'italic'); doc.setFontSize(7.8); doc.setTextColor(...GRIS);
    const nota = doc.splitTextToSize(t(`Tiempo sugerido por salida: ${clamp(g.limiteMin, 1, 60, 5)} min. Alerta con más de ${md} salidas en un día. Las alertas son una guía para dar seguimiento: ir al sanitario es un derecho y una salida frecuente o larga puede tener una causa de salud. Antes de tomar cualquier medida, conviene platicar con el alumno y, si hace falta, con su familia o con orientación.`), W - 2 * M);
    doc.text(nota, M, y);
    y += nota.length * 3.6;

    const firmas = (e.firmas || []).filter(f => f && String(f).trim());
    if (firmas.length) {
      let yF = Math.max(y + 24, H - 36);
      if (yF > H - 22) { doc.addPage(); yF = H - 60; }
      const gap = 12, fw = (W - 2 * M - gap * (firmas.length - 1)) / firmas.length;
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...TINTA); doc.setDrawColor(...TINTA); doc.setLineWidth(0.3);
      firmas.forEach((f, i) => {
        const fx = M + i * (fw + gap);
        doc.line(fx + 4, yF, fx + fw - 4, yF);
        doc.setFontSize(8.5); doc.text(t(f), fx + fw / 2, yF + 4.5, { align: 'center' });
        doc.setFontSize(7); doc.setTextColor(...GRIS); doc.text('Nombre y firma', fx + fw / 2, yF + 8.5, { align: 'center' }); doc.setTextColor(...TINTA);
      });
    }

    const n = doc.getNumberOfPages(), generado = fechaHumana(Date.now());
    for (let p = 1; p <= n; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GRIS);
      doc.text(t(`Pase al Baño · ${g.nombre} · Semana del ${rango} de ${anio} · Generado el ${generado}`), M, H - 8);
      doc.text(`Página ${p} de ${n}`, W - M, H - 8, { align: 'right' });
    }

    const ok = await entregarArchivo(`reporte-semanal-${slug(g.nombre)}-${lunes}.pdf`, doc.output('blob'), 'application/pdf');
    if (ok) {
      await marcarReporte(gid, lunes, 'descargado');
      aviso('Reporte PDF listo.');
      if (S.vista === 'semana') renderSemana();
    }
    return ok;
  } catch (err) {
    aviso('No se pudo crear el PDF. Intenta con «Imprimir» y elige «Guardar como PDF».', { error: true });
    return false;
  } finally { generandoPdf = false; }
}

async function imprimirReporte(gid, lunes) {
  if (gid !== S.gid) cambiarGrupo(gid);
  S.lunes = lunes; S.abierto = null;
  irA('semana', true);
  await asegurarSemana();
  renderSemana();
  await marcarReporte(gid, lunes, 'impreso');
  setTimeout(() => { try { window.print(); } catch (e) { aviso('Este navegador no permite imprimir desde la app.', { error: true }); } }, 350);
}

/* --- Aviso automático del viernes --- */
async function pendientesReporte() {
  if (!S.store || !S.grupos || !S.grupos.length) return [];
  const [hh, mm] = String(S.escuela.horaReporte || '13:00').split(':').map(Number);
  const ahora = new Date(), ds = ahora.getDay();
  const corte = new Date(); corte.setHours(hh || 13, mm || 0, 0, 0);
  const lunes = (ds === 5 && ahora >= corte) || ds === 6 || ds === 0 ? lunesDe(S.hoy) : addDias(lunesDe(S.hoy), -7);
  const rep = S.local.ajustes().reportes || {};
  const fechas = semanaDe(lunes), out = [];
  for (const g of gruposReporte()) {
    const st = rep[g.id + '|' + lunes] || {};
    if (st.descargado || st.impreso) continue;
    if (st.pospuesto && Date.now() - st.pospuesto < 2 * 3600000) continue;
    const docs = await Promise.all(fechas.map(f => leerDiaVivo(g.id, f)));
    const n = docs.reduce((t, d, i) => t + salidasDe(d, fechas[i]).length, 0);
    if (n) out.push({ g, lunes, n });
  }
  return out;
}

let revisandoReportes = false;
async function revisarReportes() {
  if (revisandoReportes || S.modal || !S.local) return;
  revisandoReportes = true;
  try {
    const p = await pendientesReporte();
    if (p.length && !S.modal) {
      S.modal = { tipo: 'reporte', pendientes: p };
      renderModal();
      sonar(false);
      notificar('Reporte semanal listo', p.map(x => x.g.nombre).join(', '));
    }
  } catch (e) {} finally { revisandoReportes = false; }
}
let revisarT = null;
function revisarReportesPronto() { clearTimeout(revisarT); revisarT = setTimeout(revisarReportes, 1500); }

async function posponerReportes() {
  const m = S.modal;
  if (!m || m.tipo !== 'reporte') return;
  const rep = S.local.ajustes().reportes || {};
  m.pendientes.forEach(p => { const k = p.g.id + '|' + p.lunes; rep[k] = Object.assign({}, rep[k], { pospuesto: Date.now() }); });
  try { await S.local.guardarAjustes({ reportes: rep }); } catch (e) {}
  cerrarModal();
  aviso('Te lo recordamos en dos horas.');
}

/* ================= Imágenes (fotos y logotipo) ================= */
async function procesarImagen(archivo, { lado = 200, cuadrado = true, max = 320, tipo = 'image/jpeg', calidad = 0.8 } = {}) {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => mal(new Error('imagen')); i.src = url; });
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight, dw, dh;
    if (cuadrado) {
      const m = Math.min(sw, sh);
      sx = (sw - m) / 2;
      sy = sh > sw ? (sh - m) * 0.3 : (sh - m) / 2;   // en fotos verticales, la cara suele estar arriba
      sw = sh = m; dw = dh = lado;
    } else {
      const k = Math.min(1, max / Math.max(sw, sh));
      dw = Math.round(sw * k); dh = Math.round(sh * k);
    }
    const c = document.createElement('canvas');
    c.width = dw; c.height = dh;
    const ctx = c.getContext('2d');
    if (tipo === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, dw, dh); }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
    return c.toDataURL(tipo, calidad);
  } finally { URL.revokeObjectURL(url); }
}

async function recibirImagen(archivo) {
  const d = S.destinoImagen;
  S.destinoImagen = null;
  if (!archivo || !d) return;
  if (!/^image\//.test(archivo.type || 'image/')) { aviso('Elige una imagen (JPG o PNG).', { error: true }); return; }
  try {
    if (d.tipo === 'foto') {
      const data = await procesarImagen(archivo, { lado: 200, cuadrado: true });
      await S.store.guardarFoto(d.id, d.gid, data);
      aviso('Foto guardada.');
    } else if (d.tipo === 'logo') {
      const data = await procesarImagen(archivo, { cuadrado: false, max: 320, tipo: 'image/png' });
      await guardarEscuelaParcial({ logo: data });
      aviso('Logotipo guardado.');
    }
  } catch (e) { aviso('No se pudo usar esa imagen. Prueba con otra.', { error: true }); }
}

async function guardarEscuelaParcial(p) {
  if (S.escBorrador) Object.assign(S.escBorrador, p);
  try { await S.store.guardarEscuela(p); } catch (e) { errorGuardar(e); }
  renderEscuela();
}

/* ================= Vista: Ajustes ================= */
function renderAjustes() {
  if (S.vista !== 'grupos') return;
  $('#btnNuevo').hidden = !S.puedeEscribir;
  renderGruposLista();
  renderEscuela();
  renderVinculos();
  renderSeguridad();
  renderConexion();
  renderRespaldo();
  renderEditor();
}

function renderGruposLista() {
  const ul = $('#listaGrupos');
  if (S.grupos === null) ul.innerHTML = '<li class="skeleton">Cargando…</li>';
  else if (!S.grupos.length) ul.innerHTML = '<li class="panel-empty">Aún no hay grupos. Crea uno con «Nuevo grupo».</li>';
  else ul.innerHTML = S.grupos.map(g => {
    const actual = g.id === S.gid;
    return `<li class="group-item${actual ? ' is-current' : ''}">
      <div><h4>${esc(g.nombre || 'Grupo sin nombre')}</h4><p>${plural(activos(g).length, 'alumno', 'alumnos')} · ${clamp(g.limiteMin, 1, 60, 5)} min sugeridos · alerta con más de ${maxDia(g)} salidas al día</p></div>
      <div class="acts">${actual ? '<span class="tag info">En uso</span>' : `<button class="btn" type="button" data-act="usar-grupo" data-id="${esc(g.id)}">Usar</button>`}
      ${S.puedeEscribir ? `<button class="btn" type="button" data-act="editar-grupo" data-id="${esc(g.id)}">Editar</button>` : ''}</div>
    </li>`;
  }).join('');
}

function renderEscuela() {
  const el = $('#panelEscuela');
  if (!el || S.vista !== 'grupos') return;
  const e = S.escBorrador || S.escuela, ed = puedeEditarEscuela(), dis = ed ? '' : ' disabled';
  const firmas = (e.firmas || []).concat(['', '', '']).slice(0, 3);
  el.innerHTML = `
    <div class="panel-head"><h3>Escuela</h3></div>
    <div class="logo-fila">
      <div class="logo-prev">${e.logo ? `<img src="${e.logo}" alt="Logotipo de la escuela">` : `<svg viewBox="0 0 44 44" aria-hidden="true"><rect class="logo-pass" x="4" y="10" width="36" height="24" rx="6"/><circle class="logo-hole" cx="12.5" cy="22" r="3.2" style="fill:var(--surface)"/><path class="logo-line" d="M20 17.5h13M20 22h9M20 26.5h11"/></svg>`}</div>
      <div>
        <p class="muted" style="margin:0 0 8px">El logotipo aparece en la barra y en el reporte impreso. Usa una imagen PNG o JPG.</p>
        ${ed ? `<div class="form-actions"><button class="btn" type="button" data-act="logo-cambiar">${ICON.camara}${e.logo ? 'Cambiar logotipo' : 'Subir logotipo'}</button>${e.logo ? '<button class="btn ghost" type="button" data-act="logo-quitar">Quitar</button>' : ''}</div>` : ''}
      </div>
    </div>
    <div class="row2" style="margin-top:14px">
      <label class="field" for="eNombre">Nombre de la escuela<input id="eNombre" data-esc="nombre" value="${esc(e.nombre)}" placeholder="Ej. Escuela Secundaria Técnica No. 12" maxlength="120"${dis}></label>
      <label class="field" for="eCct">CCT (Clave de Centro de Trabajo)<input id="eCct" data-esc="cct" value="${esc(e.cct)}" placeholder="Ej. 09DST0012X" maxlength="20" autocapitalize="characters"${dis}></label>
      <label class="field" for="eTurno">Turno<span class="select"><select id="eTurno" data-esc="turno"${dis}><option value="">Sin indicar</option>${TURNOS.map(x => `<option${e.turno === x ? ' selected' : ''}>${x}</option>`).join('')}</select>${CHEVRON}</span></label>
      <label class="field" for="eCiclo">Ciclo escolar<input id="eCiclo" data-esc="ciclo" value="${esc(e.ciclo)}" placeholder="${cicloActual()}" maxlength="20"${dis}></label>
      <label class="field" for="eHora">Hora del aviso del viernes<input id="eHora" data-esc="horaReporte" type="time" value="${esc(e.horaReporte || '13:00')}"${dis}><small>A esa hora aparece el aviso para descargar o imprimir el reporte.</small></label>
      <label class="field check" for="eFotos"><span><input id="eFotos" data-esc="fotos" type="checkbox"${e.fotos !== false ? ' checked' : ''}${dis}> Mostrar fotos de los alumnos</span><small>Si la escuela no tiene autorización de las familias, desactívalo.</small></label>
    </div>
    <fieldset style="margin-top:14px"><legend>Firmas al pie del reporte</legend>
      <div class="row2">${firmas.map((f, i) => `<label class="field" for="eFirma${i}">Firma ${i + 1}<input id="eFirma${i}" data-esc="firma${i}" value="${esc(f)}" placeholder="${i === 2 ? 'Opcional (ej. Prefectura)' : ''}" maxlength="60"${dis}></label>`).join('')}</div>
    </fieldset>
    ${ed ? `<div class="form-actions" style="margin-top:14px"><button class="btn primary" type="button" data-act="escuela-guardar">Guardar datos de la escuela</button></div>` : '<p class="muted" style="margin-top:12px">Solo dirección puede cambiar estos datos.</p>'}`;
}

function renderVinculos() {
  const el = $('#panelVinculos');
  if (!el || S.vista !== 'grupos') return;
  const mapa = mapaAlumnos();
  const persona = P => `<span class="persona">${fotoHtml(P.a.id, 'persona-foto') || `<span class="persona-ini">${esc(iniciales(P.a.nombre))}</span>`}<span><b>${esc(P.a.nombre)}</b><small>${esc(P.g.nombre)}</small></span></span>`;
  const filas = S.vinculos.map(v => {
    const A = mapa.get(v.a), B = mapa.get(v.b);
    if (!A || !B) return '';
    return `<li class="vinc-row"><div class="vinc-par">${persona(A)}<span class="vinc-ic">${ICON.cadena}</span>${persona(B)}</div>${v.nota ? `<p class="muted">${esc(v.nota)}</p>` : ''}${S.puedeEscribir ? `<button class="link-btn danger" type="button" data-act="vinc-quitar" data-id="${esc(v.id)}">Quitar vínculo</button>` : ''}</li>`;
  }).join('');
  const opciones = sel => (S.todos || []).map(g => `<optgroup label="${esc(g.nombre)}">${activos(g).map(a => `<option value="${esc(a.id)}"${sel === a.id ? ' selected' : ''}>${esc(a.nombre)}</option>`).join('')}</optgroup>`).join('');
  el.innerHTML = `
    <div class="panel-head"><h3>Alumnos vinculados</h3></div>
    <p class="muted">Vincula a dos alumnos, aunque sean de salones distintos. Si los dos están fuera al mismo tiempo, la app avisa con sonido en ${enNube() ? 'los equipos de ambos salones' : 'este equipo'} y lo anota en el reporte semanal.</p>
    ${filas ? `<ul class="vinc-lista">${filas}</ul>` : '<p class="panel-empty">Todavía no hay alumnos vinculados.</p>'}
    ${S.puedeEscribir ? `<div class="vinc-form">
      <label class="field" for="vA">Alumno<span class="select"><select id="vA" data-vinc="a"><option value="">Elige un alumno</option>${opciones(S.vincForm.a)}</select>${CHEVRON}</span></label>
      <label class="field" for="vB">Vincular con<span class="select"><select id="vB" data-vinc="b"><option value="">Elige otro alumno</option>${opciones(S.vincForm.b)}</select>${CHEVRON}</span></label>
      <label class="field" for="vNota">Motivo (opcional)<input id="vNota" data-vinc="nota" maxlength="120" placeholder="Ej. salen juntos con frecuencia" value="${esc(S.vincForm.nota)}"></label>
      <div class="form-actions"><button class="btn primary" type="button" data-act="vinc-crear">${ICON.cadena}Vincular</button></div>
    </div>` : ''}`;
}

function renderSeguridad() {
  const el = $('#panelSeguridad');
  if (!el || S.vista !== 'grupos') return;
  const pin = S.pinActivo;
  const notif = !('Notification' in window) ? 'no' : Notification.permission;
  const formPin = (!pin || S.cambiandoPin) ? `
    <div class="row2">
      <label class="field" for="pin1">${pin ? 'Nuevo PIN' : 'PIN'} (4 a 6 números)<input id="pin1" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></label>
      <label class="field" for="pin2">Repite el PIN<input id="pin2" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></label>
    </div>
    <div class="form-actions"><button class="btn primary" type="button" data-act="pin-guardar">Guardar PIN</button>${S.cambiandoPin ? '<button class="btn ghost" type="button" data-act="pin-cancelar-cambio">Cancelar</button>' : ''}</div>` : '';
  el.innerHTML = `
    <div class="panel-head"><h3>PIN del maestro</h3></div>
    ${pin ? `<p class="ok-line">${ICON.check}El PIN está activo en este equipo.</p>
      <p class="muted" style="margin-top:8px">Al bloquear, los alumnos solo ven la Lista. La app también se bloquea sola después de 3 minutos sin uso.</p>
      ${S.cambiandoPin ? '' : `<div class="form-actions"><button class="btn primary" type="button" data-act="bloquear">${ICON.candado}Bloquear ahora</button><button class="btn ghost" type="button" data-act="pin-cambiar">Cambiar PIN</button><button class="btn danger" type="button" data-act="pin-quitar">Quitar PIN</button></div>`}`
      : '<p class="muted">Con un PIN, la tablet del salón solo muestra la Lista hasta que el maestro la desbloquea. Así los alumnos no pueden cambiar de grupo, borrar registros ni ver reportes.</p>'}
    ${formPin}
    ${S.errorPin ? `<p class="form-error" role="alert" style="margin-top:10px">${esc(S.errorPin)}</p>` : ''}
    ${S.codigoRecuperacion ? `<div class="import-box" role="alert"><p><b>Anota este código de recuperación:</b></p><p class="codigo">${esc(S.codigoRecuperacion)}</p><p class="muted" style="margin:0">Si olvidas el PIN, con este código puedes quitarlo. No se volverá a mostrar.</p><div class="form-actions"><button class="btn" type="button" data-act="codigo-ok">Ya lo anoté</button></div></div>` : ''}
    <div class="panel-head" style="margin-top:22px"><h3>Avisos</h3></div>
    <p class="muted">Cada viernes a las ${esc(S.escuela.horaReporte || '13:00')} aparece el aviso para descargar o imprimir el reporte. Los avisos de alumnos vinculados suenan al momento.</p>
    ${notif === 'granted' ? `<p class="ok-line">${ICON.campana}Los avisos del sistema están activos.</p>`
      : notif === 'denied' ? '<p class="muted" style="margin:0">El navegador bloqueó los avisos del sistema; la app los mostrará en pantalla.</p>'
      : notif === 'no' ? '' : `<div class="form-actions"><button class="btn" type="button" data-act="notif-activar">${ICON.campana}Avisarme también cuando la app esté en segundo plano</button></div>`}`;
}

function renderConexion() {
  const el = $('#panelConexion');
  if (!el || S.vista !== 'grupos') return;
  const head = `<div class="panel-head"><h3>Conectar varios equipos</h3></div>`;
  if (!S.cfg) {
    el.innerHTML = `${head}<p class="muted" style="margin:0">Ahora los datos viven solo en este equipo. Para que las tablets de todos los salones y dirección compartan la información y los avisos en tiempo real, la escuela necesita un proyecto gratuito de Firebase. Sigue la guía <b>GUIA-FIREBASE.md</b> que viene con la app.</p>`;
    return;
  }
  const N = S.nube, c = S.conexion;
  const err = c.error ? `<p class="form-error" role="alert">${esc(c.error)}</p>` : '';
  const dis = c.ocupado ? ' disabled' : '';
  if (!N || N.estado === 'cargando') { el.innerHTML = `${head}<p class="muted">Conectando con la escuela…</p>`; return; }
  if (N.estado === 'error') {
    el.innerHTML = `${head}<p class="form-error">${esc(N.error || 'No se pudo conectar.')}</p><div class="form-actions"><button class="btn" type="button" data-act="nube-reintentar">Reintentar</button>${N.usuario ? '<button class="btn ghost" type="button" data-act="nube-salir">Cerrar sesión</button>' : ''}</div>`;
    return;
  }
  if (N.estado === 'sin-sesion') {
    const crear = c.vista === 'crear';
    el.innerHTML = `${head}<p class="muted">Entra con tu cuenta para compartir los registros con los demás equipos de la escuela.</p>
      <div class="seg" role="group" aria-label="Cuenta" style="margin-bottom:12px"><button type="button" data-act="nube-vista" data-v="entrar" aria-pressed="${!crear}">Entrar</button><button type="button" data-act="nube-vista" data-v="crear" aria-pressed="${crear}">Crear cuenta</button></div>
      <div class="row2">
        ${crear ? '<label class="field" for="nNombre">Tu nombre<input id="nNombre" autocomplete="name" maxlength="80"></label>' : ''}
        <label class="field" for="nCorreo">Correo<input id="nCorreo" type="email" autocomplete="email" inputmode="email"></label>
        <label class="field" for="nClave">Contraseña<input id="nClave" type="password" autocomplete="${crear ? 'new-password' : 'current-password'}" minlength="6"></label>
      </div>
      ${err}
      <div class="form-actions" style="margin-top:12px"><button class="btn primary" type="button" data-act="${crear ? 'nube-crear-cuenta' : 'nube-entrar'}"${dis}>${crear ? 'Crear cuenta' : 'Entrar'}</button>${crear ? '' : `<button class="link-btn" type="button" data-act="nube-olvide"${dis}>Olvidé mi contraseña</button>`}</div>`;
    return;
  }
  if (N.estado === 'sin-escuela') {
    el.innerHTML = `${head}<p class="ok-line">${ICON.check}Entraste como ${esc(N.usuario.email)}.</p>
      <h4 class="sub-h">Maestro</h4><p class="muted">Escribe el código de 6 letras que te dio dirección.</p>
      <div class="inline-form"><label class="field" for="nCodigo">Código de la escuela<input id="nCodigo" maxlength="9" autocapitalize="characters" autocomplete="off"></label><button class="btn primary" type="button" data-act="nube-unirse"${dis}>Unirme</button></div>
      <h4 class="sub-h">Dirección</h4><p class="muted">Si la escuela aún no está registrada, regístrala. Tú aprobarás a los maestros.</p>
      <div class="inline-form"><label class="field" for="nEscuela">Nombre de la escuela<input id="nEscuela" maxlength="120" value="${esc(S.escuela.nombre)}"></label><button class="btn" type="button" data-act="nube-crear-escuela"${dis}>Registrar escuela</button></div>
      ${err}
      <div class="form-actions" style="margin-top:12px"><button class="btn ghost" type="button" data-act="nube-salir">Cerrar sesión</button></div>`;
    return;
  }
  if (N.estado === 'pendiente') {
    el.innerHTML = `${head}<p class="ok-line">${ICON.reloj}Tu solicitud llegó a dirección.</p><p class="muted">Cuando la aprueben, este equipo se conecta solo. Mientras tanto puedes seguir usando la app con los datos de este equipo.</p><div class="form-actions"><button class="btn ghost" type="button" data-act="nube-salir">Cerrar sesión</button></div>`;
    return;
  }
  // Conectado
  const dir = esDirector();
  const miembros = N.miembros || [];
  const pend = miembros.filter(m => !m.aprobado), apro = miembros.filter(m => m.aprobado);
  const local = S.local ? S.local.resumen() : { grupos: 0 };
  el.innerHTML = `${head}<p class="ok-line">${ICON.nube}Conectado a <b>${esc((N.escuela && N.escuela.nombre) || S.escuela.nombre || 'la escuela')}</b></p>
    <p class="muted" style="margin-top:8px">${esc(N.usuario.nombre || N.usuario.email)} · ${dir ? 'Dirección' : 'Maestro'}. Los registros se comparten en tiempo real con los demás equipos.</p>
    ${dir ? `<div class="codigo-box"><span>Código para que los maestros se unan</span><b class="codigo">${esc((N.escuela && N.escuela.codigo) || '')}</b></div>
      ${pend.length ? `<h4 class="sub-h">Solicitudes pendientes</h4><ul class="miembros">${pend.map(m => `<li><div><b>${esc(m.nombre || m.email)}</b><span>${esc(m.email || '')}</span></div><div class="acts"><button class="btn primary" type="button" data-act="nube-aprobar" data-id="${esc(m.uid)}">Aprobar</button><button class="btn ghost" type="button" data-act="nube-rechazar" data-id="${esc(m.uid)}">Rechazar</button></div></li>`).join('')}</ul>` : ''}
      <h4 class="sub-h">Personal conectado (${apro.length})</h4><ul class="miembros">${apro.map(m => `<li><div><b>${esc(m.nombre || m.email)}</b><span>${esc(m.email || '')} · ${m.rol === 'director' ? 'Dirección' : 'Maestro'}</span></div>${m.uid !== N.usuario.uid ? `<div class="acts"><button class="link-btn danger" type="button" data-act="nube-rechazar" data-id="${esc(m.uid)}">Quitar acceso</button></div>` : ''}</li>`).join('')}</ul>` : ''}
    ${local.grupos && !prefs.subidoLocal ? `<div class="import-box"><p>Este equipo tiene ${plural(local.grupos, 'grupo guardado', 'grupos guardados')} desde antes de conectarse.</p><div class="form-actions"><button class="btn primary" type="button" data-act="nube-subir"${dis}>Subir a la escuela</button><button class="btn ghost" type="button" data-act="nube-no-subir">No, gracias</button></div></div>` : ''}
    ${err}
    <div class="form-actions" style="margin-top:12px"><button class="btn ghost" type="button" data-act="nube-salir">Cerrar sesión en este equipo</button></div>`;
}

function pedirPersistencia() {
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
}

async function descargarRespaldo() {
  if (!S.store) return;
  let datos;
  try { datos = await S.store.exportar(); } catch (e) { aviso('No se pudo preparar el respaldo.', { error: true }); return; }
  const ok = await entregarArchivo(`respaldo-pase-al-bano-${S.hoy}.json`, JSON.stringify(datos), 'application/json');
  if (!ok) return;
  try { await S.local.guardarAjustes({ ultimoRespaldo: Date.now() }); } catch (e) {}
  aviso('Respaldo descargado. Guárdalo en tu computadora, Drive o correo.');
  renderRespaldo();
  if (S.vista === 'semana') renderSemana();
}

async function leerRespaldo(archivo) {
  if (!archivo) return;
  try {
    const datos = JSON.parse(await archivo.text());
    if (!datos || datos.app !== 'pase-al-bano' || !datos.grupos || typeof datos.grupos !== 'object' || !datos.dias || typeof datos.dias !== 'object') throw new Error('formato');
    S.importacion = { datos, nombre: archivo.name, grupos: Object.keys(datos.grupos).length, dias: Object.keys(datos.dias).length, fecha: datos.exportado };
  } catch (e) {
    S.importacion = null;
    aviso('Ese archivo no es un respaldo de Pase al Baño.', { error: true });
  }
  renderRespaldo();
}

function renderRespaldo() {
  const el = $('#panelRespaldo');
  if (!el || !S.local || S.vista !== 'grupos') return;
  const ult = S.local.ajustes().ultimoRespaldo;
  const nube = enNube();
  const puedeRestaurar = !nube || esDirector();
  let instalar;
  if (esApp()) instalar = `<p class="ok-line">${ICON.check}Pase al Baño está instalada en este dispositivo.</p>`;
  else if (avisoInstalar) instalar = `<p class="muted">Instálala para abrirla desde la pantalla de inicio, a pantalla completa y sin internet.</p><button class="btn primary" type="button" data-act="instalar">${ICON.descargar}Instalar en este dispositivo</button>`;
  else if (esIOS) instalar = `<p class="muted" style="margin:0">En iPad o iPhone: abre esta página en <b>Safari</b>, toca el botón <b>Compartir</b> y elige <b>Agregar a pantalla de inicio</b>.</p>`;
  else instalar = `<p class="muted" style="margin:0">Para tenerla como app: abre el menú del navegador (⋮) y elige <b>Instalar app</b> o <b>Agregar a la pantalla principal</b>.</p>`;
  const r = S.local.resumen();
  const imp = S.importacion;
  el.innerHTML = `
    <div class="panel-head"><h3>Respaldo de datos</h3></div>
    <p class="muted">${nube ? 'Los registros de la escuela se guardan en la nube. Puedes descargar una copia completa cuando quieras.' : `Los registros se guardan solo en este dispositivo: ${plural(r.grupos, 'grupo', 'grupos')} y ${plural(r.dias, 'día', 'días')} con salidas. Descarga un respaldo cada viernes para no perder información o para pasarla a otro dispositivo.`} ${ult ? `Último respaldo: ${conPunto(fechaHumana(ult))}` : 'Todavía no has descargado un respaldo.'}</p>
    <div class="form-actions">
      <button class="btn" type="button" data-act="respaldo-descargar">${ICON.descargar}Descargar respaldo</button>
      ${puedeRestaurar ? '<button class="btn ghost" type="button" data-act="respaldo-abrir">Restaurar o combinar…</button>' : ''}
      <input type="file" id="archivoRespaldo" accept=".json,application/json" hidden>
    </div>
    ${imp ? `<div class="import-box" role="alert">
      <p><b>${esc(imp.nombre)}</b>${imp.fecha ? ` · hecho el ${fechaHumana(imp.fecha)}` : ''} · ${plural(imp.grupos, 'grupo', 'grupos')} y ${plural(imp.dias, 'día', 'días')} con salidas.</p>
      <p class="muted" style="margin:0">«Combinar» suma este respaldo a lo que ya hay ${nube ? 'en la escuela' : 'aquí'}.${nube ? '' : ' «Reemplazar» borra lo de este dispositivo y deja solo lo del respaldo.'}</p>
      <div class="form-actions">
        <button class="btn primary" type="button" data-act="importar-combinar">Combinar</button>
        ${nube ? '' : '<button class="btn danger" type="button" data-act="importar-reemplazar">Reemplazar todo</button>'}
        <button class="btn ghost" type="button" data-act="importar-cancelar">Cancelar</button>
      </div></div>` : ''}
    ${S.local.persistente || nube ? '' : '<p class="form-error" style="margin-top:12px">Este navegador no permite guardar datos: lo que registres se perderá al cerrar la ventana.</p>'}
    <div class="panel-head" style="margin-top:22px"><h3>Usar como app</h3></div>
    ${instalar}`;
}

/* --- Editor de grupo --- */
function abrirEditor(id) {
  const g = id ? (S.grupos || []).find(x => x.id === id) : null;
  S.borrador = g
    ? { id: g.id, nuevo: false, nombre: g.nombre || '', limiteMin: clamp(g.limiteMin, 1, 60, 5), maxDia: maxDia(g), creado: g.creado || Date.now(), creadoPor: g.creadoPor || '', alumnos: (g.alumnos || []).map(a => ({ id: a.id, nombre: a.nombre, permiso: !!a.permiso, baja: !!a.baja })) }
    : { id: rid('g'), nuevo: true, nombre: '', limiteMin: 5, maxDia: 2, creado: Date.now(), creadoPor: '', alumnos: [] };
  S.confirmarBorrarGrupo = false; S.errorForm = '';
  if (S.vista !== 'grupos') irA('grupos'); else renderAjustes();
  setTimeout(() => { const f = $('#fNombre'); if (f && !f.value) f.focus(); const ed = $('#editor'); if (ed && window.innerWidth < 900) ed.scrollIntoView({ block: 'start' }); }, 30);
}

function filasEditor() {
  const d = S.borrador;
  const act = d.alumnos.filter(a => !a.baja), bajas = d.alumnos.filter(a => a.baja);
  if (!act.length && !bajas.length) return '<li class="ed-empty">La lista está vacía. Pega los nombres abajo y toca «Agregar a la lista».</li>';
  const conFotos = S.escuela.fotos !== false;
  return act.map((a, i) => {
    const f = S.fotos[a.id];
    return `<li class="ed-row${conFotos ? '' : ' sin-foto'}">
      <span class="n">${i + 1}</span>
      ${conFotos ? `<span class="ed-foto-box"><button type="button" class="ed-foto" data-act="ed-foto" data-id="${esc(a.id)}" aria-label="${f ? 'Cambiar' : 'Tomar o elegir'} foto de ${esc(a.nombre)}">${f ? `<img src="${f}" alt="">` : ICON.camara}</button>${f ? `<button type="button" class="ed-foto-x" data-act="ed-foto-quitar" data-id="${esc(a.id)}" aria-label="Quitar foto">${ICON.x}</button>` : ''}</span>` : ''}
      <input type="text" id="al-${esc(a.id)}" data-ed="nombre" data-id="${esc(a.id)}" value="${esc(a.nombre)}" aria-label="Nombre del alumno ${i + 1}">
      <label class="perm"><input type="checkbox" id="pe-${esc(a.id)}" data-ed="permiso" data-id="${esc(a.id)}"${a.permiso ? ' checked' : ''}>Permiso especial</label>
      <button class="link-btn danger" type="button" data-act="ed-quitar" data-id="${esc(a.id)}">Quitar</button>
    </li>`;
  }).join('') + bajas.map(a => `<li class="ed-row is-baja${conFotos ? '' : ' sin-foto'}">
      <span class="n">–</span>
      ${conFotos ? '<span class="ed-foto-box"></span>' : ''}
      <input type="text" id="al-${esc(a.id)}" value="${esc(a.nombre)}" readonly aria-label="Alumno dado de baja">
      <span class="perm">Dado de baja</span>
      <button class="link-btn" type="button" data-act="ed-reactivar" data-id="${esc(a.id)}">Reactivar</button>
    </li>`).join('');
}

function renderEditor() {
  const ed = $('#editor');
  if (!ed) return;
  const d = S.borrador;
  if (!d || !S.puedeEscribir) {
    ed.innerHTML = `<div class="panel"><div class="panel-head"><h3>Cómo funciona</h3></div>
      <p style="margin:0 0 10px">1. Crea un grupo, pega su lista de asistencia y, si quieres, agrega la foto de cada alumno.</p>
      <p style="margin:0 0 10px">2. Deja la tablet a la vista con la pestaña <b>Lista</b> abierta y bloquéala con el PIN. El alumno toca su nombre al salir y otra vez al regresar.</p>
      <p style="margin:0 0 10px">3. En <b>Registro</b> ves cada salida del día; en <b>Semana</b>, el reporte de lunes a viernes por alumno.</p>
      <p style="margin:0 0 10px">4. El viernes, a la hora que elijas, aparece el aviso para descargar el reporte en PDF o imprimirlo.</p>
      <p class="muted" style="margin:0">${enNube() ? 'Los datos se comparten con los demás equipos de la escuela.' : 'Los datos viven en este equipo: descarga un respaldo cada viernes.'}</p></div>`;
    return;
  }
  ed.innerHTML = `<form class="panel editor" id="formGrupo" novalidate>
    <div class="panel-head" style="margin:0"><h3>${d.nuevo ? 'Nuevo grupo' : 'Editar grupo'}</h3></div>
    <label class="field" for="fNombre">Nombre del grupo
      <input id="fNombre" data-ed="g-nombre" value="${esc(d.nombre)}" placeholder="Ej. 2° A – Matemáticas" maxlength="80" autocomplete="off">
    </label>
    <div class="row2">
      <label class="field" for="fLimite">Tiempo sugerido por salida (minutos)
        <input id="fLimite" data-ed="g-limite" type="number" inputmode="numeric" min="1" max="60" value="${d.limiteMin}">
        <small>La ficha se pone naranja al pasarlo y roja al doble.</small>
      </label>
      <label class="field" for="fMaxDia">Salidas al día antes de alertar
        <input id="fMaxDia" data-ed="g-maxdia" type="number" inputmode="numeric" min="1" max="10" value="${d.maxDia}">
        <small>Con más salidas que esto en un día aparece una alerta.</small>
      </label>
    </div>
    <fieldset>
      <legend>Lista de asistencia (${d.alumnos.filter(a => !a.baja).length})</legend>
      ${S.escuela.fotos !== false ? '<p class="muted" style="margin:0">Toca el ícono de cámara de cada alumno para tomarle una foto o elegirla de la galería.</p>' : ''}
      <ol class="ed-list" id="edLista">${filasEditor()}</ol>
      <label class="field" for="fPegar">Agregar alumnos
        <textarea id="fPegar" rows="5" placeholder="Un nombre por renglón. Puedes copiar la columna de nombres desde Excel o desde tu lista oficial."></textarea>
      </label>
      <div class="form-actions">
        <button class="btn" type="button" data-act="ed-agregar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Agregar a la lista</button>
        <button class="btn ghost" type="button" data-act="ed-ordenar">Ordenar de la A a la Z</button>
      </div>
    </fieldset>
    ${S.errorForm ? `<p class="form-error" role="alert">${esc(S.errorForm)}</p>` : ''}
    <div class="form-actions">
      <button class="btn primary" type="submit">Guardar grupo</button>
      <button class="btn" type="button" data-act="ed-cancelar">Cancelar</button>
      <span class="spacer"></span>
      ${d.nuevo ? '' : S.confirmarBorrarGrupo
        ? `<span class="confirm">Se quitará el grupo y su lista; el historial deja de mostrarse. <button class="btn danger solid" type="button" data-act="ed-borrar-si">Eliminar grupo</button><button class="btn" type="button" data-act="ed-borrar-no">No</button></span>`
        : '<button class="btn danger" type="button" data-act="ed-borrar">Eliminar grupo</button>'}
    </div>
  </form>`;
}

function refrescarListaEditor() {
  const ol = $('#edLista'); if (ol) ol.innerHTML = filasEditor();
  const lg = $('#formGrupo legend'); if (lg && S.borrador) lg.textContent = `Lista de asistencia (${S.borrador.alumnos.filter(a => !a.baja).length})`;
}

function parsearLista(txt) {
  return String(txt).split(/\r?\n/).map(l => l.split('\t').map(c => c.trim()).filter(c => c && !/^\d+[.)-]?$/.test(c)).join(' ')
    .replace(/^\d+\s*[.)\-]\s*/, '').replace(/\s+/g, ' ').trim()).filter(Boolean);
}

async function guardarBorrador() {
  const d = S.borrador;
  if (!d) return;
  const nombre = d.nombre.trim();
  if (!nombre) { S.errorForm = 'Escribe el nombre del grupo.'; renderEditor(); $('#fNombre').focus(); return; }
  const pendiente = parsearLista(($('#fPegar') || {}).value || '');
  pendiente.forEach(n => d.alumnos.push({ id: rid('a'), nombre: n, permiso: false, baja: false }));
  const alumnos = d.alumnos.map(a => ({ id: a.id, nombre: String(a.nombre).trim(), permiso: !!a.permiso, baja: !!a.baja })).filter(a => a.nombre);
  const doc = { id: d.id, nombre, limiteMin: clamp(d.limiteMin, 1, 60, 5), maxDia: clamp(d.maxDia, 1, 10, 2), alumnos, creado: d.creado, actualizado: Date.now() };
  if (d.creadoPor) doc.creadoPor = d.creadoPor;
  try {
    await S.store.guardarGrupo(doc);
  } catch (e) {
    S.errorForm = e && e.name === 'QuotaExceededError' ? 'Se llenó el espacio del dispositivo. Descarga un respaldo y borra grupos que ya no uses.' : 'No se pudo guardar el grupo. Inténtalo otra vez.';
    renderEditor(); return;
  }
  S.gid = d.id; prefs.gid = d.id; guardarPrefs(); recordarUso(d.id);
  pedirPersistencia();
  S.borrador = null; S.errorForm = ''; S.sem = null;
  suscribirDia();
  aviso(`Grupo «${nombre}» guardado con ${plural(alumnos.filter(a => !a.baja).length, 'alumno', 'alumnos')}.`);
  renderEncabezado();
  irA('lista');
}

/* ================= Conexión con Firebase ================= */
async function leerConfigFirebase() {
  if (!/^https?:$/.test(location.protocol)) return null;
  // Un wifi sin salida a internet deja la petición esperando: se corta a los 5 segundos.
  const corte = typeof AbortController === 'function' ? new AbortController() : null;
  const reloj = setTimeout(() => { if (corte) corte.abort(); }, 5000);
  try {
    const r = await fetch('firebase-config.txt', { cache: 'no-cache', signal: corte ? corte.signal : undefined });
    if (!r.ok) return null;
    const txt = (await r.text()).replace(/^\s*(#|\/\/).*$/gm, '');
    const cfg = {};
    txt.replace(/([A-Za-z]+)\s*:\s*["'`]([^"'`]+)["'`]/g, (m, k, v) => { cfg[k] = v.trim(); return m; });
    return cfg.apiKey && cfg.projectId && cfg.appId ? cfg : null;
  } catch (e) { return undefined; }   // no se pudo leer (sin red): no es lo mismo que «sin configurar»
  finally { clearTimeout(reloj); }
}

async function iniciarConexion() {
  S.cfg = await leerConfigFirebase();
  if (S.cfg === null && prefs.modoNube) { prefs.modoNube = false; guardarPrefs(); }
  if (!S.cfg) { S.cfg = null; if (!S.store) conectarStore(S.local); return false; }
  try {
    const mod = await import('./nube.js');
    S.nube = await mod.iniciarNube(S.cfg, { escuelaGuardada: prefs.escuelaId || null, alCambiar: alCambiarNube, alError: errorGuardar });
    return true;
  } catch (e) {
    S.nube = { estado: 'error', error: 'No se pudo cargar la conexión. Revisa el internet y los datos de firebase-config.txt.' };
    if (S.vista === 'grupos') renderConexion();
    return false;
  }
}

function alCambiarNube(N) {
  S.nube = N;
  S.conexion.ocupado = false;
  if (N.escuela && N.escuela.id && N.estado !== 'sin-escuela') { prefs.escuelaId = N.escuela.id; guardarPrefs(); }
  if (N.estado === 'sin-escuela' || N.estado === 'sin-sesion') { prefs.escuelaId = null; guardarPrefs(); }
  if (N.estado === 'miembro' && !enNube()) {
    prefs.modoNube = true; guardarPrefs();
    conectarStore(N.almacen());
  } else if (N.estado !== 'miembro' && N.estado !== 'cargando' && (enNube() || !S.store)) {
    if (N.estado !== 'error' || !enNube()) { prefs.modoNube = false; guardarPrefs(); conectarStore(S.local); }
  }
  renderBanner();
  if (S.vista === 'grupos') renderAjustes();
}

async function accionNube(fn) {
  S.conexion.error = ''; S.conexion.ocupado = true; renderConexion();
  try { await fn(); }
  catch (e) { S.conexion.error = (e && e.message) || 'No se pudo completar.'; }
  S.conexion.ocupado = false;
  renderConexion();
}

/* ================= Suscripciones ================= */
function conectarStore(store) {
  S.cancelar.forEach(f => { try { f(); } catch (e) {} });
  S.cancelar = [];
  if (S.cancelarDia) { try { S.cancelarDia(); } catch (e) {} S.cancelarDia = null; }
  S.diaClave = ''; S.dia = null; S.diaListo = false;
  S.store = store; S.todos = null; S.grupos = null; S.sem = null; S.verClave = '';
  S.fotos = {}; S.vinculos = []; S.activosEsc = [];
  const err = () => aviso('No se pudieron cargar los datos. Revisa la conexión y recarga la página.', { error: true });
  S.cancelar.push(store.alGrupos(gs => {
    S.todos = gs.filter(g => g && g.id).sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { numeric: true }));
    S.grupos = S.todos;
    if (!S.grupos.some(g => g.id === S.gid)) { S.gid = S.grupos.length ? S.grupos[0].id : null; prefs.gid = S.gid; guardarPrefs(); }
    recordarUso(S.gid);
    if (S.borrador && !S.borrador.nuevo && !S.todos.some(g => g.id === S.borrador.id)) S.borrador = null;
    suscribirDia();
    renderTodo();
    revisarReportesPronto();
  }, err));
  S.cancelar.push(store.alEscuela(e => {
    S.escuela = Object.assign(escuelaBase(), Object.fromEntries(Object.entries(e || {}).filter(([, v]) => v !== undefined && v !== null)));
    renderEncabezado();
    if (S.vista === 'grupos') { if (!S.escBorrador) renderEscuela(); renderSeguridad(); }
    if (S.vista === 'semana') llenarImpresion();
  }, err));
  S.cancelar.push(store.alFotos(f => {
    S.fotos = f || {};
    if (S.vista === 'lista') renderLista();
    if (S.borrador) refrescarListaEditor();
    if (S.vista === 'grupos') renderVinculos();
  }, err));
  S.cancelar.push(store.alVinculos(v => {
    S.vinculos = (v || []).filter(x => x && x.a && x.b);
    if (S.vista === 'grupos') renderVinculos();
    if (S.vista === 'lista') renderLista();
    revisarCoincidenciasAhora();
  }, err));
  S.cancelar.push(store.alActivos(a => {
    S.activosEsc = a || [];
    revisarCoincidenciasAhora();
    if (S.vista === 'semana') recargarSemanaPronto();
  }, err));
  renderTodo();
}

function suscribirDia() {
  const clave = (S.gid || '') + '|' + S.hoy;
  if (clave === S.diaClave) return;
  if (S.cancelarDia) { try { S.cancelarDia(); } catch (e) {} S.cancelarDia = null; }
  S.diaClave = clave; S.dia = null; S.diaListo = false;
  if (!S.gid || !S.store) return;
  const gid = S.gid, hoy = S.hoy;
  S.cancelarDia = S.store.alDia(gid, hoy, doc => {
    if (S.diaClave !== gid + '|' + hoy) return;
    S.dia = doc; S.diaListo = true;
    alCambiarDia();
  }, () => { aviso('Se perdió la conexión con el registro de hoy. Recarga la página.', { error: true }); });
}

function alCambiarDia() {
  renderLista();
  if (S.vista === 'hoy' && S.ver === S.hoy) renderHoy();
  if (S.sem && !S.sem.cargando && S.sem.gid === S.gid && semanaDe(S.sem.lunes).includes(S.hoy)) {
    S.sem.dias[S.hoy] = S.dia;
    if (S.vista === 'semana') renderSemana();
  }
}

function renderTodo() { renderEncabezado(); renderBanner(); renderInsignia(); renderVista(); }

/* ================= Reloj ================= */
function tic() {
  const ahora = Date.now();
  $('#reloj').textContent = new Date(ahora).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
  if (hoyStr() !== S.hoy) {
    const antes = S.hoy;
    S.hoy = hoyStr();
    if (S.ver === antes) S.ver = S.hoy;
    cargarAlertadas();
    suscribirDia(); renderTodo();
    return;
  }
  $$('[data-desde]').forEach(el => { el.textContent = fReloj(ahora - Number(el.dataset.desde)); });
  const g = grupo();
  if (g && S.vista === 'lista') {
    const lim = limiteMs(g);
    const cambio = $$('[data-desde-ficha]').some(t => nivel(ahora - Number(t.dataset.desdeFicha), lim) !== t.dataset.nivel);
    if (cambio) renderLista();
  }
  if (S.pinActivo && !S.bloqueado && !S.modal && !S.borrador && ahora - S.ultimoToque > BLOQUEO_AUTO) bloquear(true);
  const minuto = Math.floor(ahora / 60000);
  if (minuto !== ultimoMinuto) { ultimoMinuto = minuto; revisarReportes(); }
}
let ultimoMinuto = Math.floor(Date.now() / 60000);

/* ================= Eventos ================= */
function enlazar() {
  document.addEventListener('pointerdown', () => { S.ultimoToque = Date.now(); prepararAudio(); }, true);
  document.addEventListener('keydown', e => {
    S.ultimoToque = Date.now();
    if (e.key === 'Enter' && e.target && e.target.id === 'pinValor') { e.preventDefault(); comprobarPin(); }
    if (e.key === 'Escape' && S.modal && S.modal.tipo === 'pin') cerrarModal();
  }, true);

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act, id = b.dataset.id;
    switch (act) {
      case 'goto': irA(b.dataset.view); break;
      case 'alternar': if (b.getAttribute('aria-disabled') !== 'true') alternar(id); else aviso('Tu acceso es de solo lectura.', { error: true }); break;
      case 'filtro':
        S.filtro = b.dataset.v;
        $$('[data-act="filtro"]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === S.filtro)));
        renderLista(); break;
      case 'candado': if (S.bloqueado) pedirDesbloqueo(); else bloquear(); break;
      case 'nuevo-grupo': requiereDesbloqueo(() => abrirEditor(null)); break;
      case 'editar-grupo': requiereDesbloqueo(() => abrirEditor(id)); break;
      case 'usar-grupo': cambiarGrupo(id); break;
      case 'borrar-salida': S.borrarSalida = id; renderHoy(); break;
      case 'borrar-salida-no': S.borrarSalida = null; renderHoy(); break;
      case 'borrar-salida-si': {
        S.borrarSalida = null;
        const fecha = S.ver;
        escribir(fecha, id, null).then(() => { if (fecha !== S.hoy) { S.verClave = ''; renderHoy(); } });
        marcarActivo(id, null);
        S.sem = null;
        aviso('Registro borrado.');
        if (fecha === S.hoy) renderHoy();
        break;
      }
      case 'fila': S.abierto = S.abierto === id ? null : id; renderSemana(); break;
      case 'csv': descargarCsv(); break;
      case 'copiar': copiarTabla(); break;
      case 'pdf': generarPdf(S.gid, S.lunes); break;
      case 'imprimir': imprimirReporte(S.gid, S.lunes); break;
      case 'hist-ver': S.lunes = b.dataset.lunes; S.abierto = null; renderSemana(); window.scrollTo({ top: 0 }); break;
      case 'hist-pdf': generarPdf(S.gid, b.dataset.lunes); break;
      case 'rep-pdf': {
        const lunes = b.dataset.lunes;
        requiereDesbloqueo(() => generarPdf(id, lunes).then(ok => {
          if (!ok || !S.modal || S.modal.tipo !== 'reporte') return;
          S.modal.pendientes = S.modal.pendientes.filter(p => !(p.g.id === id && p.lunes === lunes));
          if (S.modal.pendientes.length) renderModal(); else cerrarModal();
        }));
        break;
      }
      case 'rep-imprimir': { const lunes = b.dataset.lunes; requiereDesbloqueo(() => { cerrarModal(); imprimirReporte(id, lunes); }); break; }
      case 'rep-luego': posponerReportes(); break;
      case 'pin-tecla': { const i = $('#pinValor'); if (i && i.value.length < 6) i.value += b.dataset.k; break; }
      case 'pin-borrar': { const i = $('#pinValor'); if (i) i.value = i.value.slice(0, -1); break; }
      case 'pin-ok': comprobarPin(); break;
      case 'pin-cancelar': cerrarModal(); break;
      case 'pin-recuperar': if (S.modal) { S.modal.recuperar = true; S.modal.error = ''; renderModal(); } break;
      case 'alerta-ok': S.alertas.shift(); renderAlerta(); break;
      case 'bloquear': bloquear(); break;
      case 'pin-cambiar': S.cambiandoPin = true; S.errorPin = ''; renderSeguridad(); break;
      case 'pin-cancelar-cambio': S.cambiandoPin = false; S.errorPin = ''; renderSeguridad(); break;
      case 'pin-quitar':
        S.local.guardarAjustes({ pin: null, recuperacion: null, bloqueado: false }).then(() => { S.pinActivo = false; S.bloqueado = false; renderSeguridad(); aplicarBloqueo(); aviso('Se quitó el PIN de este equipo.'); });
        break;
      case 'pin-guardar': guardarPin(); break;
      case 'codigo-ok': S.codigoRecuperacion = ''; renderSeguridad(); break;
      case 'notif-activar':
        try { Notification.requestPermission().then(() => renderSeguridad()); } catch (err) {}
        break;
      case 'escuela-guardar': guardarEscuela(); break;
      case 'logo-cambiar': S.destinoImagen = { tipo: 'logo' }; $('#archivoImagen').click(); break;
      case 'logo-quitar': guardarEscuelaParcial({ logo: '' }); break;
      case 'ed-foto': if (S.borrador) { S.destinoImagen = { tipo: 'foto', id, gid: S.borrador.id }; $('#archivoImagen').click(); } break;
      case 'ed-foto-quitar': if (S.borrador) S.store.guardarFoto(id, S.borrador.id, null).catch(errorGuardar); break;
      case 'vinc-crear': crearVinculo(S.vincForm.a, S.vincForm.b, S.vincForm.nota.trim(), true); break;
      case 'vinc-sugerido': {
        const f = semanaDe(S.lunes);
        crearVinculo(b.dataset.a, b.dataset.b, `Coincidieron fuera ${b.dataset.veces} veces en la semana del ${rangoTxt(f[0], f[4])}.`, false).then(() => { S.sem = null; renderSemana(); });
        break;
      }
      case 'vinc-quitar': {
        const v = S.vinculos.find(x => x.id === id);
        if (!v) break;
        S.store.borrarVinculo(id).then(() => aviso('Vínculo quitado.', { deshacer: () => S.store.guardarVinculo(v) })).catch(errorGuardar);
        break;
      }
      case 'respaldo-descargar': descargarRespaldo(); break;
      case 'respaldo-abrir': { const f = $('#archivoRespaldo'); if (f) f.click(); break; }
      case 'importar-cancelar': S.importacion = null; renderRespaldo(); break;
      case 'importar-combinar':
      case 'importar-reemplazar': {
        const imp = S.importacion; if (!imp) break;
        const reemplazar = act === 'importar-reemplazar' && !enNube();
        S.importacion = null;
        S.store.importar(imp.datos, reemplazar).then(() => {
          aviso(reemplazar ? 'Listo: ahora este dispositivo tiene solo los datos del respaldo.' : 'Listo: el respaldo se combinó con los datos.');
        }).catch(() => aviso('No se pudo guardar el respaldo.', { error: true }));
        S.sem = null; S.verClave = '';
        renderTodo();
        break;
      }
      case 'instalar':
        if (avisoInstalar) {
          const p = avisoInstalar; avisoInstalar = null;
          p.prompt();
          p.userChoice.then(() => renderRespaldo(), () => renderRespaldo());
        }
        break;
      case 'nube-vista': S.conexion.vista = b.dataset.v; S.conexion.error = ''; renderConexion(); break;
      case 'nube-entrar': accionNube(() => S.nube.entrar(val('#nCorreo'), val('#nClave'))); break;
      case 'nube-crear-cuenta': accionNube(() => S.nube.crearCuenta(val('#nNombre'), val('#nCorreo'), val('#nClave'))); break;
      case 'nube-olvide': accionNube(async () => { await S.nube.restablecer(val('#nCorreo')); aviso('Te enviamos un correo para cambiar la contraseña.'); }); break;
      case 'nube-salir': accionNube(() => S.nube.salir()); break;
      case 'nube-reintentar': location.reload(); break;
      case 'nube-unirse': accionNube(() => S.nube.unirse(val('#nCodigo'))); break;
      case 'nube-crear-escuela': accionNube(() => S.nube.crearEscuela(Object.assign({}, S.escuela, { nombre: val('#nEscuela') }))); break;
      case 'nube-aprobar': accionNube(() => S.nube.aprobar(id)); break;
      case 'nube-rechazar': accionNube(() => S.nube.rechazar(id)); break;
      case 'nube-subir': accionNube(async () => {
        const datos = await S.local.exportar();
        await S.store.importar(datos, false);
        prefs.subidoLocal = true; guardarPrefs();
        aviso('Los grupos de este equipo ya están en la escuela.');
      }); break;
      case 'nube-no-subir': prefs.subidoLocal = true; guardarPrefs(); renderConexion(); break;
      case 'ed-quitar': {
        const d = S.borrador; const i = d.alumnos.findIndex(a => a.id === id);
        if (i >= 0) { const g = (S.grupos || []).find(x => x.id === d.id); const guardado = g && (g.alumnos || []).some(a => a.id === id); if (guardado) d.alumnos[i].baja = true; else d.alumnos.splice(i, 1); }
        refrescarListaEditor(); break;
      }
      case 'ed-reactivar': { const a = S.borrador.alumnos.find(x => x.id === id); if (a) a.baja = false; refrescarListaEditor(); break; }
      case 'ed-agregar': {
        const ta = $('#fPegar'); const nombres = parsearLista(ta.value);
        if (!nombres.length) { ta.focus(); break; }
        nombres.forEach(n => S.borrador.alumnos.push({ id: rid('a'), nombre: n, permiso: false, baja: false }));
        ta.value = ''; refrescarListaEditor();
        aviso(`${plural(nombres.length, 'alumno agregado', 'alumnos agregados')}. Toca «Guardar grupo» para conservar los cambios.`);
        break;
      }
      case 'ed-ordenar': {
        const d = S.borrador;
        const act2 = d.alumnos.filter(a => !a.baja).sort((a, c) => a.nombre.localeCompare(c.nombre, 'es', { sensitivity: 'base' }));
        d.alumnos = act2.concat(d.alumnos.filter(a => a.baja));
        refrescarListaEditor(); break;
      }
      case 'ed-cancelar': S.borrador = null; S.errorForm = ''; renderEditor(); break;
      case 'ed-borrar': S.confirmarBorrarGrupo = true; renderEditor(); break;
      case 'ed-borrar-no': S.confirmarBorrarGrupo = false; renderEditor(); break;
      case 'ed-borrar-si': {
        const d = S.borrador; const nombre = d.nombre;
        S.store.borrarGrupo(d.id).then(() => aviso(`Grupo «${nombre}» eliminado.`)).catch(() => aviso('No se pudo eliminar el grupo.', { error: true }));
        S.borrador = null; S.confirmarBorrarGrupo = false; renderEditor();
        break;
      }
    }
  });

  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'buscar') { S.q = t.value; renderLista(); return; }
    if (t.dataset && t.dataset.esc) { campoEscuela(t); return; }
    if (t.dataset && t.dataset.vinc === 'nota') { S.vincForm.nota = t.value; return; }
    const k = t.dataset && t.dataset.ed;
    if (!k || !S.borrador) return;
    const d = S.borrador;
    if (k === 'g-nombre') d.nombre = t.value;
    else if (k === 'g-limite') d.limiteMin = t.value;
    else if (k === 'g-maxdia') d.maxDia = t.value;
    else if (k === 'nombre') { const a = d.alumnos.find(x => x.id === t.dataset.id); if (a) a.nombre = t.value; }
  });

  document.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'grupoSel') { cambiarGrupo(t.value); return; }
    if (t.id === 'archivoRespaldo') { const f = t.files && t.files[0]; t.value = ''; leerRespaldo(f); return; }
    if (t.id === 'archivoImagen') { const f = t.files && t.files[0]; t.value = ''; recibirImagen(f); return; }
    if (t.id === 'ordenSem') { S.orden = t.value; prefs.orden = t.value; guardarPrefs(); renderSemana(); return; }
    if (t.dataset && t.dataset.esc) { campoEscuela(t); return; }
    if (t.dataset && (t.dataset.vinc === 'a' || t.dataset.vinc === 'b')) { S.vincForm[t.dataset.vinc] = t.value; return; }
    if (t.dataset && t.dataset.ed === 'permiso' && S.borrador) { const a = S.borrador.alumnos.find(x => x.id === t.dataset.id); if (a) a.permiso = t.checked; }
  });

  document.addEventListener('submit', e => { if (e.target.id === 'formGrupo') { e.preventDefault(); guardarBorrador(); } });

  // Gráfica: información al pasar el dedo, el cursor o el foco
  document.addEventListener('pointerover', e => { const c = e.target.closest && e.target.closest('.col[data-tip]'); if (c) mostrarTip(c); });
  document.addEventListener('pointerout', e => { const c = e.target.closest && e.target.closest('.col[data-tip]'); if (c && !c.contains(e.relatedTarget)) ocultarTip(); });
  document.addEventListener('focusin', e => { const c = e.target.closest && e.target.closest('.col[data-tip]'); if (c) mostrarTip(c); });
  document.addEventListener('focusout', e => { if (e.target.closest && e.target.closest('.col[data-tip]')) ocultarTip(); });

  $('#diaPrev').onclick = () => { S.ver = diaHabil(S.ver, -1); S.borrarSalida = null; renderHoy(); };
  $('#diaNext').onclick = () => { const n = diaHabil(S.ver, 1); S.ver = n > S.hoy ? S.hoy : n; S.borrarSalida = null; renderHoy(); };
  $('#diaHoy').onclick = () => { S.ver = S.hoy; renderHoy(); };
  $('#semPrev').onclick = () => { S.lunes = addDias(S.lunes, -7); S.abierto = null; renderSemana(); };
  $('#semNext').onclick = () => { const n = addDias(S.lunes, 7); if (n <= lunesDe(S.hoy)) { S.lunes = n; S.abierto = null; renderSemana(); } };
  $('#semHoy').onclick = () => { S.lunes = lunesDe(S.hoy); S.abierto = null; renderSemana(); };
  window.addEventListener('hashchange', () => { const v = vistaDeHash(); if (v !== S.vista) irA(v); });
  window.addEventListener('online', renderBanner);
  window.addEventListener('offline', renderBanner);
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); avisoInstalar = e; renderRespaldo(); });
  window.addEventListener('appinstalled', () => { avisoInstalar = null; aviso('Pase al Baño quedó instalada.'); renderRespaldo(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (abiertasHoy().length) mantenerPantalla();
    revisarReportesPronto();
  });
}

const val = sel => { const el = $(sel); return el ? el.value.trim() : ''; };

function campoEscuela(t) {
  if (!S.escBorrador) S.escBorrador = JSON.parse(JSON.stringify(S.escuela));
  const k = t.dataset.esc;
  if (k.startsWith('firma')) { const i = Number(k.slice(5)); S.escBorrador.firmas = (S.escBorrador.firmas || []).concat(['', '', '']).slice(0, 3); S.escBorrador.firmas[i] = t.value; }
  else if (k === 'fotos') S.escBorrador.fotos = t.checked;
  else S.escBorrador[k] = t.value;
}

async function guardarEscuela() {
  const e = Object.assign({}, S.escuela, S.escBorrador || {});
  const datos = {
    nombre: String(e.nombre || '').trim(),
    cct: String(e.cct || '').trim().toUpperCase(),
    turno: e.turno || '',
    ciclo: String(e.ciclo || '').trim(),
    horaReporte: /^\d{2}:\d{2}$/.test(e.horaReporte || '') ? e.horaReporte : '13:00',
    firmas: (e.firmas || []).map(f => String(f || '').trim()).slice(0, 3),
    fotos: e.fotos !== false
  };
  try {
    await S.store.guardarEscuela(datos);
    S.escBorrador = null;
    aviso('Datos de la escuela guardados.');
    renderEscuela(); renderSeguridad();
  } catch (err) { errorGuardar(err); }
}

async function guardarPin() {
  const p1 = val('#pin1'), p2 = val('#pin2');
  S.errorPin = '';
  if (!/^\d{4,6}$/.test(p1)) S.errorPin = 'El PIN debe tener de 4 a 6 números.';
  else if (p1 !== p2) S.errorPin = 'Los dos PIN no coinciden.';
  if (S.errorPin) { renderSeguridad(); return; }
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let codigo = '';
  const azar = new Uint32Array(8);
  try { crypto.getRandomValues(azar); } catch (e) { for (let i = 0; i < 8; i++) azar[i] = Math.floor(Math.random() * 1e9); }
  azar.forEach(n => { codigo += letras[n % letras.length]; });
  await S.local.guardarAjustes({ pin: await hashTexto(p1), recuperacion: await hashTexto(codigo), bloqueado: false });
  S.pinActivo = true; S.cambiandoPin = false;
  S.codigoRecuperacion = codigo.slice(0, 4) + '-' + codigo.slice(4);
  aplicarBloqueo();
  renderSeguridad();
  aviso('PIN guardado. Usa «Bloquear» cuando dejes la tablet a los alumnos.');
}

async function crearVinculo(a, b, nota, desdeForm) {
  if (!a || !b) { aviso('Elige a los dos alumnos.', { error: true }); return; }
  if (a === b) { aviso('Elige a dos alumnos distintos.', { error: true }); return; }
  if (S.vinculos.some(v => (v.a === a && v.b === b) || (v.a === b && v.b === a))) { aviso('Esos alumnos ya están vinculados.'); return; }
  try {
    await S.store.guardarVinculo({ id: rid('v'), a, b, nota: nota || '', creado: Date.now() });
    if (desdeForm) S.vincForm = { a: '', b: '', nota: '' };
    aviso('Alumnos vinculados.');
    renderVinculos();
  } catch (e) { errorGuardar(e); }
}

function cambiarGrupo(id) {
  if (!id || id === S.gid) return;
  S.gid = id; prefs.gid = id; guardarPrefs(); recordarUso(id);
  S.sem = null; S.abierto = null; S.ver = S.hoy; S.verClave = ''; S.borrarSalida = null; S.q = '';
  const b = $('#buscar'); if (b) b.value = '';
  suscribirDia(); renderTodo();
}

/* ================= Inicio ================= */
async function iniciar() {
  enlazar();
  cargarAlertadas();
  irA(vistaDeHash(), true);
  renderTodo();
  tic(); setInterval(tic, 1000);

  S.local = await almacenDispositivo();
  const aj = S.local.ajustes();
  S.pinActivo = !!aj.pin;
  S.bloqueado = S.pinActivo && !!aj.bloqueado;
  if (S.bloqueado && S.vista !== 'lista') irA('lista', true);

  // La app nunca espera a la red para abrir: muestra de inmediato los datos de este equipo.
  // Solo si este equipo ya estaba conectado a la escuela espera unos segundos a la nube.
  if (!prefs.modoNube) conectarStore(S.local);
  else setTimeout(() => { if (!S.store) conectarStore(S.local); }, 6000);
  renderBanner();
  aplicarBloqueo();
  iniciarConexion();

  // Deja listas las bibliotecas del PDF para poder usarlas sin internet después.
  setTimeout(() => { if (/^https?:$/.test(location.protocol)) [JSPDF_URL, AUTOTABLE_URL].forEach(u => fetch(u).catch(() => {})); }, 5000);
}

// Funciona sin internet una vez abierta: el service worker guarda la app en el dispositivo.
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}

iniciar();
})();
