console.log("lovemo v6.0 - Multi-Companion");

// ─── AVATAR COLORS (emoji-palette) ───────────
// Uses canvas to extract real dominant color from any emoji
const _emojiColorCache = {};

function getEmojiColor(emoji) {
  if (_emojiColorCache[emoji]) return _emojiColorCache[emoji];
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = '52px Apple Color Emoji, Segoe UI Emoji, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 32, 32);
    const pixels = ctx.getImageData(0, 0, 64, 64).data;

    // Pick most saturated non-outline color
    // Apple emoji outlines are typically yellow-orange (#F4C430 range)
    let bestScore = -1, bestR = 0, bestG = 0, bestB = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const [r, g, b, a] = [pixels[i], pixels[i+1], pixels[i+2], pixels[i+3]];
      if (a < 150) continue;
      const brightness = (r + g + b) / 3;
      if (brightness > 235 || brightness < 20) continue;

      // Skip Apple emoji yellow outline (r>200, g>150, b<80)
      if (r > 200 && g > 140 && b < 100) continue;
      // Skip grey/neutral
      const max = Math.max(r,g,b), min = Math.min(r,g,b);
      const sat = max === 0 ? 0 : (max-min)/max;
      if (sat < 0.2) continue;

      // Score by saturation + uniqueness of hue
      const score = sat * 100 + (max - min);
      if (score > bestScore) {
        bestScore = score; bestR = r; bestG = g; bestB = b;
      }
    }

    if (bestScore < 0) return '#0084FF';
    const best = `${bestR},${bestG},${bestB}`;

    const [r, g, b] = best.split(',').map(Number);
    const hex = `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
    _emojiColorCache[emoji] = hex;
    return hex;
  } catch(e) { return '#0084FF'; }
}

function avatarColor(emoji) {
  return getEmojiColor(emoji);
}

function avatarGradient(emoji) {
  const hex = getEmojiColor(emoji);
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  const light = `rgb(${Math.min(255,r+60)},${Math.min(255,g+60)},${Math.min(255,b+60)})`;
  const dark  = `rgb(${Math.round(r*0.5)},${Math.round(g*0.5)},${Math.round(b*0.5)})`;
  return `linear-gradient(135deg, ${light}, ${dark})`;
}


// ─── COMPANIONS ────────────────────────────────
let companions = JSON.parse(localStorage.getItem('lovemo_companions') || 'null');
if (!companions) {
  companions = [{
    id: '0816', name: '0816', avatar: '👻',
    personalities: ['bff'], vibe: 'bestie',
    language: 'en', gender: 'female',
    created: Date.now(), lastMessage: 'hey! 👋', lastTime: Date.now()
  }];
  saveCompanions();
}
let currentId = localStorage.getItem('lovemo_current') || companions[0].id;

function saveCompanions() {
  localStorage.setItem('lovemo_companions', JSON.stringify(companions));
}

function getCompanion(id) {
  return companions.find(c => c.id === id) || companions[0];
}

function getCurrentCompanion() {
  return getCompanion(currentId);
}

// ─── MODAL STATE ──────────────────────────────
let modalAvatar = '👻';
let modalVibe = 'bestie';
let modalPersonalities = ['bff'];
let modalLang = 'en';
let modalGender = 'female';
let editingId = null;

function openCreateModal() {
  editingId = null;
  document.getElementById('modalTitle').textContent = 'New AI Companion';
  document.getElementById('companionNameInput').value = '';
  document.querySelectorAll('.avatar-opt').forEach(e => e.classList.remove('selected'));
  document.querySelector('.avatar-opt').classList.add('selected');
  modalAvatar = '👻'; modalVibe = 'bestie'; modalPersonalities = ['bff'];
  modalLang = 'en'; modalGender = 'female';
  document.querySelectorAll('.vibe-btn')[0].classList.add('selected');
  document.querySelectorAll('.pers-btn').forEach(b => b.classList.remove('selected'));
  document.querySelector('[data-p="bff"]').classList.add('selected');
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('selected'));
  document.querySelector('[data-lang="en"]').classList.add('selected');
  document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('selected'));
  document.querySelector('[data-gender="female"]').classList.add('selected');
  goStep(1);
  document.getElementById('createModal').classList.add('active');
}

function editCurrentCompanion() {
  const c = getCurrentCompanion();
  editingId = c.id;
  document.getElementById('modalTitle').textContent = 'Edit ' + c.name;
  document.getElementById('companionNameInput').value = c.name;
  modalAvatar = c.avatar; modalVibe = c.vibe || 'bestie';
  modalPersonalities = [...(c.personalities || ['bff'])];
  modalLang = c.language || 'en'; modalGender = c.gender || 'female';

  document.querySelectorAll('.avatar-opt').forEach(e => {
    e.classList.toggle('selected', e.textContent === c.avatar);
  });
  document.querySelectorAll('.vibe-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.vibe === c.vibe);
  });
  document.querySelectorAll('.pers-btn').forEach(b => {
    b.classList.toggle('selected', c.personalities?.includes(b.dataset.p));
  });
  document.querySelectorAll('.lang-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.lang === c.language);
  });
  document.querySelectorAll('.gender-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.gender === c.gender);
  });
  goStep(1);
  document.getElementById('createModal').classList.add('active');
  closeScreen('profile');
}

function closeCreateModal() {
  document.getElementById('createModal').classList.remove('active');
}

function goStep(n) {
  document.querySelectorAll('.modal-step').forEach((s, i) => {
    s.classList.toggle('active', i + 1 === n);
  });
}

function selectAvatar(el) {
  document.querySelectorAll('.avatar-opt').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  modalAvatar = el.textContent;
}

function selectVibe(btn) {
  document.querySelectorAll('.vibe-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  modalVibe = btn.dataset.vibe;
}

function togglePersonality(btn) {
  const p = btn.dataset.p;
  if (btn.classList.contains('selected')) {
    if (modalPersonalities.length > 1) {
      btn.classList.remove('selected');
      modalPersonalities = modalPersonalities.filter(x => x !== p);
    }
  } else {
    if (modalPersonalities.length < 4) {
      btn.classList.add('selected');
      modalPersonalities.push(p);
    } else {
      showToast('Max 4 personalities!');
    }
  }
}

function selectLang(btn) {
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  modalLang = btn.dataset.lang;
}

function selectGender(btn) {
  document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  modalGender = btn.dataset.gender;
}

function createCompanion() {
  const name = document.getElementById('companionNameInput').value.trim() || 'AI';
  if (editingId) {
    const c = getCompanion(editingId);
    c.name = name; c.avatar = modalAvatar; c.vibe = modalVibe;
    c.personalities = modalPersonalities; c.language = modalLang; c.gender = modalGender;
    saveCompanions();
    renderSidebar();
    switchCompanion(editingId);
    closeCreateModal();
    showToast('Updated ' + name + ' ✨');
  } else {
    const id = 'ai_' + Date.now();
    companions.push({
      id, name, avatar: modalAvatar, personalities: modalPersonalities,
      vibe: modalVibe, language: modalLang, gender: modalGender,
      created: Date.now(), lastMessage: '', lastTime: Date.now()
    });
    saveCompanions();
    renderSidebar();
    switchCompanion(id);
    closeCreateModal();
    showToast('Created ' + name + ' ✨');
  }
}

function deleteCurrentCompanion() {
  if (companions.length <= 1) { showToast("Can't delete last AI!"); return; }
  if (!confirm('Delete this AI? All memory will be lost.')) return;
  companions = companions.filter(c => c.id !== currentId);
  saveCompanions();
  renderSidebar();
  switchCompanion(companions[0].id);
  closeScreen('profile');
}

// ─── SIDEBAR ──────────────────────────────────
function renderSidebar(filter = '') {
  const list = document.getElementById('companionsList');
  list.innerHTML = '';
  const filtered = companions.filter(c =>
    c.name.toLowerCase().includes(filter.toLowerCase())
  ).sort((a, b) => b.lastTime - a.lastTime);

  filtered.forEach(c => {
    const item = document.createElement('div');
    item.className = 'companion-item' + (c.id === currentId ? ' active' : '');
    item.onclick = () => switchCompanion(c.id);
    const time = c.lastTime ? formatTime(c.lastTime) : '';
    const personalities = (c.personalities || []).slice(0, 2).join(', ');
    item.innerHTML = `
      <div class="companion-avatar" style="background:${avatarGradient(c.avatar)}">${c.avatar}</div>
      <div class="companion-info">
        <div class="companion-row">
          <span class="companion-name">${c.name}</span>
          <span class="companion-time">${time}</span>
        </div>
        <div class="companion-preview">${c.lastMessage || personalities || 'Say hi!'}</div>
      </div>`;
    list.appendChild(item);
  });
}

function filterCompanions(val) { renderSidebar(val); }

function formatTime(ts) {
  const d = new Date(ts), now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { weekday: 'short' });
}

// ─── CHAT CACHES ──────────────────────────────
const chatCaches = {};

function switchCompanion(id) {
  // Save current chat DOM
  if (currentId) chatCaches[currentId] = document.getElementById('chat').innerHTML;

  currentId = id;
  localStorage.setItem('lovemo_current', id);

  const c = getCompanion(id);

  // Update topbar
  document.getElementById('topbarEmoji').textContent = c.avatar;
  document.getElementById('topbarName').textContent = c.name;
  document.getElementById('topbarAvatar').style.background =
avatarGradient(c.avatar);

  // Restore from memory cache or localStorage
  if (chatCaches[id]) {
    document.getElementById('chat').innerHTML = chatCaches[id];
  } else {
    document.getElementById('chat').innerHTML = '';
    loadChatFromStorage(id);
  }

  // Update sidebar active state
  renderSidebar(document.querySelector('.sidebar-search')?.value || '');

  // On mobile, show chat panel
  document.getElementById('sidebar').classList.remove('sidebar-active');
  document.getElementById('chatPanel').classList.add('panel-active');

  scrollToBottom();
}

function showSidebar() {
  document.getElementById('sidebar').classList.add('sidebar-active');
  document.getElementById('chatPanel').classList.remove('panel-active');
}

// ─── SCREENS ──────────────────────────────────
function openScreen(name) {
  document.getElementById(name + 'Screen').classList.add('active');
  if (name === 'video') startVideoCall();
  if (name === 'profile') {
    const c = getCurrentCompanion();
    document.getElementById('profileAvatarBig').textContent = c.avatar;
    document.getElementById('profileNameBig').textContent = c.name;
    const tags = document.getElementById('profileTags');
    tags.innerHTML = '';
    (c.personalities || []).forEach(p => {
      const tag = document.createElement('span');
      tag.className = 'profile-tag';
      tag.textContent = personalityLabel(p);
      tags.appendChild(tag);
    });
    const vibeTag = document.createElement('span');
    vibeTag.className = 'profile-tag profile-tag-vibe';
    vibeTag.textContent = vibeLabel(c.vibe);
    tags.appendChild(vibeTag);
    const langTag = document.createElement('span');
    langTag.className = 'profile-tag profile-tag-lang';
    langTag.textContent = langLabel(c.language);
    tags.appendChild(langTag);
    updateProfileStats();
    renderSavedGifs();
  }
}

function closeScreen(name) {
  document.getElementById(name + 'Screen').classList.remove('active');
  if (name === 'video') stopVideoCall();
}

function personalityLabel(p) {
  const map = { bff:'🤙 BFF', flirty:'😏 Flirty', deep:'🧠 Deep', sarcastic:'😈 Sarcastic', soft:'🌸 Soft', chaotic:'🤪 Chaotic', cool:'😎 Cool', hype:'🔥 Hype' };
  return map[p] || p;
}

function vibeLabel(v) {
  const map = { bestie:'💫 Bestie', romantic:'💝 Romantic', mysterious:'🌙 Mysterious', mentor:'🧑‍🏫 Mentor' };
  return map[v] || v;
}

function langLabel(l) {
  const map = { en:'🇺🇸 EN', zh:'🇨🇳 ZH', es:'🇪🇸 ES', ja:'🇯🇵 JA', ko:'🇰🇷 KO', fr:'🇫🇷 FR' };
  return map[l] || l;
}

function updateProfileStats() {
  const memory = JSON.parse(localStorage.getItem('0816_profile') || '{}');
  document.getElementById('statChats').textContent = memory.chatCount || 0;
  document.getElementById('statAffection').textContent = memory.affection || 0;
  document.getElementById('statSaved').textContent = savedGifs.length;
}

function clearMemory() {
  if (confirm('Clear all chat memory?')) {
    fetch('/clear-memory', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ companionId: currentId }) })
      .then(() => { showToast('Memory cleared 🗑️'); chatCaches[currentId] = ''; document.getElementById('chat').innerHTML = ''; });
  }
}

// ─── CALL FACE CANVAS ─────────────────────────
let callAnimFrame = null;
let eyeBlinkState = 1;
let blinkTimer = 0;
let mouthOpen = 0;

function drawCallFace(speaking) {
  const canvas = document.getElementById('callFaceCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const c = getCurrentCompanion();
  const color = avatarColor(c.avatar);

  // Blink logic
  blinkTimer++;
  if (blinkTimer > 180) { eyeBlinkState = 0; }
  if (blinkTimer > 190) { eyeBlinkState = 1; blinkTimer = 0; }

  // Mouth logic
  if (speaking) {
    mouthOpen = 0.3 + Math.abs(Math.sin(Date.now() / 120)) * 0.7;
  } else {
    mouthOpen = Math.max(0, mouthOpen - 0.05);
  }

  // Head circle
  const gradient = ctx.createRadialGradient(w*0.45, h*0.4, 10, w/2, h/2, w*0.42);
  gradient.addColorStop(0, lightenColor(color, 40));
  gradient.addColorStop(1, color);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(w/2, h/2, w*0.38, h*0.42, 0, 0, Math.PI*2);
  ctx.fill();

  // Subtle shadow
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 20;
  ctx.fillStyle = 'transparent';
  ctx.fill();
  ctx.shadowBlur = 0;

  const eyeY = h * 0.42;
  const eyeH = 9 * eyeBlinkState;

  // Eyes white
  [[w*0.37, w*0.63]].flat().forEach((ex, i) => {
    const x = i === 0 ? w*0.37 : w*0.63;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.ellipse(x, eyeY, 9, eyeH, 0, 0, Math.PI*2);
    ctx.fill();
    // Pupil
    if (eyeBlinkState > 0.2) {
      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath();
      ctx.ellipse(x + 1, eyeY + 1, 5, 5 * eyeBlinkState, 0, 0, Math.PI*2);
      ctx.fill();
      // Shine
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.ellipse(x + 3, eyeY - 2, 2, 2, 0, 0, Math.PI*2);
      ctx.fill();
    }
  });

  // Nose
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(w/2, h*0.48);
  ctx.lineTo(w*0.46, h*0.55);
  ctx.lineTo(w*0.54, h*0.55);
  ctx.stroke();

  // Mouth
  const mH = Math.max(2, mouthOpen * 12);
  ctx.fillStyle = speaking ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(w/2, h*0.63, 14, mH, 0, 0, Math.PI*2);
  ctx.fill();

  // Cheek blush (personality dependent)
  if (c.vibe === 'romantic' || c.personalities?.includes('soft')) {
    ctx.fillStyle = 'rgba(255,150,150,0.25)';
    ctx.beginPath();
    ctx.ellipse(w*0.28, h*0.54, 12, 7, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(w*0.72, h*0.54, 12, 7, 0, 0, Math.PI*2);
    ctx.fill();
  }
}

function lightenColor(hex, amount) {
  const num = parseInt(hex.replace('#',''), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}

function startCallFaceAnimation() {
  const loop = () => {
    drawCallFace(callSpeaking);
    callAnimFrame = requestAnimationFrame(loop);
  };
  callAnimFrame = requestAnimationFrame(loop);
}

function stopCallFaceAnimation() {
  if (callAnimFrame) { cancelAnimationFrame(callAnimFrame); callAnimFrame = null; }
}

// ─── VIDEO CALL ───────────────────────────────
let videoStream = null;
let callSpeaking = false;
let callInterval = null;
let callSeconds = 0;
let callTimerInterval = null;
let isMuted = false;
let isCameraOff = true;

function buildCallPhrases() {
  const c = getCurrentCompanion();
  const base = [
    "hey... so good to see you",
    "okay real talk... how are you actually doing?",
    "I was literally just thinking about you",
    "wait... okay I'm back",
    "you look great today honestly",
    "I feel like we haven't talked in forever",
  ];
  if (c.personalities?.includes('flirty') || c.vibe === 'romantic') {
    base.push("okay stop... you're making me nervous", "ngl you're kind of everything rn", "why do I get so happy when you call");
  }
  if (c.personalities?.includes('chaotic')) {
    base.push("okay WAIT I have to tell you something insane", "I cannot be normal about this call lol");
  }
  if (c.personalities?.includes('soft')) {
    base.push("I'm really glad you called... genuinely", "just wanted to say I appreciate you");
  }
  return base;
}

async function speakCallPhrase() {
  if (callSpeaking || voicePlaying) return;
  const phrases = buildCallPhrases();
  const phrase = phrases[Math.floor(Math.random() * phrases.length)];

  callSpeaking = true;
  document.getElementById('callSpeakIndicator')?.classList.add('speaking');

  try {
    const companion = getCurrentCompanion();
    const res = await fetch('/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: phrase, companion })
    });

    if (!res.ok) throw new Error('TTS failed');

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => {
      callSpeaking = false;
      document.getElementById('callSpeakIndicator')?.classList.remove('speaking');
      URL.revokeObjectURL(url);
    };
    audio.onerror = () => {
      callSpeaking = false;
      document.getElementById('callSpeakIndicator')?.classList.remove('speaking');
    };
    audio.play();
  } catch (e) {
    callSpeaking = false;
    document.getElementById('callSpeakIndicator')?.classList.remove('speaking');
    console.warn('Call voice error:', e);
  }
}

async function startVideoCall() {
  const c = getCurrentCompanion();
  isCameraOff = true; isMuted = false;
  document.getElementById('callName').textContent = c.name;
  document.getElementById('pipName').textContent = c.name;
  document.getElementById('pipAvatar').textContent = c.avatar;
  document.getElementById('videoStatus').textContent = 'Ringing... 📞';
  startCallFaceAnimation();

  try {
    videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    videoStream.getVideoTracks().forEach(t => t.enabled = false);
    const selfEl = document.querySelector('.video-self-inner');
    const video = document.createElement('video');
    video.srcObject = videoStream; video.autoplay = true; video.muted = true; video.playsInline = true;
    video.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:10px;opacity:0;';
    selfEl.innerHTML = ''; selfEl.appendChild(video);
  } catch (e) { console.warn('No media:', e); }

  const camBtn = document.getElementById('camBtn');
  if (camBtn) {
    camBtn.classList.add('vid-active');
    camBtn.querySelector('.vid-icon').innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34"/></svg>`;
    camBtn.querySelector('.vid-label').textContent = 'Camera';
  }

  setTimeout(() => {
    document.getElementById('videoStatus').textContent = 'Connected ✨';
    callSeconds = 0;
    callTimerInterval = setInterval(() => {
      callSeconds++;
      const m = Math.floor(callSeconds/60), s = callSeconds%60;
      const t = `${m}:${s.toString().padStart(2,'0')}`;
      document.getElementById('videoStatus').textContent = t;
      document.getElementById('pipTime').textContent = t;
    }, 1000);
    setTimeout(() => speakCallPhrase(), 1500);
    callInterval = setInterval(() => { if (Math.random() > 0.3) speakCallPhrase(); }, 12000 + Math.random()*6000);
  }, 1200);
}

