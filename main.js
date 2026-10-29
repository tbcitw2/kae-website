const desktop = window.matchMedia('(min-width: 900px)');
const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
const glide = () => (calm.matches ? 'auto' : 'smooth');

// Mobile full-screen menu
const toggle = document.querySelector('.menu-toggle');
const menu = document.getElementById('mobile-menu');
function setMenu(open) {
  const was = menu.classList.contains('open');
  menu.classList.toggle('open', open);
  menu.setAttribute('aria-hidden', !open);
  toggle.setAttribute('aria-expanded', open);
  toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  document.body.classList.toggle('menu-open', open);
  // keep keyboard focus inside the menu while it covers the page
  document.querySelectorAll('main, .site-footer, .book-bar, .promo, .screen-dots').forEach((el) => (el.inert = open));
  if (open && !was) menu.querySelector('a, button')?.focus();
  if (!open && was) toggle.focus();
  updateBookBar();
}
toggle.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
desktop.addEventListener('change', () => setMenu(false));

// "What's included" is always open on desktop, collapsible on phones
const includes = document.querySelector('[data-open-desktop]');
const syncIncludes = () => { if (desktop.matches) includes.open = true; };
syncIncludes();
desktop.addEventListener('change', syncIncludes);
includes.addEventListener('toggle', syncIncludes);

// Random promo: one of her shops or socials, once per visit
const promo = document.querySelector('.promo');
const PROMOS = [
  { kind: 'Shop my closet', title: 'Kae’s LTK', text: 'Every outfit I wear, all in one place.', cta: 'Shop LTK', url: 'https://www.shopltk.com/explore/Kaetheblondie', img: 'img/sm/kae-night.jpg' },
  { kind: 'Amazon storefront', title: 'My Amazon favs', text: 'Hair tools, beauty and closet staples I swear by.', cta: 'Shop Amazon', url: 'https://www.amazon.com/shop/kaelynemily', img: 'img/sm/kae-denim.jpg' },
  { kind: 'For hairstylists', title: 'The Content Playbook', text: 'Grow online without losing your mind. $24.99', cta: 'Get the playbook', url: 'https://stan.store/kaetheblondie', img: 'img/sm/kae-portrait.jpg' },
  { kind: 'Hair care', title: 'UNITE Hair', text: 'The products that keep your color vibrant.', cta: 'Shop UNITE', url: 'https://www.unitehair.com/?rfsn=6927630.0da53c9&utm_source=refersion&utm_medium=affiliate&utm_campaign=6927630.0da53c9', img: 'img/sm/work-04.jpg' },
  { kind: 'Scalp health', title: 'DIVI Scalp Serum', text: 'Use code <span class="code">kaetheblondie</span> at checkout.', cta: 'Shop DIVI', url: 'https://sldr.page.link/nKQ8j', img: 'img/sm/work-02.jpg' },
  { kind: 'Hair vitamins', title: 'JS Health', text: 'My go-to for stronger, shinier growth.', cta: 'Shop vitamins', url: 'https://us.jshealthvitamins.com/products/jshealth-hair-vitamin-60-capsules?utm_source=USAtalent&utm_medium=TikTok&utm_campaign=KaelynEmily', img: 'img/sm/work-09.jpg' },
  { kind: 'For your business', title: 'Jotform — 50% off', text: 'Online forms for your business — 50% off annual plans.', cta: 'Get 50% off', url: 'https://www.jotform.com/products/form-builder/?partner=kaelynmoritsch', icon: 'kae-mark', bg: 'var(--honey)' },
  { kind: 'Follow along', title: 'Instagram', text: 'Fresh blondes and transformations every week.', cta: 'Follow', url: 'https://instagram.com/kaetheblondie', icon: 'i-instagram' },
  { kind: 'Watch', title: 'TikTok', text: 'Behind-the-chair videos, tips and fun.', cta: 'Watch on TikTok', url: 'https://www.tiktok.com/@kaetheblondie', icon: 'i-tiktok', bg: 'var(--honey)' },
  { kind: 'Watch', title: 'YouTube', text: 'Longer hair tutorials and vlogs.', cta: 'Subscribe', url: 'https://www.youtube.com/@kaetheblondie', icon: 'i-youtube' },
  { kind: 'Outfits & tips', title: 'Lemon8', text: 'Style posts, hair tips and favorite finds.', cta: 'See Lemon8', url: 'https://v.lemon8-app.com/s/jMvwdrpy', icon: 'i-lemon', bg: 'var(--latte)' },
];
const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch {} },
};
let promoIndex = -1;
function fillPromo() {
  let i;
  do { i = Math.floor(Math.random() * PROMOS.length); } while (i === promoIndex && PROMOS.length > 1);
  promoIndex = i;
  const p = PROMOS[i];
  const thumb = promo.querySelector('.promo-thumb');
  thumb.style.background = p.bg || '';
  thumb.innerHTML = p.img
    ? `<img src="${p.img}" alt="" width="76" height="76">`
    : `<svg viewBox="${p.icon === 'kae-mark' ? '0 0 200 260' : '0 0 24 24'}" aria-hidden="true"><use href="#${p.icon}"/></svg>`;
  promo.querySelector('.promo-kind').textContent = p.kind;
  promo.querySelector('.promo-title').textContent = p.title;
  promo.querySelector('.promo-text').innerHTML = p.text;
  const cta = promo.querySelector('.promo-cta');
  cta.textContent = p.cta + ' ↗';
  cta.href = p.url;
}
let promoAutoHide;
function showPromo() {
  if (store.get('kaePromo') || menu.classList.contains('open')) return;
  fillPromo();
  promo.classList.add('show');
  promo.setAttribute('aria-hidden', 'false');
  // On phones it sits over the page, so it steps aside on its own after a while
  armPromoTimer();
}
function armPromoTimer() {
  clearTimeout(promoAutoHide);
  if (!desktop.matches) promoAutoHide = setTimeout(() => hidePromo(true), 9000);
}
function hidePromo(forGood) {
  promo.classList.remove('show');
  promo.setAttribute('aria-hidden', 'true');
  if (forGood) store.set('kaePromo', 'done');
}
promo.querySelector('.promo-close').addEventListener('click', () => hidePromo(true));
promo.querySelector('.promo-next').addEventListener('click', () => { fillPromo(); armPromoTimer(); });
promo.querySelector('.promo-cta').addEventListener('click', () => setTimeout(() => hidePromo(true), 300));

