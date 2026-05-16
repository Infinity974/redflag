/**
 * RedFlag — Dialog Manager (refonte)
 *
 * - Popup ciblage avec carte miniature en haut à gauche
 * - Couleur lumineuse adaptée au type de carte
 * - Badge "Moi" sur le joueur courant
 * - Replacement Ghosté avec slider visuel sur la pioche
 */

import { renderCard } from './card-renderer.js';
import { getCard } from '../data/cards-catalog.js';
import { CARD_TYPES } from '../config/game-constants.js';
import { renderHeartGauge } from './heart-gauge.js';

let dialogContainer = null;

function getContainer() {
  if (!dialogContainer) {
    dialogContainer = document.createElement('div');
    dialogContainer.id = 'dialogContainer';
    dialogContainer.className = 'dialog-container';
    document.body.appendChild(dialogContainer);
  }
  return dialogContainer;
}

function getCardTypeColor(card) {
  if (!card) return 'pink';
  switch (card.type) {
    case CARD_TYPES.GREEN_FLAG: return 'green';
    case CARD_TYPES.RED_FLAG: return 'red';
    case CARD_TYPES.CONDITIONAL: return 'purple';
    case CARD_TYPES.ACTION: return 'cyan';
    case CARD_TYPES.SHIELD: return 'gold';
    case CARD_TYPES.DRAW: return 'gold';
    case CARD_TYPES.CRUSH: return 'pink';
    default: return 'pink';
  }
}

/**
 * Popup de ciblage améliorée :
 * - Carte miniature en haut à gauche
 * - Couleur lumineuse selon type
 * - Badge "MOI" sur le joueur courant
 */
export function showTargetPicker(state, currentPlayerUid, options = {}) {
  return new Promise((resolve) => {
    const container = getContainer();
    const card = options.cardCode ? getCard(options.cardCode) : null;
    const themeColor = getCardTypeColor(card);

    const validTargets = Object.values(state.players)
      .filter(p => !p.isGhosted)
      .filter(p => options.allowSelf ? true : p.uid !== currentPlayerUid)
      .sort((a, b) => a.turnOrder - b.turnOrder);

    container.innerHTML = `
      <div class="dialog dialog--target-picker dialog--theme-${themeColor} animate-slide-up">
        <div class="dialog__top-bar">
          ${card ? `<div class="dialog__card-preview">${renderCard(card.code, { inHand: false })}</div>` : '<div></div>'}
          <div class="dialog__header">
            <h3>${options.title || 'Choisis une cible'}</h3>
            ${options.subtitle ? `<p>${options.subtitle}</p>` : ''}
          </div>
        </div>

        <div class="dialog__targets">
          ${validTargets.map(p => {
            const isMe = p.uid === currentPlayerUid;
            return `
              <button class="target-btn ${isMe ? 'target-btn--me' : ''}" data-uid="${p.uid}">
                ${isMe ? '<div class="target-btn__me-badge">MOI</div>' : ''}
                <div class="target-btn__avatar" style="background: ${p.avatarColor};">
                  ${p.avatarLetter}
                </div>
                <div class="target-btn__info">
                  <div class="target-btn__name">${escape(p.nickname)}</div>
                  <div class="target-btn__gauge-wrap">
                    ${renderHeartGauge(p.profile.seductionGauge, { isNegative: p.profile.seductionGauge < 0 })}
                  </div>
                </div>
              </button>
            `;
          }).join('')}
        </div>

        <button class="dialog__cancel btn btn--ghost btn--small">Annuler</button>
      </div>
    `;

    container.classList.add('dialog-container--open');

    container.querySelectorAll('.target-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const uid = btn.dataset.uid;
        closeDialog();
        resolve(uid);
      });
    });

    container.querySelector('.dialog__cancel').addEventListener('click', () => {
      closeDialog();
      resolve(null);
    });
  });
}

/**
 * Popup pour demander une carte précise (combo Crush x3).
 */
/**
 * Picker visuel pour le combo Crush x2 :
 * affiche le dos des cartes de la cible et permet de cliquer dessus.
 * Retourne l'index choisi (ou null si annulé).
 */