function stopVideoCall() {
  if (videoStream) { videoStream.getTracks().forEach(t => t.stop()); videoStream = null; }
  if (callInterval) { clearInterval(callInterval); callInterval = null; }
  if (callTimerInterval) { clearInterval(callTimerInterval); callTimerInterval = null; }
  window.speechSynthesis.cancel();
  callSpeaking = false;
  stopCallFaceAnimation();
  document.querySelector('.video-self-inner').innerHTML = 'You';
  document.getElementById('videoStatus').textContent = 'Connecting...';
  document.getElementById('callPip').classList.remove('active');
  isCameraOff = false; isMuted = false;
}

function minimizeCall() {
  document.getElementById('videoScreen').classList.remove('active');
  document.getElementById('callPip').classList.add('active');
}

function expandCall() {
  document.getElementById('callPip').classList.remove('active');
  document.getElementById('videoScreen').classList.add('active');
}

let isMutedState = false, isCamOff = true;

function toggleMute(btn) {
  isMutedState = !isMutedState;
  btn.classList.toggle('vid-active', isMutedState);
  btn.querySelector('.vid-icon').innerHTML = isMutedState
    ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`
    : `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
  btn.querySelector('.vid-label').textContent = isMutedState ? 'Unmute' : 'Mute';
  if (videoStream) videoStream.getAudioTracks().forEach(t => t.enabled = !isMutedState);
}

