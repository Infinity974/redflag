/**
 * RedFlag — Game Renderer V3
 *
 * Nouveau layout opponent :
 *  - Avatar (cercle) | Jauge cœur (à droite)
 *  - Compteur cartes en main (en dessous, centré)
 *  - Board (flags posés AVEC valeurs) en dessous
 *  - Bouclier mini en bas si actif
 *
 * Le board affiche maintenant la valeur de chaque flag (lisible).
 */

import { renderCard } from './card-renderer.js';
import { renderHeartGauge } from './heart-gauge.js';
import { getTrait } from '../data/traits-catalog.js';
import { getCard } from '../data/cards-catalog.js';
import { CARD_TYPES, GAME_CONFIG } from '../config/game-constants.js';

export function renderGame(state, currentPlayerUid) {
  if (!state || !state.players) return;

  renderTopBar(state);
  renderOpponents(state, currentPlayerUid);
  renderCrushZone(state);
  renderDeckZone(state);
  renderActionZone(state, currentPlayerUid);
  renderPlayerBar(state, currentPlayerUid);
}

function renderTopBar(state) {
  const roundEl = document.getElementById('currentRound');
  if (roundEl) roundEl.textContent = state.currentRound || 1;
}

function renderOpponents(state, currentPlayerUid) {
  const container = document.getElementById('opponentsRow');
  if (!container) return;

  const opponents = Object.values(state.players)
    .filter(p => p.uid !== currentPlayerUid)
    .sort((a, b) => {
      // Ghostés en fin
      if (a.isGhosted !== b.isGhosted) return a.isGhosted ? 1 : -1;
      return a.turnOrder - b.turnOrder;
    });

  container.innerHTML = opponents.map(opp => renderOpponent(opp, state)).join('');
}