export function showStealHandPicker(target) {
  return new Promise((resolve) => {
    const container = getContainer();
    const handLength = target.hand.length;

    const cardsHtml = Array.from({ length: handLength }, (_, i) => `
      <button class="steal-card-back card-back" data-index="${i}" title="Carte ${i + 1}">
        <span class="steal-card-back__num">${i + 1}</span>
      </button>
    `).join('');

    container.innerHTML = `
      <div class="dialog dialog--steal animate-slide-up">
        <div class="dialog__header">
          <h3>👀 Vol au hasard chez ${escape(target.nickname)}</h3>
          <p>Clique sur une carte (les dos sont mélangés)</p>
        </div>
        <div class="steal-hand">
          ${handLength === 0 ? '<p class="empty-hand">Main vide !</p>' : cardsHtml}
        </div>
        <button class="dialog__cancel btn btn--ghost btn--small">Annuler</button>
      </div>
    `;

    container.classList.add('dialog-container--open');

    container.querySelectorAll('.steal-card-back').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        closeDialog();
        resolve(idx);
      });
    });

    container.querySelector('.dialog__cancel').addEventListener('click', () => {
      closeDialog();
      resolve(null);
    });
  });
}

export function showCardRequestPicker() {
  return new Promise((resolve) => {
    const container = getContainer();

    // Liste de cartes "demandables" (cartes courantes que l'autre joueur peut avoir)
    const candidates = [
      { code: 'BG-01', label: 'Bouclier Gaslighting', emoji: '🛡' },
      { code: 'AC-01', label: 'Glow Up (purge)', emoji: '✨' },
      { code: 'AC-04', label: 'Gossip (vol)', emoji: '🗣️' },
      { code: 'AC-07', label: "L'Ex Toxique (stun)", emoji: '💔' },
      { code: 'AC-10', label: 'Stalker (vision)', emoji: '👁️' },
      { code: 'AC-14', label: 'Catfish (chaos)', emoji: '🎲' },
    ];

    container.innerHTML = `
      <div class="dialog dialog--request animate-slide-up">
        <div class="dialog__header">
          <h3>🔍 Quelle carte demandes-tu ?</h3>
          <p>Si l'adversaire l'a, il te la donne. Sinon, raté.</p>
        </div>
        <div class="request-options">
          ${candidates.map(c => `
            <button class="request-btn" data-code="${c.code}">
              <span class="request-btn__emoji">${c.emoji}</span>
              <span class="request-btn__label">${c.label}</span>
            </button>
          `).join('')}
        </div>
        <button class="dialog__cancel btn btn--ghost btn--small">Annuler</button>
      </div>
    `;

    container.classList.add('dialog-container--open');

    container.querySelectorAll('.request-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const code = btn.dataset.code;
        closeDialog();
        resolve(code);
      });
    });
    container.querySelector('.dialog__cancel').addEventListener('click', () => {
      closeDialog();
      resolve(null);
    });
  });
}

/**
 * Le moment dramatique : Tu pioches une carte Ghosté.
 */
export function showGhostedReveal(state, currentPlayerUid, hasShield) {
  return new Promise((resolve) => {
    const container = getContainer();

    container.innerHTML = `
      <div class="dialog dialog--ghosted animate-fade-in">
        <div class="ghosted-reveal animate-glitch">
          <div class="ghosted-reveal__sms">
            <div class="ghosted-reveal__from">📱 Notification</div>
            <div class="ghosted-reveal__title">TU ES GHOSTÉ</div>
            <div class="ghosted-reveal__message">Le Crush vient de te ghoster...</div>
          </div>
        </div>
        <div class="ghosted-reveal__actions">
          ${hasShield ? `
            <button class="btn btn--gold btn--large" id="useShieldBtn">
              🛡 Utiliser ton bouclier
            </button>
          ` : `
            <p class="ghosted-no-shield">Tu n'as pas de bouclier... 💔</p>
          `}
          <button class="btn btn--ghost" id="acceptGhostedBtn">
            Accepter le sort
          </button>
        </div>
      </div>
    `;

    container.classList.add('dialog-container--open', 'dialog-container--dramatic');

    if (hasShield) {
      container.querySelector('#useShieldBtn').addEventListener('click', () => {
        closeDialog();
        resolve({ useShield: true });
      });
    }

    container.querySelector('#acceptGhostedBtn').addEventListener('click', () => {
      closeDialog();
      resolve({ useShield: false });
    });
  });
}