// Show it once the visitor has scrolled past the hero and spent a few seconds on the page
let promoTimerDone = false, pastHero = false;
setTimeout(() => { promoTimerDone = true; maybeShowPromo(); }, 6000);
function maybeShowPromo() {
  if (promoTimerDone && pastHero && !promo.classList.contains('show')) showPromo();
}

// Sticky "Book" bar: shows after the hero, hides at the booking section and footer
const bookBar = document.querySelector('.book-bar');
const hero = document.querySelector('.hero');
const bookSection = document.getElementById('book');
const footer = document.querySelector('.site-footer');
const seen = new Map();
function updateBookBar() {
  const show = seen.get(hero) === false && !seen.get(bookSection) && !seen.get(footer) && !menu.classList.contains('open');
  bookBar.classList.toggle('show', show);
  document.querySelector('.site-header').classList.toggle('bar-on', show);
  bookBar.setAttribute('aria-hidden', !show);
  bookBar.querySelectorAll('a').forEach((a) => (a.tabIndex = show ? 0 : -1));
  promo?.classList.toggle('solo', !show || desktop.matches);
  if (menu.classList.contains('open')) hidePromo();
}
const barObserver = new IntersectionObserver((entries) => {
  entries.forEach((e) => seen.set(e.target, e.isIntersecting));
  if (seen.get(hero) === false) { pastHero = true; maybeShowPromo(); }
  updateBookBar();
});
[hero, bookSection, footer].forEach((el) => barObserver.observe(el));

