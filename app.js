'use strict';

/**
 * app.js — logique d'interaction du site.
 *
 * Principes de sécurité appliqués dans tout ce fichier :
 * - Jamais de innerHTML/insertAdjacentHTML avec une donnée venant de
 *   l'utilisateur ou du réseau -> on utilise textContent partout, ce qui
 *   empêche l'exécution de balises/scripts injectés (XSS).
 * - Toute saisie utilisateur est validée ET nettoyée (sanitize) avant
 *   d'être réutilisée, même pour un simple affichage.
 * - Aucune donnée sensible (identifiants, tokens, contenu de formulaire)
 *   n'est stockée en localStorage/sessionStorage.
 */

document.addEventListener('DOMContentLoaded', () => {
  initYear();
  initNavToggle();
  initActiveNav();
  initProjectFilters();
  initScrollReveal();
  initContactForm();
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

/* -------------------------------------------------------------------------
 * Formulaire de contact : validation + sanitization + soumission
 * ---------------------------------------------------------------------- */
function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  const statusEl = document.getElementById('formStatus');
  const submitBtn = form.querySelector('button[type="submit"]');

  const fields = {
    name: {
      input: form.elements.name,
      errorEl: document.getElementById('name-error'),
      validate: (value) =>
        value.length >= 2 && value.length <= 80
          ? ''
          : 'Merci d\'indiquer un nom entre 2 et 80 caractères.',
    },
    email: {
      input: form.elements.email,
      errorEl: document.getElementById('email-error'),
      validate: (value) =>
        isValidEmail(value) ? '' : 'Merci d\'indiquer une adresse email valide.',
    },
    message: {
      input: form.elements.message,
      errorEl: document.getElementById('message-error'),
      validate: (value) =>
        value.length >= 10 && value.length <= 2000
          ? ''
          : 'Le message doit contenir entre 10 et 2000 caractères.',
    },
  };

  // Validation "live" au blur, pour un retour immédiat et accessible
  Object.values(fields).forEach(({ input }) => {
    input.addEventListener('blur', () => {
      input.dataset.touched = 'true';
      validateField(input.name);
    });
  });

  function validateField(name) {
    const field = fields[name];
    const rawValue = field.input.value.trim();
    const message = field.validate(rawValue);
    field.errorEl.textContent = message;
    field.input.setAttribute('aria-invalid', message ? 'true' : 'false');
    return message === '';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    statusEl.textContent = '';

    // Honeypot : si ce champ caché est rempli, c'est très probablement un bot.
    // On simule un succès sans rien envoyer, sans indiquer au bot son échec.
    const honeypot = form.elements.website;
    if (honeypot && honeypot.value !== '') {
      form.reset();
      statusEl.textContent = 'Merci, votre message a bien été envoyé.';
      return;
    }

    const allValid = Object.keys(fields)
      .map((name) => {
        fields[name].input.dataset.touched = 'true';
        return validateField(name);
      })
      .every(Boolean);

    if (!allValid) {
      statusEl.textContent = 'Merci de corriger les champs en erreur.';
      fields.name.input.form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }

    // Nettoyage défensif : on retire tout caractère '<' ou '>' pour éviter
    // qu'une valeur ne puisse être interprétée comme balise HTML si elle
    // est un jour réaffichée (ex: email de notification, back-office).
    const payload = {
      name: sanitize(fields.name.input.value.trim()),
      email: sanitize(fields.email.input.value.trim()),
      message: sanitize(fields.message.input.value.trim()),
    };

    submitBtn.disabled = true;
    statusEl.textContent = 'Envoi en cours…';

    try {
      // À brancher sur un vrai backend. Le endpoint devra :
      // - revalider les données côté serveur (ne jamais faire confiance au client)
      // - exiger un jeton CSRF (cookie double-submit ou header dédié)
      // - appliquer un rate-limiting par IP
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Réponse serveur invalide');

      form.reset();
      statusEl.textContent = 'Merci, votre message a bien été envoyé.';
    } catch (error) {
      statusEl.textContent =
        'Une erreur est survenue. Merci de réessayer ou de me contacter directement par email.';
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function isValidEmail(value) {
  // Regex volontairement simple : la validation forte reste côté serveur.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function sanitize(value) {
  return value.replace(/[<>]/g, '');
}