/**
 * Replacement visuel de la Ghosté : slider qui montre la pioche
 * avec une ligne d'insertion qui se déplace.
 */
export function showGhostedReplacement(deckSize) {
  return new Promise((resolve) => {
    const container = getContainer();

    let position = 0; // par défaut au sommet

    const renderDeckPreview = (pos) => {
      const totalSlots = Math.min(deckSize + 1, 12); // visualisation simplifiée
      const insertSlot = Math.round((pos / Math.max(deckSize, 1)) * (totalSlots - 1));
      let html = '';
      for (let i = 0; i < totalSlots; i++) {
        if (i === insertSlot) {
          html += `<div class="deck-slot deck-slot--ghosted">
            <span class="deck-slot__icon">☠️</span>
            <span class="deck-slot__label">ICI</span>
          </div>`;
        } else {
          html += `<div class="deck-slot">
            <span class="deck-slot__icon">♥</span>
          </div>`;
        }
      }
      return html;
    };

    const update = () => {
      container.querySelector('.deck-preview').innerHTML = renderDeckPreview(position);
      const label = container.querySelector('.position-label');
      if (label) {
        let text = '';
        if (position === 0) text = '🔝 Au sommet (prochain joueur la pioche !)';
        else if (position < 4) text = `⬆ Près du sommet (${position} cartes plus loin)`;
        else if (position < deckSize / 2) text = `🌊 Quart supérieur`;
        else if (position < deckSize * 0.75) text = `🌊 Au milieu`;
        else text = `⬇ Au fond (planquée)`;
        label.textContent = text;
      }
    };

    container.innerHTML = `
      <div class="dialog dialog--replacement animate-slide-up">
        <div class="dialog__header">
          <h3>🎯 Replace la Ghosté</h3>
          <p>Choisis stratégiquement où la planquer dans la pioche.</p>
        </div>

        <div class="replacement-tool">
          <div class="deck-preview">${renderDeckPreview(0)}</div>

          <div class="position-controls">
            <button class="position-btn" id="topBtn">⬆ Sommet</button>
            <input
              type="range"
              id="positionSlider"
              min="0"
              max="${deckSize}"
              value="0"
              class="position-slider"
            >
            <button class="position-btn" id="bottomBtn">⬇ Fond</button>
          </div>

          <div class="position-label">🔝 Au sommet (prochain joueur la pioche !)</div>
        </div>

        <button class="btn btn--gold btn--large btn--full" id="confirmBtn">
          Confirmer le replacement
        </button>
      </div>
    `;

    container.classList.add('dialog-container--open');

    const slider = container.querySelector('#positionSlider');
    slider.addEventListener('input', (e) => {
      position = parseInt(e.target.value, 10);
      update();
    });

    container.querySelector('#topBtn').addEventListener('click', () => {
      position = 0;
      slider.value = 0;
      update();
    });

    container.querySelector('#bottomBtn').addEventListener('click', () => {
      position = deckSize;
      slider.value = deckSize;
      update();
    });

    container.querySelector('#confirmBtn').addEventListener('click', () => {
      closeDialog();
      resolve(position);
    });
  });
}

/**
 * Écran de fin de partie.
 */
export function showGameEnd(state, winnerUid, breakupSMSes = []) {
  const container = getContainer();
  const winner = state.players[winnerUid];

  container.innerHTML = `
    <div class="dialog dialog--gameover animate-fade-in">
      <div class="gameover">
        <h1 class="gameover__title">💍 IT'S A MATCH</h1>
        <div class="gameover__winner">
          <div class="gameover__avatar" style="background: ${winner?.avatarColor || '#FF4FA3'};">
            ${winner?.avatarLetter || '?'}
          </div>
          <div class="gameover__name">${escape(winner?.nickname || 'Mystère')}</div>
          <p class="gameover__crush">a séduit ${escape(state.crush?.profileData?.displayName || 'le Crush')}</p>
        </div>

        ${breakupSMSes.length > 0 ? `
          <div class="gameover__breakups">
            <h3>SMS reçus par les autres :</h3>
            ${breakupSMSes.map(sms => `
              <div class="breakup-sms">
                <div class="breakup-sms__from">De : Le Crush</div>
                <div class="breakup-sms__to">À : ${escape(sms.nickname)}</div>
                <div class="breakup-sms__body">${escape(sms.message)}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div class="gameover__actions">
          <button class="btn btn--primary btn--large" id="gameoverReplayBtn">
            🔄 Rejouer
          </button>
          <button class="btn btn--secondary btn--large" onclick="window.location.hash='#/home'">
            🏠 Accueil
          </button>
        </div>
      </div>
    </div>
  `;

  container.classList.add('dialog-container--open', 'dialog-container--dramatic');
}

/**
 * Toast éphémère.
 */
export function showToast(message, type = 'info', durationMs = 2500) {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast--fade-out');
    setTimeout(() => toast.remove(), 300);
  }, durationMs);
}