// Swipe rails: dots that follow the scroll position
document.querySelectorAll('[data-rail]').forEach((rail) => {
  const dots = rail.nextElementSibling?.querySelector('.rail-dots');
  if (!dots) return;
  const items = [...rail.children];
  dots.innerHTML = items.map(() => '<i></i>').join('');
  const marks = [...dots.children];
  const update = () => {
    const step = items[1] ? items[1].offsetLeft - items[0].offsetLeft : 1;
    const atEnd = rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - 2;
    const i = atEnd ? items.length - 1 : Math.min(items.length - 1, Math.round(rail.scrollLeft / step));
    marks.forEach((m, n) => m.classList.toggle('on', n === i));
  };
  rail.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
  update();
});

// Reveal on scroll
const io = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.classList.add('in');
      io.unobserve(entry.target);
    }
  }
}, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

// Copy discount code
document.querySelectorAll('[data-copy]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      btn.textContent = 'Copied!';
    } catch {
      btn.textContent = 'Hold to copy';
    }
    setTimeout(() => { btn.textContent = 'Copy'; }, 1800);
  });
});

// ---------- On-site client forms ----------
// Where submissions go. Leave empty for preview mode (nothing is sent).
// Later: set this to your form handler URL; it receives multipart/form-data
// with the answers plus photos_current / photos_goal image files.
const FORM_ENDPOINT = '';

const tabs = [...document.querySelectorAll('.form-tabs [role="tab"]')];
const forms = [...document.querySelectorAll('.client-form')];
const formDone = document.querySelector('.form-done');

function selectForm(id) {
  if (!formDone.hidden) return;                            // already sent: keep the thank-you screen
  tabs.forEach((t) => {
    const on = t.getAttribute('aria-controls') === id;
    t.setAttribute('aria-selected', on);
    t.tabIndex = on ? 0 : -1;
  });
  forms.forEach((f) => (f.hidden = f.id !== id));
  relayout();
}
tabs.forEach((t) => t.addEventListener('click', () => selectForm(t.getAttribute('aria-controls'))));
document.querySelector('.form-tabs').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const i = tabs.indexOf(document.activeElement);
  const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
  next.click(); next.focus();
});
document.querySelectorAll('[data-open-form]').forEach((a) =>
  a.addEventListener('click', () => selectForm(a.dataset.openForm === 'ext' ? 'form-ext' : 'form-new')));

// Photo pickers with previews (files are kept here, not in the input)
const picked = new Map();
document.querySelectorAll('.upload input[type=file]').forEach((input) => {
  picked.set(input, []);
  const thumbs = input.closest('.upload').querySelector('.thumbs');
  const max = Number(input.dataset.max || 4);
  const render = () => {
    thumbs.innerHTML = '';
    picked.get(input).forEach((file, i) => {
      const url = URL.createObjectURL(file);
      const div = document.createElement('div');
      div.className = 'thumb';
      div.innerHTML = `<img src="${url}" alt=""><button type="button" aria-label="Remove photo">×</button>`;
      const img = div.querySelector('img');
      img.onload = img.onerror = () => URL.revokeObjectURL(url);
      div.querySelector('button').onclick = () => { picked.get(input).splice(i, 1); render(); };
      thumbs.append(div);
    });
    input.closest('.drop').querySelector('span').textContent =
      picked.get(input).length >= max ? `Max ${max} photos` : '＋ Add photos';
    clearError(input.closest('.field'));
    const form = input.form;
    if (!form.querySelector('.invalid')) form.querySelector('.form-error').hidden = true;
    relayout();
  };
  input.addEventListener('change', () => {
    const list = picked.get(input);
    [...input.files].filter((f) => f.type.startsWith('image/')).forEach((f) => { if (list.length < max) list.push(f); });
    input.value = '';
    render();
  });
});

function setError(field, msg) {
  field.classList.add('invalid');
  field.querySelectorAll('input, textarea').forEach((el) => el.setAttribute('aria-invalid', 'true'));
  let err = field.querySelector(':scope > .err');
  if (!err) { err = document.createElement('span'); err.className = 'err'; field.append(err); }
  err.textContent = msg;
}
function clearError(field) {
  if (!field) return;
  if (!field.classList.contains('invalid')) return;
  field.classList.remove('invalid');
  field.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  field.querySelector(':scope > .err')?.remove();
  relayout();                                              // heights changed
  syncSnapPause();
}
forms.forEach((form) => {
  const onEdit = (e) => {
    clearError(e.target.closest('.field'));
    if (!form.querySelector('.invalid')) { form.querySelector('.form-error').hidden = true; syncSnapPause(); }
  };
  form.addEventListener('input', onEdit);
  form.addEventListener('change', onEdit);
});

