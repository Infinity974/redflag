/**
 * RedFlag — Lobby screen
 *
 * Le salon affiche tous les joueurs et bots, permet :
 *   - À l'hôte : ajouter/retirer bots, kick joueurs, transférer hôte, configurer, lancer
 *   - À tous : voir le code, voir les joueurs, copier le code
 */

import { showSimpleToast } from './settings.js';
import { navigateTo } from './app.js';
import {
  getRoom, listenRoom, getMyUid, isHost,
  leaveRoom, addBot, kickPlayer, transferHost,
  dissolveRoom,
} from './services/room-service.js';

const codeBig = document.getElementById('roomCodeBig');
const playersGrid = document.getElementById('playersGrid');
const playerCountEl = document.getElementById('lobbyPlayerCount');
const playerMaxEl = document.getElementById('playerMax');
const leaveBtn = document.getElementById('leaveBtn');
const copyCodeBtn = document.getElementById('copyCodeBtn');
const addBotBtn = document.getElementById('addBotBtn');
const lobbyBotControls = document.getElementById('lobbyBotControls');
const configBtn = document.getElementById('configBtn');
const lobbyFooterHint = document.getElementById('lobbyFooterHint');

let currentRoom = null;
let unsubscribe = null;

// === Si on arrive ici sans salon, retour au menu ===
if (!getRoom()) {
  showSimpleToast('Aucun salon actif', 'warning');
  navigateTo('home');
}

// === Rendu ===

function renderPlayers(room) {
  if (!playersGrid) return;
  const players = Object.values(room.players).sort((a, b) => a.joinedAt - b.joinedAt);
  const myUid = getMyUid();
  const iAmHost = room.meta.hostUid === myUid;

  playersGrid.innerHTML = players.map(p => {
    const isMe = p.uid === myUid;
    const isHostPlayer = p.uid === room.meta.hostUid;
    const isBot = p.isBot;
    const initials = (p.nickname || '?')[0].toUpperCase();

    // Boutons d'action affichés à l'hôte (sauf sur lui-même)
    let actions = '';
    if (iAmHost && !isMe) {
      actions = `<div class="player-card__actions">`;
      if (!isBot) {
        actions += `<button class="player-card__btn" data-action="transfer-host" data-uid="${p.uid}" title="Donner le rôle d'hôte">👑</button>`;
      }
      actions += `<button class="player-card__btn player-card__btn--danger" data-action="kick" data-uid="${p.uid}" title="Retirer">✕</button>`;
      actions += `</div>`;
    }

    let badge = '';
    if (isHostPlayer) badge = `<span class="player-card__badge player-card__badge--host">👑 Hôte</span>`;
    else if (isBot) badge = `<span class="player-card__badge player-card__badge--bot">🤖 Bot</span>`;

    return `
      <div class="player-card ${isMe ? 'player-card--me' : ''} ${isBot ? 'player-card--bot' : ''}" data-uid="${p.uid}">
        <div class="player-card__avatar" style="background:${p.color}">${initials}</div>
        <div class="player-card__info">
          <div class="player-card__name">${escapeHtml(p.nickname)}${isMe ? ' (toi)' : ''}</div>
          ${badge}
        </div>
        ${actions}
      </div>
    `;
  }).join('');

  // Bind les boutons
  playersGrid.querySelectorAll('[data-action="kick"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const uid = e.currentTarget.dataset.uid;
      try {
        await kickPlayer(uid);
        showSimpleToast('Joueur retiré', 'info', 1800);
      } catch (err) {
        showSimpleToast(err.message, 'error', 2500);
      }
    });
  });
  playersGrid.querySelectorAll('[data-action="transfer-host"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const uid = e.currentTarget.dataset.uid;
      const target = currentRoom.players[uid];
      if (!confirm(`Donner le rôle d'hôte à ${target.nickname} ?`)) return;
      try {
        await transferHost(uid);
        showSimpleToast(`${target.nickname} est maintenant l'hôte`, 'info', 2500);
      } catch (err) {
        showSimpleToast(err.message, 'error', 2500);
      }
    });
  });
}