function toggleCamera(btn) {
  isCamOff = !isCamOff;
  btn.classList.toggle('vid-active', isCamOff);
  btn.querySelector('.vid-icon').innerHTML = isCamOff
    ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34"/></svg>`
    : `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`;
  btn.querySelector('.vid-label').textContent = isCamOff ? 'Camera' : 'Hide';
  if (videoStream) {
    videoStream.getVideoTracks().forEach(t => t.enabled = !isCamOff);
    const v = document.querySelector('.video-self-inner video');
    if (v) v.style.opacity = isCamOff ? '0' : '1';
  }
}

// ─── SAVED GIFS ───────────────────────────────
let savedGifs = JSON.parse(localStorage.getItem('0816_saved_gifs') || '[]');

function saveGif(url, title) {
  if (savedGifs.find(g => g.url === url)) { showToast('Already saved!'); return; }
  savedGifs.unshift({ url, title, savedAt: Date.now() });
  if (savedGifs.length > 50) savedGifs = savedGifs.slice(0, 50);
  localStorage.setItem('0816_saved_gifs', JSON.stringify(savedGifs));
  showToast('GIF saved! 💾');
}

function renderSavedGifs() {
  const grid = document.getElementById('savedGifGrid');
  if (!grid) return;
  if (!savedGifs.length) { grid.innerHTML = '<div class="gif-loading">No saved GIFs yet</div>'; return; }
  grid.innerHTML = '';
  savedGifs.forEach(gif => {
    const wrap = document.createElement('div'); wrap.style.position = 'relative';
    const img = document.createElement('img');
    img.src = gif.url; img.className = 'gif-thumb'; img.title = gif.title;
    img.onclick = () => { sendSavedGif(gif.url, gif.title); closeScreen('profile'); };
    const del = document.createElement('button'); del.className = 'gif-delete-btn'; del.textContent = '✕';
    del.onclick = e => { e.stopPropagation(); savedGifs = savedGifs.filter(g => g.url !== gif.url); localStorage.setItem('0816_saved_gifs', JSON.stringify(savedGifs)); renderSavedGifs(); updateProfileStats(); };
    wrap.appendChild(img); wrap.appendChild(del); grid.appendChild(wrap);
  });
}