function closeDialog() {
  const container = getContainer();
  container.classList.remove('dialog-container--open', 'dialog-container--dramatic');
  container.innerHTML = '';
}

function escape(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ===========================================================================
// DIALOGS EXPLODING KITTENS — Mélanger / Faveur / Changer l'avenir / Divination
// ===========================================================================

/**
 * Affiche le picker pour Mélanger : choisit la 1ère et la dernière carte du deck.
 */
export function showShufflePicker(deckCards, getCardFn) {
  return new Promise((resolve) => {
    const container = getContainer();

    const cardsHtml = deckCards.map((code, idx) => {
      const card = getCardFn(code);
      return `
        <button class="shuffle-card" data-code="${code}" data-idx="${idx}">
          <span class="shuffle-card__emoji">${card?.emoji || '🃏'}</span>
          <span class="shuffle-card__name">${escape(card?.name || code)}</span>
        </button>
      `;
    }).join('');

    container.innerHTML = `
      <div class="dialog dialog--shuffle">
        <div class="dialog__header">
          <h3>🔀 Mélanger</h3>
          <p>Choisis la <strong>carte du sommet</strong> (la prochaine piochée), puis la <strong>carte du fond</strong>. Le reste sera mélangé.</p>
        </div>
        <div class="shuffle-step" id="shuffleStep">Étape 1 : choisis la carte du SOMMET 🔝</div>
        <div class="shuffle-cards">${cardsHtml}</div>
        <button class="dialog__cancel btn btn--ghost btn--small">Annuler</button>
      </div>
    `;

    container.classList.add('dialog-container--open');

    let topCard = null;

    container.querySelectorAll('.shuffle-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const code = btn.dataset.code;
        if (!topCard) {
          topCard = code;
          btn.classList.add('shuffle-card--selected', 'shuffle-card--top');
          btn.disabled = true;
          document.getElementById('shuffleStep').textContent = 'Étape 2 : choisis la carte du FOND 🔚';
        } else {
          const bottomCard = code;
          closeDialog();
          resolve({ topCard, bottomCard });
        }
      });
    });

    container.querySelector('.dialog__cancel').addEventListener('click', () => {
      closeDialog();
      resolve(null);
    });
  });
}

/**
 * Affiche le picker pour Faveur : le destinataire choisit la carte à donner.
 */
export function showFavorDonor(donorPlayer, requesterName, getCardFn) {
  return new Promise((resolve) => {
    const container = getContainer();

    const cardsHtml = donorPlayer.hand.map((code) => {
      const card = getCardFn(code);
      if (!card) return '';
      const typeColor = {
        'green_flag': '#22c55e', 'red_flag': '#ef4444',
        'action': '#3b82f6', 'conditional': '#f59e0b',
        'crush': '#ec4899', 'draw': '#8b5cf6',
        'skip': '#06b6d4', 'nope': '#f97316',
      }[card.type] || '#6b7280';
      return `
        <button class="favor-card" data-code="${code}">
          <div class="favor-card__visual" style="background:${typeColor}">
            <div class="favor-card__emoji">${card.emoji || '🃏'}</div>
            <div class="favor-card__type-label">${card.type || ''}</div>
          </div>
          <div class="favor-card__info">
            <div class="favor-card__name">${escape(card.name || code)}</div>
            ${card.description ? `<div class="favor-card__desc">${escape(card.description)}</div>` : ''}
          </div>
        </button>
      `;
    }).join('');

    container.innerHTML = `
      <div class="dialog dialog--favor">
        <div class="dialog__header">
          <h3>🙏 Faveur — <strong>${escape(requesterName)}</strong> te demande une carte</h3>
          <p class="dialog__subtitle">Tu dois choisir une carte à lui donner.</p>
        </div>
        <div class="favor-cards">${cardsHtml}</div>
      </div>
    `;

    container.classList.add('dialog-container--open');
    container.querySelectorAll('.favor-card').forEach(btn => {
      btn.addEventListener('click', () => { closeDialog(); resolve(btn.dataset.code); });
    });
  });
}

