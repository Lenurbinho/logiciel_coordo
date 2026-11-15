/* =====================================================================
   COORDO — module LIVE
   - Régie (le topeur) : live.html?regie=1
   - Poste (lecture seule) : live.html?code=XXXXXX&poste=dj   (poste=tous pour tout voir)
   Synchronisation : Firebase Realtime Database si configurée (js/firebase-config.js),
   sinon « mode local » entre onglets du même navigateur.
   ===================================================================== */
(function () {
'use strict';

const P = new URLSearchParams(location.search);
const ROLE = P.get('poste') ? 'poste' : (P.has('regie') ? 'regie' : (P.has('journal') ? 'journal' : 'accueil'));
const POSTE = P.get('poste') || '';
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- Temps ---------------- */
function fmtT(s) { if (s == null || isNaN(s)) return '--:--:--'; s = ((Math.floor(s) % 86400) + 86400) % 86400; return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60); }
function fmtD(s) { if (s == null || isNaN(s)) return ''; const neg = s < 0; s = Math.abs(Math.round(s)); const m = Math.floor(s / 60), r = s % 60; return (neg ? '-' : '') + m + "'" + pad(r) + '"'; }
function fmtCount(s) { const neg = s < 0; s = Math.abs(Math.ceil(s)); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, r = s % 60; return (neg ? '+' : '') + (h ? h + ':' + pad(m) : pad(m)) + ':' + pad(r); }
function tod(ms) { const d = new Date(ms); return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000; }

/* ---------------- Code de l'événement ---------------- */
function genCode() { const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let c = ''; for (let i = 0; i < 6; i++) c += a[Math.floor(Math.random() * a.length)]; return c; }
const EV = P.get('e') || '';
const PLAN_KEY = EV ? 'coordo.liveplan.' + EV : 'coordo.liveplan';
function readLocalPlan() { try { return JSON.parse(localStorage.getItem(PLAN_KEY) || 'null'); } catch (e) { return null; } }
let CODE = (P.get('code') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
if (!CODE && (ROLE === 'regie' || ROLE === 'journal')) {
  const lp = readLocalPlan();
  CODE = (lp && lp.code) || localStorage.getItem('coordo.live.code') || genCode();
  if (!(lp && lp.code)) localStorage.setItem('coordo.live.code', CODE);
}

/* ---------------- Configuration Firebase ---------------- */
function fbConfig() {
  if (window.COORDO_FIREBASE) return { cfg: window.COORDO_FIREBASE, from: 'fichier' };
  const inUrl = P.get('fb');
  if (inUrl) { try { return { cfg: JSON.parse(decodeURIComponent(escape(atob(inUrl)))), from: 'lien' }; } catch (e) {} }
  try { const l = localStorage.getItem('coordo.fbcfg'); if (l) return { cfg: JSON.parse(l), from: 'navigateur' }; } catch (e) {}
  return null;
}
function parseFirebaseSnippet(txt) {
  const m = txt.match(/\{[\s\S]*\}/); if (!m) return null;
  let j = m[0].replace(/\/\/.*$/gm, '').replace(/([{,]\s*)([A-Za-z_][\w]*)\s*:/g, '$1"$2":').replace(/'/g, '"').replace(/,\s*}/g, '}');
  try { const o = JSON.parse(j); return o.databaseURL ? o : null; } catch (e) { return null; }
}

/* ---------------- Couche de synchronisation ---------------- */
const Sync = {
  mode: 'local', offset: 0, connected: true, db: null, listeners: [],
  key() { return 'coordo.live.data.' + CODE; },
  async init() {
    const fc = fbConfig();
    if (fc) {
      try {
        await loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
        await loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js');
        firebase.initializeApp(fc.cfg);
        this.db = firebase.database();
        this.mode = 'firebase'; this.cfgFrom = fc.from;
        this.db.ref('.info/serverTimeOffset').on('value', s => { this.offset = s.val() || 0; });
        this.db.ref('.info/connected').on('value', s => { this.connected = !!s.val(); showConn(); });
        this.db.ref('events/' + CODE).on('value', s => this.emit(s.val() || {}));
        return;
      } catch (e) { console.error(e); this.fbError = String(e.message || e); }
    }
    this.mode = 'local';
    window.addEventListener('storage', e => { if (e.key === this.key()) this.emit(this.readLocal()); });
    setTimeout(() => this.emit(this.readLocal()), 0);
  },
  readLocal() { try { return JSON.parse(localStorage.getItem(this.key()) || '{}'); } catch (e) { return {}; } },
  now() { return Date.now() + this.offset; },
  set(path, val) {
    if (this.mode === 'firebase') return this.db.ref('events/' + CODE + '/' + path).set(clean(val));
    const d = this.readLocal(); d[path] = val; localStorage.setItem(this.key(), JSON.stringify(d)); this.emit(d);
  },
  on(cb) { this.listeners.push(cb); },
  emit(d) { this.listeners.forEach(cb => cb(d)); },
};
function clean(o) { return JSON.parse(JSON.stringify(o, (k, v) => (v === undefined ? null : v))); }
function loadScript(src) { return new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ko(new Error('Chargement impossible : ' + src)); document.head.appendChild(s); }); }
function showConn() {
  const el = $('conn'); if (!el) return;
  if (Sync.mode === 'local') { el.className = 'conn local'; el.textContent = 'MODE LOCAL (même navigateur uniquement)'; return; }
  el.className = 'conn ' + (Sync.connected ? 'ok' : 'ko');
  el.textContent = Sync.connected ? 'EN LIGNE' : 'CONNEXION PERDUE — reconnexion…';
}

/* ---------------- Données partagées ---------------- */
let PLAN = null;           // { event, postes, rows, publishedAt }
let LIVE = blankLive();    // { cur, curStart, adj, hist, log, msg }
function blankLive() { return { cur: -1, curStart: 0, adj: {}, hist: [], log: {}, msg: null, journal: [], notes: {} }; }
function normLive(l) { l = Object.assign(blankLive(), l || {}); l.adj = l.adj || {}; l.hist = l.hist || []; l.log = l.log || {}; l.journal = l.journal || []; l.notes = l.notes || {}; return l; }
const plainLabel = r => r ? r.label + (r.of ? ' — ' + r.of : '') : '';
/* Journal : chaque action de la régie est notée avec son heure (pour le RETEX) */
function jlog(e) { e.at = e.at || Sync.now(); LIVE.journal.push(e); if (LIVE.journal.length > 3000) LIVE.journal.shift(); }
/* Archives du journal, gardées dans ce navigateur par événement */
const retexKey = () => 'coordo.retex.' + (EV || CODE);
function readArchives() { try { return JSON.parse(localStorage.getItem(retexKey()) || '[]'); } catch (e) { return []; } }
function archiveLive(label) {
  if (!PLAN || !LIVE.journal.length) return false;
  const a = readArchives();
  a.push({ id: 'a' + Date.now().toString(36), at: Date.now(), label: label || '', plan: PLAN, live: clean(LIVE) });
  localStorage.setItem(retexKey(), JSON.stringify(a));
  return true;
}

/* Projection : à partir de l'état réel, calcule l'heure prévue de chaque ligne.
   - Les lignes déjà passées gardent leur heure réelle.
   - Une ligne ne peut pas commencer avant son heure prévue, ni avant la fin de la précédente.
     => le retard se propage tant que les lignes s'enchaînent, et se résorbe tout seul
        dans les « trous » du conducteur (rattrapage progressif).
   - Une contrainte FIXE ne bouge jamais : si on arrive en retard dessus, elle est « menacée ». */
function project(nowMs) {
  if (!PLAN) return [];
  const nowS = tod(nowMs); const adj = LIVE.adj || {}; const cur = LIVE.cur;
  let prevEnd = null;
  return PLAN.rows.map((r0, i) => {
    const a = adj[r0.id] || {};
    const r = Object.assign({}, r0, { i, dur: a.dur != null ? a.dur : r0.dur, skip: !!a.skip, short: a.dur != null && a.dur !== r0.dur });
    if (cur >= 0 && i < cur) { r.state = r.skip ? 'skipped' : 'done'; r.real = LIVE.log[r.id] != null ? tod(LIVE.log[r.id]) : null; return r; }
    if (i === cur) {
      r.state = 'current'; r.proj = tod(LIVE.curStart); r.delta = r.proj - r.t;
      r.elapsed = nowS - r.proj; r.remain = r.dur - r.elapsed;
      prevEnd = Math.max(r.proj + r.dur, nowS);
      return r;
    }
    if (r.skip) { r.state = 'skipped'; return r; }
    r.state = 'todo';
    if (prevEnd == null) prevEnd = nowS;
    if (r.fixed) { r.proj = r.t; r.threat = Math.max(0, prevEnd - r.t); }
    else r.proj = Math.max(r.t, prevEnd);
    r.delta = r.proj - r.t;
    prevEnd = r.proj + r.dur;
    return r;
  });
}
const lab = r => esc(r.label) + (r.of ? ' <span class="of">· ' + esc(r.of) + '</span>' : '');
const cueOf = (r, p) => (r.cues || {})[p] || '';
const posteLabel = id => ((PLAN && PLAN.postes.find(p => p.id === id)) || { label: id === 'tous' ? 'Vue générale' : id }).label;
function tagsHtml(r) {
  return (r.fixed ? '<span class="tg fixe">FIXE</span>' : '') + (r.prio === 'secondaire' && r.main ? '<span class="tg sec">secondaire</span>' : '')
    + (r.prio === 'sacrifiable' && r.main ? '<span class="tg sac">sacrifiable</span>' : '') + (r.short ? '<span class="tg short">durée modifiée</span>' : '')
    + (r.naming ? `<span class="tg naming">${esc(r.naming)}</span>` : '');
}
function kindClass(r) { return 'k-' + (r.kind || 'autre'); }
function delayHtml(d) {
  if (d == null) return '';
  if (Math.abs(d) < 15) return '<span class="dl ok">à l\'heure</span>';
  return d > 0 ? `<span class="dl late">+${fmtD(d)} de retard</span>` : `<span class="dl early">en avance de ${fmtD(-d)}</span>`;
}

/* =====================================================================
   RÉGIE
   ===================================================================== */
function regieInit() {
  const localPlan = readLocalPlan();
  $('live').innerHTML = `
  <div class="regie">
    <header class="rg-top">
      <div class="rg-title"><b id="rg-event"></b><span>RÉGIE · code <b>${CODE}</b>${EV ? ` · <a href="index.html#e=${esc(EV)}" target="_blank">ouvrir l'éditeur</a>` : ''}</span></div>
      <div class="rg-clock" id="rg-clock">--:--:--</div>
      <div class="rg-delay" id="rg-delay"></div>
    </header>
    <div class="rg-body">
      <section class="rg-main">
        <div id="rg-alert"></div>
        <div class="rg-now" id="rg-now"></div>
        <div class="rg-go">
          <button class="go" id="btn-go" title="Barre d'espace">TOP ▶</button>
          <div class="go-side">
            <button class="b" id="btn-undo" title="Ctrl+Z">↩ Annuler le dernier top</button>
            <span class="hint">Barre d'espace = TOP · clic sur une ligne = options</span>
          </div>
        </div>
        <div class="rg-next" id="rg-next"></div>
        <h3>À venir</h3>
        <div id="rg-list" class="rg-list"></div>
      </section>
      <aside class="rg-side">
        <div class="card">
          <h3>Message aux postes</h3>
          <div class="msgrow"><select id="msg-to"></select></div>
          <div class="msgrow"><input id="msg-text" placeholder="Votre message…" maxlength="120"><button class="b primary" id="msg-send">Envoyer</button></div>
          <div class="quick" id="msg-quick">
            ${['STOP', 'ON ATTEND', 'GO GO GO', 'ON ENCHAÎNE', 'RETARD — ON RACCOURCIT', 'ATTENTION DIRECT TV', 'MUSIQUE !', 'NOIR SALLE'].map(q => `<button class="b small" data-q="${q}">${q}</button>`).join('')}
          </div>
          <div id="msg-last" class="hint"></div>
          <button class="b small" id="msg-clear">Effacer le message affiché</button>
        </div>
        <div class="card">
          <h3>Journal</h3>
          <div class="msgrow"><input id="note-text" placeholder="Note rapide (rattachée à l'action en cours)…" maxlength="300"><button class="b" id="note-add">Noter</button></div>
          <div id="jr-last" class="jr-last"></div>
          <a class="b small" id="jr-open" target="_blank">Ouvrir le journal complet / RETEX</a>
        </div>
        <div class="card">
          <h3>Liens des postes</h3>
          <p class="hint">Chaque poste ouvre son lien (ou scanne le QR code) sur son téléphone, sa tablette ou son ordinateur.</p>
          <div id="links"></div>
        </div>
        <div class="card">
          <h3>Plan & synchronisation</h3>
          <div id="sync-info" class="hint"></div>
          <button class="b" id="btn-republish">Recharger le conducteur depuis l'éditeur</button>
          <button class="b danger" id="btn-reset">Remettre le live à zéro</button>
          <details><summary>Réglages Firebase</summary>
            <p class="hint">Colle ici la configuration copiée depuis la console Firebase (bloc <code>const firebaseConfig = {…}</code>). Elle est gardée dans ce navigateur et transmise aux postes par leurs liens.</p>
            <textarea id="fb-text" rows="7"></textarea>
            <button class="b primary" id="fb-save">Enregistrer et recharger</button> <button class="b" id="fb-del">Revenir en mode local</button>
          </details>
        </div>
      </aside>
    </div>
    <div id="rowmenu" class="rowmenu hidden"></div>
  </div>`;
  let first = true;
  Sync.on(d => {
    const remotePlan = d.plan || null;
    if (first) {
      first = false;
      if (localPlan && (!remotePlan || (localPlan.publishedAt || 0) > (remotePlan.publishedAt || 0))) {
        PLAN = localPlan; LIVE = normLive(d.live);
        if (remotePlan) remapLive(remotePlan, localPlan);
        Sync.set('plan', PLAN); Sync.set('live', LIVE);
        return;
      }
    }
    if (remotePlan) PLAN = remotePlan; else if (localPlan && !PLAN) PLAN = localPlan;
    LIVE = normLive(d.live);
    regieRender(true);
  });
  regieEvents();
  renderLinks();
  setInterval(() => regieRender(false), 250);
}
/* Quand on recharge le conducteur en cours de live : on garde la position et les réglages par identifiant de ligne */
function remapLive(oldPlan, newPlan) {
  const curId = LIVE.cur >= 0 && oldPlan.rows[LIVE.cur] ? oldPlan.rows[LIVE.cur].id : null;
  const ni = curId ? newPlan.rows.findIndex(r => r.id === curId) : -1;
  if (LIVE.cur >= 0) LIVE.cur = ni >= 0 ? ni : LIVE.cur;
  LIVE.hist = [];
  const ids = new Set(newPlan.rows.map(r => r.id));
  Object.keys(LIVE.adj).forEach(k => { if (!ids.has(k)) delete LIVE.adj[k]; });
}
function pushLive() { Sync.set('live', LIVE); }
function nextIndex(from) { const rows = PLAN.rows; for (let i = from + 1; i < rows.length; i++) { const a = LIVE.adj[rows[i].id]; if (!(a && a.skip)) return i; } return -1; }
function top(toIndex) {
  if (!PLAN) return;
  const i = toIndex != null ? toIndex : nextIndex(LIVE.cur);
  if (i < 0) { flash('Fin du conducteur'); return; }
  LIVE.hist.push({ cur: LIVE.cur, curStart: LIVE.curStart }); if (LIVE.hist.length > 30) LIVE.hist.shift();
  LIVE.cur = i; LIVE.curStart = Sync.now(); LIVE.log[PLAN.rows[i].id] = LIVE.curStart;
  const r = PLAN.rows[i];
  jlog({ at: LIVE.curStart, type: 'top', rowId: r.id, label: plainLabel(r), planned: r.t, delta: Math.round(tod(LIVE.curStart) - r.t), fixed: !!r.fixed });
  pushLive();
}
function undo() { const h = LIVE.hist.pop(); if (!h) return; if (LIVE.cur >= 0 && PLAN.rows[LIVE.cur]) { delete LIVE.log[PLAN.rows[LIVE.cur].id]; jlog({ type: 'undo', rowId: PLAN.rows[LIVE.cur].id, label: plainLabel(PLAN.rows[LIVE.cur]) }); } LIVE.cur = h.cur; LIVE.curStart = h.curStart; pushLive(); }
function setAdj(id, patch) {
  const r = PLAN.rows.find(x => x.id === id);
  if (patch.skip === true) jlog({ type: 'skip', rowId: id, label: plainLabel(r), val: r ? (LIVE.adj[id] && LIVE.adj[id].dur != null ? LIVE.adj[id].dur : r.dur) : 0 });
  else if (patch.skip === null) jlog({ type: 'unskip', rowId: id, label: plainLabel(r) });
  if ('dur' in patch) jlog({ type: 'dur', rowId: id, label: plainLabel(r), from: r ? r.dur : null, val: patch.dur == null ? (r ? r.dur : null) : patch.dur });
  const a = Object.assign({}, LIVE.adj[id] || {}, patch); Object.keys(a).forEach(k => { if (a[k] == null || a[k] === false) delete a[k]; }); if (Object.keys(a).length) LIVE.adj[id] = a; else delete LIVE.adj[id]; pushLive(); }
function flash(t) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = t; document.body.appendChild(el); setTimeout(() => el.remove(), 2200); }

let lastSig = {};
function setHtml(id, html) { if (lastSig[id] === html) return; lastSig[id] = html; $(id).innerHTML = html; }
function regieRender(force) {
  if (!PLAN) { setHtml('rg-now', '<div class="empty">Aucun conducteur reçu. Ouvre l\'éditeur (index.html), onglet Conducteur, puis « ▶ Passer en LIVE ».</div>'); return; }
  if (force) lastSig = {};
  const now = Sync.now(), nowS = tod(now);
  const rows = project(now);
  $('rg-event').textContent = PLAN.event.name || '';
  $('rg-clock').textContent = fmtT(nowS);
  const cur = rows.find(r => r.state === 'current');
  const todo = rows.filter(r => r.state === 'todo');
  const nxt = todo[0];
  // Retard : le prochain top est projeté après son heure prévue (dès 15").
  // Avance : le top en cours a été lancé au moins 1 minute avant son heure prévue
  // (les tops suivants ne sont jamais projetés en avance, d'où ce calcul sur la ligne en cours).
  let d = null;
  if (nxt && nxt.delta >= 15) d = nxt.delta;
  else if (cur && cur.delta <= -60) d = cur.delta;
  else if (nxt || cur) d = 0;
  setHtml('rg-delay', delayHtml(d));
  // en cours
  setHtml('rg-now', cur ? `<div class="lbl">EN COURS <span class="since">topé à ${fmtT(cur.proj)} (prévu ${fmtT(cur.t)})</span></div>
    <div class="row-title ${kindClass(cur)}">${lab(cur)} ${tagsHtml(cur)}</div>
    <div class="count ${cur.remain < 0 ? 'over' : (cur.remain <= 10 ? 'soon' : '')}">${cur.dur ? (cur.remain >= 0 ? 'reste ' + fmtCount(cur.remain) : 'dépassement ' + fmtCount(cur.remain)) : 'écoulé ' + fmtCount(cur.elapsed)}</div>
    ${cuesTable(cur)}${cur.wavelight ? `<div class="wl">Wave light : ${esc(cur.wavelight)}</div>` : ''}${cur.notes ? `<div class="note">${esc(cur.notes)}</div>` : ''}`
    : `<div class="lbl">LIVE PAS ENCORE LANCÉ</div><div class="row-title">${nxt ? 'Premier top : ' + lab(nxt) + ' à ' + fmtT(nxt.t) : ''}</div><div class="hint">Appuie sur TOP au moment où la première action démarre.</div>`);
  const after2 = todo.slice(1, 3);
  setHtml('rg-next', nxt ? `<div class="nx-wrap"><div class="nx-main">
    <div class="lbl">PROCHAIN TOP <span class="since">prévu ${fmtT(nxt.t)}${nxt.delta >= 15 ? ' → ' + fmtT(nxt.proj) : ''}</span></div>
    <div class="nx"><span class="nx-count ${nxt.proj - nowS <= 10 ? 'soon' : ''}">${fmtCount(nxt.proj - nowS)}</span>
    <span class="row-title ${kindClass(nxt)}">${lab(nxt)} ${tagsHtml(nxt)}</span></div>${cuesTable(nxt)}</div>
    ${after2.length ? `<div class="nx-after"><div class="lbl">ENSUITE</div>${after2.map(r => `<div class="nx-small ${kindClass(r)}">
      <div class="nx-small-head"><span class="nx-small-count">${fmtCount(r.proj - nowS)}</span><span class="nx-small-time">${fmtT(r.proj)}${r.delta >= 15 ? ` <i class="late">+${fmtD(r.delta)}</i>` : ''}</span></div>
      <div class="nx-small-title">${lab(r)} ${tagsHtml(r)}</div>
      ${PLAN.postes.filter(p => cueOf(r, p.id)).map(p => `<div class="nx-small-cue"><span>${esc(p.label)}</span> ${esc(cueOf(r, p.id))}</div>`).join('')}</div>`).join('')}</div>` : ''}
    </div>` : '<div class="lbl">FIN DU CONDUCTEUR</div>');
  // alerte contrainte fixe
  setHtml('rg-alert', fixedAlert(rows));
  // liste à venir (40 lignes)
  const list = rows.filter(r => r.state === 'todo' || r.state === 'skipped').filter(r => r.i > LIVE.cur).slice(0, 45);
  setHtml('rg-list', `<table class="lt"><thead><tr><th>Prévu</th><th>Projeté</th><th>Durée</th><th>Action</th>${PLAN.postes.map(p => `<th>${lab(p)}</th>`).join('')}</tr></thead><tbody>
    ${list.map(r => `<tr class="${kindClass(r)} ${r.state} ${r.fixed ? 'fixed' : ''} ${r.threat ? 'threat' : ''}" data-row="${r.i}">
      <td class="tm">${fmtT(r.t)}</td><td class="tm">${r.state === 'skipped' ? '—' : (r.delta >= 15 ? `<b class="late">${fmtT(r.proj)}</b>` : fmtT(r.proj))}</td>
      <td class="tm">${r.state === 'skipped' ? 'supprimé' : fmtD(r.dur)}</td>
      <td class="ac">${lab(r)} ${tagsHtml(r)}${r.threat ? `<div class="thr">⚠ menacé : ${fmtD(r.threat)} de retard</div>` : ''}</td>
      ${PLAN.postes.map(p => `<td>${esc(cueOf(r, p.id))}</td>`).join('')}</tr>`).join('')}
    </tbody></table>`);
  setHtml('jr-last', LIVE.journal.slice(-5).reverse().map(e => `<div class="jl"><span>${fmtT(tod(e.at))}</span> ${journalText(e)}</div>`).join('') || '<span class="hint">Rien pour l\'instant.</span>');
  // message
  const m = LIVE.msg;
  $('msg-last').innerHTML = m && m.text ? `Affiché : « <b>${esc(m.text)}</b> » → ${esc(m.to === 'all' ? 'tous' : posteLabel(m.to))} (${fmtT(tod(m.at))})` : 'Aucun message affiché.';
  $('sync-info').innerHTML = Sync.mode === 'firebase'
    ? `Synchronisation <b>en ligne</b> (Firebase, config. ${esc(Sync.cfgFrom)}). Horloge serveur : correction ${Math.round(Sync.offset)} ms.`
    : `<b>Mode local</b> : les postes ne fonctionnent que dans ce même navigateur, sur cet ordinateur.${Sync.fbError ? '<br>Erreur Firebase : ' + esc(Sync.fbError) : ''}`;
}
function cuesTable(r) {
  const c = PLAN.postes.filter(p => cueOf(r, p.id));
  if (!c.length) return '';
  return `<div class="cues">${c.map(p => `<div class="cue"><span>${lab(p)}</span><b>${esc(cueOf(r, p.id))}</b></div>`).join('')}</div>`;
}
/* Rattrapage : prochaine contrainte fixe et propositions pour l'atteindre à l'heure */
function fixedAlert(rows) {
  const fx = rows.find(r => r.state === 'todo' && r.fixed);
  if (!fx) return '';
  const before = rows.filter(r => r.state === 'todo' && r.i < fx.i);
  // marge = temps libre jusqu'à la contrainte si on suivait le plan
  if (!fx.threat) {
    const lastEnd = before.length ? before[before.length - 1].proj + before[before.length - 1].dur : null;
    const margin = lastEnd != null ? fx.t - lastEnd : null;
    return `<div class="fx ok">Prochaine contrainte fixe : <b>${fmtT(fx.t)} ${lab(fx)}</b> — tenue${margin != null && margin >= 15 ? ` (marge ${fmtD(margin)})` : ''}.</div>`;
  }
  const sac = before.filter(r => r.main && r.prio === 'sacrifiable' && r.kind !== 'main' && r.dur > 0);
  const sec = before.filter(r => r.main && r.prio === 'secondaire' && r.kind !== 'main' && r.dur > 15);
  let gain = 0;
  const props = [];
  sac.forEach(r => { gain += r.dur; props.push(`<button class="b small" data-skip="${r.id}">Supprimer « ${lab(r)} » (−${fmtD(r.dur)})</button>`); });
  sec.forEach(r => { const h = Math.max(15, Math.round(r.dur / 2 / 15) * 15); gain += r.dur - h; props.push(`<button class="b small" data-half="${r.id}" data-to="${h}">Réduire « ${lab(r)} » à ${fmtD(h)} (−${fmtD(r.dur - h)})</button>`); });
  return `<div class="fx ko"><b>⚠ CONTRAINTE FIXE MENACÉE : ${fmtT(fx.t)} ${lab(fx)}</b> — retard projeté ${fmtD(fx.threat)}.
    ${props.length ? `<div class="props">Pour rattraper (gain possible ${fmtD(gain)}${gain < fx.threat ? ' — insuffisant, il faudra aussi raccourcir des routines' : ''}) :<br>${props.join(' ')}</div>`
      : '<div class="props">Aucun bloc secondaire ou sacrifiable avant cette contrainte : raccourcir des étapes (clic sur une ligne).</div>'}</div>`;
}
function regieEvents() {
  $('btn-go').onclick = () => top();
  $('btn-undo').onclick = undo;
  document.addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); top(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
    if (e.key === 'Escape') $('rowmenu').classList.add('hidden');
  });
  document.addEventListener('click', e => {
    const sk = e.target.closest('[data-skip]'); if (sk) { setAdj(sk.dataset.skip, { skip: true }); return; }
    const hf = e.target.closest('[data-half]'); if (hf) { setAdj(hf.dataset.half, { dur: +hf.dataset.to }); return; }
    const q = e.target.closest('[data-q]'); if (q) { sendMsg(q.dataset.q); return; }
    const mm = e.target.closest('[data-m]'); if (mm) { rowAction(mm.dataset.m, +mm.dataset.i); $('rowmenu').classList.add('hidden'); return; }
    const tr = e.target.closest('tr[data-row]');
    if (tr) { openRowMenu(+tr.dataset.row, e); return; }
    if (!e.target.closest('#rowmenu')) $('rowmenu').classList.add('hidden');
  });
  const sel = $('msg-to');
  const fill = () => { if (!PLAN) return; sel.innerHTML = '<option value="all">Tous les postes</option>' + PLAN.postes.map(p => `<option value="${p.id}">${lab(p)}</option>`).join(''); };
  fill(); Sync.on(() => { if (sel.options.length <= 1) fill(); renderLinks(); });
  $('msg-send').onclick = () => { const t = $('msg-text').value.trim(); if (t) { sendMsg(t); $('msg-text').value = ''; } };
  $('msg-text').addEventListener('keydown', e => { if (e.key === 'Enter') $('msg-send').click(); });
  $('msg-clear').onclick = () => { LIVE.msg = null; pushLive(); };
  $('btn-republish').onclick = () => {
    const lp = readLocalPlan();
    if (!lp) { alert('Aucun conducteur trouvé : ouvre l\'éditeur et clique « ▶ Passer en LIVE ».'); return; }
    remapLive(PLAN, lp); PLAN = lp; jlog({ type: 'plan' }); Sync.set('plan', PLAN); pushLive(); flash('Conducteur rechargé');
  };
  $('btn-reset').onclick = () => {
    if (!confirm('Remettre le live à zéro ? (tous les tops, suppressions, messages et notes seront effacés)')) return;
    if (LIVE.journal.length && confirm('Archiver d\'abord le journal de ce live (pour le RETEX) ?')) archiveLive('avant remise à zéro');
    LIVE = blankLive(); pushLive();
  };
  $('note-add').onclick = () => { const r = LIVE.cur >= 0 ? PLAN.rows[LIVE.cur] : null; addNote($('note-text').value, r ? r.id : null); $('note-text').value = ''; };
  $('note-text').addEventListener('keydown', e => { if (e.key === 'Enter') $('note-add').click(); });
  $('jr-open').href = 'live.html?journal=1' + (EV ? '&e=' + encodeURIComponent(EV) : '') + '&code=' + CODE;
  const fc = fbConfig(); if (fc && fc.from === 'navigateur') $('fb-text').value = JSON.stringify(fc.cfg, null, 1);
  $('fb-save').onclick = () => { const c = parseFirebaseSnippet($('fb-text').value); if (!c) { alert('Configuration non reconnue : il faut le bloc firebaseConfig avec « databaseURL ».'); return; } localStorage.setItem('coordo.fbcfg', JSON.stringify(c)); location.reload(); };
  $('fb-del').onclick = () => { localStorage.removeItem('coordo.fbcfg'); location.reload(); };
}
function sendMsg(text) { LIVE.msg = { id: Math.random().toString(36).slice(2, 8), text, to: $('msg-to').value || 'all', at: Sync.now() }; jlog({ type: 'msg', text, to: LIVE.msg.to }); pushLive(); flash('Message envoyé'); }
function addNote(text, rowId) {
  text = (text || '').trim(); if (!text) return;
  const r = rowId ? PLAN.rows.find(x => x.id === rowId) : null;
  if (r) LIVE.notes[r.id] = (LIVE.notes[r.id] ? LIVE.notes[r.id] + ' / ' : '') + text;
  jlog({ type: 'note', text, rowId: r ? r.id : null, label: plainLabel(r) });
  pushLive(); flash('Note ajoutée au journal');
}
function openRowMenu(i, e) {
  const r = PLAN.rows[i]; const a = LIVE.adj[r.id] || {}; const dur = a.dur != null ? a.dur : r.dur;
  const m = $('rowmenu');
  m.innerHTML = `<div class="rm-title">${lab(r)}</div>
    <button class="b primary" data-m="top" data-i="${i}">TOP sur cette ligne maintenant</button>
    <div class="rm-dur"><button class="b" data-m="minus" data-i="${i}">−15"</button><span>Durée ${fmtD(dur)}</span><button class="b" data-m="plus" data-i="${i}">+15"</button>
      ${a.dur != null ? `<button class="b small" data-m="resetdur" data-i="${i}">durée d'origine (${fmtD(r.dur)})</button>` : ''}</div>
    ${a.skip ? `<button class="b" data-m="unskip" data-i="${i}">Rétablir la ligne</button>` : `<button class="b danger" data-m="skip" data-i="${i}">Supprimer la ligne du live</button>`}
    ${r.sub ? `<button class="b" data-m="skipitem" data-i="${i}">Supprimer toute la séquence (${esc(itemName(r))})</button>` : ''}
    <button class="b" data-m="note" data-i="${i}">📝 Annoter cette ligne (journal)</button>`;
  m.classList.remove('hidden');
  const x = Math.min(e.clientX, window.innerWidth - m.offsetWidth - 8), y = Math.max(8, Math.min(e.clientY, window.innerHeight - m.offsetHeight - 8));
  m.style.left = x + 'px'; m.style.top = y + 'px';
}
function itemName(r) { const mr = PLAN.rows.find(x => x.itemId === r.itemId && x.main); return mr ? mr.label : ''; }
function rowAction(act, i) {
  const r = PLAN.rows[i]; const a = LIVE.adj[r.id] || {}; const dur = a.dur != null ? a.dur : r.dur;
  if (act === 'top') { if (confirm('Toper « ' + r.label + ' » maintenant ?')) top(i); }
  if (act === 'minus') setAdj(r.id, { dur: Math.max(0, dur - 15) });
  if (act === 'plus') setAdj(r.id, { dur: dur + 15 });
  if (act === 'resetdur') setAdj(r.id, { dur: null });
  if (act === 'skip') setAdj(r.id, { skip: true });
  if (act === 'unskip') setAdj(r.id, { skip: null });
  if (act === 'skipitem') { jlog({ type: 'skipitem', rowId: r.id, label: itemName(r) }); PLAN.rows.forEach((x, k) => { if (x.itemId === r.itemId && k !== LIVE.cur) { LIVE.adj[x.id] = Object.assign({}, LIVE.adj[x.id] || {}, { skip: true }); } }); pushLive(); }
  if (act === 'note') { const t = prompt('Note sur « ' + r.label + ' » :', (LIVE.notes[r.id] || '')); if (t != null) addNote(t, r.id); }
}
function posteUrl(p) {
  const u = new URL('live.html', location.href); u.search = '';
  u.searchParams.set('code', CODE); u.searchParams.set('poste', p);
  const fc = fbConfig(); if (fc && fc.from !== 'fichier') u.searchParams.set('fb', btoa(unescape(encodeURIComponent(JSON.stringify(fc.cfg)))));
  return u.toString();
}
let qrLoaded = null;
function renderLinks() {
  if (!PLAN) return;
  const list = [{ id: 'tous', label: 'Vue générale' }].concat(PLAN.postes);
  const html = list.map(p => `<div class="lk"><div><b>${lab(p)}</b><br><a href="${posteUrl(p.id)}" target="_blank">ouvrir</a> · <a href="#" data-copy="${esc(posteUrl(p.id))}">copier le lien</a> · <a href="#" data-qr="${p.id}">QR code</a></div><div class="qr" id="qr-${p.id}"></div></div>`).join('');
  if ($('links').dataset.sig === html) return;
  $('links').dataset.sig = html; $('links').innerHTML = html;
  $('links').onclick = async e => {
    const c = e.target.closest('[data-copy]'); if (c) { e.preventDefault(); try { await navigator.clipboard.writeText(c.dataset.copy); flash('Lien copié'); } catch (x) { prompt('Copie ce lien :', c.dataset.copy); } return; }
    const q = e.target.closest('[data-qr]'); if (q) {
      e.preventDefault(); const box = $('qr-' + q.dataset.qr); if (box.innerHTML) { box.innerHTML = ''; return; }
      try { qrLoaded = qrLoaded || loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'); await qrLoaded; new QRCode(box, { text: posteUrl(q.dataset.qr), width: 180, height: 180, correctLevel: QRCode.CorrectLevel.L }); }
      catch (x) { box.textContent = 'QR code indisponible (pas de connexion)'; }
    }
  };
}

/* =====================================================================
   POSTE (lecture seule)
   ===================================================================== */
function posteInit() {
  $('live').innerHTML = `<div class="poste">
    <header class="ps-top"><div><b id="ps-name"></b><span id="ps-event"></span></div><div class="ps-clock" id="ps-clock">--:--:--</div></header>
    <div id="ps-msg"></div>
    <div id="ps-main"></div>
    <div id="ps-list"></div>
    <button id="ps-wake" class="b small wake">Garder l'écran allumé</button>
  </div>`;
  Sync.on(d => { if (d.plan) PLAN = d.plan; LIVE = normLive(d.live); posteRender(true); });
  setInterval(() => posteRender(false), 250);
  $('ps-wake').onclick = async () => { try { await navigator.wakeLock.request('screen'); $('ps-wake').textContent = 'Écran maintenu allumé ✓'; } catch (e) { $('ps-wake').textContent = 'Non disponible sur cet appareil'; } };
  document.addEventListener('click', e => { if (e.target.closest('[data-ack]')) { localStorage.setItem('coordo.ack.' + CODE + '.' + POSTE, e.target.closest('[data-ack]').dataset.ack); posteRender(true); } });
}
function posteRender(force) {
  if (force) lastSig = {};
  const now = Sync.now(), nowS = tod(now);
  $('ps-clock').textContent = fmtT(nowS);
  if (!PLAN) { setHtml('ps-main', `<div class="empty">En attente de la régie… (code ${esc(CODE)})</div>`); return; }
  const all = POSTE === 'tous';
  $('ps-name').textContent = posteLabel(POSTE); $('ps-event').textContent = ' · ' + (PLAN.event.name || '');
  const rows = project(now);
  const mine = r => all ? true : !!cueOf(r, POSTE);
  const cur = rows.find(r => r.state === 'current');
  const todo = rows.filter(r => r.state === 'todo');
  const nextAny = todo[0];
  const nextMine = todo.find(mine);
  // message
  const m = LIVE.msg; const acked = localStorage.getItem('coordo.ack.' + CODE + '.' + POSTE);
  setHtml('ps-msg', m && m.text && (m.to === 'all' || m.to === POSTE) && acked !== m.id
    ? `<div class="msg"><div class="msg-t">RÉGIE · ${fmtT(tod(m.at))}</div><div class="msg-x">${esc(m.text)}</div><button class="b" data-ack="${m.id}">OK, vu</button></div>` : '');
  const cueLine = r => all ? cuesMini(r) : `<div class="mycue">${esc(cueOf(r, POSTE)) || '<span class="muted">rien pour toi</span>'}</div>`;
  let html = '';
  if (cur) {
    html += `<div class="ps-card now ${mine(cur) ? '' : 'other'}"><div class="lbl">MAINTENANT</div>
      <div class="ttl ${kindClass(cur)}">${lab(cur)}</div>${cueLine(cur)}
      ${cur.dur ? `<div class="cnt ${cur.remain < 0 ? 'over' : ''}">${cur.remain >= 0 ? 'reste ' + fmtCount(cur.remain) : 'dépassement ' + fmtCount(cur.remain)}</div>` : ''}</div>`;
  } else html += `<div class="ps-card now other"><div class="lbl">LIVE PAS ENCORE LANCÉ</div><div class="ttl">${nextAny ? 'Début prévu ' + fmtT(nextAny.t) : ''}</div></div>`;
  if (nextMine) {
    const c = nextMine.proj - nowS;
    html += `<div class="ps-card next ${c <= 10 ? 'soon' : ''}"><div class="lbl">${all ? 'PROCHAIN TOP' : 'TA PROCHAINE ACTION'} <span>${fmtT(nextMine.proj)}${nextMine.delta >= 15 ? ` <i class="late">(+${fmtD(nextMine.delta)})</i>` : ''}</span></div>
      <div class="big">${fmtCount(c)}</div><div class="ttl ${kindClass(nextMine)}">${lab(nextMine)} ${nextMine.fixed ? '<span class="tg fixe">FIXE</span>' : ''}</div>${cueLine(nextMine)}</div>`;
  }
  if (!all && nextAny && nextAny !== nextMine) html += `<div class="ps-small">Prochain top général dans ${fmtCount(nextAny.proj - nowS)} : ${lab(nextAny)}</div>`;
  setHtml('ps-main', html);
  const after = todo.filter(r => r !== nextMine).filter(mine).slice(0, 6);
  setHtml('ps-list', after.length ? `<div class="lbl">ENSUITE</div>${after.map(r => `<div class="ps-row ${kindClass(r)}"><span class="tm">${fmtT(r.proj)}</span><span class="tx"><b>${lab(r)}</b>${all ? '' : `<br>${esc(cueOf(r, POSTE))}`}</span></div>`).join('')}` : '');
}
function cuesMini(r) { const c = PLAN.postes.filter(p => cueOf(r, p.id)); return c.length ? `<div class="cues">${c.map(p => `<div class="cue"><span>${lab(p)}</span><b>${esc(cueOf(r, p.id))}</b></div>`).join('')}</div>` : ''; }

/* =====================================================================
   JOURNAL / RETEX
   ===================================================================== */
const posteName = to => to === 'all' ? 'tous les postes' : posteLabel(to);
function deltaTxt(d) { if (d == null) return ''; if (Math.abs(d) < 15) return 'à l\'heure'; return d > 0 ? '+' + fmtD(d) + ' de retard' : fmtD(-d) + ' d\'avance'; }
function journalText(e) {
  switch (e.type) {
    case 'top': return `<b>TOP</b> ${esc(e.label)} <span class="${e.delta >= 15 ? 'late' : (e.delta <= -15 ? 'early' : 'muted')}">(prévu ${fmtT(e.planned)} · ${deltaTxt(e.delta)})</span>${e.fixed ? ' <span class="tg fixe">FIXE</span>' : ''}`;
    case 'undo': return `↩ Top annulé : ${esc(e.label)}`;
    case 'skip': return `✂ Supprimé : ${esc(e.label)}${e.val ? ' (−' + fmtD(e.val) + ')' : ''}`;
    case 'skipitem': return `✂ Séquence supprimée : ${esc(e.label)}`;
    case 'unskip': return `Rétabli : ${esc(e.label)}`;
    case 'dur': return `⏱ Durée modifiée : ${esc(e.label)} → ${fmtD(e.val)}${e.from != null ? ' (prévu ' + fmtD(e.from) + ')' : ''}`;
    case 'msg': return `💬 Message à ${esc(posteName(e.to))} : « ${esc(e.text)} »`;
    case 'note': return `📝 <b>${esc(e.text)}</b>${e.label ? ' <span class="muted">— ' + esc(e.label) + '</span>' : ''}`;
    case 'plan': return '🔄 Conducteur rechargé depuis l\'éditeur';
    default: return esc(e.type);
  }
}
function journalText2(e) { const d = document.createElement('div'); d.innerHTML = journalText(e); return d.textContent; }
/* Analyse d'un live : une ligne par action du conducteur */
function analyse(plan, live) {
  const rows = plan.rows.map((r, i) => {
    const a = (live.adj || {})[r.id] || {};
    const real = live.log[r.id] != null ? tod(live.log[r.id]) : null;
    return { i, r, real, delta: real != null ? Math.round(real - r.t) : null, skip: !!a.skip, durAdj: a.dur, note: (live.notes || {})[r.id] || '' };
  });
  const topped = rows.filter(x => x.real != null).sort((a, b) => a.real - b.real);
  topped.forEach((x, k) => { const n = topped[k + 1]; x.realDur = n ? Math.round(n.real - x.real) : null; });
  const s = { nbRows: rows.length, nbTop: topped.length };
  if (topped.length) {
    s.first = topped[0]; s.last = topped[topped.length - 1];
    s.maxLate = topped.reduce((m, x) => (x.delta > (m ? m.delta : 0) ? x : m), null);
    s.maxEarly = topped.reduce((m, x) => (x.delta < (m ? m.delta : 0) ? x : m), null);
  }
  s.skipped = rows.filter(x => x.skip);
  s.skippedTime = s.skipped.reduce((t, x) => t + (x.r.dur || 0), 0);
  s.durChanged = rows.filter(x => x.durAdj != null);
  s.fixed = rows.filter(x => x.r.fixed);
  s.overruns = topped.filter(x => x.realDur != null && x.r.dur > 0 && x.realDur - (x.durAdj != null ? x.durAdj : x.r.dur) >= 30).sort((a, b) => (b.realDur - b.r.dur) - (a.realDur - a.r.dur)).slice(0, 8);
  const j = live.journal || [];
  s.msgs = j.filter(e => e.type === 'msg'); s.notes = j.filter(e => e.type === 'note'); s.undos = j.filter(e => e.type === 'undo');
  return { rows, s };
}
let JR = { src: 'live', archive: null };
function journalInit() {
  const aid = P.get('a');
  const arch = readArchives();
  if (aid) { JR.archive = arch.find(a => a.id === aid) || null; JR.src = 'archive'; }
  $('live').innerHTML = `<div class="journal"><div id="jr"></div></div>`;
  if (JR.archive) { PLAN = JR.archive.plan; LIVE = normLive(JR.archive.live); journalRender(); return; }
  Sync.on(d => { if (d.plan) PLAN = d.plan; else { const lp = readLocalPlan(); if (lp) PLAN = lp; } LIVE = normLive(d.live); journalRender(); });
}
function journalRender() {
  const el = $('jr');
  if (!PLAN) { el.innerHTML = '<div class="empty">Aucun live trouvé pour ce code.</div>'; return; }
  const { rows, s } = analyse(PLAN, LIVE);
  const arch = readArchives();
  const ev = PLAN.event || {};
  const fixedTxt = s.fixed.map(x => `<li>${fmtT(x.r.t)} ${esc(plainLabel(x.r))} : ${x.skip ? 'supprimée' : (x.real == null ? 'non topée' : `topée ${fmtT(x.real)} — <b class="${Math.abs(x.delta) < 15 ? 'ok' : (x.delta > 0 ? 'late' : 'early')}">${deltaTxt(x.delta)}</b>`)}</li>`).join('');
  el.innerHTML = `
  <div class="jr-head no-print">
    <div><h1>Journal du live — RETEX</h1><div class="muted">${esc(ev.name || '')}${ev.date ? ' · ' + esc(ev.date) : ''} · code ${esc(CODE)}</div></div>
    <div class="jr-tools">
      <select id="jr-src"><option value="">Live en cours (temps réel)</option>${arch.map(a => `<option value="${a.id}" ${JR.archive && JR.archive.id === a.id ? 'selected' : ''}>Archive du ${new Date(a.at).toLocaleString('fr-FR')}${a.label ? ' — ' + esc(a.label) : ''}</option>`).join('')}</select>
      ${JR.src === 'live' ? '<button class="b primary" id="jr-arch">Archiver ce journal</button>' : '<button class="b danger" id="jr-del">Supprimer cette archive</button>'}
      <button class="b" id="jr-xls">Export Excel</button>
      <button class="b" id="jr-print">Imprimer / PDF</button>
    </div>
  </div>
  <h1 class="print-only">Journal du live — RETEX · ${esc(ev.name || '')}</h1>
  <section class="jr-sum">
    <div class="kpi"><span>Début</span><b>${s.first ? fmtT(s.first.real) : '—'}</b><i>${s.first ? 'prévu ' + fmtT(s.first.r.t) : ''}</i></div>
    <div class="kpi"><span>Dernier top</span><b>${s.last ? fmtT(s.last.real) : '—'}</b><i>${s.last ? 'prévu ' + fmtT(s.last.r.t) + ' · ' + deltaTxt(s.last.delta) : ''}</i></div>
    <div class="kpi"><span>Retard maximum</span><b class="late">${s.maxLate ? '+' + fmtD(s.maxLate.delta) : '—'}</b><i>${s.maxLate ? fmtT(s.maxLate.real) + ' · ' + esc(plainLabel(s.maxLate.r)) : ''}</i></div>
    <div class="kpi"><span>Avance maximum</span><b class="early">${s.maxEarly ? fmtD(-s.maxEarly.delta) : '—'}</b><i>${s.maxEarly ? fmtT(s.maxEarly.real) + ' · ' + esc(plainLabel(s.maxEarly.r)) : ''}</i></div>
    <div class="kpi"><span>Tops</span><b>${s.nbTop} / ${s.nbRows}</b><i>${s.undos.length} annulation(s)</i></div>
    <div class="kpi"><span>Lignes supprimées</span><b>${s.skipped.length}</b><i>${s.skippedTime ? fmtD(s.skippedTime) + ' gagnés' : ''}</i></div>
    <div class="kpi"><span>Messages</span><b>${s.msgs.length}</b><i>${s.notes.length} note(s)</i></div>
  </section>
  <div class="jr-cols">
    <section><h2>Contraintes fixes</h2>${fixedTxt ? `<ul>${fixedTxt}</ul>` : '<p class="muted">Aucune.</p>'}
      <h2>Plus gros dépassements</h2>${s.overruns.length ? `<ul>${s.overruns.map(x => `<li>${esc(plainLabel(x.r))} : ${fmtD(x.realDur)} au lieu de ${fmtD(x.durAdj != null ? x.durAdj : x.r.dur)} (<b class="late">+${fmtD(x.realDur - (x.durAdj != null ? x.durAdj : x.r.dur))}</b>)</li>`).join('')}</ul>` : '<p class="muted">Aucun dépassement de plus de 30".</p>'}
      <h2>Notes</h2>${s.notes.length ? `<ul>${s.notes.map(e => `<li>${fmtT(tod(e.at))} — <b>${esc(e.text)}</b>${e.label ? ' <span class="muted">(' + esc(e.label) + ')</span>' : ''}</li>`).join('')}</ul>` : '<p class="muted">Aucune note.</p>'}
    </section>
    <section><h2>Chronologie</h2><div class="chrono">${(LIVE.journal || []).map(e => `<div class="jl t-${e.type}"><span>${fmtT(tod(e.at))}</span> ${journalText(e)}</div>`).join('') || '<p class="muted">Journal vide.</p>'}</div></section>
  </div>
  <h2>Détail ligne par ligne</h2>
  <table class="jt" id="jr-table"><thead><tr><th>N°</th><th>Prévu</th><th>Réel</th><th>Écart</th><th>Durée prévue</th><th>Durée réelle</th><th>Action</th><th>Statut</th><th>Note</th></tr></thead><tbody>
  ${rows.map(x => `<tr class="${x.skip ? 'skipped' : ''} ${x.r.main ? 'main' : ''}"><td>${x.i + 1}</td><td>${fmtT(x.r.t)}</td><td>${x.real != null ? fmtT(x.real) : ''}</td>
    <td class="${x.delta >= 15 ? 'late' : (x.delta <= -15 ? 'early' : '')}">${x.delta == null ? '' : (Math.abs(x.delta) < 15 ? '0' : (x.delta > 0 ? '+' : '−') + fmtD(Math.abs(x.delta)))}</td>
    <td>${fmtD(x.durAdj != null ? x.durAdj : x.r.dur)}${x.durAdj != null ? ' <i class="muted">(' + fmtD(x.r.dur) + ')</i>' : ''}</td><td>${x.realDur != null ? fmtD(x.realDur) : ''}</td>
    <td>${esc(plainLabel(x.r))}${x.r.fixed ? ' <span class="tg fixe">FIXE</span>' : ''}</td><td>${x.skip ? 'supprimée' : (x.real != null ? 'topée' : 'non topée')}</td><td>${esc(x.note)}</td></tr>`).join('')}
  </tbody></table>`;
  $('jr-src').onchange = e => { const u = new URL(location.href); if (e.target.value) u.searchParams.set('a', e.target.value); else u.searchParams.delete('a'); location.href = u.toString(); };
  if ($('jr-arch')) $('jr-arch').onclick = () => { const l = prompt('Nom de l\'archive (facultatif) :', ''); if (l == null) return; if (archiveLive(l)) { flash('Journal archivé'); journalRender(); } else alert('Le journal est vide.'); };
  if ($('jr-del')) $('jr-del').onclick = () => { if (!confirm('Supprimer cette archive ?')) return; localStorage.setItem(retexKey(), JSON.stringify(readArchives().filter(a => a.id !== JR.archive.id))); const u = new URL(location.href); u.searchParams.delete('a'); location.href = u.toString(); };
  $('jr-print').onclick = () => window.print();
  $('jr-xls').onclick = () => journalXls(rows, s);
}
function journalXls(rows, s) {
  const ev = PLAN.event || {};
  const st = 'border:1px solid #999;font-family:Arial;font-size:10pt;mso-number-format:"\\@";';
  const th = 'border:1px solid #999;font-family:Arial;font-size:10pt;background:#111827;color:#fff;';
  const html = `<html><head><meta charset="utf-8"></head><body>
    <h2>Journal du live — ${esc(ev.name || '')} ${esc(ev.date || '')}</h2>
    <table><tr><td style="${st}">Début réel</td><td style="${st}">${s.first ? fmtT(s.first.real) : ''}</td></tr>
    <tr><td style="${st}">Dernier top</td><td style="${st}">${s.last ? fmtT(s.last.real) + ' (' + deltaTxt(s.last.delta) + ')' : ''}</td></tr>
    <tr><td style="${st}">Retard maximum</td><td style="${st}">${s.maxLate ? '+' + fmtD(s.maxLate.delta) + ' — ' + esc(plainLabel(s.maxLate.r)) : ''}</td></tr>
    <tr><td style="${st}">Lignes supprimées</td><td style="${st}">${s.skipped.length}</td></tr></table><br>
    <table><tr>${['N°', 'Prévu', 'Réel', 'Écart (s)', 'Durée prévue', 'Durée réelle', 'Action', 'Statut', 'Note'].map(h => `<th style="${th}">${h}</th>`).join('')}</tr>
    ${rows.map(x => `<tr>${[x.i + 1, fmtT(x.r.t), x.real != null ? fmtT(x.real) : '', x.delta == null ? '' : x.delta, fmtD(x.durAdj != null ? x.durAdj : x.r.dur), x.realDur != null ? fmtD(x.realDur) : '', plainLabel(x.r) + (x.r.fixed ? ' [FIXE]' : ''), x.skip ? 'supprimée' : (x.real != null ? 'topée' : 'non topée'), x.note].map(v => `<td style="${st}">${esc(v)}</td>`).join('')}</tr>`).join('')}</table><br>
    <h3>Chronologie</h3><table><tr><th style="${th}">Heure</th><th style="${th}">Événement</th></tr>
    ${(LIVE.journal || []).map(e => `<tr><td style="${st}">${fmtT(tod(e.at))}</td><td style="${st}">${esc(journalText2(e))}</td></tr>`).join('')}</table></body></html>`;
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + html], { type: 'application/vnd.ms-excel' }));
  a.download = ('journal_' + (ev.name || 'live')).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').slice(0, 60) + '.xls';
  document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 500);
}

/* =====================================================================
   ACCUEIL (aucun paramètre)
   ===================================================================== */
function accueilInit() {
  $('live').innerHTML = `<div class="accueil"><h1>COORDO · LIVE</h1>
    <a class="b primary big" href="live.html?regie=1">Je suis la régie (topeur)</a>
    <div class="join"><h3>Je suis un poste</h3>
      <input id="j-code" placeholder="Code (6 caractères)" maxlength="6"><input id="j-poste" placeholder="Poste (ex : dj, speaker, ecran, tous)">
      <button class="b" id="j-go">Rejoindre</button></div>
    <p class="hint">Le plus simple : la régie te donne directement ton lien ou ton QR code.</p>
    <p><a href="index.html">← Retour à l'éditeur de conducteur</a></p></div>`;
  $('j-go').onclick = () => { location.href = 'live.html?code=' + encodeURIComponent($('j-code').value.trim().toUpperCase()) + '&poste=' + encodeURIComponent($('j-poste').value.trim().toLowerCase() || 'tous'); };
}

/* ---------------- Démarrage ---------------- */
(async function start() {
  if (ROLE === 'accueil') { accueilInit(); return; }
  if (ROLE === 'journal') { journalInit(); if (JR.archive) { document.title = 'Coordo — Journal'; return; } }
  else if (ROLE === 'regie') regieInit(); else posteInit();
  await Sync.init();
  showConn();
  document.title = 'Coordo — ' + (ROLE === 'regie' ? 'Régie' : (ROLE === 'journal' ? 'Journal' : posteLabel(POSTE)));
})();
window.COORDO_LIVE = { project, get plan() { return PLAN; }, get live() { return LIVE; }, top, undo, tod };
})();
