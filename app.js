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
 * Formulaire de contact : email en 2 temps, validation, anti-spam, envoi
 * ---------------------------------------------------------------------- */
const CONTACT_SENT_KEY = 'nf-contact-sent';
const DISPOSABLE_EMAIL_DOMAINS = ['yopmail.com', 'mailinator.com', 'tempmail.com'];

function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  const alreadySentEl = document.getElementById('contactAlreadySent');

  // Un seul envoi autorisé par navigateur : si déjà envoyé, on masque le
  // formulaire et on affiche le message de confirmation à la place. C'est un
  // verrou côté client (contournable en vidant le stockage du site) : il
  // dissuade les envois répétés depuis un même appareil, il ne remplace pas
  // un rate-limiting serveur.
  if (hasAlreadySubmitted()) {
    form.hidden = true;
    if (alreadySentEl) alreadySentEl.hidden = false;
    return;
  }

  const statusEl = document.getElementById('formStatus');
  const submitBtn = form.querySelector('button[type="submit"]');
  const honeypot = form.elements.website;

  const step1 = document.getElementById('contactStep1');
  const step2 = document.getElementById('contactStep2');
  const emailInput = form.elements.email;
  const emailError = document.getElementById('email-error');
  const emailContinueBtn = document.getElementById('emailContinueBtn');

  function validateEmailStep() {
    const value = emailInput.value.trim();
    emailInput.dataset.touched = 'true';
    emailError.textContent = '';
    emailInput.setAttribute('aria-invalid', 'false');

    if (!isValidEmail(value)) {
      emailError.textContent = 'Merci d\'indiquer une adresse email valide.';
      emailInput.setAttribute('aria-invalid', 'true');
      return false;
    }
    if (isDisposableEmail(value)) {
      emailError.textContent = 'Les adresses email jetables ne sont pas acceptées.';
      emailInput.setAttribute('aria-invalid', 'true');
      return false;
    }
    return true;
  }

  emailInput.addEventListener('blur', validateEmailStep);

  emailContinueBtn.addEventListener('click', () => {
    // Honeypot rempli -> bot présumé : blocage silencieux, aucune erreur affichée.
    if (honeypot && honeypot.value !== '') return;

    if (!validateEmailStep()) {
      emailInput.focus();
      return;
    }

    step1.hidden = true;
    step2.hidden = false;
    const firstField = step2.querySelector('input, textarea');
    if (firstField) firstField.focus();
  });

  const fields = {
    name: {
      input: form.elements.name,
      errorEl: document.getElementById('name-error'),
      validate: (value) =>
        value.length >= 2 && value.length <= 80
          ? ''
          : 'Merci d\'indiquer un nom entre 2 et 80 caractères.',
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

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    statusEl.textContent = '';

    // Re-vérification défensive : un bot pourrait manipuler le DOM pour
    // afficher l'étape 2 sans passer par le bouton "Continuer".
    if (honeypot && honeypot.value !== '') return;
    if (!validateEmailStep()) {
      step1.hidden = false;
      step2.hidden = true;
      emailInput.focus();
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
      step2.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }

    // Nettoyage défensif : on retire tout caractère '<' ou '>' pour éviter
    // qu'une valeur ne puisse être interprétée comme balise HTML si elle
    // est un jour réaffichée (ex: dans le client email ouvert ci-dessous).
    const payload = {
      name: sanitize(fields.name.input.value.trim()),
      email: sanitize(emailInput.value.trim()),
      message: sanitize(fields.message.input.value.trim()),
    };

    // Pas de backend sur ce site statique : on ouvre le client email du
    // visiteur avec le message pré-rempli, plutôt qu'un faux appel réseau.
    // Limite connue : on ne peut pas confirmer que le visiteur a bien cliqué
    // sur "Envoyer" dans son client — le statut "un seul envoi" reflète donc
    // une intention d'envoi, pas une confirmation de livraison.
    const subject = `Message depuis le site — ${payload.name}`;
    const body = `Nom : ${payload.name}\nEmail : ${payload.email}\n\n${payload.message}`;
    const mailtoUrl =
      'mailto:nicolas.fournel@icloud.com' +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;

    submitBtn.disabled = true;
    statusEl.textContent =
      'Ton client email va s\'ouvrir avec le message pré-rempli : il ne reste plus qu\'à cliquer sur Envoyer.';

    window.location.href = mailtoUrl;
    markAsSubmitted();
    form.reset();
  });
}

function hasAlreadySubmitted() {
  try {
    return localStorage.getItem(CONTACT_SENT_KEY) === '1';
  } catch (error) {
    return false; // stockage indisponible (navigation privée...) : on ne bloque pas
  }
}

function markAsSubmitted() {
  try {
    localStorage.setItem(CONTACT_SENT_KEY, '1');
  } catch (error) {
    // stockage indisponible : le blocage best-effort ne survivra pas au rechargement
  }
}

function isValidEmail(value) {
  // Regex stricte : partie locale restreinte aux caractères RFC 5322 usuels,
  // domaine avec au moins un point et un TLD de 2 lettres minimum.
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/.test(value);
}

function isDisposableEmail(value) {
  const at = value.lastIndexOf('@');
  const domain = at === -1 ? '' : value.slice(at + 1).toLowerCase();
  return DISPOSABLE_EMAIL_DOMAINS.includes(domain);
}

function sanitize(value) {
  return value.replace(/[<>]/g, '');
}