/**
 * Changer l'Avenir : réordonne les 3 prochaines cartes du deck.
 */
export function showAlterFutureReorder(cards, getCardFn) {
  return new Promise((resolve) => {
    const container = getContainer();
    let currentOrder = [...cards];

    const renderCards = () => currentOrder.map((code, i) => {
      const card = getCardFn(code);
      const isGhosted = code === 'GHOSTED';
      const typeColor = {
        'green_flag': '#22c55e', 'red_flag': '#ef4444',
        'action': '#3b82f6', 'conditional': '#f59e0b',
        'crush': '#ec4899', 'draw': '#8b5cf6',
        'skip': '#06b6d4', 'nope': '#f97316',
      }[card?.type] || '#6b7280';
      return `
        <div class="alter-card" data-idx="${i}">
          <div class="alter-card__label">${i === 0 ? '① PROCHAINE' : i === 1 ? '②' : '③'}</div>
          <div class="alter-card__visual ${isGhosted ? 'alter-card--danger' : ''}" style="background:${isGhosted ? '#7f1d1d' : typeColor}">
            <div class="alter-card__emoji">${isGhosted ? '👻' : (card?.emoji || '🃏')}</div>
            <div class="alter-card__name">${isGhosted ? '💀 GHOSTÉ' : escape(card?.name || code)}</div>
            ${!isGhosted && card?.description ? `<div class="alter-card__desc">${escape(card.description)}</div>` : ''}
          </div>
          <div class="alter-card__arrows">
            ${i > 0 ? `<button class="alter-btn alter-up" data-idx="${i}">◀ avant</button>` : '<span></span>'}
            ${i < currentOrder.length - 1 ? `<button class="alter-btn alter-down" data-idx="${i}">après ▶</button>` : '<span></span>'}
          </div>
        </div>
      `;
    }).join('');

    const refresh = () => {
      const el = container.querySelector('.alter-cards-list');
      if (el) { el.innerHTML = renderCards(); attachListeners(); }
    };

    const attachListeners = () => {
      container.querySelectorAll('.alter-up').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx, 10);
          if (idx > 0) { [currentOrder[idx-1], currentOrder[idx]] = [currentOrder[idx], currentOrder[idx-1]]; refresh(); }
        });
      });
      container.querySelectorAll('.alter-down').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx, 10);
          if (idx < currentOrder.length-1) { [currentOrder[idx], currentOrder[idx+1]] = [currentOrder[idx+1], currentOrder[idx]]; refresh(); }
        });
      });
    };

    container.innerHTML = `
      <div class="dialog dialog--alter">
        <div class="dialog__header">
          <h3>✨ Changer l'Avenir</h3>
          <p class="dialog__subtitle">Réordonne les 3 prochaines cartes. ① sera ta prochaine pioche.</p>
        </div>
        <div class="alter-cards-list">${renderCards()}</div>
        <button class="btn btn--primary" style="margin-top:12px">✅ Valider</button>
      </div>
    `;

    container.classList.add('dialog-container--open');
    attachListeners();
    container.querySelector('.btn--primary').addEventListener('click', () => { closeDialog(); resolve(currentOrder); });
  });
}

/**
 * Divination / Stalker : affiche les N prochaines cartes visuellement.
 */
