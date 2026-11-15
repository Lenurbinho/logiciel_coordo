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
const ROLE = P.get('poste') ? 'poste' : (P.has('regie') ? 'regie' : 'accueil');
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
let CODE = (P.get('code') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
if (!CODE && ROLE === 'regie') { CODE = localStorage.getItem('coordo.live.code') || genCode(); localStorage.setItem('coordo.live.code', CODE); }

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
function blankLive() { return { cur: -1, curStart: 0, adj: {}, hist: [], log: {}, msg: null }; }
function normLive(l) { l = Object.assign(blankLive(), l || {}); l.adj = l.adj || {}; l.hist = l.hist || []; l.log = l.log || {}; return l; }

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
  return d > 0 ? `<span class="dl late">+${fmtD(d)} de retard</span>` : `<span class="dl early">${fmtD(-d)} d'avance</span>`;
}

/* =====================================================================
   RÉGIE
   ===================================================================== */
function regieInit() {
  let localPlan = null;
  try { localPlan = JSON.parse(localStorage.getItem('coordo.liveplan') || 'null'); } catch (e) {}
  $('live').innerHTML = `
  <div class="regie">
    <header class="rg-top">
      <div class="rg-title"><b id="rg-event"></b><span>RÉGIE · code <b>${CODE}</b></span></div>
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
  pushLive();
}
function undo() { const h = LIVE.hist.pop(); if (!h) return; if (LIVE.cur >= 0 && PLAN.rows[LIVE.cur]) delete LIVE.log[PLAN.rows[LIVE.cur].id]; LIVE.cur = h.cur; LIVE.curStart = h.curStart; pushLive(); }
function setAdj(id, patch) { const a = Object.assign({}, LIVE.adj[id] || {}, patch); Object.keys(a).forEach(k => { if (a[k] == null || a[k] === false) delete a[k]; }); if (Object.keys(a).length) LIVE.adj[id] = a; else delete LIVE.adj[id]; pushLive(); }
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
  // retard global = retard projeté du prochain top (ou du top en cours)
  const d = nxt ? nxt.delta : (cur ? cur.delta : null);
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
    let lp = null; try { lp = JSON.parse(localStorage.getItem('coordo.liveplan') || 'null'); } catch (e) {}
    if (!lp) { alert('Aucun conducteur trouvé : ouvre l\'éditeur et clique « ▶ Passer en LIVE ».'); return; }
    remapLive(PLAN, lp); PLAN = lp; Sync.set('plan', PLAN); pushLive(); flash('Conducteur rechargé');
  };
  $('btn-reset').onclick = () => { if (confirm('Remettre le live à zéro ? (tous les tops, suppressions et messages seront effacés)')) { LIVE = blankLive(); pushLive(); } };
  const fc = fbConfig(); if (fc && fc.from === 'navigateur') $('fb-text').value = JSON.stringify(fc.cfg, null, 1);
  $('fb-save').onclick = () => { const c = parseFirebaseSnippet($('fb-text').value); if (!c) { alert('Configuration non reconnue : il faut le bloc firebaseConfig avec « databaseURL ».'); return; } localStorage.setItem('coordo.fbcfg', JSON.stringify(c)); location.reload(); };
  $('fb-del').onclick = () => { localStorage.removeItem('coordo.fbcfg'); location.reload(); };
}
function sendMsg(text) { LIVE.msg = { id: Math.random().toString(36).slice(2, 8), text, to: $('msg-to').value || 'all', at: Sync.now() }; pushLive(); flash('Message envoyé'); }
function openRowMenu(i, e) {
  const r = PLAN.rows[i]; const a = LIVE.adj[r.id] || {}; const dur = a.dur != null ? a.dur : r.dur;
  const m = $('rowmenu');
  m.innerHTML = `<div class="rm-title">${lab(r)}</div>
    <button class="b primary" data-m="top" data-i="${i}">TOP sur cette ligne maintenant</button>
    <div class="rm-dur"><button class="b" data-m="minus" data-i="${i}">−15"</button><span>Durée ${fmtD(dur)}</span><button class="b" data-m="plus" data-i="${i}">+15"</button>
      ${a.dur != null ? `<button class="b small" data-m="resetdur" data-i="${i}">durée d'origine (${fmtD(r.dur)})</button>` : ''}</div>
    ${a.skip ? `<button class="b" data-m="unskip" data-i="${i}">Rétablir la ligne</button>` : `<button class="b danger" data-m="skip" data-i="${i}">Supprimer la ligne du live</button>`}
    ${r.sub ? `<button class="b" data-m="skipitem" data-i="${i}">Supprimer toute la séquence (${esc(itemName(r))})</button>` : ''}`;
  m.classList.remove('hidden');
  const x = Math.min(e.clientX, window.innerWidth - 340), y = Math.min(e.clientY, window.innerHeight - 220);
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
  if (act === 'skipitem') { PLAN.rows.forEach(x => { if (x.itemId === r.itemId && x.i !== LIVE.cur) { LIVE.adj[x.id] = Object.assign({}, LIVE.adj[x.id] || {}, { skip: true }); } }); pushLive(); }
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
  if (ROLE === 'regie') regieInit(); else posteInit();
  await Sync.init();
  showConn();
  document.title = 'Coordo — ' + (ROLE === 'regie' ? 'Régie' : posteLabel(POSTE));
})();
window.COORDO_LIVE = { project, get plan() { return PLAN; }, get live() { return LIVE; }, top, undo, tod };
})();
