// Beauty by Kae — admin panel (login, menu, appointments calendar).
const $ = (s, el = document) => el.querySelector(s);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function time12(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${pad(m)}`;
}
const ampm = t => (t ? (Number(t.slice(0, 2)) < 12 ? 'AM' : 'PM') : '');

async function api(path, opts = {}) {
  const res = await fetch(`/api/admin/${path}`, {
    credentials: 'same-origin',
    headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== 'login') {                // session expired: back to the login screen
    authed = false;
    if (editor.open) editor.close();
    show('login');
    toast('Your session ended. Please log in again.');
    throw new Error('auth');
  }
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2200);
}

/* ---------- Views ---------- */
let authed = false;
function show(view) {
  if (!authed) view = 'login';
  document.querySelectorAll('[data-view]').forEach(v => (v.hidden = v.dataset.view !== view));
  $('#logout').hidden = !authed;
  if (view === 'login') setTimeout(() => $('#login-form [name=password]').focus(), 50);
  if (view === 'appointments') loadMonth();
  if (view === 'menu') loadMenuCount();
  window.scrollTo(0, 0);
}
function route() {
  const view = location.hash.slice(1) || 'menu';
  show(['menu', 'appointments'].includes(view) ? view : 'menu');
}
window.addEventListener('hashchange', route);

/* ---------- Login / logout ---------- */
$('#login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('#login-error'); err.hidden = true;
  const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
  try {
    await api('login', { method: 'POST', body: { password: e.target.password.value } });
    authed = true; e.target.reset();
    if (!location.hash || location.hash === '#login') location.hash = '#menu'; else route();
  } catch (ex) {
    err.textContent = ex.message; err.hidden = false;
  } finally { btn.disabled = false; }
});
$('#logout').addEventListener('click', async () => {
  await api('logout', { method: 'POST' }).catch(() => {});
  authed = false; show('login');
});

/* ---------- Menu ---------- */
async function loadMenuCount() {
  const now = new Date();
  try {
    const list = await api(`appointments?month=${now.getFullYear()}-${pad(now.getMonth() + 1)}`);
    const upcoming = list.filter(a => a.date >= ymd(now)).length;
    $('#tile-sub').textContent = `${upcoming} upcoming in ${MONTHS[now.getMonth()]}`;
  } catch { /* keep default text */ }
}

/* ---------- Calendar ---------- */
const state = { mode: 'month', year: new Date().getFullYear(), month: new Date().getMonth(), selected: ymd(new Date()), list: [] };
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_PX = 64;
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fromMin = m => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
const label12 = m => `${time12(fromMin(m))} ${ampm(fromMin(m))}`;
const handleOf = a => (a.instagram ? '@' + a.instagram : a.name);
const rangeLabel = (s, e) => (ampm(fromMin(s)) === ampm(fromMin(e)) ? `${time12(fromMin(s))} – ${label12(e)}` : `${label12(s)} – ${label12(e)}`);

let loadSeq = 0;
async function loadMonth() {
  const seq = ++loadSeq;                                   // ignore answers that arrive after a newer request
  let list = [];
  try { list = await api(`appointments?month=${state.year}-${pad(state.month + 1)}`); }
  catch (ex) { if (ex.message === 'auth') return; toast(ex.message); }
  if (seq !== loadSeq) return;
  state.list = list;
  render();
}

// Select a date; reloads only when it falls in another month.
function goDate(key) {
  const d = parseYmd(key);
  state.selected = key;
  if (d.getMonth() !== state.month || d.getFullYear() !== state.year) {
    state.year = d.getFullYear(); state.month = d.getMonth(); loadMonth();
  } else render();
}

function setMode(mode) {
  state.mode = mode;
  try { localStorage.setItem('kaeAdminView', mode); } catch { /* private mode */ }
  render();
}

function render() {
  const day = state.mode === 'day', d = parseYmd(state.selected);
  $('#month-title').textContent = day
    ? `${SHORT_DAYS[d.getDay()]}, ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`
    : `${MONTHS[state.month]} ${state.year}`;
  $('#prev').setAttribute('aria-label', day ? 'Previous day' : 'Previous month');
  $('#next').setAttribute('aria-label', day ? 'Next day' : 'Next month');
  document.querySelectorAll('.view-toggle button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode)));
  $('.appts-body').classList.toggle('day-mode', day);
  $('#calendar').hidden = day; $('#day-panel').hidden = day; $('#dayview').hidden = !day;
  if (day) renderTimeline(); else { renderGrid(); renderDay(); }
}

function byDay() {
  const map = {};
  for (const a of state.list) (map[a.date] ||= []).push(a);
  return map;
}

function renderGrid() {
  const first = new Date(state.year, state.month, 1);
  const start = new Date(first); start.setDate(1 - first.getDay());
  const weeks = Math.ceil((first.getDay() + new Date(state.year, state.month + 1, 0).getDate()) / 7);
  const map = byDay(), today = ymd(new Date());
  let html = '';
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const key = ymd(d), inMonth = d.getMonth() === state.month;
    const items = inMonth ? map[key] || [] : [];
    const cls = ['day', inMonth ? '' : 'out', key === today ? 'today' : '', key === state.selected ? 'selected' : ''].join(' ');
    const label = `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}${items.length ? `, ${items.length} appointment${items.length > 1 ? 's' : ''}` : ''}`;
    html += `<button class="${cls}" data-date="${key}" aria-label="${label}">
      <span class="num">${d.getDate()}</span>
      ${items.length ? `<span class="dots">${items.slice(0, 4).map(() => '<i></i>').join('')}</span>` : ''}
      ${items.length ? `<span class="chips">${items.slice(0, 3).map(a =>
        `<span class="chip" data-id="${a.id}" title="${esc(a.time ? label12(toMin(a.time)) + ' · ' : '')}${esc(handleOf(a))}">${a.time ? `<b>${time12(a.time)} ${ampm(a.time)}</b>` : ''}${esc(handleOf(a))}</span>`).join('')}</span>` : ''}
      ${items.length > 3 ? `<span class="more">+${items.length - 3} more</span>` : ''}
    </button>`;
  }
  $('#grid').innerHTML = html;
}

function renderDay() {
  const d = parseYmd(state.selected);
  $('#dp-weekday').textContent = WEEKDAYS[d.getDay()];
  $('#dp-date').textContent = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  const items = byDay()[state.selected] || [];
  $('#dp-empty').hidden = items.length > 0;
  $('#dp-list').innerHTML = items.map(a => `
    <li class="appt">
      <span class="time">${a.time ? `${time12(a.time)}<small>${ampm(a.time)}</small>` : '<small>Any time</small>'}</span>
      <span class="who">
        ${a.instagram
          ? `<a class="handle" href="https://instagram.com/${encodeURIComponent(a.instagram)}" target="_blank" rel="noopener"><svg aria-hidden="true"><use href="#i-ig"/></svg>@${esc(a.instagram)}</a>`
          : `<span class="handle">${esc(a.name)}</span>`}
        <span class="meta">${esc([a.instagram ? a.name : '', a.service].filter(Boolean).join(' · '))}</span>
      </span>
      <button class="btn edit" data-id="${a.id}">Edit</button>
      ${a.notes ? `<span class="notes">${esc(a.notes)}</span>` : ''}
    </li>`).join('');
}

// Day view: hour grid with each appointment as a block from start to end; overlapping ones share the width.
function renderTimeline() {
  const items = byDay()[state.selected] || [];
  const timed = items.filter(a => a.time)
    .map(a => ({ a, start: toMin(a.time), end: Math.min(toMin(a.time) + (a.duration || 60), 24 * 60) }))
    .sort((x, y) => x.start - y.start || y.end - x.end);
  const untimed = items.filter(a => !a.time);

  let first = 8, last = 20;                                     // 8 AM – 8 PM, widened to fit
  for (const t of timed) { first = Math.min(first, Math.floor(t.start / 60)); last = Math.max(last, Math.ceil(t.end / 60)); }

  let cluster = [], clusterEnd = -1;
  const place = () => { const cols = Math.max(...cluster.map(t => t.col)) + 1; cluster.forEach(t => (t.cols = cols)); };
  for (const t of timed) {
    if (t.start >= clusterEnd && cluster.length) { place(); cluster = []; }
    const used = cluster.filter(o => o.end > t.start).map(o => o.col);
    t.col = 0; while (used.includes(t.col)) t.col++;
    cluster.push(t); clusterEnd = Math.max(clusterEnd, t.end);
  }
  if (cluster.length) place();

  const y = m => ((m - first * 60) / 60) * HOUR_PX;
  let html = '';
  for (let h = first; h <= last; h++) {
    html += `<div class="tl-hour" style="top:${y(h * 60)}px"><span>${h === 24 ? '12 AM' : `${((h + 11) % 12) + 1} ${h < 12 ? 'AM' : 'PM'}`}</span></div>`;
    if (h < last) html += `<div class="tl-half" style="top:${y(h * 60 + 30)}px"></div>`;
  }
  html += '<div class="tl-area" id="tl-area">';
  for (const t of timed) {
    const a = t.a, short = t.end - t.start <= 45;
    html += `<button class="tl-appt${short ? ' short' : ''}" data-id="${a.id}"
      style="top:${y(t.start) + 1}px;height:${Math.max(y(t.end) - y(t.start) - 3, 26)}px;left:calc(${(t.col / t.cols) * 100}% + 2px);width:calc(${100 / t.cols}% - 6px)">
      <span class="t">${rangeLabel(t.start, t.end)}</span>
      <span class="h">${esc(handleOf(a))}</span>
      ${a.service || (a.instagram && a.name) ? `<span class="s">${esc([a.instagram ? a.name : '', a.service].filter(Boolean).join(' · '))}</span>` : ''}
    </button>`;
  }
  html += '</div>';
  if (state.selected === ymd(new Date())) {
    const now = new Date(), m = now.getHours() * 60 + now.getMinutes();
    if (m >= first * 60 && m <= last * 60) html += `<div class="tl-now" style="top:${y(m)}px"></div>`;
  }
  const tl = $('#timeline');
  tl.style.height = `${(last - first) * HOUR_PX}px`;
  tl.dataset.first = first;
  tl.innerHTML = html;

  $('#dv-allday').hidden = !untimed.length;
  $('#dv-allday').innerHTML = untimed.length ? `<span class="lbl">No time set</span>` +
    untimed.map(a => `<button class="chip" data-id="${a.id}">${esc(handleOf(a))}</button>`).join('') : '';
}

$('#grid').addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  const day = e.target.closest('.day');
  if (!day) return;
  const before = `${state.year}-${state.month}`;
  goDate(day.dataset.date);
  if (`${state.year}-${state.month}` !== before) return;
  if (chip) openEditor(state.list.find(a => a.id === chip.dataset.id));
  else if (matchMedia('(max-width: 1039px)').matches) $('#day-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('#grid').addEventListener('dblclick', e => {
  const day = e.target.closest('.day');
  if (day && !e.target.closest('.chip')) { state.selected = day.dataset.date; setMode('day'); }
});
$('#dp-list').addEventListener('click', e => {
  const btn = e.target.closest('.edit');
  if (btn) openEditor(state.list.find(a => a.id === btn.dataset.id));
});
$('#dp-hours').addEventListener('click', () => setMode('day'));

$('#dayview').addEventListener('click', e => {
  const item = e.target.closest('[data-id]');
  if (item) return openEditor(state.list.find(a => a.id === item.dataset.id));
  const area = e.target.closest('#timeline');
  if (!area) return;
  // Empty slot: start a new appointment at the tapped half hour.
  const offset = e.clientY - area.getBoundingClientRect().top;
  const m = Number(area.dataset.first) * 60 + Math.floor((offset / HOUR_PX) * 2) * 30;
  openEditor(null, state.selected, fromMin(Math.max(0, Math.min(m, 23 * 60 + 30))));
});

document.querySelectorAll('.view-toggle button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));

function step(dir) {
  if (state.mode === 'day') {
    const d = parseYmd(state.selected); d.setDate(d.getDate() + dir); return goDate(ymd(d));
  }
  const d = new Date(state.year, state.month + dir, 1);
  const today = new Date();
  goDate(d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() ? ymd(today) : ymd(d));
}
$('#prev').addEventListener('click', () => step(-1));
$('#next').addEventListener('click', () => step(1));
$('#today').addEventListener('click', () => goDate(ymd(new Date())));
try { if (localStorage.getItem('kaeAdminView') === 'day') state.mode = 'day'; } catch { /* private mode */ }

/* ---------- Editor ---------- */
const editor = $('#editor'), form = $('#appt-form');
let editingId = null;

function openEditor(appt, date, time) {
  editingId = appt?.id || null;
  form.reset();
  $('#editor-error').hidden = true;
  $('#editor-title').textContent = appt ? 'Edit appointment' : 'New appointment';
  $('#delete').hidden = !appt;
  const v = appt || { date: date || state.selected, time: time || '' };
  for (const k of ['date', 'time', 'instagram', 'name', 'service', 'notes']) form.elements[k].value = v[k] || '';
  const dur = String(v.duration || 60), sel = form.elements.duration;
  if (![...sel.options].some(o => o.value === dur)) sel.add(new Option(`${dur} min`, dur));
  sel.value = dur;
  editor.showModal();
  if (!appt) form.elements.instagram.focus();
}
$('#add').addEventListener('click', () => openEditor(null));
$('#editor-close').addEventListener('click', () => editor.close());
$('#dp-add').addEventListener('click', () => openEditor(null, state.selected));
editor.addEventListener('click', e => { if (e.target === editor) editor.close(); });   // tap outside to close
form.elements.instagram.addEventListener('input', e => { e.target.value = e.target.value.replace(/^@+/, '').replace(/\s/g, ''); });

form.addEventListener('submit', async e => {
  e.preventDefault();
  const body = Object.fromEntries(['date', 'time', 'duration', 'instagram', 'name', 'service', 'notes'].map(k => [k, form.elements[k].value]));
  const err = $('#editor-error'); err.hidden = true;
  try {
    const saved = await api(editingId ? `appointments/${editingId}` : 'appointments', { method: editingId ? 'PUT' : 'POST', body });
    editor.close();
    toast(editingId ? 'Appointment updated' : 'Appointment added');
    const d = parseYmd(saved.date);
    state.year = d.getFullYear(); state.month = d.getMonth(); state.selected = saved.date;
    loadMonth();
  } catch (ex) {
    if (ex.message !== 'auth') { err.textContent = ex.message; err.hidden = false; }
  }
});

$('#delete').addEventListener('click', async () => {
  if (!editingId || !confirm('Delete this appointment?')) return;
  try {
    await api(`appointments/${editingId}`, { method: 'DELETE' });
    editor.close(); toast('Appointment deleted'); loadMonth();
  } catch (ex) { if (ex.message !== 'auth') toast(ex.message); }
});

/* ---------- Start ---------- */
api('session').then(s => { authed = s.authed; route(); }).catch(() => route());