export function showDivinationPublic(cards, getCardFn) {
  return new Promise((resolve) => {
    const container = getContainer();

    const cardsHtml = cards.map((code, i) => {
      const card = getCardFn(code);
      const isGhosted = code === 'GHOSTED';
      const typeColor = {
        'green_flag': '#16a34a', 'red_flag': '#dc2626',
        'action': '#2563eb', 'conditional': '#d97706',
        'crush': '#db2777', 'draw': '#7c3aed',
        'skip': '#0891b2', 'nope': '#ea580c',
      }[card?.type] || '#374151';
      // ✅ Affiche le % si la carte a une valeur
      const valueHtml = card?.value && card.value !== 0
        ? `<div class="divin-card__value" style="color:${card.value > 0 ? '#4ade80' : '#f87171'}">${card.value > 0 ? '+' : ''}${card.value}%</div>`
        : '';
      return `
        <div class="divin-card ${isGhosted ? 'divin-card--danger' : ''}" style="background: ${isGhosted ? 'linear-gradient(160deg,#7f1d1d,#450a0a)' : `linear-gradient(160deg, ${typeColor}dd, ${typeColor}88)`}">
          <div class="divin-card__header">
            <span class="divin-card__pos">${i === 0 ? '① next' : i === 1 ? '②' : '③'}</span>
            <span class="divin-card__type">${isGhosted ? 'DANGER' : (card?.type || '').replace('_', ' ')}</span>
          </div>
          <div class="divin-card__emoji">${isGhosted ? '👻' : (card?.emoji || '🃏')}</div>
          ${valueHtml}
          <div class="divin-card__name">${isGhosted ? '💀 Ghosté' : escape(card?.name || code)}</div>
          ${card?.description && !isGhosted ? `<div class="divin-card__desc">${escape(card.description)}</div>` : ''}
          ${card?.displayedTags?.length && !isGhosted ? `<div class="divin-card__tags">${card.displayedTags.join(' ')}</div>` : ''}
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="dialog dialog--divin">
        <div class="dialog__header">
          <h3>🔮 Divination</h3>
          <p class="dialog__subtitle">Fermeture dans <span id="divinTimer">8</span>s</p>
        </div>
        <div class="divin-cards">${cardsHtml}</div>
        <button class="btn btn--secondary" style="margin-top:12px">✅ Fermer</button>
      </div>
    `;

    container.classList.add('dialog-container--open');
    let t = 8;
    const timerEl = container.querySelector('#divinTimer');
    const tick = setInterval(() => {
      t--; if (timerEl) timerEl.textContent = t;
      if (t <= 0) { clearInterval(tick); closeDialog(); resolve(); }
    }, 1000);
    container.querySelector('.btn--secondary')?.addEventListener('click', () => {
      clearInterval(tick); closeDialog(); resolve();
    });
  });
}

/**
 * Affiche la dernière carte du deck (visible uniquement par le joueur)
 * et lui demande s'il veut la prendre.
 * Dans tous les cas, la carte qui passe son tour.
 */
export function showPeekBottom(cardCode, getCardFn) {
  return new Promise((resolve) => {
    const container = getContainer();
    const card = getCardFn(cardCode);
    const isSafe = cardCode !== 'GHOSTED';

    container.innerHTML = `
      <div class="dialog dialog--peek-bottom">
        <div class="dialog__header">
          <h3>👀 Tu regardes la dernière carte…</h3>
          <p class="dialog__subtitle">Seul toi vois cette carte. Ton tour est passé dans tous les cas.</p>
        </div>
        <div class="peek-bottom-card ${isSafe ? '' : 'peek-bottom-card--danger'}">
          <div class="peek-bottom-card__emoji">${card?.emoji || (cardCode === 'GHOSTED' ? '👻' : '🃏')}</div>
          <div class="peek-bottom-card__name">${isSafe ? escape(card?.name || cardCode) : '💀 TU ES GHOSTÉ'}</div>
          ${card?.description ? `<div class="peek-bottom-card__desc">${escape(card.description)}</div>` : ''}
          ${card?.displayedTags?.length ? `<div class="peek-bottom-card__tags">${card.displayedTags.join(' ')}</div>` : ''}
        </div>
        <div class="peek-bottom-actions">
          <button class="btn btn--primary" id="peekTakeBtn" ${!isSafe ? 'disabled' : ''}>
            ✋ Prendre la carte
          </button>
          <button class="btn btn--secondary" id="peekSkipBtn">
            ❌ Laisser en bas
          </button>
        </div>
        <p class="peek-bottom-note">⏭ Ton tour est passé quoi qu'il arrive.</p>
      </div>
    `;

    container.classList.add('dialog-container--open');

    container.querySelector('#peekTakeBtn')?.addEventListener('click', () => {
      closeDialog();
      resolve(true);
    });
    container.querySelector('#peekSkipBtn')?.addEventListener('click', () => {
      closeDialog();
      resolve(false);
    });
  });
}