function renderOpponent(player, state) {
  // Si éliminé → rendu grisé avec cœur brisé
  if (player.isGhosted) {
    return `
      <div class="opponent opponent--ghosted" data-player-uid="${player.uid}">
        <div class="opponent__ghost-badge">👻 GHOSTÉ</div>
        <div class="opponent__name" style="opacity:0.5">${escapeHtml(player.nickname)}</div>
        <div class="opponent__avatar opponent__avatar--ghosted" style="background: #3a3a4a; filter: grayscale(1);">
          <span style="opacity:0.4">${escapeHtml((player.nickname || '?')[0]?.toUpperCase() || '?')}</span>
        </div>
        <div class="opponent__heart opponent__heart--broken">💔</div>
        <div class="opponent__ghost-status" style="opacity:0.45">Hors course</div>
      </div>
    `;
  }

  const isActive = state.turn?.activePlayerUid === player.uid;
  const isDateImminent = player.profile?.isDateImminent;
  const isInDanger = player.profile?.isInDanger;
  const handCount = player.hand?.length || 0;
  const gauge = player.profile?.seductionGauge || 0;
  const hasShield = player.profile?.shieldActive;
  const flags = player.profile?.activeFlags || [];

  const classes = ['opponent'];
  if (isActive) classes.push('opponent--active');
  if (isDateImminent) classes.push('opponent--date-imminent');
  if (isInDanger) classes.push('opponent--danger');

  // Avatar classes selon l'état
  let avatarCls = 'opponent__avatar';
  if (isDateImminent) avatarCls += ' opponent__avatar--gold';
  else if (isInDanger) avatarCls += ' opponent__avatar--danger';
  if (isActive) avatarCls += ' opponent__avatar--active-pulse';

  // Badge danger
  let dangerBadge = '';
  if (isDateImminent) {
    dangerBadge = '<div class="opponent__danger-badge">⚡ DATE IMMINENT</div>';
  } else if (isInDanger) {
    dangerBadge = '<div class="opponent__danger-badge opponent__danger-badge--minus">💀 DANGER</div>';
  }

  // Board (flags posés) — AVEC valeurs lisibles
  const boardHtml = flags.slice(0, 8).map(flag => {
    const card = getCard(flag.cardCode);
    const flippedCls = flag.flippedFromGreen ? ' board-flag--flipped' : '';
    const typeCls = flag.type === 'green' ? 'board-flag--green' : 'board-flag--red';
    const sign = flag.value > 0 ? '+' : '';
    return `
      <div class="board-flag ${typeCls}${flippedCls}" title="${escapeHtml(card?.name || '?')}: ${flag.value}%" data-flag-card-code="${flag.cardCode}">
        <span class="board-flag__emoji">${card?.emoji || '?'}</span>
        <span class="board-flag__value">${sign}${flag.value}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="${classes.join(' ')}" data-player-uid="${player.uid}">
      ${dangerBadge}
      ${isActive ? '<div class="opponent__turn-badge">▶ SON TOUR</div>' : ''}
      <div class="opponent__name">${escapeHtml(player.nickname)}</div>

      <!-- Avatar + Jauge à droite -->
      <div class="opponent__main">
        <div class="${avatarCls}" style="background: ${player.avatarColor};">
          ${player.avatarLetter}
        </div>
        ${renderHeartGauge(gauge, { isGold: isDateImminent, isNegative: gauge < 0, playerUid: player.uid })}
      </div>

      <!-- Compteur cartes -->
      <div class="opponent__hand-count" title="Cartes en main">
        <span class="card-back-stack"></span>
        <span class="hand-count-number">${handCount}</span>
      </div>

      <!-- Board (flags posés avec valeur) -->
      <div class="opponent__board">
        ${boardHtml}
      </div>

      ${hasShield ? '<div class="opponent__shields"><div class="shield-mini">🛡</div></div>' : ''}
    </div>
  `;
}

function renderCrushZone(state) {
  const crushAvatarEl = document.querySelector('.crush-avatar');
  const crushLabelEl  = document.querySelector('.crush-label');

  if (crushAvatarEl && state.crush?.profileData) {
    crushAvatarEl.textContent = state.crush.profileData.avatar;
  }
  if (crushLabelEl && state.crush?.profileData) {
    crushLabelEl.textContent = state.crush.profileData.displayName;
  }

  const leftEl   = document.getElementById('crushTraitsLeft');
  const rightEl  = document.getElementById('crushTraitsRight');
  const bottomEl = document.getElementById('crushTraitsBottom');
  const topEl    = document.getElementById('crushTraitsTop');
  if (!leftEl || !rightEl || !bottomEl) return;

  const revealed = state.crush?.revealedTraits || [];

  // ✅ Version check : ne re-rend que si quelque chose a changé
  const newVersion = revealed.map(t => t.traitId).sort().join(',') || 'empty';
  if (bottomEl.dataset.crushVersion === newVersion) return;
  bottomEl.dataset.crushVersion = newVersion;

  leftEl.innerHTML   = '';
  rightEl.innerHTML  = '';
  bottomEl.innerHTML = '';
  if (topEl) topEl.innerHTML = '';

  if (revealed.length === 0) {
    bottomEl.innerHTML = '<div class="trait-badge trait-badge--mystery">À découvrir…</div>';
    return;
  }

  // --- Regroupement : chaque principal + ses sous-traits forment un groupe stable ---
  // Un groupe = { principal, subtraits[] }
  const principalGroups = []; // ordonnés par round de révélation
  const orphanSubtraits = []; // sous-traits dont le principal n'est pas encore révélé

  const revealedIds = new Set(revealed.map(t => t.traitId));

  // Trie par round de révélation pour ordre stable
  const byRound = [...revealed].sort((a, b) =>
    (a.revealedAtRound || 0) - (b.revealedAtRound || 0)
  );

  for (const t of byRound) {
    if (t.type === 'principal') {
      // Trouve ses sous-traits déjà révélés
      const traitData = getTrait(t.traitId);
      const subIds = traitData?.subtraits || [];
      const mySubtraits = byRound.filter(r =>
        r.type === 'subtrait' && subIds.includes(r.traitId)
      );
      principalGroups.push({ principal: t, subtraits: mySubtraits });
    } else {
      // Sous-trait : vérifie si son principal est révélé
      const traitData = getTrait(t.traitId);
      const parentId = traitData?.parentId;
      if (!parentId || !revealedIds.has(parentId)) {
        orphanSubtraits.push(t);
      }
      // Sinon il sera rattaché à son principal ci-dessus
    }
  }

  // --- Placement stable : gauche, droite, bas (jamais haut) ---
  // slot 0 → bas, slot 1 → gauche, slot 2 → droite, slot 3 → gauche, slot 4 → droite …
  const sideContainers = [bottomEl, leftEl, rightEl, leftEl, rightEl, leftEl, rightEl];

  const renderBadge = (t, container, isNew = false) => {
    const traitData = getTrait(t.traitId);
    if (!traitData) return;
    const cls = t.type === 'principal' ? 'trait-badge--principal' : 'trait-badge--subtrait';
    const prefix = t.type === 'subtrait' ? '↳ ' : '';
    const newCls = isNew ? ' trait-badge--new' : '';
    const badge = document.createElement('div');
    badge.className = `trait-badge ${cls}${newCls}`;
    badge.dataset.traitId = t.traitId;
    badge.innerHTML = `
      ${traitData.emoji ? `<span class="trait-badge__emoji">${traitData.emoji}</span>` : ''}
      <span class="trait-badge__name">${prefix}${escapeHtml(traitData.displayName)}</span>
    `;
    container.appendChild(badge);
  };

  const anyNew = revealed.some(t => t.isNewlyRevealed);

  principalGroups.forEach((group, i) => {
    const container = sideContainers[i] || bottomEl;
    renderBadge(group.principal, container, group.principal.isNewlyRevealed);
    // Sous-traits dans le même conteneur, juste en dessous du principal
    for (const st of group.subtraits) {
      renderBadge(st, container, st.isNewlyRevealed);
    }
  });

  // Orphelins → bas
  for (const t of orphanSubtraits) {
    renderBadge(t, bottomEl, t.isNewlyRevealed);
  }

  // Retire l'animation après 2s
  if (anyNew) {
    setTimeout(() => {
      document.querySelectorAll('.trait-badge--new').forEach(el =>
        el.classList.remove('trait-badge--new')
      );
    }, 2000);
  }
}

function renderDeckZone(state) {
  const countEl = document.querySelector('.deck-pile__count');
  const ghostedEl = document.getElementById('ghostedCount');

  if (countEl) countEl.textContent = state.deck?.drawPile?.length || 0;
  if (ghostedEl) ghostedEl.textContent = state.deck?.ghostedRemaining || 0;
}

function renderActionZone(state, currentPlayerUid) {
  // Indicateur de chaîne
  const chainEl = document.querySelector('.chain-indicator');
  if (chainEl) {
    if (state.activeChain) {
      const targetPlayer = state.players[state.activeChain.currentTargetUid];
      const targetIsMe = state.activeChain.currentTargetUid === currentPlayerUid;
      chainEl.className = 'chain-indicator chain-indicator--active';
      chainEl.innerHTML = `
        <div class="chain-indicator__warning">⚠ Chaîne</div>
        <div class="chain-indicator__total">📲 +${state.activeChain.totalToDraw}</div>
        <div class="chain-indicator__target">→ ${targetIsMe ? 'TOI' : escapeHtml(targetPlayer?.nickname || '?')}</div>
      `;
    } else {
      chainEl.className = 'chain-indicator';
      chainEl.innerHTML = '';
    }
  }

  // ── Journal de partie ─────────────────────────────────────────────────
  const journalEl = document.getElementById('journalEntries');
  if (journalEl) {
    const allActions = state.actionLog || [];
    if (allActions.length === 0) {
      journalEl.innerHTML = '<div class="journal-empty">Aucune action encore.</div>';
    } else {
      // Ne re-rend que si nouvelles entrées
      const newVersion = allActions[0]?.timestamp || 0;
      if (journalEl.dataset.version !== String(newVersion)) {
        journalEl.dataset.version = String(newVersion);
        journalEl.innerHTML = allActions.slice(0, 30).map((action, idx) => {
          const fromPlayer = state.players[action.playerUid];
          const targetPlayer = action.targetUid ? state.players[action.targetUid] : null;
          const isSelf = action.targetUid === action.playerUid;
          const cardCode = action.cardCode || (action.cardCodes?.[0]);
          const card = cardCode ? getCard(cardCode) : null;

          // Calcule l'effet principal lisible
          const flagEffect = action.effects?.find(e => e.type === 'flag_placed');
          const chainEffect = action.effects?.find(e => e.type === 'chain_started' || e.type === 'chain_draw');
          const nopeEffect = action.effects?.find(e => e.type === 'nope' || e.type === 'nope_resolved');
          const swapEffect = action.effects?.find(e => e.type === 'hand_swapped');
          const stealEffect = action.effects?.find(e => e.type === 'flag_stolen' || e.type === 'card_stolen');
          const raseEffect = action.effects?.find(e => e.type === 'table_rase' || e.type === 'flags_purged');
          const stunEffect = action.effects?.find(e => e.type === 'stunned' || e.type === 'turn_skipped');
          const peekEffect = action.effects?.find(e => e.type === 'see_future' || e.type === 'alter_future' || e.type === 'public_reveal');

          let effectHtml = '';
          if (nopeEffect) {
            const isCanceled = nopeEffect.isCanceled;
            effectHtml = `<span class="journal-effect" style="color:${isCanceled ? '#f87171' : '#4ade80'}">${isCanceled ? '🚫 NOPE' : '✅ CONTRE'}</span>`;
          } else if (flagEffect) {
            const sign = flagEffect.effectiveValue > 0 ? '+' : '';
            const color = flagEffect.effectiveValue > 0 ? '#4ade80' : '#f87171';
            const crit = flagEffect.isDoubleCritical ? ' ✦✦' : (flagEffect.isCritical ? ' ✦' : '');
            effectHtml = `<span class="journal-effect" style="color:${color}">${sign}${flagEffect.effectiveValue}%${crit}</span>`;
          } else if (chainEffect) {
            effectHtml = `<span class="journal-effect" style="color:#a78bfa">📲 chaîne</span>`;
          } else if (swapEffect) {
            effectHtml = `<span class="journal-effect" style="color:#fb923c">🔄 échange</span>`;
          } else if (stealEffect) {
            effectHtml = `<span class="journal-effect" style="color:#fbbf24">🎯 vol</span>`;
          } else if (raseEffect) {
            effectHtml = `<span class="journal-effect" style="color:#f87171">🧹 rase</span>`;
          } else if (stunEffect) {
            effectHtml = `<span class="journal-effect" style="color:#60a5fa">💤 stun</span>`;
          } else if (peekEffect) {
            effectHtml = `<span class="journal-effect" style="color:#34d399">👁 peek</span>`;
          } else if (action.actionType === 'play_crush_combo') {
            effectHtml = `<span class="journal-effect" style="color:#f472b6">💕 ×${action.comboLevel}</span>`;
          } else if (card?.type === 'skip') {
            effectHtml = `<span class="journal-effect" style="color:#67e8f9">⏭ skip</span>`;
          }

          const fromColor = fromPlayer?.avatarColor || '#666';
          const fromName = escapeHtml(fromPlayer?.nickname || '?');
          const targetName = targetPlayer && !isSelf ? escapeHtml(targetPlayer.nickname) : '';
          const arrowHtml = targetName ? `<span class="journal-arrow">→</span><span class="journal-target">${targetName}</span>` : '';
          const isNew = idx === 0 ? ' journal-entry--new' : '';

          return `
            <div class="journal-entry${isNew}" data-ts="${action.timestamp}">
              <span class="journal-dot" style="background:${fromColor}"></span>
              <span class="journal-from">${fromName}</span>
              ${arrowHtml}
              <span class="journal-card">${card ? `${card.emoji} ${escapeHtml(card.name)}` : '?'}</span>
              ${effectHtml}
            </div>
          `;
        }).join('');
      }
    }
  }
} // ← fin renderActionZone

function renderPlayerBar(state, currentPlayerUid) {
  const player = state.players[currentPlayerUid];
  if (!player) return;

  const nameEl = document.querySelector('.player-status-block__name');
  if (nameEl) nameEl.textContent = player.nickname;

  const labelEl = document.querySelector('.player-status-block__label');
  if (labelEl) {
    if (state.turn?.activePlayerUid === currentPlayerUid) {
      labelEl.textContent = '▶ TON TOUR';
      labelEl.style.color = 'var(--color-gold)';
    } else {
      labelEl.textContent = 'TOI';
      labelEl.style.color = 'var(--color-white-muted)';
    }
  }

  // Jauge SVG (avec gestion négative)
  const gaugeContainer = document.querySelector('.player-status-block__gauge');
  if (gaugeContainer) {
    const gauge = player.profile.seductionGauge || 0;
    const isDate = player.profile.isDateImminent;
    gaugeContainer.innerHTML = `
      ${renderHeartGauge(gauge, { isBig: true, isGold: isDate, isNegative: gauge < 0, playerUid: player.uid })}
      ${player.profile.shieldActive ? '<div class="player-shield-active" title="Bouclier actif">🛡</div>' : ''}
    `;
  }

  // Mon board (mes flags actifs) — affiché à droite entre l'historique et les boutons
  const boardEl = document.getElementById('playerBoard') || document.querySelector('.player-board');
  if (boardEl) {
    const flags = player.profile.activeFlags || [];
    if (flags.length === 0) {
      boardEl.innerHTML = '';
    } else {
      boardEl.innerHTML = flags.map(flag => {
        const card = getCard(flag.cardCode);
        const flippedCls = flag.flippedFromGreen ? ' board-flag--flipped' : '';
        const typeCls = flag.type === 'green' ? 'board-flag--green' : 'board-flag--red';
        const sign = flag.value > 0 ? '+' : '';
        return `
          <div class="board-flag ${typeCls}${flippedCls}" title="${escapeHtml(card?.name || '?')}: ${flag.value}%">
            <span class="board-flag__emoji">${card?.emoji || '?'}</span>
            <span class="board-flag__value">${sign}${flag.value}</span>
          </div>
        `;
      }).join('');
    }
  }

  setupJournalToggle();
  renderHand(state, currentPlayerUid);
}

function renderHand(state, currentPlayerUid) {
  const handEl = document.getElementById('playerHand');
  if (!handEl) return;

  const player = state.players[currentPlayerUid];
  if (!player) return;

  // ✅ FIX drag & drop : ne pas re-rendre la main si un drag est en cours
  if (handEl.dataset.dragging === 'true') return;

  // ✅ FIX clignotement : ne re-rendre que si la main ou la sélection a changé
  const handVersion    = player.handVersion || 0;
  const selectedKey    = `${state.localUI?.selectedCardCode || ''}-${(state.localUI?.selectedCrushCombo || []).join(',')}`;
  const traitVersion   = (state.crush?.revealedTraits || []).map(t => t.traitId).join(',');
  const chainKey       = state.activeChain?.currentTargetUid || '';
  const currentVersion = `${handVersion}-${selectedKey}-${traitVersion}-${chainKey}`;

  if (handEl.dataset.handVersion === currentVersion) return;
  handEl.dataset.handVersion = currentVersion;

  // Adapte la taille des cartes au nombre dans la main
  const handCount = player.hand.length;
  let scaleAdjust = 1;
  if (handCount > 12) scaleAdjust = 0.7;
  else if (handCount > 10) scaleAdjust = 0.8;
  else if (handCount > 8)  scaleAdjust = 0.9;
  handEl.style.setProperty('--hand-scale', scaleAdjust);

  const activeTraits = (state.crush?.revealedTraits || [])
    .filter(t => t.isActive)
    .map(t => getTrait(t.traitId))
    .filter(Boolean);

  const chainActive      = !!state.activeChain;
  const isMyChainTurn    = state.activeChain?.currentTargetUid === currentPlayerUid;
  const selectedCrushCombo = state.localUI?.selectedCrushCombo || [];
  const selectedCardCode = state.localUI?.selectedCardCode || null;

  handEl.innerHTML = player.hand.map((cardCode, idx) => {
    const card = getCard(cardCode);
    if (!card) return '';

    const canCounter     = chainActive && isMyChainTurn && card.type === CARD_TYPES.DRAW;
    const isComboSelected = selectedCrushCombo.includes(cardCode);
    const isSelected     = selectedCardCode === cardCode && !isComboSelected;

    return renderCard(cardCode, {
      activeTraits,
      canCounter,
      inHand: true,
      selected: isSelected,
      isLocked: false,   // jamais locké — drag autorisé pour toutes les cartes incl. Bouclier
      isComboSelected,
      handIndex: idx,
    });
  }).join('');
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// =========================================================================
// JOURNAL TOGGLE
// =========================================================================
let journalSetup = false;
function setupJournalToggle() {
  if (journalSetup) return;
  journalSetup = true;
  const btn = document.getElementById('journalToggle');
  const entries = document.getElementById('journalEntries');
  if (!btn || !entries) return;
  btn.addEventListener('click', () => {
    const collapsed = entries.classList.toggle('game-journal__entries--collapsed');
    btn.textContent = collapsed ? '+' : '−';
  });
}

// =========================================================================
// CARD HOVER PREVIEW
// =========================================================================
let cardHoverSetup = false;
export function setupCardHoverPreview() {
  if (cardHoverSetup) return;
  cardHoverSetup = true;

  const popup = document.getElementById('cardPreviewPopup');
  if (!popup) return;

  let hoverTimeout = null;

  document.addEventListener('mouseover', (e) => {
    const cardEl = e.target.closest('.game-card--in-hand, .board-flag');
    if (!cardEl) return;

    // Récupère le code de la carte
    const code = cardEl.dataset.cardCode || cardEl.dataset.flagCardCode;
    if (!code) return;

    clearTimeout(hoverTimeout);
    hoverTimeout = setTimeout(() => showCardPreview(popup, cardEl, code), 350);
  });

  document.addEventListener('mouseout', (e) => {
    const cardEl = e.target.closest('.game-card--in-hand, .board-flag');
    if (!cardEl) return;
    clearTimeout(hoverTimeout);
    hideCardPreview(popup);
  });

  // Touch : tap long pour voir le détail
  let touchTimer = null;
  document.addEventListener('touchstart', (e) => {
    const cardEl = e.target.closest('.game-card--in-hand, .board-flag');
    if (!cardEl) return;
    const code = cardEl.dataset.cardCode || cardEl.dataset.flagCardCode;
    if (!code) return;
    touchTimer = setTimeout(() => {
      showCardPreview(popup, cardEl, code);
    }, 500);
  }, { passive: true });

  document.addEventListener('touchend', () => {
    clearTimeout(touchTimer);
    setTimeout(() => hideCardPreview(popup), 1500);
  }, { passive: true });
}

function showCardPreview(popup, cardEl, code) {
  const card = getCard(code);
  if (!card) return;

  const typeColors = {
    'green_flag': 'linear-gradient(160deg,#16a34a,#065f46)',
    'red_flag': 'linear-gradient(160deg,#dc2626,#7f1d1d)',
    'action': 'linear-gradient(160deg,#2563eb,#1e3a8a)',
    'conditional': 'linear-gradient(160deg,#d97706,#78350f)',
    'crush': 'linear-gradient(160deg,#db2777,#831843)',
    'draw': 'linear-gradient(160deg,#7c3aed,#4c1d95)',
    'skip': 'linear-gradient(160deg,#0891b2,#164e63)',
    'nope': 'linear-gradient(160deg,#ea580c,#7c2d12)',
    'shield': 'linear-gradient(160deg,#4b5563,#1f2937)',
  };
  const bg = typeColors[card.type] || 'linear-gradient(160deg,#374151,#111827)';
  const sign = card.value > 0 ? '+' : '';
  const valueStr = card.value ? `${sign}${card.value}%` : '';
  const valueColor = card.value > 0 ? '#4ade80' : card.value < 0 ? '#f87171' : 'transparent';

  popup.innerHTML = `
    <div class="card-preview__inner" style="background:${bg}">
      <div class="card-preview__type">${(card.type || '').replace('_', ' ').toUpperCase()}</div>
      <div class="card-preview__emoji">${card.emoji || '🃏'}</div>
      ${valueStr ? `<div class="card-preview__value" style="color:${valueColor}">${valueStr}</div>` : ''}
      <div class="card-preview__name">${escapeHtml(card.name)}</div>
      ${card.description ? `<div class="card-preview__desc">${escapeHtml(card.description)}</div>` : ''}
      ${card.displayedTags?.length ? `<div class="card-preview__tags">${card.displayedTags.join(' · ')}</div>` : ''}
    </div>
  `;

  // Positionnement : évite les bords d'écran
  const rect = cardEl.getBoundingClientRect();
  const pw = 220, ph = 280;
  let left = rect.left + rect.width / 2 - pw / 2;
  let top = rect.top - ph - 12;
  if (top < 8) top = rect.bottom + 12;
  if (left < 8) left = 8;
  if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;

  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
  popup.classList.add('card-preview-popup--visible');
}

function hideCardPreview(popup) {
  popup.classList.remove('card-preview-popup--visible');
}
