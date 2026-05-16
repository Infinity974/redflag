/**
 * RedFlag — Effets visuels épiques pour les moments forts du jeu
 *
 * Architecture :
 *   - showEpicEffect(type, options) : grosse popup centrale style "fighting game"
 *   - Types disponibles :
 *       'critical' / 'double_critical' / 'ghosted' / 'shielded' /
 *       'date_imminent' / 'victory' / 'nope' / 'combo_steal' / 'combo_request'
 *
 * Modes :
 *   - Normal : avec particules, glow, shake, blur
 *   - Fluide (low-end-mode) : version simplifiée sans particules ni filtres lourds
 *
 * Le toast classique (showToast) reste utilisé pour les événements mineurs.
 */

const EPIC_EFFECT_DURATIONS = {
  critical: 1400,
  double_critical: 1800,
  ghosted: 2200,
  shielded: 1600,
  date_imminent: 2000,
  victory: 4000,
  nope: 1600,
  combo_steal: 1500,
  combo_request: 1500,
};

/**
 * Détecte si on est en mode fluide (low-end devices).
 */
function isLowEndMode() {
  return document.body.classList.contains('low-end-mode');
}

/**
 * Affiche un effet épique au centre de l'écran.
 *
 * @param {string} type - Le type d'effet (voir EPIC_EFFECT_DURATIONS)
 * @param {object} options
 *   - title : texte principal (gros)
 *   - subtitle : texte secondaire (petit)
 *   - icon : emoji affiché en haut (ex: '💥', '👻', '🛡️')
 *   - value : valeur numérique optionnelle (ex: '+50%')
 *   - color : couleur custom (sinon dérivée du type)
 */
export function showEpicEffect(type, options = {}) {
  const duration = EPIC_EFFECT_DURATIONS[type] || 1500;
  const lowEnd = isLowEndMode();

  // Conteneur principal
  const overlay = document.createElement('div');
  overlay.className = `epic-effect epic-effect--${type}`;
  if (lowEnd) overlay.classList.add('epic-effect--simple');

  // Glow background
  if (!lowEnd) {
    const glow = document.createElement('div');
    glow.className = 'epic-effect__glow';
    overlay.appendChild(glow);
  }

  // Contenu central
  const content = document.createElement('div');
  content.className = 'epic-effect__content';

  if (options.icon) {
    const icon = document.createElement('div');
    icon.className = 'epic-effect__icon';
    icon.textContent = options.icon;
    content.appendChild(icon);
  }

  if (options.title) {
    const title = document.createElement('div');
    title.className = 'epic-effect__title';
    title.textContent = options.title;
    content.appendChild(title);
  }

  if (options.value) {
    const value = document.createElement('div');
    value.className = 'epic-effect__value';
    value.textContent = options.value;
    content.appendChild(value);
  }

  if (options.subtitle) {
    const subtitle = document.createElement('div');
    subtitle.className = 'epic-effect__subtitle';
    subtitle.textContent = options.subtitle;
    content.appendChild(subtitle);
  }

  overlay.appendChild(content);

  // Particules (mode normal uniquement)
  if (!lowEnd) {
    const particles = document.createElement('div');
    particles.className = 'epic-effect__particles';
    const particleCount = type === 'victory' ? 24 : 12;
    for (let i = 0; i < particleCount; i++) {
      const p = document.createElement('span');
      p.className = 'epic-effect__particle';
      p.style.setProperty('--p-angle', `${(360 / particleCount) * i}deg`);
      p.style.setProperty('--p-delay', `${i * 30}ms`);
      particles.appendChild(p);
    }
    overlay.appendChild(particles);
  }

  document.body.appendChild(overlay);

  // Auto-remove
  setTimeout(() => {
    overlay.classList.add('epic-effect--exit');
    setTimeout(() => overlay.remove(), 400);
  }, duration);

  return overlay;
}

/**
 * Effet "carte qui s'envole" : anime une carte de sa position d'origine
 * vers une cible (défausse, profil joueur, centre).
 *
 * @param {HTMLElement} sourceEl - La carte d'origine (clone visuel sera créé)
 * @param {object} target - { x, y } coords ou { selector } pour resolve
 * @param {object} options
 *   - duration : durée en ms (default 700)
 *   - rotate : rotation finale en deg (default 360)
 *   - onComplete : callback quand l'anim finit
 */