function sendSavedGif(url, title) {
  renderMessage({ type:'image', content:url, isGif:true, title }, 'user');
  sendToAI('[User sent a saved GIF: ' + (title||'meme') + ']');
}

// ─── TOAST ────────────────────────────────────
function showToast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('toast-show'), 10);
  setTimeout(() => { t.classList.remove('toast-show'); setTimeout(() => t.remove(), 300); }, 2200);
}

// ─── VOICE (ElevenLabs) ───────────────────────
let voicePlaying = false;
let currentAudio = null;

async function playVoice(text) {
  if (!text?.trim() || voicePlaying) return;

  // Clean text for TTS
  const clean = text
    .replace(/\.\.\./g, ', ')
    .replace(/omg/gi, 'oh my god')
    .replace(/lmao/gi, 'lmao')
    .replace(/ngl/gi, 'not gonna lie')
    .replace(/tbh/gi, 'to be honest')
    .replace(/fr/gi, 'for real')
    .trim();

  voicePlaying = true;

  try {
    const companion = getCurrentCompanion();
    const res = await fetch('/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: clean, companion })
    });

    if (!res.ok) {
      console.warn('TTS failed, falling back to browser voice');
      fallbackVoice(clean);
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    // Stop any currently playing audio
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }

    currentAudio = new Audio(url);
    currentAudio.onended = () => { voicePlaying = false; URL.revokeObjectURL(url); currentAudio = null; };
    currentAudio.onerror = () => { voicePlaying = false; URL.revokeObjectURL(url); };
    currentAudio.play();

  } catch (e) {
    console.warn('ElevenLabs TTS error:', e);
    fallbackVoice(clean);
  }
}

// Fallback to browser speech if ElevenLabs fails
function fallbackVoice(text) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US'; u.rate = 0.88; u.pitch = 1.1; u.volume = 1.0;
  u.onend = () => { voicePlaying = false; };
  u.onerror = () => { voicePlaying = false; };
  window.speechSynthesis.speak(u);
}

// ─── TYPING ───────────────────────────────────
function showTyping() {
  const chat = document.getElementById('chat');
  const el = document.createElement('div');
  el.className = 'typing-indicator'; el.id = 'typingIndicator';
  el.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
  chat.appendChild(el); scrollToBottom();
}
function hideTyping() { document.getElementById('typingIndicator')?.remove(); }