function validate(form) {
  const bad = [];
  form.querySelectorAll('input[required], textarea[required]').forEach((el) => {
    const field = el.closest('.field');
    const v = el.value.trim();
    if (!v) { setError(field, 'Please fill this in.'); bad.push(field); }
    else if (el.type === 'email' && !el.checkValidity()) { setError(field, 'Please enter a valid email.'); bad.push(field); }
    else if (el.type === 'tel' && v.replace(/\D/g, '').length < 10) { setError(field, 'Please enter a valid phone number.'); bad.push(field); }
  });
  form.querySelectorAll('input[type=email]:not([required])').forEach((el) => {
    if (el.value.trim() && !el.checkValidity()) { setError(el.closest('.field'), 'Please enter a valid email.'); bad.push(el.closest('.field')); }
  });
  form.querySelectorAll('fieldset[data-required]').forEach((fs) => {
    if (!fs.querySelector('input:checked')) { setError(fs, 'Please pick at least one.'); bad.push(fs); }
  });
  form.querySelectorAll('.upload[data-required]').forEach((up) => {
    if (!picked.get(up.querySelector('input')).length) { setError(up, 'Please add at least one photo.'); bad.push(up); }
  });
  return bad;
}

// Shrink big phone photos before upload (falls back to the original file)
async function shrink(file, maxSide = 1600) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.82));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

forms.forEach((form) => form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const banner = form.querySelector('.form-error');
  const bad = validate(form);
  if (bad.length) {
    banner.textContent = bad.length === 1 ? 'One thing needs a quick fix ↓' : `${bad.length} things need a quick fix ↓`;
    banner.hidden = false;
    relayout();
    syncSnapPause();
    bad[0].scrollIntoView({ behavior: glide(), block: 'center' });
    bad[0].querySelector('input, textarea')?.focus({ preventScroll: true });
    return;
  }
  banner.hidden = true;
  if (form.dataset.busy) return;
  form.dataset.busy = '1';
  const btn = form.querySelector('.submit');
  const label = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'Sending…';

  const data = new FormData();
  data.append('form', form.dataset.form);
  new FormData(form).forEach((v, k) => { if (!(v instanceof File)) data.append(k, v); });
  for (const input of form.querySelectorAll('.upload input')) {
    for (const f of picked.get(input)) data.append(input.name, await shrink(f));
  }

  try {
    if (FORM_ENDPOINT) {
      const res = await fetch(FORM_ENDPOINT, { method: 'POST', body: data });
      if (!res.ok) throw new Error(res.status);
    } else {
      await new Promise((r) => setTimeout(r, 700));
      formDone.querySelector('.form-note').hidden = false;
      formDone.querySelector('.form-note').textContent = 'Preview mode: this form isn’t connected to an email yet, so nothing was sent.';
    }
    formDone.querySelector('[data-name]').textContent = form.first_name.value.trim().split(' ')[0] || 'babe';
    forms.forEach((f) => (f.hidden = true));
    document.querySelector('.form-tabs').hidden = true;
    formDone.hidden = false;
    relayout();
    formDone.focus({ preventScroll: true });
    formDone.scrollIntoView({ behavior: glide(), block: 'center' });
  } catch {
    banner.textContent = 'Something went wrong sending your info. Please try again, or email kaetheblondie@gmail.com.';
    banner.hidden = false;
    relayout();
  } finally {
    delete form.dataset.busy;
    btn.disabled = false;
    btn.innerHTML = label;
  }
}));

// ---------- Phones: one screen per swipe ----------
// Each section's blocks are grouped into screen-sized pages. Every page is padded to exactly one screen
// (content centered) and CSS scroll snapping on html.swipe moves one page per swipe, like a video feed.
const root = document.documentElement;
const header = document.querySelector('.site-header');
const units = [...document.querySelectorAll('main > section, .site-footer')];
const dotsNav = document.querySelector('.screen-dots');
const hint = document.querySelector('.swipe-hint');
let pages = [], screenH = 0, layoutWidth = 0;

