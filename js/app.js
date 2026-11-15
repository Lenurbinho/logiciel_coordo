/* =====================================================================
   COORDO — module Conducteur (V1)
   Tout fonctionne dans le navigateur, sans serveur.
   Les données de l'événement sont gardées dans le navigateur (localStorage)
   et peuvent être enregistrées / ouvertes en fichier .json.
   ===================================================================== */
(function () {
'use strict';

const STORE_KEY = 'coordo.event.v1';
const STEP = 15; // palier de 15 secondes

/* ---------------- Valeurs par défaut ---------------- */
const DEFAULT_POSTES = [
  { id: 'dj', label: 'DJ', group: 'AUDIO', visible: true },
  { id: 'speaker', label: 'Speaker', group: 'AUDIO', visible: true },
  { id: 'ecran', label: 'Écran géant', group: 'VIDÉO', visible: true },
  { id: 'lumiere', label: 'Lumière', group: 'TECHNIQUE', visible: true },
  { id: 'tv', label: 'TV / Réal', group: 'VIDÉO', visible: false },
  { id: 'marketing', label: 'Marketing', group: 'PARTENAIRES', visible: false },
];
const DEFAULT_ZONES = [
  { id: 'piste', label: 'Piste' },
  { id: 'c1', label: 'Concours 1' },
  { id: 'c2', label: 'Concours 2' },
];
const PRES = { dj: 'JINGLE', speaker: 'INTRO ÉPREUVE', ecran: 'JINGLE ÉPREUVE' };
const SL = { dj: 'TAPIS MUSICAL', speaker: 'START LIST', ecran: 'START LIST' };
const LU = { dj: 'TAPIS MUSICAL', speaker: 'PRÉSENTATION ATHLÈTES', ecran: 'CAMÉRA SUR ATHLÈTE' };
const RES = { speaker: 'COMMENTAIRE / CLÔTURE / ITW', ecran: 'REPLAY / CAM SI ITW' };
const RUN = { dj: 'MUSIQUE COURSE', speaker: 'COMMENTAIRE', ecran: 'SPORT' };
const DEFAULT_ROUTINES = [
  { id: 'reg', name: 'Course régionale / avant-programme',
    before: [st('PRÉSENTATION ÉPREUVE', 30, 'presentation', PRES), st('START-LIST', 15, 'startlist', SL), st('LINE-UP — LIGNE DE DÉPART', 75, 'lineup', LU)],
    main: RUN, after: [st('ANNONCE RÉSULTAT', 30, 'resultat', RES)] },
  { id: 'int-serie', name: 'Course internationale — série',
    before: [st('PRÉSENTATION ÉPREUVE', 30, 'presentation', PRES), st('START-LIST', 15, 'startlist', SL), st('LINE-UP — SORTIE RIDEAU', 135, 'lineup', LU)],
    main: RUN, after: [st('ANNONCE RÉSULTAT', 30, 'resultat', RES)] },
  { id: 'int-finale', name: 'Course internationale — finale',
    before: [st('PRÉSENTATION ÉPREUVE', 30, 'presentation', PRES), st('START-LIST', 15, 'startlist', SL), st('LINE-UP — RIDEAU — DRAMA ORDER', 135, 'lineup', LU)],
    main: RUN, after: [st('ANNONCE RÉSULTAT', 30, 'resultat', RES), st('ITW VAINQUEUR', 60, 'resultat', { speaker: 'ITW', ecran: 'CAM SUR SPEAKER' })] },
  { id: 'concours', name: 'Concours',
    before: [st('PRÉSENTATION ÉPREUVE', 30, 'presentation', PRES), st('START-LIST', 15, 'startlist', SL), st('LINE-UP — SORTIE RIDEAU', 135, 'lineup', LU)],
    main: { speaker: 'COMMENTAIRE', ecran: 'SPORT' }, after: [] },
  { id: 'aucune', name: '(aucune routine)', before: [], main: {}, after: [] },
];
function st(label, dur, kind, cues) { return { label, dur, kind, cues: Object.assign({}, cues) }; }

const CATEGORIES = [
  ['autre', 'Séquence (speaker / écran…)'], ['partenaires', 'Partenaires / marketing'], ['tunnel', 'Tunnel pub écran'],
  ['animation', 'Animation public'], ['ceremonie', 'Cérémonie / show'], ['protocole', 'Protocole / podium'],
  ['alerte', 'Alerte / vérification'], ['technique', 'Technique / info'],
];
const STEP_KINDS = [['presentation', 'Présentation'], ['startlist', 'Start-list'], ['lineup', 'Line-up'], ['resultat', 'Résultat / après'], ['autre', 'Autre']];
const PRIOS = [['essentiel', 'Essentiel'], ['secondaire', 'Secondaire (raccourcissable)'], ['sacrifiable', 'Sacrifiable (supprimable)']];

/* ---------------- Outils temps ---------------- */
const pad = n => String(n).padStart(2, '0');
function fmtT(s) { if (s == null || isNaN(s)) return ''; s = ((Math.round(s) % 86400) + 86400) % 86400; return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60); }
function fmtD(s) { if (!s) return ''; const m = Math.floor(s / 60), r = s % 60; if (m >= 60) return Math.floor(m / 60) + 'h' + pad(m % 60) + (r ? '' + pad(r) : ''); return m + "'" + pad(r) + '"'; }
function round15(s) { return Math.round(s / STEP) * STEP; }
/* heure : "13:26", "13h26", "13:26:30", "1326" */
function parseT(v) {
  if (v == null) return null; v = String(v).trim(); if (!v) return null;
  let m = v.match(/^(\d{1,2})\s*[:hH.]\s*(\d{2})(?:\s*[:'.]\s*(\d{2}))?/);
  if (!m) { m = v.match(/^(\d{1,2})(\d{2})$/); if (!m) return null; }
  const s = (+m[1]) * 3600 + (+m[2]) * 60 + (+(m[3] || 0));
  return round15(s);
}
/* durée : "2'15", "2:15", "2'15\"", "0:30", "45\"" ; nombre seul = minutes */
function parseD(v) {
  if (v == null) return 0; v = String(v).trim().replace(/[’`]/g, "'"); if (!v) return 0;
  let m;
  if ((m = v.match(/^(\d+):(\d{1,2}):(\d{2})$/))) return round15(+m[1] * 3600 + +m[2] * 60 + +m[3]);
  if ((m = v.match(/^(\d+)\s*h\s*(\d{1,2})?$/i))) return round15(+m[1] * 3600 + (+(m[2] || 0)) * 60);
  if ((m = v.match(/^(\d+)\s*['m:]\s*(\d{1,2})?\s*(?:"|''|s)?$/i))) return round15(+m[1] * 60 + (+(m[2] || 0)));
  if ((m = v.match(/^(\d+)\s*(?:"|''|s)$/i))) return round15(+m[1]);
  if ((m = v.match(/^\d+([.,]\d+)?$/))) return round15(parseFloat(v.replace(',', '.')) * 60);
  return 0;
}
/* durée de course estimée d'après le nom de l'épreuve */
function estimateRun(name) {
  const n = name.toLowerCase();
  if (/marche/.test(n)) { const k = n.match(/(\d+)\s*m/); const d = k ? +k[1] : 3000; return round15(d / 1000 * 270); }
  if (/(\d+)\s*[x\*]\s*1\s*tour/.test(n)) { const k = +n.match(/(\d+)\s*[x\*]/)[1]; return round15(k * 25 + 30); }
  if (/mile/.test(n)) return 270;
  const m = n.match(/(\d{2,5})\s*m/);
  if (!m) return 60;
  const d = +m[1];
  if (d <= 60) return 15; if (d <= 110) return 30; if (d <= 200) return 30; if (d <= 400) return 60;
  if (d <= 800) return 135; if (d <= 1000) return 180; if (d <= 1500) return 270; if (d <= 3000) return 570; if (d <= 5000) return 960;
  return round15(d / 1000 * 200);
}
const CONCOURS_RE = /hauteur|perche|longueur|triple|poids|disque|javelot|marteau/i;

/* ---------------- État ---------------- */
let S = null;
let ui = { tab: 'conducteur', view: 'tous', hideEmpty: false };
try { Object.assign(ui, JSON.parse(localStorage.getItem('coordo.ui') || '{}')); } catch (e) {}
const uid = () => Math.random().toString(36).slice(2, 9);
const clone = o => JSON.parse(JSON.stringify(o));

function blankEvent() {
  return { version: 1, event: { name: 'Nouvel événement', date: '', lieu: '' },
    postes: clone(DEFAULT_POSTES), zones: clone(DEFAULT_ZONES), routines: clone(DEFAULT_ROUTINES), items: [] };
}
function normalize(d) {
  const b = blankEvent();
  d = d || {};
  d.event = Object.assign(b.event, d.event || {});
  d.postes = d.postes && d.postes.length ? d.postes : b.postes;
  d.zones = d.zones && d.zones.length ? d.zones : b.zones;
  d.routines = d.routines && d.routines.length ? d.routines : b.routines;
  d.items = (d.items || []).map(it => normItem(it, d));
  d.version = 1;
  return d;
}
function normItem(it, d) {
  it = Object.assign({ id: uid(), type: 'course', name: '', naming: '', time: null, chain: false, dur: null,
    routine: '', zone: '', fixed: false, priority: 'essentiel', wavelight: '', notes: '', cues: {}, category: 'autre' }, it);
  if (!it.id) it.id = uid();
  if (it.type === 'course') { if (it.dur == null) it.dur = estimateRun(it.name); if (!it.routine) it.routine = 'reg'; if (!it.zone) it.zone = 'piste'; }
  if (it.type === 'concours') { if (it.dur == null) it.dur = 3600; if (!it.routine) it.routine = 'concours'; if (!it.zone) it.zone = (d.zones[1] || d.zones[0]).id; }
  if (it.type === 'bloc') { if (it.dur == null) it.dur = 60; it.routine = ''; }
  if (it.time == null && !it.chain) it.chain = true;
  return it;
}
/* ---------- Bibliothèque d'événements (plusieurs événements dans le navigateur) ----------
   coordo.lib        : liste [{id, name, date, lieu, count, updated}]
   coordo.ev.<id>    : contenu complet d'un événement
   L'événement ouvert dans un onglet est indiqué dans l'adresse (#e=<id>),
   on peut donc en ouvrir plusieurs dans plusieurs onglets. */
const LIB_KEY = 'coordo.lib';
const evKey = id => 'coordo.ev.' + id;
function libRead() { try { return JSON.parse(localStorage.getItem(LIB_KEY) || '[]'); } catch (e) { return []; } }
function libWrite(l) { localStorage.setItem(LIB_KEY, JSON.stringify(l)); }
function libEntry(d) { return { id: d.id, name: d.event.name, date: d.event.date, lieu: d.event.lieu, count: d.items.filter(i => i.type !== 'bloc').length, updated: Date.now() }; }
function libStore(d) {
  localStorage.setItem(evKey(d.id), JSON.stringify(d));
  const l = libRead(); const e = libEntry(d); const i = l.findIndex(x => x.id === d.id);
  if (i >= 0) l[i] = e; else l.push(e);
  libWrite(l);
}
function libLoad(id) { try { const raw = localStorage.getItem(evKey(id)); return raw ? normalize(JSON.parse(raw)) : null; } catch (e) { return null; } }
function libAdd(d, name) { d = normalize(d); d.id = 'e' + uid(); d.liveCode = ''; if (name) d.event.name = name; libStore(d); return d.id; }
function libInit() {
  if (localStorage.getItem(LIB_KEY)) return;
  // première ouverture : on récupère l'événement de l'ancienne version, sinon la démo
  let old = null; try { old = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) {}
  libWrite([]);
  libAdd(clone(window.COORDO_DEMO || {}));
  if (old) libAdd(old);
}
function currentIdFromHash() { const m = location.hash.match(/e=([\w-]+)/); return m ? m[1] : null; }
function load() {
  libInit();
  const id = currentIdFromHash();
  S = id ? libLoad(id) : null;
  if (id && !S) history.replaceState(null, '', location.pathname + location.search);
}
function openEvent(id) { location.hash = 'e=' + id; }
window.addEventListener('hashchange', () => { flushSave(); load(); if (S && ui.tab === 'home') ui.tab = 'conducteur'; render(); window.scrollTo(0, 0); });
let saveTimer = null;
function flushSave() {
  if (!saveTimer) return; clearTimeout(saveTimer); saveTimer = null;
  if (!S) return;
  try { libStore(S); setStatus('Enregistré dans ce navigateur ' + new Date().toLocaleTimeString('fr-FR')); }
  catch (e) { setStatus('⚠ Impossible d\'enregistrer dans le navigateur'); }
}
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(flushSave, 250); }
window.addEventListener('beforeunload', flushSave);
function saveUi() { try { localStorage.setItem('coordo.ui', JSON.stringify(ui)); } catch (e) {} }
function setStatus(t) { const el = document.getElementById('status'); if (el) el.textContent = t; }
const routineById = id => S.routines.find(r => r.id === id) || null;
const zoneById = id => S.zones.find(z => z.id === id) || null;

/* ---------------- Calcul du conducteur ---------------- */
function itemEnd(it, start) {
  if (it.type === 'concours') return start; // un concours tourne en fond : on enchaîne après son début
  const r = it.type === 'bloc' ? null : routineById(it.routine);
  const after = r ? r.after.reduce((a, s) => a + (s.dur || 0), 0) : 0;
  return start + (it.dur || 0) + after;
}
function computeTimes() {
  const times = {}; let prevEnd = null;
  S.items.forEach(it => {
    let t = it.chain || it.time == null ? prevEnd : it.time;
    times[it.id] = t;
    if (t != null) prevEnd = itemEnd(it, t);
  });
  return times;
}
function buildRows() {
  const times = computeTimes();
  const rows = []; const spans = []; let order = 0;
  S.items.forEach(it => {
    const t = times[it.id]; if (t == null) return;
    const base = { itemId: it.id, fixed: false, prio: it.priority, ord: 0 };
    const push = r => rows.push(Object.assign({}, base, r, { ord: order++ }));
    if (it.type === 'bloc') {
      push({ t, dur: it.dur || 0, kind: it.category || 'autre', label: it.name, cues: it.cues || {}, notes: it.notes, fixed: it.fixed, main: true });
      return;
    }
    const r = routineById(it.routine) || { before: [], after: [], main: {} };
    const pre = r.before.reduce((a, s) => a + (s.dur || 0), 0);
    let c = t - pre;
    r.before.forEach(s => { push({ t: c, dur: s.dur, kind: s.kind || 'autre', label: s.label, cues: s.cues || {}, sub: true }); c += s.dur || 0; });
    const title = (it.type === 'concours' ? 'DÉBUT ' : '') + it.name;
    const mainCues = Object.assign({}, r.main || {}, stripEmpty(it.cues || {}));
    push({ t, dur: it.type === 'concours' ? 0 : it.dur, kind: 'main', label: title, naming: it.naming, wavelight: it.wavelight, notes: it.notes,
      cues: mainCues, fixed: it.fixed, main: true, zone: it.zone, zoneText: it.name, type: it.type });
    if (it.type === 'concours') {
      spans.push({ zone: it.zone, from: t, to: t + (it.dur || 0), name: it.name, itemId: it.id });
      push({ t: t + (it.dur || 0), dur: 0, kind: 'info', label: 'Fin estimée — ' + it.name, cues: {}, sub: true });
    } else {
      let a = t + (it.dur || 0);
      r.after.forEach(s => { push({ t: a, dur: s.dur, kind: s.kind || 'resultat', label: s.label, cues: s.cues || {}, sub: true }); a += s.dur || 0; });
    }
  });
  rows.sort((x, y) => x.t - y.t || x.ord - y.ord);
  // détection des chevauchements : une ligne qui démarre avant la fin d'un AUTRE élément.
  // Les repères sans durée (alertes, débuts de concours) ne sont pas signalés,
  // et un seul signalement par élément.
  let busyUntil = -1, busyLabel = '', busyItem = null; const flagged = new Set();
  rows.forEach(r => {
    if (r.kind === 'info' || !r.dur) return;
    if (r.t < busyUntil && busyItem !== r.itemId && !flagged.has(r.itemId)) { r.clash = busyUntil - r.t; r.clashWith = busyLabel; flagged.add(r.itemId); }
    const end = r.t + r.dur;
    if (end > busyUntil) { busyUntil = end; busyLabel = r.main ? r.label : (S.items.find(i => i.id === r.itemId) || {}).name || r.label; busyItem = r.itemId; }
  });
  return { rows, spans, times };
}
function stripEmpty(o) { const r = {}; Object.keys(o).forEach(k => { if (o[k] && String(o[k]).trim()) r[k] = o[k]; }); return r; }

/* ---------------- Rendu général ---------------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const opt = (list, val) => list.map(([v, l]) => `<option value="${esc(v)}"${v === val ? ' selected' : ''}>${esc(l)}</option>`).join('');
function render() {
  const app = document.getElementById('app');
  document.body.classList.toggle('is-home', !S);
  document.getElementById('cur-event').textContent = S ? S.event.name : '';
  if (!S) { app.innerHTML = renderHome(); document.title = 'Coordo — Événements'; return; }
  if (ui.tab === 'home') ui.tab = 'conducteur';
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === ui.tab));
  const f = { event: renderEvent, programme: renderProgramme, routines: renderRoutines, conducteur: renderConducteur, fichiers: renderFichiers }[ui.tab] || renderConducteur;
  app.innerHTML = f();
  document.title = 'Coordo — ' + (S.event.name || 'Conducteur');
}

/* ---------- Onglet Événement ---------- */
function renderEvent() {
  return `
  <div class="panel"><h2>Événement</h2>
    <div class="row">
      <label class="f">Nom<input data-ev="name" value="${esc(S.event.name)}" size="44"></label>
      <label class="f">Date<input data-ev="date" type="date" value="${esc(S.event.date)}"></label>
      <label class="f">Lieu<input data-ev="lieu" value="${esc(S.event.lieu)}" size="40"></label>
    </div>
  </div>
  <div class="panel"><h2>Postes (colonnes du conducteur)</h2>
    <p class="hint">Chaque poste devient une colonne « qui fait quoi ». Décocher « Afficher » masque la colonne sans perdre les consignes déjà saisies.</p>
    <table class="grid" style="max-width:760px"><thead><tr><th>Nom du poste</th><th>Groupe (bandeau)</th><th>Afficher</th><th></th></tr></thead><tbody>
    ${S.postes.map((p, i) => `<tr>
      <td><input data-poste="${i}" data-k="label" value="${esc(p.label)}"></td>
      <td><input data-poste="${i}" data-k="group" value="${esc(p.group || '')}"></td>
      <td><input type="checkbox" data-poste="${i}" data-k="visible" ${p.visible ? 'checked' : ''}></td>
      <td class="actions"><button class="btn icon" data-act="poste-up" data-i="${i}">↑</button><button class="btn icon" data-act="poste-down" data-i="${i}">↓</button>
      <button class="btn icon danger" data-act="poste-del" data-i="${i}" title="Supprimer">✕</button></td></tr>`).join('')}
    </tbody></table>
    <p><button class="btn" data-act="poste-add">+ Ajouter un poste</button></p>
  </div>
  <div class="panel"><h2>Zones de compétition</h2>
    <p class="hint">Les épreuves simultanées (piste + concours) s'affichent chacune dans leur colonne de zone. Un concours apparaît en continu de son début à sa fin estimée.</p>
    <table class="grid" style="max-width:520px"><thead><tr><th>Zone</th><th></th></tr></thead><tbody>
    ${S.zones.map((z, i) => `<tr><td><input data-zone="${i}" value="${esc(z.label)}"></td>
      <td class="actions"><button class="btn icon danger" data-act="zone-del" data-i="${i}">✕</button></td></tr>`).join('')}
    </tbody></table>
    <p><button class="btn" data-act="zone-add">+ Ajouter une zone</button></p>
  </div>`;
}

/* ---------- Onglet Programme ---------- */
function renderProgramme() {
  const times = computeTimes();
  const typeLbl = { course: 'Course', concours: 'Concours', bloc: 'Bloc' };
  return `
  <div class="panel"><h2>Programme</h2>
    <p class="hint">Une ligne par épreuve ou par bloc (cérémonie, partenaires, tunnel pub, animation…). L'ordre de cette liste sert aux blocs « enchaînés » : ils démarrent à la fin de l'élément juste au-dessus. Les étapes de routine (présentation, start-list, line-up…) sont calculées automatiquement à rebours.</p>
    <div class="toolbar">
      <button class="btn primary" data-act="item-new" data-type="course">+ Course</button>
      <button class="btn primary" data-act="item-new" data-type="concours">+ Concours</button>
      <button class="btn primary" data-act="item-new" data-type="bloc">+ Bloc</button>
      <span class="sep"></span>
      <button class="btn" data-act="items-sort">Trier par heure</button>
      <button class="btn" data-act="goto-import">Importer un horaire…</button>
    </div>
    <table class="grid prog"><thead><tr>
      <th class="w-time">Heure</th><th>Type</th><th>Nom</th><th>Routine / catégorie</th><th class="w-dur">Durée</th><th>Zone</th><th>Contraintes</th><th></th></tr></thead><tbody>
    ${S.items.map((it, i) => {
      const t = times[it.id];
      const rt = it.type === 'bloc' ? (CATEGORIES.find(c => c[0] === it.category) || ['', ''])[1] : ((routineById(it.routine) || {}).name || '—');
      const z = it.type === 'bloc' ? '' : ((zoneById(it.zone) || {}).label || '');
      return `<tr class="type-${it.type}">
        <td class="w-time">${it.chain ? `<span class="muted" title="Enchaîné après l'élément précédent">↳ ${fmtT(t)}</span>` : `<b>${fmtT(t)}</b>`}</td>
        <td>${typeLbl[it.type]}</td>
        <td><a href="#" data-act="item-edit" data-id="${it.id}"><b>${esc(it.name) || '<i>sans nom</i>'}</b></a>${it.naming ? `<span class="tag naming">${esc(it.naming)}</span>` : ''}${it.wavelight ? `<span class="tag">WL ${esc(it.wavelight)}</span>` : ''}</td>
        <td>${esc(rt)}</td><td>${fmtD(it.dur)}</td><td>${esc(z)}</td>
        <td>${it.fixed ? '<span class="tag fixe">FIXE</span>' : ''}${it.priority === 'secondaire' ? '<span class="tag sec">secondaire</span>' : ''}${it.priority === 'sacrifiable' ? '<span class="tag sac">sacrifiable</span>' : ''}</td>
        <td class="actions"><button class="btn icon" data-act="item-up" data-i="${i}" title="Monter">↑</button><button class="btn icon" data-act="item-down" data-i="${i}" title="Descendre">↓</button>
          <button class="btn icon" data-act="item-edit" data-id="${it.id}" title="Modifier">✎</button><button class="btn icon" data-act="item-dup" data-i="${i}" title="Dupliquer">⧉</button>
          <button class="btn icon danger" data-act="item-del" data-i="${i}" title="Supprimer">✕</button></td></tr>`;
    }).join('') || '<tr><td colspan="8" class="muted">Aucun élément. Ajoutez une course, un concours ou un bloc, ou importez un horaire (onglet Fichiers).</td></tr>'}
    </tbody></table>
  </div>`;
}

function itemForm(it) {
  const isBloc = it.type === 'bloc';
  const cues = it.cues || {};
  const r = routineById(it.routine);
  return `<h2>${it._new ? 'Nouveau' : 'Modifier'} — ${({ course: 'course', concours: 'concours', bloc: 'bloc' })[it.type]}</h2>
  <div class="grid2">
    <label class="f" style="grid-column:span 2">Nom<input id="fi-name" value="${esc(it.name)}"></label>
    ${isBloc ? '' : `<label class="f">Naming partenaire<input id="fi-naming" value="${esc(it.naming)}"></label>`}
    <label class="f">Heure ${it.type === 'concours' ? 'de début' : (isBloc ? '' : 'de départ')}
      <input id="fi-time" ${it.chain ? "disabled" : ""} value="${it.chain ? '' : fmtT(it.time)}" placeholder="ex : 17:11 ou 17:04:30"></label>
    <label class="f"><span><input type="checkbox" id="fi-chain" ${it.chain ? 'checked' : ''}> Enchaîné après l'élément précédent</span></label>
    ${it.type === 'concours'
      ? `<label class="f">Fin estimée<input id="fi-end" value="${it.time != null && !it.chain ? fmtT(it.time + (it.dur || 0)) : ''}" placeholder="ex : 19:10"></label>`
      : `<label class="f">Durée ${isBloc ? '' : 'de course estimée'}<input id="fi-dur" value="${fmtD(it.dur)}" placeholder="ex : 2'15"></label>`}
    ${isBloc
      ? `<label class="f">Catégorie<select id="fi-cat">${opt(CATEGORIES, it.category)}</select></label>`
      : `<label class="f">Routine<select id="fi-routine">${opt(S.routines.map(r => [r.id, r.name]), it.routine)}</select></label>
         <label class="f">Zone<select id="fi-zone">${opt(S.zones.map(z => [z.id, z.label]), it.zone)}</select></label>`}
    ${it.type === 'course' ? `<label class="f">Wave light<input id="fi-wl" value="${esc(it.wavelight)}" placeholder="ex : 1'47&quot;50"></label>` : ''}
    <label class="f">Priorité<select id="fi-prio">${opt(PRIOS, it.priority)}</select></label>
    <label class="f"><span><input type="checkbox" id="fi-fixed" ${it.fixed ? 'checked' : ''}> Contrainte FIXE (horaire TV…)</span></label>
    <label class="f" style="grid-column:1/-1">Notes<input id="fi-notes" value="${esc(it.notes)}"></label>
  </div>
  <h3>Consignes par poste ${isBloc ? '' : '<span class="muted" style="font-weight:400">(ligne de l\'épreuve — vide = consigne de la routine)</span>'}</h3>
  <div class="cuegrid">
    ${S.postes.map(p => `<label>${esc(p.label)}</label><input data-cue="${p.id}" value="${esc(cues[p.id] || '')}" placeholder="${esc(r && r.main ? (r.main[p.id] || '') : '')}">`).join('')}
  </div>
  <div class="modal-foot">
    ${it._new ? '' : '<button class="btn danger" data-act="modal-del">Supprimer</button>'}
    <span style="flex:1"></span>
    <button class="btn" data-act="modal-close">Annuler</button>
    <button class="btn primary" data-act="modal-save">Enregistrer</button>
  </div>`;
}
let editing = null;
function openItem(it) { editing = it; document.getElementById('modal-body').innerHTML = itemForm(it); document.getElementById('modal').classList.remove('hidden'); setTimeout(() => { const n = document.getElementById('fi-name'); n && n.focus(); }, 30); }
function closeModal() { editing = null; document.getElementById('modal').classList.add('hidden'); }
function saveItem() {
  const it = editing; if (!it) return;
  const v = id => { const el = document.getElementById(id); return el ? (el.type === 'checkbox' ? el.checked : el.value) : undefined; };
  it.name = v('fi-name').trim();
  if (v('fi-naming') !== undefined) it.naming = v('fi-naming').trim();
  it.chain = v('fi-chain');
  const t = parseT(v('fi-time'));
  if (!it.chain) {
    if (t == null) { alert('Indiquez une heure (ex : 17:11) ou cochez « Enchaîné ».'); return; }
    it.time = t;
  } else it.time = null;
  if (it.type === 'concours') {
    const e = parseT(v('fi-end'));
    if (e != null && it.time != null) it.dur = Math.max(0, e - it.time);
  } else it.dur = parseD(v('fi-dur'));
  if (it.type === 'bloc') it.category = v('fi-cat');
  else { it.routine = v('fi-routine'); it.zone = v('fi-zone'); }
  if (v('fi-wl') !== undefined) it.wavelight = v('fi-wl').trim();
  it.priority = v('fi-prio'); it.fixed = v('fi-fixed'); it.notes = v('fi-notes').trim();
  it.cues = {};
  document.querySelectorAll('[data-cue]').forEach(el => { if (el.value.trim()) it.cues[el.dataset.cue] = el.value.trim(); });
  if (it._new) {
    delete it._new;
    // insère à la bonne place chronologique
    const times = computeTimes();
    let idx = S.items.length;
    if (!it.chain) idx = S.items.findIndex(x => times[x.id] != null && times[x.id] > it.time);
    if (idx < 0) idx = S.items.length;
    S.items.splice(idx, 0, it);
  }
  closeModal(); save(); render();
}

/* ---------- Onglet Routines ---------- */
function renderRoutines() {
  const cols = S.postes;
  const stepRows = (r, ri, part) => (r[part] || []).map((s, si) => `<tr>
      <td><input data-step="${ri}|${part}|${si}" data-k="label" value="${esc(s.label)}"></td>
      <td class="w-dur"><input data-step="${ri}|${part}|${si}" data-k="dur" value="${fmtD(s.dur)}"></td>
      <td><select data-step="${ri}|${part}|${si}" data-k="kind">${opt(STEP_KINDS, s.kind)}</select></td>
      ${cols.map(p => `<td><input data-step="${ri}|${part}|${si}" data-k="cue:${p.id}" value="${esc((s.cues || {})[p.id] || '')}"></td>`).join('')}
      <td class="actions"><button class="btn icon" data-act="step-up" data-ref="${ri}|${part}|${si}">↑</button><button class="btn icon danger" data-act="step-del" data-ref="${ri}|${part}|${si}">✕</button></td></tr>`).join('');
  return `<div class="panel"><h2>Routines</h2>
    <p class="hint">Une routine = l'enchaînement type autour d'une épreuve. Les étapes « avant » sont placées à rebours depuis l'heure de départ (comme les formules de ton Google Sheets). Durées par paliers de 15" (ex : 0'30, 1'15, 2'15). Modifier une routine met à jour toutes les épreuves qui l'utilisent.</p>
    ${S.routines.map((r, ri) => `<div class="routine">
      <div class="routine-head"><input data-rname="${ri}" value="${esc(r.name)}">
        <span class="muted">Avant : ${fmtD(r.before.reduce((a, s) => a + s.dur, 0)) || '0'} · Utilisée par ${S.items.filter(i => i.routine === r.id).length} épreuve(s)</span>
        <span style="flex:1"></span>
        <button class="btn small" data-act="routine-dup" data-i="${ri}">Dupliquer</button>
        <button class="btn small danger" data-act="routine-del" data-i="${ri}">Supprimer</button></div>
      <table class="grid steps"><thead><tr><th>Étape</th><th>Durée</th><th>Type</th>${cols.map(p => `<th>${esc(p.label)}</th>`).join('')}<th></th></tr></thead><tbody>
        <tr><td class="sect" colspan="${cols.length + 4}">AVANT L'ÉPREUVE <button class="btn small" data-act="step-add" data-ref="${ri}|before">+ étape</button></td></tr>
        ${stepRows(r, ri, 'before')}
        <tr><td class="sect" colspan="3">LIGNE DE L'ÉPREUVE (départ)</td>${cols.map(p => `<td><input data-rmain="${ri}" data-k="${p.id}" value="${esc((r.main || {})[p.id] || '')}"></td>`).join('')}<td></td></tr>
        <tr><td class="sect" colspan="${cols.length + 4}">APRÈS L'ÉPREUVE <button class="btn small" data-act="step-add" data-ref="${ri}|after">+ étape</button></td></tr>
        ${stepRows(r, ri, 'after')}
      </tbody></table></div>`).join('')}
    <button class="btn primary" data-act="routine-add">+ Nouvelle routine</button>
  </div>`;
}

/* ---------- Onglet Conducteur ---------- */
function renderConducteur() {
  const { rows, spans } = buildRows();
  const postes = S.postes.filter(p => p.visible);
  const single = ui.view !== 'tous' ? S.postes.find(p => p.id === ui.view) : null;
  const showP = single ? [single] : postes;
  const zones = single ? [] : S.zones.filter(z => S.items.some(i => i.zone === z.id && i.type !== 'bloc'));
  const clashes = rows.filter(r => r.clash);
  const fixed = rows.filter(r => r.fixed && r.main);
  const first = rows.length ? rows[0].t : null, last = rows.length ? Math.max(...rows.map(r => r.t + (r.dur || 0))) : null;
  // groupes de colonnes (bandeau)
  const groups = []; showP.forEach(p => { const g = p.group || ''; if (groups.length && groups[groups.length - 1].g === g) groups[groups.length - 1].n++; else groups.push({ g, n: 1 }); });
  let n = 0;
  const body = rows.map(r => {
    const hasCue = showP.some(p => r.cues && r.cues[p.id]);
    const dim = single && !hasCue && !r.main;
    if (single && ui.hideEmpty && !hasCue && !r.main) return '';
    n++;
    const cls = ['k-' + r.kind, r.fixed ? 'fixe' : '', r.clash ? 'clash' : '', 'prio-' + (r.prio || ''), dim ? 'dim' : ''].join(' ');
    const label = `${esc(r.label)}${r.naming ? ` <span class="tag naming">${esc(r.naming)}</span>` : ''}${r.fixed ? ' <span class="tag fixe">FIXE</span>' : ''}${r.main && r.prio === 'secondaire' ? ' <span class="tag sec">secondaire</span>' : ''}${r.main && r.prio === 'sacrifiable' ? ' <span class="tag sac">sacrifiable</span>' : ''}`
      + (r.wavelight ? `<span class="wl">Wave light : ${esc(r.wavelight)}</span>` : '')
      + (r.notes ? `<span class="note">${esc(r.notes)}</span>` : '')
      + (r.clash ? `<span class="clashmsg">⚠ chevauche « ${esc(r.clashWith)} » de ${fmtD(r.clash)}</span>` : '');
    const zcells = zones.map(z => {
      if (r.zone === z.id && r.main) return `<td class="zone start">${esc(r.zoneText)}</td>`;
      const sp = spans.find(s => s.zone === z.id && r.t > s.from && r.t < s.to);
      return sp ? `<td class="zone on">│ ${esc(sp.name)}</td>` : '<td class="zone"></td>';
    }).join('');
    return `<tr class="${cls}" data-item="${r.itemId}"><td class="n">${n}</td><td class="t">${fmtT(r.t)}</td><td class="d">${fmtD(r.dur)}</td><td class="a">${label}</td>
      ${showP.map(p => `<td class="cue">${esc((r.cues || {})[p.id] || '')}</td>`).join('')}${zcells}</tr>`;
  }).join('');
  return `
  <div class="toolbar no-print">
    <label>Vue : <select data-ui="view"><option value="tous">Conducteur complet</option>${S.postes.map(p => `<option value="${p.id}"${ui.view === p.id ? ' selected' : ''}>Poste ${esc(p.label)}</option>`).join('')}</select></label>
    ${single ? `<label><input type="checkbox" data-ui="hideEmpty" ${ui.hideEmpty ? 'checked' : ''}> Masquer les lignes sans consigne</label>` : ''}
    <span class="sep"></span>
    <button class="btn primary" data-act="go-live">▶ Passer en LIVE</button>
    <span class="sep"></span>
    <button class="btn" data-act="print">Imprimer / PDF</button>
    <button class="btn" data-act="export-xls">Export Excel</button>
    <span class="sep"></span>
    <span class="muted">Clic sur une ligne = modifier l'élément</span>
  </div>
  ${clashes.length ? `<div class="alertbox no-print"><b>${clashes.length} enchaînement(s) serré(s)</b> — des lignes démarrent avant la fin de la précédente :
     <ul>${clashes.slice(0, 8).map(c => `<li>${fmtT(c.t)} « ${esc(c.main ? c.label : c.label + ' — ' + ((S.items.find(i => i.id === c.itemId) || {}).name || ''))} » chevauche « ${esc(c.clashWith)} » de ${fmtD(c.clash)}</li>`).join('')}${clashes.length > 8 ? '<li>…</li>' : ''}</ul></div>` : ''}
  <div class="cond-head">
    <div><h1>${esc(S.event.name)}${single ? ' — ' + esc(single.label) : ''}</h1>
      <div class="sub">${esc(S.event.lieu)}${S.event.date ? ' · ' + new Date(S.event.date + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''}</div></div>
    <div class="summary">${first != null ? `<span>Début <b>${fmtT(first)}</b></span><span>Fin <b>${fmtT(last)}</b></span>` : ''}
      <span><b>${S.items.filter(i => i.type !== 'bloc').length}</b> épreuves</span><span><b>${fixed.length}</b> contrainte(s) fixe(s)</span></div>
  </div>
  <table class="cond" id="cond-table">
    <thead>
      <tr class="groups"><th colspan="4">ACTION</th>${groups.map(g => `<th colspan="${g.n}">${esc(g.g)}</th>`).join('')}${zones.length ? `<th colspan="${zones.length}">COMPÉTITION</th>` : ''}</tr>
      <tr><th>N°</th><th>Heure</th><th>Durée</th><th>Action</th>${showP.map(p => `<th>${esc(p.label)}</th>`).join('')}${zones.map(z => `<th>${esc(z.label)}</th>`).join('')}</tr>
    </thead>
    <tbody>${body || `<tr><td colspan="${4 + showP.length + zones.length}" class="muted">Le programme est vide.</td></tr>`}</tbody>
  </table>
  <p class="print-only muted">Édité le ${new Date().toLocaleString('fr-FR')} — Coordo</p>`;
}

/* ---------- Accueil : liste des événements ---------- */
function renderHome() {
  const l = libRead().sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.updated - a.updated);
  const fd = d => d ? new Date(d + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) : 'date à définir';
  return `<div class="home">
    <div class="home-head"><h1>Mes événements</h1>
      <div class="toolbar">
        <button class="btn primary" data-act="home-new">+ Nouvel événement</button>
        <button class="btn" data-act="file-open">📂 Importer un fichier .json…</button>
        <button class="btn" data-act="home-demo">Ajouter la démo (Meeting de l'Eure)</button>
      </div></div>
    <p class="hint">Les événements sont gardés dans ce navigateur. Un clic ouvre l'événement ; clic molette ou Ctrl+clic pour l'ouvrir dans un nouvel onglet et travailler sur plusieurs à la fois. Pense à exporter un .json de temps en temps pour avoir une sauvegarde (ou pour passer sur un autre ordinateur).</p>
    <div class="cards">
    ${l.map(e => `<div class="evcard">
      <a class="ev-open" href="#e=${e.id}"><div class="ev-date">${esc(fd(e.date))}</div><div class="ev-name">${esc(e.name || 'Sans nom')}</div>
        <div class="ev-meta">${esc(e.lieu || '')}</div><div class="ev-meta">${e.count} épreuve(s) · modifié le ${new Date(e.updated).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div></a>
      <div class="ev-actions">
        <a class="btn small primary" href="#e=${e.id}">Ouvrir</a>
        <button class="btn small" data-act="home-dup" data-id="${e.id}">Dupliquer</button>
        <button class="btn small" data-act="home-export" data-id="${e.id}">Exporter .json</button>
        <button class="btn small danger" data-act="home-del" data-id="${e.id}">Supprimer</button>
      </div></div>`).join('') || '<p class="muted">Aucun événement. Crée-en un ou importe un fichier.</p>'}
    </div></div>`;
}

/* ---------- Onglet Fichiers ---------- */
function renderFichiers() {
  return `
  <div class="panel"><h2>Fichier de l'événement</h2>
    <p class="hint">L'événement est gardé automatiquement dans ce navigateur. Le fichier .json sert de sauvegarde ou à passer sur un autre ordinateur. Pour changer d'événement, créer ou dupliquer : bouton « ⌂ Mes événements » en haut à gauche.</p>
    <div class="toolbar">
      <button class="btn primary" data-act="file-save">💾 Exporter cet événement (.json)</button>
      <button class="btn" data-act="file-open">📂 Importer un fichier .json (nouvel événement)…</button>
      <button class="btn" data-act="home-dup" data-id="${S.id}">Dupliquer cet événement</button>
    </div>
  </div>
  <div class="panel" id="import"><h2>Importer un horaire</h2>
    <p class="hint">Copie depuis Excel / Google Sheets les colonnes <b>Épreuve</b> et <b>Heure</b> (et éventuellement <b>Heure de fin</b> pour les concours), puis colle ci-dessous. Les concours (hauteur, perche, longueur, triple, poids, disque, javelot, marteau) sont reconnus automatiquement. Les lignes contenant « cérémonie », « animation » ou « protocole » deviennent des blocs.</p>
    <textarea id="imp-text" placeholder="10*1 tour fetes des clubs	13:26&#10;Hauteur hommes	14:10	15:50&#10;1000m Be Mi Femmes	13:54"></textarea>
    <div class="row" style="margin-top:8px">
      <label class="f">Routine pour les courses<select id="imp-routine">${opt(S.routines.map(r => [r.id, r.name]), 'reg')}</select></label>
      <label class="f">Routine pour les concours<select id="imp-routine-c">${opt(S.routines.map(r => [r.id, r.name]), 'concours')}</select></label>
      <label class="f"><span><input type="checkbox" id="imp-replace"> Remplacer le programme actuel</span></label>
      <button class="btn primary" data-act="import-go">Importer</button>
    </div>
    <div id="imp-result" class="hint"></div>
  </div>`;
}
function doImport() {
  const txt = document.getElementById('imp-text').value;
  const rc = document.getElementById('imp-routine').value, rcc = document.getElementById('imp-routine-c').value;
  const out = [];
  txt.split(/\r?\n/).forEach(line => {
    if (!line.trim()) return;
    const cells = line.split(/\t|;/).map(c => c.trim()).filter(Boolean);
    const times = cells.map(parseT).filter(t => t != null);
    const name = cells.find(c => parseT(c) == null && !/^\d+$/.test(c));
    if (!name || !times.length) return;
    const low = name.toLowerCase();
    let it;
    if (/c[ée]r[ée]monie|animation|protocole/.test(low)) it = { type: 'bloc', category: /protocole/.test(low) ? 'protocole' : (/animation/.test(low) ? 'animation' : 'ceremonie'), dur: 180 };
    else if (CONCOURS_RE.test(name)) it = { type: 'concours', routine: rcc, dur: times[1] ? Math.max(0, times[1] - times[0]) : 3600, zone: (S.zones[1] || S.zones[0]).id };
    else it = { type: 'course', routine: rc, zone: S.zones[0].id };
    it.name = name; it.time = times[0];
    out.push(normItem(it, S));
  });
  if (!out.length) { document.getElementById('imp-result').textContent = 'Rien reconnu : vérifie qu\'il y a bien un nom et une heure sur chaque ligne.'; return; }
  if (document.getElementById('imp-replace').checked) S.items = [];
  S.items = S.items.concat(out);
  sortItems();
  save();
  document.getElementById('imp-result').innerHTML = `<b style="color:var(--ok)">${out.length} élément(s) importé(s).</b> Va dans l'onglet Programme pour les vérifier.`;
}
function sortItems() {
  // trie par heure en gardant chaque bloc « enchaîné » derrière son prédécesseur
  const groups = []; S.items.forEach(it => { if (it.chain && groups.length) groups[groups.length - 1].push(it); else groups.push([it]); });
  groups.sort((a, b) => (a[0].time == null ? -1 : a[0].time) - (b[0].time == null ? -1 : b[0].time));
  S.items = [].concat(...groups);
}

/* ---------- Export Excel (tableau mis en forme) ---------- */
function exportXls() {
  const table = document.getElementById('cond-table'); if (!table) return;
  const css = getComputedStyle(document.documentElement);
  const colors = {};
  ['presentation', 'lineup', 'resultat', 'partenaires', 'ceremonie', 'alerte', 'tunnel', 'technique', 'protocole', 'animation'].forEach(k => colors[k] = css.getPropertyValue('--c-' + k).trim());
  colors.startlist = colors.presentation;
  const clone = table.cloneNode(true);
  clone.querySelectorAll('tr').forEach(tr => {
    const k = [...tr.classList].find(c => c.startsWith('k-')); const kind = k ? k.slice(2) : '';
    tr.querySelectorAll('td').forEach((td, i) => {
      let st = 'border:1px solid #999;vertical-align:top;font-family:Arial;font-size:10pt;';
      if (td.classList.contains('t') || td.classList.contains('d')) st += 'mso-number-format:"\\@";';
      if ((td.classList.contains('a') || td.classList.contains('cue')) && colors[kind]) st += 'background:' + colors[kind] + ';' + (kind === 'ceremonie' ? 'color:#fff;' : '');
      if (kind === 'main') st += 'font-weight:bold;';
      if (tr.classList.contains('fixe') && td.classList.contains('t')) st += 'background:#c62828;color:#fff;';
      if (td.classList.contains('zone') && td.textContent.trim()) st += 'background:#fff3c4;';
      td.setAttribute('style', st);
    });
    tr.querySelectorAll('th').forEach(th => th.setAttribute('style', 'background:#111827;color:#fff;border:1px solid #999;font-family:Arial;font-size:10pt;'));
  });
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>
    <h2>${esc(S.event.name)}</h2><p>${esc(S.event.lieu)} ${esc(S.event.date)}</p>${clone.outerHTML}</body></html>`;
  download(new Blob(['﻿' + html], { type: 'application/vnd.ms-excel' }), fileBase() + (ui.view !== 'tous' ? '_' + ui.view : '') + '.xls');
}
function fileBase() { return ('conducteur_' + (S.event.name || 'evenement')).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/_+/g, '_').slice(0, 60); }
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

/* ---------- Envoi du conducteur vers le module Live ---------- */
function livePlan() {
  const { rows } = buildRows();
  const count = {};
  const names = {}; S.items.forEach(i => { names[i.id] = i.name; });
  const out = rows.filter(r => r.kind !== 'info').map(r => {
    count[r.itemId] = (count[r.itemId] || 0) + 1;
    return { id: r.itemId + '_' + count[r.itemId], itemId: r.itemId, t: r.t, dur: r.dur || 0, kind: r.kind, label: r.label,
      cues: stripEmpty(r.cues || {}), fixed: !!r.fixed, prio: r.prio || 'essentiel', main: !!r.main, sub: !!r.sub,
      of: r.sub ? (names[r.itemId] || '') : '', naming: r.naming || '', wavelight: r.wavelight || '', notes: r.notes || '', type: r.type || (r.main ? 'bloc' : '') };
  });
  if (!S.liveCode) { const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; S.liveCode = Array.from({ length: 6 }, () => a[Math.floor(Math.random() * a.length)]).join(''); save(); flushSave(); }
  return { event: S.event, eventId: S.id, code: S.liveCode, postes: S.postes.map(p => ({ id: p.id, label: p.label })), rows: out, publishedAt: Date.now() };
}
function publishLive() {
  try { localStorage.setItem('coordo.liveplan.' + S.id, JSON.stringify(livePlan())); }
  catch (e) { alert('Impossible de préparer le live : ' + e.message); return; }
  window.open('live.html?regie=1&e=' + encodeURIComponent(S.id), 'coordo-regie-' + S.id);
}

/* ---------------- Événements utilisateur ---------------- */
function move(arr, i, d) { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; }
function stepRef(ref) { const [ri, part, si] = ref.split('|'); return { r: S.routines[+ri], part, si: si == null ? null : +si }; }

document.addEventListener('click', e => {
  const tab = e.target.closest('#tabs button');
  if (tab) { ui.tab = tab.dataset.tab; saveUi(); render(); window.scrollTo(0, 0); return; }
  if (e.target.id === 'modal') { closeModal(); return; }
  const b = e.target.closest('[data-act]');
  if (!b) {
    const tr = e.target.closest('table.cond tbody tr[data-item]');
    if (tr) { const it = S.items.find(x => x.id === tr.dataset.item); if (it) openItem(it); }
    return;
  }
  e.preventDefault();
  const a = b.dataset.act, i = +b.dataset.i;
  switch (a) {
    case 'poste-add': S.postes.push({ id: 'p' + uid(), label: 'Nouveau poste', group: '', visible: true }); break;
    case 'poste-del': if (!confirm('Supprimer le poste « ' + S.postes[i].label + ' » et toutes ses consignes ?')) return; S.postes.splice(i, 1); break;
    case 'poste-up': move(S.postes, i, -1); break;
    case 'poste-down': move(S.postes, i, 1); break;
    case 'zone-add': S.zones.push({ id: 'z' + uid(), label: 'Nouvelle zone' }); break;
    case 'zone-del': if (S.zones.length < 2) return; S.zones.splice(i, 1); break;
    case 'item-new': {
      const type = b.dataset.type;
      openItem(normItem({ type, _new: true, chain: false, time: null, name: '', dur: type === 'bloc' ? 60 : (type === 'concours' ? 3600 : 60) }, S));
      editing.chain = false; document.getElementById('modal-body').innerHTML = itemForm(editing);
      return;
    }
    case 'item-edit': { const it = S.items.find(x => x.id === b.dataset.id); if (it) openItem(it); return; }
    case 'item-dup': { const c = clone(S.items[i]); c.id = uid(); c.name += ' (copie)'; S.items.splice(i + 1, 0, c); break; }
    case 'item-del': if (!confirm('Supprimer « ' + S.items[i].name + ' » ?')) return; S.items.splice(i, 1); break;
    case 'item-up': move(S.items, i, -1); break;
    case 'item-down': move(S.items, i, 1); break;
    case 'items-sort': sortItems(); break;
    case 'goto-import': ui.tab = 'fichiers'; saveUi(); render(); document.getElementById('import').scrollIntoView(); return;
    case 'modal-close': closeModal(); return;
    case 'modal-save': saveItem(); return;
    case 'modal-del': { const it = editing; if (!confirm('Supprimer « ' + it.name + ' » ?')) return; S.items = S.items.filter(x => x !== it); closeModal(); break; }
    case 'routine-add': S.routines.push({ id: 'r' + uid(), name: 'Nouvelle routine', before: [], main: {}, after: [] }); break;
    case 'routine-dup': { const c = clone(S.routines[i]); c.id = 'r' + uid(); c.name += ' (copie)'; S.routines.splice(i + 1, 0, c); break; }
    case 'routine-del': {
      const r = S.routines[i]; const used = S.items.filter(x => x.routine === r.id).length;
      if (!confirm(`Supprimer la routine « ${r.name} » ?${used ? `\n${used} épreuve(s) l'utilisent : elles passeront sans routine.` : ''}`)) return;
      S.items.forEach(x => { if (x.routine === r.id) x.routine = 'aucune'; }); S.routines.splice(i, 1);
      if (!routineById('aucune')) S.routines.push(clone(DEFAULT_ROUTINES.find(x => x.id === 'aucune')));
      break;
    }
    case 'step-add': { const { r, part } = stepRef(b.dataset.ref); r[part].push(st('NOUVELLE ÉTAPE', 30, part === 'after' ? 'resultat' : 'autre', {})); break; }
    case 'step-del': { const { r, part, si } = stepRef(b.dataset.ref); r[part].splice(si, 1); break; }
    case 'step-up': { const { r, part, si } = stepRef(b.dataset.ref); move(r[part], si, -1); break; }
    case 'print': window.print(); return;
    case 'go-live': publishLive(); return;
    case 'export-xls': exportXls(); return;
    case 'file-save': download(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }), fileBase() + '.json'); return;
    case 'file-open': document.getElementById('file-open').click(); return;
    case 'go-home': flushSave(); location.hash = ''; S = null; render(); return;
    case 'home-new': { ui.tab = 'event'; saveUi(); openEvent(libAdd(blankEvent())); return; }
    case 'home-demo': libAdd(clone(window.COORDO_DEMO)); render(); return;
    case 'home-dup': {
      flushSave();
      const src = libLoad(b.dataset.id); if (!src) return;
      const name = prompt('Nom de la copie :', src.event.name + ' (copie)'); if (name == null) return;
      const id = libAdd(src, name.trim() || src.event.name);
      if (S) openEvent(id); else render();
      return;
    }
    case 'home-export': { const d = libLoad(b.dataset.id); if (!d) return; const keep = S; S = d; const n = fileBase(); S = keep; download(new Blob([JSON.stringify(d, null, 1)], { type: 'application/json' }), n + '.json'); return; }
    case 'home-del': {
      const e = libRead().find(x => x.id === b.dataset.id); if (!e) return;
      if (!confirm('Supprimer définitivement « ' + e.name + ' » de ce navigateur ?\n(Exporte-le d\'abord en .json si tu veux le garder.)')) return;
      localStorage.removeItem(evKey(e.id)); localStorage.removeItem('coordo.liveplan.' + e.id);
      libWrite(libRead().filter(x => x.id !== e.id)); render(); return;
    }
    case 'import-go': doImport(); return;
    default: return;
  }
  save(); render();
});

document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.ev) { S.event[el.dataset.ev] = el.value; save(); document.getElementById('cur-event').textContent = S.event.name; return; }
  if (el.dataset.poste != null) { const p = S.postes[+el.dataset.poste]; p[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; save(); return; }
  if (el.dataset.zone != null) { S.zones[+el.dataset.zone].label = el.value; save(); return; }
  if (el.dataset.rname != null) { S.routines[+el.dataset.rname].name = el.value; save(); return; }
  if (el.dataset.rmain != null) { const r = S.routines[+el.dataset.rmain]; r.main = r.main || {}; r.main[el.dataset.k] = el.value; save(); return; }
  if (el.dataset.step) {
    const { r, part, si } = stepRef(el.dataset.step); const s = r[part][si]; const k = el.dataset.k;
    if (k === 'dur') { s.dur = parseD(el.value); el.value = fmtD(s.dur); save(); render(); return; }
    if (k.startsWith('cue:')) { s.cues = s.cues || {}; s.cues[k.slice(4)] = el.value; } else s[k] = el.value;
    save(); return;
  }
  if (el.dataset.ui) { ui[el.dataset.ui] = el.type === 'checkbox' ? el.checked : el.value; saveUi(); render(); return; }
  if (el.id === 'fi-chain') { const t = document.getElementById('fi-time'); if (t) t.disabled = el.checked; return; }
  if (el.id === 'file-open') {
    const f = el.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      let id = null;
      try { const d = JSON.parse(rd.result); if (!d || !d.event) throw new Error(); id = libAdd(d); }
      catch (err) { alert('Fichier illisible : ce n\'est pas un fichier Coordo (.json).'); }
      el.value = '';
      if (id) { flushSave(); ui.tab = 'conducteur'; saveUi(); openEvent(id); setStatus('Fichier importé : ' + f.name); }
    };
    rd.readAsText(f);
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && editing) closeModal();
  if (e.key === 'Enter' && editing && e.target.tagName === 'INPUT') { e.preventDefault(); saveItem(); }
});

/* ---------------- Démarrage ---------------- */
load();
render();
setStatus('Prêt');
// exposé pour les tests
window.COORDO = { get state() { return S; }, buildRows, livePlan, parseT, parseD, fmtT, fmtD, estimateRun };
})();