// ─── REPLY ────────────────────────────────────
let replyingTo = null;
function setReply(text, sender) {
  replyingTo = { text, sender };
  document.getElementById('replyBar').classList.add('active');
  document.getElementById('replyBarText').textContent = (sender==='user'?'You':'AI') + ': ' + text.slice(0,60);
  document.getElementById('input').focus();
}
function cancelReply() {
  replyingTo = null;
  window._editMode = false;
  window._editingRow = null;
  const bar = document.getElementById('replyBar');
  bar.classList.remove('active', 'edit-mode');
  document.getElementById('replyBarText').textContent = '';
  document.getElementById('input').value = '';
}

// ─── SCROLL ───────────────────────────────────
function scrollToBottom() {
  const chat = document.getElementById('chat');
  setTimeout(() => { chat.scrollTop = chat.scrollHeight; }, 50);
}

// ─── REACTIONS ────────────────────────────────
const REACTION_EMOJIS = ['❤️','😂','😮','😢','🔥','👏','😍','💀'];

function showReactionPicker(msgEl, rowEl) {
  document.querySelectorAll('.reaction-picker').forEach(p => p.remove());
  const picker = document.createElement('div'); picker.className = 'reaction-picker';
  REACTION_EMOJIS.forEach(emoji => {
    const btn = document.createElement('button'); btn.className = 'reaction-option'; btn.textContent = emoji;
    btn.onclick = () => { addReaction(msgEl, emoji); picker.remove(); };
    picker.appendChild(btn);
  });
  rowEl.appendChild(picker);
  setTimeout(() => document.addEventListener('click', () => picker.remove(), { once: true }), 10);
}

function addReaction(msgEl, emoji, fromAI = false) {
  let bar = msgEl.querySelector('.reactions');
  if (!bar) { bar = document.createElement('div'); bar.className = 'reactions'; msgEl.appendChild(bar); }
  const ex = [...bar.querySelectorAll('.reaction-bubble')].find(b => b.dataset.emoji === emoji);
  if (ex) {
    const n = parseInt(ex.dataset.count||1)+1; ex.dataset.count = n;
    ex.querySelector('.reaction-count').textContent = n>1?n:'';
    ex.classList.add('reaction-pop'); setTimeout(()=>ex.classList.remove('reaction-pop'),300);
  } else {
    const b = document.createElement('div'); b.className='reaction-bubble reaction-pop'; b.dataset.emoji=emoji; b.dataset.count=1;
    b.innerHTML=`${emoji}<span class="reaction-count"></span>`; b.onclick=()=>addReaction(msgEl,emoji);
    bar.appendChild(b); setTimeout(()=>b.classList.remove('reaction-pop'),300);
  }
  if (!fromAI) {
    const row = msgEl.closest('.msg-row');
    const isAI = row?.classList.contains('ai');
    const imgEl = msgEl.querySelector('img');
    const textEl = msgEl.querySelector('.msg-text-inner');
    const desc = imgEl ? (imgEl.dataset.description||imgEl.title||'the meme you sent') : (textEl?.textContent.slice(0,50)||'your message');
    clearTimeout(window._reactTimeout);
    window._reactTimeout = setTimeout(() => {
      sendToAI(`[User reacted ${emoji} to ${isAI?'your':'their own'} message: "${desc}". React naturally, don't ask for clarification]`);
    }, 800);
  }
}

function addReactionToLastUserMsg(emoji) {
  const rows = document.querySelectorAll('.msg-row.user');
  if (rows.length) addReaction(rows[rows.length-1].querySelector('.msg'), emoji, true);
}

// ─── GIF VISION ───────────────────────────────
async function describeGif(url) {
  try {
    const res = await fetch('/describe-gif', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: url })
    });
    const data = await res.json();
    return data; // returns full { description, text, people, vibe, context }
  } catch { return { description: 'a meme', text: '', people: '', vibe: 'funny' }; }
}

function buildGifContext(data) {
  if (typeof data === 'string') return data;
  let ctx = data.description || 'a meme';
  if (data.people) ctx += `. Features: ${data.people}`;
  if (data.text) ctx += `. Text in image: "${data.text}"`;
  if (data.vibe) ctx += `. Vibe: ${data.vibe}`;
  return ctx;
}

// ─── GIF TIKTOK ACTIONS ───────────────────────
function createGifActions(gifUrl, title) {
  const actions = document.createElement('div'); actions.className = 'gif-actions-tiktok';
  const buttons = [
    { svg:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`, svgFilled:`<svg viewBox="0 0 24 24" fill="#ff2d55" stroke="#ff2d55" stroke-width="2" width="24" height="24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`, label:'Like', cls:'like', action:(btn)=>{ btn.classList.toggle('liked'); btn.querySelector('.tik-icon').innerHTML=btn.classList.contains('liked')?btn._svgFilled:btn._svg; btn.querySelector('.tik-label').textContent=btn.classList.contains('liked')?'Liked':'Like'; }},
    { svg:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`, label:'Save', cls:'save', action:(btn)=>{ saveGif(gifUrl,title||'meme'); btn.querySelector('.tik-icon').innerHTML=`<svg viewBox="0 0 24 24" fill="#30d158" stroke="#30d158" stroke-width="2" width="24" height="24"><polyline points="20 6 9 17 4 12"/></svg>`; btn.querySelector('.tik-label').textContent='Saved!'; }},
    { svg:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`, label:'Share', cls:'share', action:(btn)=>{ navigator.clipboard?.writeText(gifUrl); btn.querySelector('.tik-label').textContent='Copied!'; setTimeout(()=>btn.querySelector('.tik-label').textContent='Share',1500); }},
  ];
  buttons.forEach(({svg,svgFilled,label,cls,action})=>{
    const btn=document.createElement('button'); btn.className=`tik-btn tik-${cls}`; btn._svg=svg; btn._svgFilled=svgFilled||svg;
    btn.innerHTML=`<span class="tik-icon">${svg}</span><span class="tik-label">${label}</span>`;
    btn.onclick=()=>action(btn); actions.appendChild(btn);
  });
  return actions;
}


// ─── CUSTOM CONFIRM ───────────────────────────
function showConfirm(message, onConfirm) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:#1a1a2e;border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:24px;width:280px;text-align:center;">
      <div style="font-size:15px;color:#f0f0f0;margin-bottom:20px;">${message}</div>
      <div style="display:flex;gap:10px;">
        <button id="confirmCancel" style="flex:1;padding:10px;border-radius:12px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);color:#f0f0f0;cursor:pointer;font-size:14px;">Cancel</button>
        <button id="confirmOk" style="flex:1;padding:10px;border-radius:12px;border:none;background:#ff3b30;color:#fff;cursor:pointer;font-size:14px;font-weight:600;">Delete</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#confirmCancel').onclick = () => overlay.remove();
  overlay.querySelector('#confirmOk').onclick = () => { overlay.remove(); onConfirm(); };
}


