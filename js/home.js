/**
 * RedFlag — Home screen
 *
 * 2 actions :
 *   - Créer un salon (devient hôte)
 *   - Rejoindre un salon avec un code
 *
 * Mode local : le salon vit dans la mémoire du navigateur. Pour le multi
 * réel entre amis, il faudra activer Firebase plus tard.
 */

import { showSimpleToast } from './settings.js';
import { navigateTo } from './app.js';
import { createRoom, joinRoom } from './services/room-service.js';

const nicknameInput = document.getElementById('nickname');
const roomCodeInput = document.getElementById('roomCode');
const joinBtn = document.getElementById('joinBtn');
const createBtn = document.getElementById('createBtn');

if (roomCodeInput) {
  roomCodeInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '');
  });
}

if (nicknameInput) {
  nicknameInput.addEventListener('change', (e) => {
    localStorage.setItem('redflag_nickname', e.target.value.trim());
  });

  const savedNickname = localStorage.getItem('redflag_nickname');
  if (savedNickname) nicknameInput.value = savedNickname;
}

function validateNickname() {
  const nick = (nicknameInput?.value || '').trim();
  if (nick.length < 2) {
    showSimpleToast('Choisis un pseudo (2 caractères minimum)', 'warning');
    nicknameInput?.focus();
    return false;
  }
  return true;
}

function getColor() {
  return localStorage.getItem('redflag_color') || '#FF4FA3';
}

function setBusy(busy) {
  if (joinBtn) joinBtn.disabled = busy;
  if (createBtn) createBtn.disabled = busy;
}

// ========= CRÉER =========
if (createBtn) {
  createBtn.addEventListener('click', async () => {
    if (!validateNickname()) return;
    const nickname = nicknameInput.value.trim();
    localStorage.setItem('redflag_nickname', nickname);

    setBusy(true);
    try {
      const { code } = await createRoom({ nickname, color: getColor() });
      localStorage.setItem('redflag_roomcode', code);
      navigateTo('lobby', { code });
    } catch (err) {
      showSimpleToast(err.message || 'Erreur', 'error', 3500);
    } finally {
      setBusy(false);
    }
  });
}

// ========= REJOINDRE =========
if (joinBtn) {
  joinBtn.addEventListener('click', async () => {
    if (!validateNickname()) return;
    const code = roomCodeInput.value.trim();
    if (code.length !== 4) {
      showSimpleToast('Le code de salon doit faire 4 caractères', 'warning');
      roomCodeInput.focus();
      return;
    }
    const nickname = nicknameInput.value.trim();
    localStorage.setItem('redflag_nickname', nickname);

    setBusy(true);
    try {
      await joinRoom({ code, nickname, color: getColor() });
      localStorage.setItem('redflag_roomcode', code);
      navigateTo('lobby', { code });
    } catch (err) {
      showSimpleToast(err.message || 'Salon introuvable', 'error', 3500);
    } finally {
      setBusy(false);
    }
  });
}