function renderHeader(room) {
  if (codeBig) codeBig.textContent = room.meta.code;
  const count = Object.keys(room.players).length;
  if (playerCountEl) playerCountEl.textContent = count;
  if (playerMaxEl) playerMaxEl.textContent = '8';
}

function renderFooter(room) {
  const myUid = getMyUid();
  const iAmHost = room.meta.hostUid === myUid;
  const count = Object.keys(room.players).length;

  // Bouton "Ajouter bot" : visible hôte uniquement, dispo si < 8 joueurs
  if (lobbyBotControls) {
    lobbyBotControls.style.display = iAmHost ? '' : 'none';
  }
  if (addBotBtn) {
    addBotBtn.disabled = count >= 8;
  }

  // Bouton "Configurer" : tout le monde voit (mais peut quand même cliquer pour voir
  // la config en lecture seule). On cache si pas hôte ? Non — tout le monde peut
  // y accéder, mais seul l'hôte interagit.
  if (configBtn) {
    configBtn.style.display = '';
    if (iAmHost && count >= 4) {
      configBtn.textContent = '⚙ Configurer & Lancer';
    } else {
      configBtn.textContent = '⚙ Configurer la partie';
    }
  }

  // Hint texte
  if (lobbyFooterHint) {
    if (iAmHost) {
      if (count < 4) {
        lobbyFooterHint.textContent = `💡 Code : ${room.meta.code} — Ajoute encore ${4 - count} joueur(s) pour pouvoir lancer`;
      } else {
        lobbyFooterHint.textContent = `💡 Code : ${room.meta.code} — Clique sur Configurer pour lancer la partie`;
      }
    } else {
      lobbyFooterHint.textContent = `🕓 En attente que l'hôte lance la partie`;
    }
  }
}

function renderAll(room) {
  if (!room) {
    // Le salon a été dissous (l'hôte est parti) → retour home
    if (currentRoom) {
      // Tente la navigation seulement si on avait un salon avant
      showSimpleToast('Le salon a été fermé', 'info', 2000);
      navigateTo('home');
    }
    return;
  }
  currentRoom = room;
  renderHeader(room);
  renderPlayers(room);
  renderFooter(room);

  // Si l'hôte a lancé la partie, tous les clients suivent
  if (room.meta?.status === 'playing') {
    // Stocke le snapshot pour game-entry
    localStorage.setItem('redflag_local_game', JSON.stringify({
      players: room.players,
      config: room.config,
      myUid: getMyUid(),
    }));
    if (window.location.hash !== '#/game') {
      navigateTo('game');
    }
  }
}

// === Subscriptions ===
unsubscribe = listenRoom(renderAll);

// === Boutons ===
if (leaveBtn) {
  leaveBtn.addEventListener('click', async () => {
    if (!confirm('Quitter le salon ?')) return;
    if (unsubscribe) unsubscribe();
    await leaveRoom();
    navigateTo('home');
  });
}

if (copyCodeBtn) {
  copyCodeBtn.addEventListener('click', async () => {
    if (!currentRoom) return;
    try {
      await navigator.clipboard.writeText(currentRoom.meta.code);
      showSimpleToast('Code copié !', 'success', 1500);
    } catch {
      showSimpleToast('Code : ' + currentRoom.meta.code, 'info', 3000);
    }
  });
}

if (addBotBtn) {
  addBotBtn.addEventListener('click', async () => {
    if (!isHost()) {
      showSimpleToast('Seul l\'hôte peut ajouter des bots', 'warning', 2000);
      return;
    }
    try {
      const botLevel = currentRoom?.config?.botLevel || 'normal';
      await addBot(botLevel);
    } catch (err) {
      showSimpleToast(err.message, 'error', 2500);
    }
  });
}

if (configBtn) {
  configBtn.addEventListener('click', () => {
    navigateTo('config');
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