const docTop = (el) => { let y = 0; for (let n = el; n; n = n.offsetParent) y += n.offsetTop; return y; };
const plain = (el) => getComputedStyle(el).backgroundColor === 'rgba(0, 0, 0, 0)';   // no card behind it

// Blocks a page can start on; anything taller than a screen is split into its block-level children.
const isInline = (el) => getComputedStyle(el).display.startsWith('inline');
function blocksOf(el, limit) {
  const out = [];
  for (const c of el.children) {
    const pos = getComputedStyle(c).position;
    if (c.hidden || !c.offsetHeight || pos === 'absolute' || pos === 'fixed') continue;
    if (c.offsetHeight > limit && c.children.length > 1 && ![...c.children].some(isInline)) out.push(...blocksOf(c, limit));
    else out.push(c);
  }
  return out;
}

// Inline styles the layout changes, so every re-layout starts from the page's own styles.
const touched = new Map();
function setStyle(el, prop, value) {
  if (!touched.has(el)) touched.set(el, { marginTop: el.style.marginTop, marginBottom: el.style.marginBottom, scrollMarginTop: el.style.scrollMarginTop });
  el.style[prop] = value;
}

function measureScreen() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;height:100svh;visibility:hidden;pointer-events:none';
  document.body.append(probe);
  screenH = probe.offsetHeight || window.innerHeight;
  probe.remove();
  layoutWidth = window.innerWidth;
}

function layoutScreens() {
  for (const [el, original] of touched) Object.assign(el.style, original);
  touched.clear();
  pages.forEach((p) => p.first.classList.remove('screen'));
  pages = [];
  const on = !desktop.matches && screenH >= 520;          // phones held upright (landscape scrolls normally)
  root.classList.toggle('swipe', on);
  dotsNav.hidden = !on;
  if (!on) return;

  const pageH = screenH - header.offsetHeight;            // what one swipe scrolls
  const reserve = bookBar.offsetHeight + 20;               // keep clear for the sticky Book bar
  const room = pageH - reserve;

  for (const unit of units) {
    const wrap = unit.querySelector(':scope > .wrap') || unit;
    const blocks = blocksOf(wrap, room - 96);              // leave room for the section's own spacing
    const tail = unit.classList.contains('hero') ? unit.nextElementSibling : null;   // the marquee ribbon
    if (tail?.classList.contains('marquee')) blocks.push(tail);
    blocks.sort((a, b) => docTop(a) - docTop(b));              // visual order (CSS may reorder)
    if (!blocks.length) continue;
    const uTop = docTop(unit);
    const uEnd = tail ? docTop(tail) + tail.offsetHeight : uTop + unit.offsetHeight;
    let page = null;
    for (const b of blocks) {
      const top = docTop(b), bottom = top + b.offsetHeight;
      if (page && bottom - page.top <= room) { page.last = b; page.bottom = bottom; page.end = bottom; continue; }
      page = { first: b, last: b, top, bottom, end: bottom, start: page ? page.bottom : uTop, unit };
      pages.push(page);
    }
    page.end = uEnd;
  }

  // Measure first, then pad, so each page is: top gap + content + bottom gap = one screen.
  // Short pages get blank space (content centered above the Book bar); tall ones lose some of their top gap.
  const plan = pages.map((p, i) => {
    let lead = p.top - p.start;
    const trail = p.end - p.bottom;
    const extra = pageH - (lead + (p.bottom - p.top) + trail);
    if (extra < 0) {
      if (i) lead = Math.max(12, lead + extra);
      return { p, lead, t: 0, b: 0 };
    }
    if (!plain(p.first.parentElement) || !plain(p.last.parentElement)) return { p, lead, t: 0, b: 0 };
    const keep = Math.min(reserve, extra), free = extra - keep;
    const t = Math.max(0, Math.min(free, (free + trail - lead) / 2));
    return { p, lead, t, b: free - t + keep };
  });
  // Read every base margin before writing any (one layout pass). In normal flow a block's top margin
  // collapses with the one above, so the collapsed gap is the base.
  const baseTop = (el) => {
    let base = parseFloat(getComputedStyle(el).marginTop);
    const prev = el.previousElementSibling;
    if (prev && getComputedStyle(el.parentElement).display === 'block') base = Math.max(base, parseFloat(getComputedStyle(prev).marginBottom));
    return base;
  };
  const writes = plan.map(({ p, lead, t, b }, i) => {
    const sameUnitBefore = i && plan[i - 1].p.unit === p.unit;
    const lastInUnit = !plan[i + 1] || plan[i + 1].p.unit !== p.unit;
    const top = t + (sameUnitBefore ? plan[i - 1].b : 0);          // a page's bottom space sits on top of the next page
    return {
      p, lead, t,
      top: top ? baseTop(p.first) + top : null,
      bottom: lastInUnit && b ? parseFloat(getComputedStyle(p.last).marginBottom) + b : null,
    };
  });
  for (const { p, lead, t, top, bottom } of writes) {
    if (top !== null) setStyle(p.first, 'marginTop', `${top}px`);
    if (bottom !== null) setStyle(p.last, 'marginBottom', `${bottom}px`);
    setStyle(p.first, 'scrollMarginTop', `${lead + t}px`);
    p.first.classList.add('screen');
  }
}