export function flyCardTo(sourceEl, target, options = {}) {
  if (!sourceEl) return Promise.resolve();
  const duration = options.duration || (isLowEndMode() ? 350 : 700);

  // Coords de départ
  const sourceRect = sourceEl.getBoundingClientRect();

  // Resolve target coords
  let targetX, targetY;
  if (target.selector) {
    const el = document.querySelector(target.selector);
    if (el) {
      const r = el.getBoundingClientRect();
      targetX = r.left + r.width / 2;
      targetY = r.top + r.height / 2;
    } else {
      targetX = window.innerWidth / 2;
      targetY = window.innerHeight / 2;
    }
  } else if (target.x !== undefined) {
    targetX = target.x;
    targetY = target.y;
  } else {
    targetX = window.innerWidth / 2;
    targetY = window.innerHeight / 2;
  }

  // Clone la carte
  const clone = sourceEl.cloneNode(true);
  clone.classList.add('flying-card');
  clone.style.position = 'fixed';
  clone.style.left = `${sourceRect.left}px`;
  clone.style.top = `${sourceRect.top}px`;
  clone.style.width = `${sourceRect.width}px`;
  clone.style.height = `${sourceRect.height}px`;
  clone.style.margin = '0';
  clone.style.pointerEvents = 'none';
  clone.style.zIndex = '9999';
  clone.style.transition = `transform ${duration}ms cubic-bezier(0.45, 0.05, 0.55, 0.95), opacity ${duration}ms ease-out`;
  document.body.appendChild(clone);

  // Trigger l'animation au prochain frame
  requestAnimationFrame(() => {
    const dx = targetX - sourceRect.left - sourceRect.width / 2;
    const dy = targetY - sourceRect.top - sourceRect.height / 2;
    const rotate = options.rotate !== undefined ? options.rotate : (isLowEndMode() ? 0 : 360);
    const scale = options.targetScale !== undefined ? options.targetScale : 0.5;
    clone.style.transform = `translate(${dx}px, ${dy}px) rotate(${rotate}deg) scale(${scale})`;
    clone.style.opacity = '0';
  });

  return new Promise((resolve) => {
    setTimeout(() => {
      clone.remove();
      if (options.onComplete) options.onComplete();
      resolve();
    }, duration);
  });
}

/**
 * Effet d'impact sur un joueur : flash de couleur sur son portrait.
 *
 * @param {string} playerUid - UID du joueur ciblé
 * @param {string} type - 'green' | 'red' | 'shield' | 'steal'
 */
export function impactPlayer(playerUid, type) {
  // Cherche le portrait du joueur (opponent ou self)
  const selectors = [
    `.opponent[data-uid="${playerUid}"]`,
    `.player-board[data-uid="${playerUid}"]`,
    `[data-player-uid="${playerUid}"]`,
  ];
  let el = null;
  for (const s of selectors) {
    el = document.querySelector(s);
    if (el) break;
  }
  if (!el) return;

  el.classList.add(`impact-${type}`);
  setTimeout(() => el.classList.remove(`impact-${type}`), 800);
}

/**
 * Helper : envoie une carte vers la défausse.
 */
export function sendToDiscard(sourceEl, options = {}) {
  return flyCardTo(sourceEl, { selector: '.discard-pile, .deck-area' }, {
    duration: 600,
    rotate: 540,
    targetScale: 0.4,
    ...options,
  });
}

/**
 * Helper : envoie une carte vers un joueur.
 */
export function sendToPlayer(sourceEl, playerUid, options = {}) {
  return flyCardTo(sourceEl,
    { selector: `[data-uid="${playerUid}"], [data-player-uid="${playerUid}"]` },
    {
      duration: 700,
      rotate: 0,
      targetScale: 0.3,
      ...options,
    }
  );
}

/**
 * Effet de transfert d'objet entre 2 joueurs (vol Red Flag, swap, etc.)
 *
 * @param {string} fromUid - joueur d'origine
 * @param {string} toUid - joueur destination
 * @param {string} icon - emoji représentant ce qui est transféré (ex: '🚩', '💚')
 */