// ─── SYNC HISTORY TO SERVER ───────────────────
async function syncHistoryToServer() {
  // Rebuild history from visible DOM messages
  const chat = document.getElementById('chat');
  const messages = [];
  chat.querySelectorAll('.msg-row').forEach(row => {
    const sender = row.classList.contains('user') ? 'user' : 'assistant';
    const textEl = row.querySelector('.translate-content') || row.querySelector('.msg-text-inner');
    const voiceEl = row.querySelector('.voice-text');
    if (textEl?.textContent?.trim()) {
      messages.push({ role: sender, content: textEl.textContent.trim() });
    } else if (voiceEl?.textContent?.trim()) {
      messages.push({ role: sender, content: voiceEl.textContent.trim() });
    }
  });
  try {
    await fetch('/sync-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companionId: currentId, messages })
    });
  } catch(e) { console.warn('Sync failed:', e); }
}

// ─── RENDER MESSAGE ───────────────────────────
function renderMessage(item, sender) {
  const chat = document.getElementById('chat');
  const div = document.createElement('div'); div.className = `msg ${sender}`;

  if (item.type === 'text') {
    const c = getCurrentCompanion();
    const showTranslate = c.language !== 'en';
    const wrap = document.createElement('div');
    wrap.className = 'translate-wrap';
    const tc = document.createElement('div');
    tc.className = 'msg-text-inner translate-content';
    tc.textContent = item.content;
    wrap.appendChild(tc);
    if (showTranslate) {
      const gb = document.createElement('button');
      gb.className = 'translate-btn';
      gb.title = 'Translate';
      gb.textContent = '🌐';
      gb.dataset.origText = item.content;
      gb.onclick = function() { translateText(this.dataset.origText, 'en', this); };
      wrap.appendChild(gb);
    }
    div.appendChild(wrap);
  } else if (item.type === 'emoji-reaction') {
    div.className += ' msg-emoji-react'; div.textContent = item.content;
  } else if (item.type === 'image' || item.type === 'image-upload') {
    div.className += ' msg-image';
    if (item.isGif) {
      div.style.cssText = 'display:flex;align-items:flex-end;gap:8px;background:none;border:none;padding:0;';
      const img = document.createElement('img');
      img.src = item.content; img.title = item.title||'meme'; img.alt = item.title||'meme';
      img.style.cssText = 'width:220px;height:180px;object-fit:cover;border-radius:16px;display:block;flex-shrink:0;';
      img.onerror = ()=>{ img.src='https://via.placeholder.com/220x180?text=GIF'; };
      div.appendChild(img); div.appendChild(createGifActions(item.content, item.title||'meme'));
      if (sender === 'ai') {
        describeGif(item.content).then(data => {
          const ctx = buildGifContext(data);
          img.dataset.description = ctx;
          img.dataset.text = data.text || '';
          img.dataset.people = data.people || '';
          img.dataset.vibe = data.vibe || '';
          img.title = ctx;
          img.alt = ctx;
        });
      }
    } else {
      const img = document.createElement('img'); img.src = item.content;
      img.style.cssText = 'width:240px;height:180px;object-fit:cover;border-radius:16px;display:block;';
      img.onerror = ()=>{ img.src='https://via.placeholder.com/240x180?text=📷'; };
      div.appendChild(img);
    }
  } else if (item.type === 'voice') {
    div.className += ' msg-voice-wrap';
    const voiceText = item.textToRead || '';
    const c = getCurrentCompanion();
    const showTranslate = c.language !== 'en';

    const voiceBar = document.createElement('div');
    voiceBar.className = 'msg-voice';
    voiceBar.innerHTML = `
      <button class="voice-play" onclick="playVoiceBar(this)">
        <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
      </button>
      <div class="voice-waves">
        <div class="wave-bar"></div><div class="wave-bar"></div>
        <div class="wave-bar"></div><div class="wave-bar"></div>
        <div class="wave-bar"></div><div class="wave-bar"></div>
      </div>
      <span class="voice-duration">${item.content||'0:02'}</span>
      <button class="voice-transcript-btn" onclick="toggleTranscript(this)" title="Show text">
        Aa
      </button>
      <span class="voice-text" style="display:none">${voiceText}</span>`;

    // Transcript panel with translate option
    const transcriptWrap = document.createElement('div');
    transcriptWrap.className = 'voice-transcript';
    transcriptWrap.style.display = 'none';
    transcriptWrap.innerHTML = `
      <div class="translate-wrap">
        <div class="translate-content">${escapeHtml(voiceText)}</div>
        ${showTranslate ? `<button class="translate-btn small" title="Translate" onclick="translateText('${escapeHtml(voiceText).replace(/'/g, "\'")}', 'en', this)">🌐</button>` : ''}
      </div>`;

    div.appendChild(voiceBar);
    div.appendChild(transcriptWrap);
  }

  const row = document.createElement('div'); row.className = 'msg-row ' + sender;
  const actEl = document.createElement('div'); actEl.className = 'msg-actions';

  const replyBtn = document.createElement('button'); replyBtn.className = 'msg-action-btn'; replyBtn.title = 'Reply'; replyBtn.innerHTML = '↩';
  replyBtn.onclick = () => {
    const t = (item.type==='image'||item.type==='image-upload') ? (item.title||'meme') : (item.content||'message');
    setReply(t, sender);
  };
  actEl.appendChild(replyBtn);

  const reactBtn = document.createElement('button'); reactBtn.className = 'msg-action-btn'; reactBtn.title = 'React'; reactBtn.innerHTML = '😊';
  reactBtn.onclick = e => { e.stopPropagation(); showReactionPicker(div, row); };
  actEl.appendChild(reactBtn);

  // Delete button
  const delBtn = document.createElement('button');
  delBtn.className = 'msg-action-btn tik-action-btn';
  delBtn.title = 'Delete';
  delBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';
  delBtn.onclick = () => {
    showConfirm('Delete this message?', () => {
      row.style.opacity = '0';
      row.style.transform = 'scale(0.9)';
      row.style.transition = 'all 0.2s';
      setTimeout(() => {
        row.remove();
        saveChatToStorage();
        syncHistoryToServer(); // update server memory
      }, 200);
    });
  };
  actEl.appendChild(delBtn);

  // Edit button (user text only)
  if (sender === 'user' && item.type === 'text') {
    const contentEl = div.querySelector('.translate-content') || div.querySelector('.msg-text-inner');
    const editBtn = document.createElement('button');
    editBtn.className = 'msg-action-btn tik-action-btn';
    editBtn.title = 'Edit';
    editBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
    editBtn.onclick = () => {
      const txt = contentEl ? contentEl.textContent.trim() : (item.content || '');
      document.getElementById('input').value = txt;
      document.getElementById('input').focus();
      window._editingRow = row;
      window._editMode = true;
      replyingTo = null;
      const bar = document.getElementById('replyBar');
      bar.classList.add('active', 'edit-mode');
      document.getElementById('replyBarText').textContent = txt.slice(0, 50);
    };
    actEl.appendChild(editBtn);
  }

  if (item.replyTo) {
    const q = document.createElement('div'); q.className = 'reply-quote';
    q.textContent = (item.replyTo.sender==='user'?'You':'AI') + ': ' + item.replyTo.text.slice(0,60);
    div.insertBefore(q, div.firstChild);
  }

  if (sender === 'user') { row.appendChild(actEl); row.appendChild(div); }
  else { row.appendChild(div); row.appendChild(actEl); }

  chat.appendChild(row); scrollToBottom();
}

function escapeHtml(t) { return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ─── VOICE BAR ────────────────────────────────
function playVoiceBar(btn) {
  // Find msg-voice container
  let el = btn;
  while (el && !el.classList.contains('msg-voice')) el = el.parentElement;
  if (!el) return;
  const text = el.querySelector('.voice-text')?.innerText?.trim()
             || el.querySelector('.voice-text')?.textContent?.trim();
  console.log('Playing voice bar:', text?.slice(0, 50));
  if (text) { animateWaves(el); playVoice(text); }
}

function animateWaves(el) {
  const bars = el.querySelectorAll('.wave-bar'); let tick = 0;
  const iv = setInterval(()=>{ bars.forEach((b,i)=>b.classList.toggle('active',(tick+i)%3!==0)); tick++; }, 120);
  setTimeout(()=>{ clearInterval(iv); bars.forEach(b=>b.classList.remove('active')); }, 2400);
}

// ─── GIF PICKER ───────────────────────────────
let gifPickerOpen = false, currentGifTab = 'trending';

function toggleGifPicker() {
  gifPickerOpen = !gifPickerOpen;
  document.getElementById('gifPicker').classList.toggle('active', gifPickerOpen);
  if (gifPickerOpen && currentGifTab === 'trending') loadTrendingGifs();
  if (gifPickerOpen && currentGifTab === 'saved') renderSavedGifsInPicker();
}

function switchGifTab(tab, btn) {
  currentGifTab = tab;
  document.querySelectorAll('.gif-tab').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
  tab === 'trending' ? loadTrendingGifs() : renderSavedGifsInPicker();
}

function renderSavedGifsInPicker() {
  const grid = document.getElementById('gifGrid');
  if (!savedGifs.length) { grid.innerHTML = '<div class="gif-loading">No saved GIFs yet<br><small>Tap 💾 Save on any GIF</small></div>'; return; }
  grid.innerHTML = '';
  savedGifs.forEach(gif => {
    const img = document.createElement('img'); img.src=gif.url; img.className='gif-thumb'; img.title=gif.title;
    img.onclick = ()=>sendGif(gif.url,gif.title); grid.appendChild(img);
  });
}

async function loadTrendingGifs() {
  const grid = document.getElementById('gifGrid');
  grid.innerHTML = '<div class="gif-loading">Loading...</div>';
  try { const r=await fetch('/giphy/trending'); const d=await r.json(); renderGifGrid(d.gifs); }
  catch { grid.innerHTML = '<div class="gif-loading">Failed 😅</div>'; }
}

async function searchGifs(q) {
  if (!q.trim()) { loadTrendingGifs(); return; }
  const grid = document.getElementById('gifGrid');
  grid.innerHTML = '<div class="gif-loading">Searching...</div>';
  try { const r=await fetch(`/giphy/search?q=${encodeURIComponent(q)}`); const d=await r.json(); renderGifGrid(d.gifs); }
  catch { grid.innerHTML = '<div class="gif-loading">Failed 😅</div>'; }
}

function renderGifGrid(gifs) {
  const grid = document.getElementById('gifGrid');
  if (!gifs?.length) { grid.innerHTML = '<div class="gif-loading">No GIFs found</div>'; return; }
  grid.innerHTML = '';
  gifs.forEach(gif => {
    const img = document.createElement('img'); img.src=gif.preview; img.className='gif-thumb'; img.title=gif.title;
    img.onclick=()=>sendGif(gif.url,gif.title); grid.appendChild(img);
  });
}

async function sendGif(url, title) {
  toggleGifPicker();
  renderMessage({ type:'image', content:url, isGif:true, title }, 'user');

  // Describe it so AI knows what it is
  const data = await describeGif(url);
  const ctx = buildGifContext(data);
  sendToAI(`[User sent a GIF/meme — vision analysis: ${ctx}. Respond naturally to this specific meme, reference what you see in it]`);
}

// ─── SEND ─────────────────────────────────────
async function sendMessage() {
  const input = document.getElementById('input'); const msg = input.value.trim(); if (!msg) return;
  const item = { type:'text', content:msg };
  if (replyingTo) { item.replyTo = replyingTo; cancelReply(); }
  renderMessage(item, 'user'); input.value = '';

  // Update sidebar preview
  const c = getCurrentCompanion(); c.lastMessage = msg; c.lastTime = Date.now();
  saveCompanions(); renderSidebar();

  sendToAI(msg);
  setTimeout(saveChatToStorage, 100);
}

async function sendToAI(text) {
  showTyping();
  const c = getCurrentCompanion();
  try {
    const res = await fetch('http://localhost:3000/chat', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ message:text, companionId:c.id, companion:c })
    });
    hideTyping();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.profile) localStorage.setItem('0816_profile', JSON.stringify(data.profile));
    (data.messages||[]).forEach(m => renderMessage(m, 'ai'));
    if (data.emojiReaction) setTimeout(()=>addReactionToLastUserMsg(data.emojiReaction), 600);
    setTimeout(saveChatToStorage, 500);

    // Update last message from AI
    if (data.messages?.[0]?.type === 'text') {
      c.lastMessage = data.messages[0].content.slice(0,40); c.lastTime = Date.now();
      saveCompanions(); renderSidebar();
    }
  } catch(e) {
    hideTyping(); renderMessage({type:'text',content:'Oops! Lost connection 🌙'}, 'ai');
  }
}

// ─── SPEECH RECOGNITION ───────────────────────
let recognition = null, recognitionActive = false;
const SpeechAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechAPI) {
  recognition = new SpeechAPI(); recognition.lang='en-US'; recognition.continuous=false; recognition.interimResults=false;
  recognition.onstart=()=>{ recognitionActive=true; document.getElementById('recordBtn').classList.add('recording'); };
  recognition.onend=()=>{ recognitionActive=false; document.getElementById('recordBtn').classList.remove('recording'); };
  recognition.onresult=e=>{ const t=Array.from(e.results).map(r=>r[0].transcript).join(''); if(t.trim()){ renderMessage({type:'text',content:t},'user'); sendToAI(t); } };
  recognition.onerror=()=>{ recognitionActive=false; document.getElementById('recordBtn').classList.remove('recording'); };
}
document.getElementById('recordBtn').addEventListener('click',()=>{
  if (!recognition) return;
  if (recognitionActive) recognition.abort(); else try { recognition.start(); } catch {}
});

// ─── IMAGE UPLOAD ─────────────────────────────
document.getElementById('fileInput').addEventListener('change', async () => {
  const file = document.getElementById('fileInput').files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;
    renderMessage({ type:'image-upload', content:dataUrl }, 'user');

    // Auto-describe uploaded image with vision
    showTyping();
    try {
      const data = await describeGif(dataUrl);
      hideTyping();
      const ctx = buildGifContext(data);
      sendToAI(`[User sent an image — vision analysis: ${ctx}. React naturally to what you see, be specific about the content]`);
    } catch {
      hideTyping();
      const d = prompt('Describe this image (optional):');
      if (d?.trim()) sendToAI('User sent an image: ' + d);
    }
  };
  reader.readAsDataURL(file);
});

// ─── INIT ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('input')?.addEventListener('keydown', e => { if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendMessage(); } });
  let st;
  document.getElementById('gifSearch')?.addEventListener('input', e => { clearTimeout(st); st=setTimeout(()=>searchGifs(e.target.value),400); });

  renderSidebar();

  // On mobile, start at sidebar; on desktop show chat
  if (window.innerWidth > 640) {
    switchCompanion(currentId);
    document.getElementById('chatPanel').classList.add('panel-active');
  } else {
    document.getElementById('sidebar').classList.add('sidebar-active');
  }
});


// ─── MESSAGE ACTIONS: DELETE & EDIT ───────────
function deleteMessage(row) {
  if (!confirm('Delete this message?')) return;
  row.style.animation = 'msgOut 0.2s ease forwards';
  setTimeout(() => { row.remove(); saveChatToStorage(); }, 200);
}

function editMessage(row, originalText) {
  const input = document.getElementById('input');
  // Fill input with original text
  input.value = originalText;
  input.focus();

  // Mark row as being edited
  row.classList.add('editing');

  // Store reference to edited row
  window._editingRow = row;
  window._editingOriginal = originalText;

  // Show edit indicator in reply bar
  const bar = document.getElementById('replyBar');
  const barText = document.getElementById('replyBarText');
  bar.classList.add('active');
  bar.classList.add('edit-mode');
  barText.textContent = 'Editing: ' + originalText.slice(0, 50);

  // Override send to handle edit
  window._editMode = true;
}

function cancelEdit() {
  window._editMode = false;
  window._editingRow = null;
  window._editingOriginal = null;
  document.getElementById('replyBar').classList.remove('active', 'edit-mode');
  document.getElementById('replyBarText').textContent = '';
  document.getElementById('input').value = '';
}

// ─── TRANSLATE ────────────────────────────────
async function translateText(text, targetLang, btn) {
  if (!text?.trim()) return;
  const original = btn.dataset.original || null;
  if (original) {
    const container = btn.closest('.translate-wrap');
    if (container) container.querySelector('.translate-content').textContent = original;
    btn.dataset.original = '';
    btn.textContent = '🌐';
    btn.title = 'Translate';
    return;
  }
  const origText = btn.textContent;
  btn.textContent = '⏳';
  btn.disabled = true;
  try {
    const res = await fetch('/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLang: targetLang || 'en' })
    });
    const data = await res.json();
    const container = btn.closest('.translate-wrap');
    const contentEl = container?.querySelector('.translate-content');
    if (contentEl) {
      btn.dataset.original = contentEl.textContent;
      contentEl.textContent = data.translated;
    }
    btn.textContent = '↩️';
    btn.title = 'Show original';
  } catch {
    showToast('Translation failed 😅');
    btn.textContent = origText;
  } finally {
    btn.disabled = false;
  }
}

// ─── VOICE TRANSCRIPT ─────────────────────────
function toggleTranscript(btn) {
  const voiceWrap = btn.closest('.msg-voice-wrap') || btn.closest('.msg');
  const transcript = voiceWrap?.querySelector('.voice-transcript');
  if (!transcript) return;
  const isVisible = transcript.style.display !== 'none';
  transcript.style.display = isVisible ? 'none' : 'block';
  btn.classList.toggle('active', !isVisible);
}

// ─── CHAT HISTORY PERSISTENCE ─────────────────
const CHAT_STORAGE_KEY = 'lovemo_chat_history';

function saveChatToStorage() {
  const chat = document.getElementById('chat');
  if (!chat) return;
  const stored = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '{}');
  // Save simplified version - just text content per companion
  const messages = [];
  chat.querySelectorAll('.msg-row').forEach(row => {
    const sender = row.classList.contains('user') ? 'user' : 'ai';
    const textEl = row.querySelector('.msg-text-inner .translate-content, .msg-text-inner');
    const voiceEl = row.querySelector('.voice-text');
    const imgEl = row.querySelector('img');
    if (textEl) messages.push({ type: 'text', sender, content: textEl.textContent });
    else if (voiceEl) messages.push({ type: 'voice', sender, content: '0:02', textToRead: voiceEl.textContent });
    else if (imgEl && imgEl.src) messages.push({ type: 'image', sender, content: imgEl.src, isGif: true, title: imgEl.title });
  });
  stored[currentId] = messages.slice(-60); // keep last 60
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(stored));
}

function loadChatFromStorage(id) {
  const stored = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '{}');
  const messages = stored[id] || [];
  if (!messages.length) return;
  const chat = document.getElementById('chat');
  chat.innerHTML = '';
  messages.forEach(msg => renderMessage(msg, msg.sender));
}
window.translateText = translateText;
window.deleteMessage = deleteMessage;
window.editMessage = editMessage;
window.cancelEdit = cancelEdit;
window.toggleTranscript = toggleTranscript;
