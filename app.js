'use strict';

/**
 * app.js — logique d'interaction du site.
 *
 * Principes de sécurité appliqués dans tout ce fichier :
 * - Jamais de innerHTML/insertAdjacentHTML avec une donnée venant de
 *   l'utilisateur ou du réseau -> on utilise textContent partout, ce qui
 *   empêche l'exécution de balises/scripts injectés (XSS).
 * - Aucune donnée sensible n'est stockée en localStorage/sessionStorage.
 */

document.addEventListener('DOMContentLoaded', () => {
  initYear();
  initNavToggle();
  initActiveNav();
  initProjectFilters();
  initScrollReveal();
  initNavAvatarReveal();
});

/* -------------------------------------------------------------------------
 * Année dynamique du footer
 * ---------------------------------------------------------------------- */
function initYear() {
  const yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }
}

/* -------------------------------------------------------------------------
 * Menu mobile
 * ---------------------------------------------------------------------- */
function initNavToggle() {
  const toggle = document.getElementById('navToggle');
  const menu = document.getElementById('navMenu');
  if (!toggle || !menu) return;

  const closeMenu = () => {
    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  };

  toggle.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  // Ferme le menu après un clic sur un lien (navigation mobile)
  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  // Ferme le menu avec Échap (accessibilité clavier)
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });
}

/* -------------------------------------------------------------------------
 * Mise en évidence du lien de navigation actif (site multi-pages)
 * ---------------------------------------------------------------------- */
function initActiveNav() {
  const links = document.querySelectorAll('.nav__menu a[href]');
  if (!links.length) return;

  const currentPath = window.location.pathname.replace(/index\.html$/, '');

  links.forEach((link) => {
    const href = link.getAttribute('href');
    if (href.includes('#')) return; // ancre (ex: Contact) : jamais marquée "page courante"

    const linkUrl = new URL(href, window.location.href);
    const linkPath = linkUrl.pathname.replace(/index\.html$/, '');
    if (linkPath === currentPath) {
      link.setAttribute('aria-current', 'page');
    }
  });
}

/* -------------------------------------------------------------------------
 * Animation légère au scroll (dégradée si reduced-motion)
 * ---------------------------------------------------------------------- */
function initScrollReveal() {
  const targets = document.querySelectorAll('[data-reveal]');
  if (!targets.length) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );

  targets.forEach((el) => observer.observe(el));
}

/* -------------------------------------------------------------------------
 * Apparition de la photo dans la nav au scroll (accueil uniquement)
 * ---------------------------------------------------------------------- */
function initNavAvatarReveal() {
  const heroAvatar = document.querySelector('.hero__avatar');
  const navAvatar = document.querySelector('.nav__avatar--reveal');
  const floatingBadges = document.querySelector('.floating-badges--reveal');
  if (!heroAvatar || !('IntersectionObserver' in window)) return;
  if (!navAvatar && !floatingBadges) return;

  // Le seuil correspond à la hauteur du header sticky (~64px) : la photo
  // apparaît dans la nav (et les boutons flottants se révèlent) au moment
  // précis où la grande photo du hero disparaîtrait dessous. Pour les
  // boutons flottants, c'est aussi ce qui évite qu'ils recouvrent la bande
  // de chiffres clés du hero sur les écrans peu hauts.
  const observer = new IntersectionObserver(
    ([entry]) => {
      const scrolledPast = !entry.isIntersecting;
      if (navAvatar) navAvatar.classList.toggle('is-visible', scrolledPast);
      if (floatingBadges) floatingBadges.classList.toggle('is-visible', scrolledPast);
    },
    { rootMargin: '-64px 0px 0px 0px', threshold: 0 }
  );

  observer.observe(heroAvatar);
}

/* -------------------------------------------------------------------------
 * Filtres de la section projets
 * ---------------------------------------------------------------------- */
function initProjectFilters() {
  const buttons = document.querySelectorAll('.filter-btn');
  const cards = document.querySelectorAll('.project-card');
  if (!buttons.length || !cards.length) return;

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.dataset.filter;

      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));

      cards.forEach((card) => {
        const categories = card.dataset.category.split(/\s+/);
        const matches = filter === 'all' || categories.includes(filter);
        card.hidden = !matches;
      });
    });
  });
}
