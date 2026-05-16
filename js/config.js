/**
 * RedFlag — Config screen
 *
 * Affiche la configuration de la partie + bouton Lancer (hôte seulement).
 *
 * Tous les joueurs voient la config en temps réel.
 * Seul l'hôte peut interagir avec elle ET lancer la partie.
 */

import { showSimpleToast } from './settings.js';
import { navigateTo } from './app.js';
import {
  getRoom, listenRoom, getMyUid, isHost, updateConfig, startGame,
} from './services/room-service.js';

const backBtn = document.getElementById('configBackBtn');
const saveBtn = document.getElementById('configSaveBtn');
const startBtn = document.getElementById('configStartBtn');
const startHint = document.getElementById('configStartHint');
const readonlyBanner = document.getElementById('configReadonlyBanner');
const cardsOptions = document.getElementById('configCardsOptions');

let unsubscribe = null;

if (!getRoom()) {
  showSimpleToast('Aucun salon actif', 'warning');
  navigateTo('home');
}

function applyConfigToUI(config) {
  document.querySelectorAll('.game-mode-card').forEach(card => {
    card.classList.toggle('game-mode-card--selected', card.dataset.mode === config.gameMode);
  });

  document.querySelectorAll('.config-option__choices').forEach(group => {
    const key = group.dataset.configKey;
    const value = config[key];
    group.querySelectorAll('.config-choice').forEach(btn => {
      let btnValue = btn.dataset.value;
      if (btnValue === 'true') btnValue = true;
      else if (btnValue === 'false') btnValue = false;
      else if (!isNaN(parseFloat(btnValue))) btnValue = parseFloat(btnValue);
      btn.classList.toggle('config-choice--active', btnValue === value);
    });
  });

  if (cardsOptions) {
    cardsOptions.style.display = config.gameMode === 'cards' ? '' : 'none';
  }
}

function renderReadonly(iAmHost) {
  if (readonlyBanner) {
    readonlyBanner.style.display = iAmHost ? 'none' : '';
  }

  document.querySelectorAll('.config-choice').forEach(btn => {
    if (!iAmHost) {
      btn.disabled = true;
      btn.classList.add('config-choice--readonly');
    } else {
      btn.disabled = false;
      btn.classList.remove('config-choice--readonly');
    }
  });
  document.querySelectorAll('.game-mode-card').forEach(card => {
    if (card.classList.contains('game-mode-card--locked')) return;
    if (!iAmHost) {
      card.disabled = true;
      card.classList.add('game-mode-card--readonly');
    } else {
      card.disabled = false;
      card.classList.remove('game-mode-card--readonly');
    }
  });
}

function renderStartButton(room) {
  const iAmHost = isHost();
  const count = Object.keys(room?.players || {}).length;

  if (saveBtn) {
    saveBtn.textContent = '← Retour au salon';
  }

  if (startBtn) {
    if (iAmHost) {
      startBtn.style.display = '';
      startBtn.disabled = count < 4;
      if (count < 4) {
        startBtn.textContent = `🚀 Encore ${4 - count} joueur(s) requis`;
      } else {
        startBtn.textContent = '🚀 Lancer la partie';
      }
    } else {
      startBtn.style.display = 'none';
    }
  }

  if (startHint) {
    if (!iAmHost) {
      startHint.style.display = '';
      startHint.textContent = '🕓 En attente que l\'hôte lance la partie';
    } else if (count < 4) {
      startHint.style.display = '';
      startHint.textContent = `Retourne au salon pour ajouter des bots ou inviter des amis`;
    } else {
      startHint.style.display = 'none';
    }
  }
}

function render(room) {
  if (!room) return;
  applyConfigToUI(room.config);
  renderReadonly(isHost());
  renderStartButton(room);
}

unsubscribe = listenRoom(render);

function goBack() {
  if (unsubscribe) unsubscribe();
  navigateTo('lobby');
}

if (backBtn) backBtn.addEventListener('click', goBack);
if (saveBtn) saveBtn.addEventListener('click', goBack);

if (startBtn) {
  startBtn.addEventListener('click', async () => {
    if (!isHost()) {
      showSimpleToast('Seul l\'hôte peut lancer', 'warning', 2000);
      return;
    }
    try {
      await startGame();
      const room = getRoom();
      if (room) {
        localStorage.setItem('redflag_local_game', JSON.stringify({
          players: room.players,
          config: room.config,
          myUid: getMyUid(),
        }));
      }
      if (unsubscribe) unsubscribe();
      navigateTo('game');
    } catch (err) {
      showSimpleToast(err.message, 'error', 3000);
    }
  });
}

document.querySelectorAll('.game-mode-card').forEach(card => {
  card.addEventListener('click', async () => {
    if (!isHost()) {
      showSimpleToast('Seul l\'hôte peut configurer', 'warning', 2000);
      return;
    }
    if (card.classList.contains('game-mode-card--locked')) {
      showSimpleToast('Ce mode arrive bientôt !', 'info', 2000);
      return;
    }
    const mode = card.dataset.mode;
    try {
      await updateConfig({ gameMode: mode });
    } catch (err) {
      showSimpleToast(err.message, 'error', 2500);
    }
  });
});

document.querySelectorAll('.config-option__choices').forEach(group => {
  const key = group.dataset.configKey;
  group.querySelectorAll('.config-choice').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!isHost()) {
        showSimpleToast('Seul l\'hôte peut configurer', 'warning', 2000);
        return;
      }
      let value = btn.dataset.value;
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (!isNaN(parseFloat(value))) value = parseFloat(value);

      try {
        await updateConfig({ [key]: value });
      } catch (err) {
        showSimpleToast(err.message, 'error', 2500);
      }
    });
  });
});
