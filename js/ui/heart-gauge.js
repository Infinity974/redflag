/**
 * RedFlag — Heart Gauge SVG (avec gestion -100% à +100%)
 *
 * Améliorations v2 :
 *   - Transition fluide du remplissage (animation CSS du fillHeight via custom property)
 *   - Pulsation cardiaque (battement) qui s'accélère selon la zone (danger/imminent)
 *   - Glow doré à 100%, glow rouge à -100%
 *   - Particules vertes qui jaillissent en cas de gain (animateGaugeChange)
 *   - Onde rouge qui se diffuse en cas de perte
 *   - Mode fluide (low-end) : transition simple, pas de particules ni glow
 *
 * - 0 à 100 : remplissage rose normal du bas vers le haut
 * - 0 à -100 : remplissage rouge qui descend du haut vers le bas
 * - 100 : DATE IMMINENT, doré
 * - -100 : DANGER, glow rouge
 */

export function renderHeartGauge(percent, options = {}) {
  const { isGold = false, isBig = false, isNegative = false, playerUid = null } = options;
  const isDanger = (percent || 0) <= -100;
  const isImminent = (percent || 0) >= 100;

  // Clamp pour affichage
  const value = Math.max(-100, Math.min(100, percent || 0));
  const absValue = Math.abs(value);
  const isNeg = value < 0;

  // Zones d'intensité pour la pulsation
  // - normale : entre -50 et +50 → pulse lent (60bpm-ish)
  // - élevée : > 50 ou < -50 → pulse moyen
  // - critique : ≥ 90 ou ≤ -90 → pulse rapide
  let intensityClass = '';
  if (absValue >= 90) intensityClass = ' gauge-heart--critical-pulse';
  else if (absValue >= 50) intensityClass = ' gauge-heart--high-pulse';
  else intensityClass = ' gauge-heart--normal-pulse';

  let cls = `gauge-heart${isBig ? ' gauge-heart--big' : ''}${intensityClass}`;
  if (isImminent || isGold) cls += ' gauge-heart--gold gauge-heart--imminent';
  if (isNeg || isNegative) cls += ' gauge-heart--negative';
  if (isDanger) cls += ' gauge-heart--danger';

  // Identifiant CSS pour la couleur (les vraies valeurs sont dans le CSS via variables)
  let mode = 'positive';
  if (isImminent || isGold) mode = 'gold';
  else if (isNeg) mode = 'negative';

  // Pour la jauge positive : remplissage du bas vers le haut
  // Pour la jauge négative : remplissage du haut vers le bas
  const fillHeight = (absValue / 100) * 32;
  const fillY = isNeg ? 0 : (32 - fillHeight);

  // Identifiant unique pour les éléments SVG (clip + gradient).
  let uniqueId;
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    uniqueId = `hg_${crypto.randomUUID().slice(0, 8)}`;
  } else {
    uniqueId = `hg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }
  const heartPath = "M18,30 C12,26 2,18 2,10 C2,4 7,2 11,2 C15,2 17,4 18,7 C19,4 21,2 25,2 C29,2 34,4 34,10 C34,18 24,26 18,30 Z";

  // Affichage du nombre : signe inclus
  const displayValue = value > 0 ? `+${Math.round(value)}%` : `${Math.round(value)}%`;

  // Optional : data-player-uid pour pouvoir cibler une jauge spécifique
  const uidAttr = playerUid ? ` data-player-uid="${playerUid}"` : '';

  return `
    <div class="${cls}" data-gauge-mode="${mode}" data-gauge-value="${value}"${uidAttr} style="--gauge-fill-pct: ${absValue};">
      <svg viewBox="0 0 36 32" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id="${uniqueId}" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" class="gauge-stop-light"/>
            <stop offset="100%" class="gauge-stop-dark"/>
          </linearGradient>
          <clipPath id="hc_${uniqueId}">
            <path d="${heartPath}"/>
          </clipPath>
        </defs>
        <path class="gauge-heart__bg" d="${heartPath}" />
        <rect
          class="gauge-heart__fill"
          x="0"
          y="${fillY}"
          width="36"
          height="${fillHeight}"
          fill="url(#${uniqueId})"
          clip-path="url(#hc_${uniqueId})"
        />
      </svg>
      <span class="gauge-heart__value">${displayValue}</span>
      <div class="gauge-heart__shockwave"></div>
    </div>
  `;
}

/**
 * Anime un changement de jauge sur l'écran avec effets visuels.
 *
 * @param {string} playerUid - UID du joueur dont la jauge a changé
 * @param {number} delta - variation (+ pour gain, - pour perte)
 * @param {number} newValue - nouvelle valeur de jauge
 */
export function animateGaugeChange(playerUid, delta, newValue) {
  const lowEnd = document.body.classList.contains('low-end-mode');

  // Cherche la jauge du joueur
  const gauges = document.querySelectorAll(`.gauge-heart[data-player-uid="${playerUid}"]`);
  if (gauges.length === 0) return;

  for (const gauge of gauges) {
    // Animation de battement renforcé sur l'événement
    gauge.classList.remove('gauge-heart--reacting');
    void gauge.offsetWidth; // reflow pour relancer l'anim
    gauge.classList.add('gauge-heart--reacting');
    setTimeout(() => gauge.classList.remove('gauge-heart--reacting'), 1000);

    // Onde de choc rouge si perte importante
    if (delta < 0 && Math.abs(delta) >= 10) {
      const shock = gauge.querySelector('.gauge-heart__shockwave');
      if (shock) {
        shock.classList.remove('gauge-heart__shockwave--active', 'gauge-heart__shockwave--red', 'gauge-heart__shockwave--green');
        void shock.offsetWidth;
        shock.classList.add('gauge-heart__shockwave--active', 'gauge-heart__shockwave--red');
        setTimeout(() => shock.classList.remove('gauge-heart__shockwave--active', 'gauge-heart__shockwave--red'), 700);
      }
    }
    // Onde verte si gain important
    else if (delta > 0 && delta >= 10) {
      const shock = gauge.querySelector('.gauge-heart__shockwave');
      if (shock) {
        shock.classList.remove('gauge-heart__shockwave--active', 'gauge-heart__shockwave--red', 'gauge-heart__shockwave--green');
        void shock.offsetWidth;
        shock.classList.add('gauge-heart__shockwave--active', 'gauge-heart__shockwave--green');
        setTimeout(() => shock.classList.remove('gauge-heart__shockwave--active', 'gauge-heart__shockwave--green'), 700);
      }
    }

    // Particules vertes (gain) — pas en mode fluide
    if (!lowEnd && delta > 0) {
      spawnParticles(gauge, 'green', Math.min(8, Math.ceil(delta / 5)));
    }
    // Particules rouges (perte)
    else if (!lowEnd && delta < 0) {
      spawnParticles(gauge, 'red', Math.min(8, Math.ceil(Math.abs(delta) / 5)));
    }

    // Affichage du delta numérique
    showDeltaNumber(gauge, delta);
  }
}

/**
 * Crée des particules qui jaillissent du cœur.
 */
function spawnParticles(gauge, color, count) {
  const rect = gauge.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = `gauge-particle gauge-particle--${color}`;
    p.style.position = 'fixed';
    p.style.left = `${cx}px`;
    p.style.top = `${cy}px`;
    // Direction aléatoire
    const angle = (Math.PI * 2 * i / count) + Math.random() * 0.4;
    const distance = 30 + Math.random() * 40;
    p.style.setProperty('--p-tx', `${Math.cos(angle) * distance}px`);
    p.style.setProperty('--p-ty', `${Math.sin(angle) * distance - 20}px`); // un peu vers le haut
    document.body.appendChild(p);

    setTimeout(() => p.remove(), 900);
  }
}

/**
 * Affiche un nombre qui s'élève au-dessus de la jauge.
 */
function showDeltaNumber(gauge, delta) {
  const rect = gauge.getBoundingClientRect();
  const num = document.createElement('span');
  num.className = `gauge-delta-number gauge-delta-number--${delta >= 0 ? 'positive' : 'negative'}`;
  num.textContent = `${delta > 0 ? '+' : ''}${Math.round(delta)}%`;
  num.style.position = 'fixed';
  num.style.left = `${rect.left + rect.width / 2}px`;
  num.style.top = `${rect.top}px`;
  document.body.appendChild(num);

  setTimeout(() => num.remove(), 1200);
}
