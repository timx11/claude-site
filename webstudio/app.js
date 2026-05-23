'use strict';

/* ── Sticky header shadow on scroll ── */
const header = document.getElementById('site-header');
const onScroll = () => {
  if (!header) return;
  header.classList.toggle('scrolled', window.scrollY > 8);
};
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ── Mobile menu ── */
const navToggle = document.getElementById('nav-toggle');
const mobileMenu = document.getElementById('mobile-menu');
if (navToggle && mobileMenu) {
  navToggle.addEventListener('click', () => {
    const open = navToggle.classList.toggle('open');
    mobileMenu.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', String(open));
  });
  mobileMenu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      navToggle.classList.remove('open');
      mobileMenu.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

/* ── FAQ: keep only one open at a time ── */
document.querySelectorAll('.faq-item').forEach(item => {
  item.addEventListener('toggle', () => {
    if (item.open) {
      document.querySelectorAll('.faq-item').forEach(other => {
        if (other !== item) other.open = false;
      });
    }
  });
});

/* ── Year in footer ── */
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

/* ── Contact form: build mailto and confirm ── */
const form = document.getElementById('contact-form');
const successEl = document.getElementById('form-success');
if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const data = new FormData(form);
    const name    = (data.get('name')    || '').toString().trim();
    const contact = (data.get('contact') || '').toString().trim();
    const branche = (data.get('branche') || '').toString().trim();
    const paket   = (data.get('paket')   || '').toString().trim();
    const message = (data.get('message') || '').toString().trim();

    if (!name || !contact || !message) {
      form.querySelectorAll('[required]').forEach(input => {
        if (!input.value.trim()) {
          input.style.borderColor = '#dc2626';
          input.style.background = '#fef2f2';
          setTimeout(() => {
            input.style.borderColor = '';
            input.style.background = '';
          }, 2500);
        }
      });
      return;
    }

    const subject = `Webseiten-Anfrage von ${name}`;
    const body = [
      `Name: ${name}`,
      `Kontakt: ${contact}`,
      branche ? `Branche / Unternehmen: ${branche}` : '',
      paket   ? `Paket: ${paket}` : '',
      '',
      'Nachricht:',
      message,
    ].filter(Boolean).join('\n');

    const mailto = `mailto:weblabduisburg@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;

    if (successEl) {
      successEl.classList.add('visible');
      form.reset();
      setTimeout(() => successEl.classList.remove('visible'), 8000);
    }
  });
}

/* ── Reveal-on-scroll (subtle) ── */
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.pkg, .feature, .step, .branche, .faq-item').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(16px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    io.observe(el);
  });
}

/* ── Hide floating WhatsApp button when contact section is in view ── */
const floatBtn = document.querySelector('.float-whatsapp');
const contactSection = document.getElementById('kontakt');
if (floatBtn && contactSection && 'IntersectionObserver' in window) {
  const io2 = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      floatBtn.classList.toggle('hidden', entry.isIntersecting);
    });
  }, { threshold: 0.15 });
  io2.observe(contactSection);
}
