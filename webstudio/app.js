'use strict';

/* ── Sticky header shadow ── */
const header = document.getElementById('site-header');
const onScroll = () => {
  if (!header) return;
  header.classList.toggle('scrolled', window.scrollY > 8);
};
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ── Mobile menu ── */
const toggle = document.getElementById('nav-toggle');
const menu   = document.getElementById('mobile-menu');
if (toggle && menu) {
  toggle.addEventListener('click', () => {
    const open = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }));
}

/* ── CRT carousel ── */
(() => {
  const frames = document.querySelectorAll('#crt-frames .mockup');
  const dots   = document.querySelectorAll('#crt-dots .crt-dot');
  if (!frames.length) return;

  let i = 0;
  let timer = null;

  function show(idx) {
    frames.forEach((f, n) => f.classList.toggle('active', n === idx));
    dots.forEach((d, n)   => d.classList.toggle('active', n === idx));
    i = idx;
  }
  function next() { show((i + 1) % frames.length); }
  function start() { stop(); timer = setInterval(next, 4200); }
  function stop()  { if (timer) { clearInterval(timer); timer = null; } }

  dots.forEach((d, n) => {
    d.addEventListener('click', () => { show(n); start(); });
  });

  // Bei Hover über den Monitor pausieren
  const crt = document.querySelector('.crt');
  if (crt) {
    crt.addEventListener('mouseenter', stop);
    crt.addEventListener('mouseleave', start);
  }

  start();
})();

/* ── Jahr im Footer ── */
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ── Kontaktformular (öffnet mailto) ── */
function submitContact(e) {
  e.preventDefault();
  const f = e.target;
  const get = n => (f.elements[n]?.value || '').trim();
  const name = get('name');
  const firma = get('firma');
  const email = get('email');
  const telefon = get('telefon');
  const nachricht = get('nachricht');

  const subject = `Anfrage von ${name}${firma ? ' · ' + firma : ''}`;
  const body =
`Hallo Tim,

${nachricht}

— — —
Name:    ${name}
Firma:   ${firma}
E-Mail:  ${email}
Telefon: ${telefon}

(Gesendet über tim-ulrich-webstudio.de)`;

  const url = `mailto:weblabduisburg@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = url;
  return false;
}
window.submitContact = submitContact;