export function transferBetweenPlayers(fromUid, toUid, icon) {
  const fromEl = document.querySelector(`[data-uid="${fromUid}"], [data-player-uid="${fromUid}"]`);
  const toEl = document.querySelector(`[data-uid="${toUid}"], [data-player-uid="${toUid}"]`);
  if (!fromEl || !toEl) return;

  const fromR = fromEl.getBoundingClientRect();
  const toR = toEl.getBoundingClientRect();

  const orb = document.createElement('div');
  orb.className = 'transfer-orb';
  orb.textContent = icon || '✨';
  orb.style.position = 'fixed';
  orb.style.left = `${fromR.left + fromR.width / 2}px`;
  orb.style.top = `${fromR.top + fromR.height / 2}px`;
  orb.style.transition = isLowEndMode()
    ? 'transform 350ms ease-in-out, opacity 350ms'
    : 'transform 700ms cubic-bezier(0.5, -0.3, 0.5, 1.3), opacity 700ms';
  document.body.appendChild(orb);

  requestAnimationFrame(() => {
    const dx = (toR.left + toR.width / 2) - (fromR.left + fromR.width / 2);
    const dy = (toR.top + toR.height / 2) - (fromR.top + fromR.height / 2);
    orb.style.transform = `translate(${dx}px, ${dy}px) scale(1.4)`;
  });

  setTimeout(() => {
    orb.style.opacity = '0';
    orb.style.transform += ' scale(0.5)';
    setTimeout(() => orb.remove(), 300);
  }, isLowEndMode() ? 300 : 600);
}

/**
 * Shake léger de l'écran (pour Red Flag impact, élimination, etc.)
 */
export function shakeScreen(intensity = 'medium') {
  if (isLowEndMode()) return; // pas de shake en mode fluide
  const game = document.getElementById('gameScreen') || document.body;
  game.classList.add(`screen-shake-${intensity}`);
  setTimeout(() => game.classList.remove(`screen-shake-${intensity}`), 500);
}

/**
 * Wrapper unique pour orchestrer les effets d'une carte jouée.
 * Appelé par game-controller après une action.
 *
 * @param {object} action - { type, sourceUid, targetUid, cardCode, isCritical, isDoubleCritical, value }
 */
export function playCardEffects(action) {
  const { type, sourceUid, targetUid, cardCode, isCritical, isDoubleCritical, value } = action;

  switch (type) {
    case 'green_flag':
      impactPlayer(targetUid, 'green');
      if (isDoubleCritical) {
        showEpicEffect('double_critical', {
          icon: '💚✨',
          title: 'DOUBLE CRITIQUE',
          value: `+${value}%`,
          subtitle: 'Le Crush adore !',
        });
      } else if (isCritical) {
        showEpicEffect('critical', {
          icon: '💚',
          title: 'CRITIQUE',
          value: `+${value}%`,
        });
      }
      break;

    case 'red_flag':
      impactPlayer(targetUid, 'red');
      shakeScreen('light');
      if (isDoubleCritical) {
        showEpicEffect('double_critical', {
          icon: '💔💥',
          title: 'DOUBLE CRITIQUE',
          value: `${value}%`,
          subtitle: 'Le Crush déteste !',
        });
      } else if (isCritical) {
        showEpicEffect('critical', {
          icon: '💔',
          title: 'CRITIQUE',
          value: `${value}%`,
        });
      }
      break;

    case 'crush_combo':
      showEpicEffect('combo_steal', {
        icon: '💕',
        title: action.level === 3 ? 'COMBO x3' : 'COMBO x2',
        subtitle: action.level === 3 ? 'Carte précise volée !' : 'Carte volée !',
      });
      if (sourceUid && targetUid) {
        setTimeout(() => transferBetweenPlayers(targetUid, sourceUid, '💕'), 400);
      }
      break;

    case 'nope':
      shakeScreen('medium');
      showEpicEffect('nope', {
        icon: '🚫',
        title: 'NOPE !',
        subtitle: 'Action annulée',
      });
      break;

    case 'shielded':
      showEpicEffect('shielded', {
        icon: '🛡️',
        title: 'SAUVÉ !',
        subtitle: 'Bouclier activé',
      });
      impactPlayer(sourceUid, 'shield');
      break;

    case 'ghosted':
      shakeScreen('strong');
      showEpicEffect('ghosted', {
        icon: '👻',
        title: 'GHOSTÉ',
        subtitle: action.nickname ? `${action.nickname} est éliminé` : 'Joueur éliminé',
      });
      break;

    case 'date_imminent':
      showEpicEffect('date_imminent', {
        icon: '💘',
        title: 'DATE IMMINENT',
        subtitle: 'Survis 1 tour de table pour gagner !',
      });
      break;

    case 'victory':
      showEpicEffect('victory', {
        icon: '🏆',
        title: 'VICTOIRE',
        subtitle: action.nickname ? `${action.nickname} décroche le date !` : 'Le Crush a craqué !',
      });
      break;

    case 'steal':
      transferBetweenPlayers(targetUid, sourceUid, action.icon || '🚩');
      break;
  }
}