let layoutQueued = false;
function relayout() {
  if (layoutQueued) return;
  layoutQueued = true;
  setTimeout(() => { layoutQueued = false; layoutScreens(); }, 60);
}

// Section dots on the right edge: where you are, tap to jump
const labelled = units.filter((u) => u.dataset.label);
dotsNav.innerHTML = labelled.map((u) => `<button type="button" aria-label="${u.dataset.label}"><i></i></button>`).join('')
  + '<span class="screen-label" aria-hidden="true"></span>';
const dotBtns = [...dotsNav.querySelectorAll('button')];
const dotLabel = dotsNav.querySelector('.screen-label');
dotBtns.forEach((btn, i) => btn.addEventListener('click', () => {
  (labelled[i].querySelector('.screen') || labelled[i]).scrollIntoView({ behavior: glide(), block: 'start' });
}));
let current = -1, labelTimer;
const sectionWatch = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const i = labelled.indexOf(e.target);
    if (i === current) continue;
    current = i;
    dotBtns.forEach((b, n) => b.toggleAttribute('aria-current', n === i));
    dotLabel.textContent = labelled[i].dataset.label;
    dotLabel.style.top = `${dotBtns[i].offsetTop + dotBtns[i].offsetHeight / 2}px`;
    dotsNav.classList.add('talk');
    clearTimeout(labelTimer);
    labelTimer = setTimeout(() => dotsNav.classList.remove('talk'), 1400);
  }
}, { rootMargin: '-50% 0px -50% 0px' });
labelled.forEach((u) => sectionWatch.observe(u));

// "Swipe up" hint until the first swipe
if (!store.get('kaeSwiped')) {
  hint.hidden = false;
  const done = () => {
    if (window.scrollY < 40) return;
    hint.classList.add('gone');
    store.set('kaeSwiped', '1');
    window.removeEventListener('scroll', done);
  };
  window.addEventListener('scroll', done, { passive: true });
}

// No snapping while typing in a form (the keyboard resizes the screen) or while a form shows errors
const TYPING = 'input:not([type=checkbox]):not([type=radio]):not([type=file]), textarea, select';
function syncSnapPause() {
  root.classList.toggle('typing', !!document.activeElement?.matches(TYPING) || !!document.querySelector('.client-form .invalid'));
}
document.addEventListener('focusin', syncSnapPause);
document.addEventListener('focusout', () => setTimeout(syncSnapPause, 100));

// Re-measure when the layout really changes (not when the phone's address bar slides)
measureScreen();
layoutScreens();
document.fonts?.ready.then(relayout);
window.addEventListener('load', relayout);
window.addEventListener('resize', () => { if (window.innerWidth !== layoutWidth) { measureScreen(); relayout(); } });
desktop.addEventListener('change', relayout);
includes.addEventListener('toggle', relayout);
