console.log("chatty-ai v6.0 - Multi-Companion");

// ─── COMPANIONS ────────────────────────────────
let companions = JSON.parse(localStorage.getItem('chatty-ai_companions') || 'null');
if (!companions) {
  companions = [{
    id: '0816', name: '0816', avatar: '👻',
    personalities: ['bff'], vibe: 'bestie',
    language: 'en', gender: 'female',
    created: Date.now(), lastMessage: 'hey! 👋', lastTime: Date.now()
  }];
  saveCompanions();
}
let currentId = localStorage.getItem('chatty-ai_current') || companions[0].id;

function saveCompanions() {
  localStorage.setItem('chatty-ai_companions', JSON.stringify(companions));
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
let modalVoiceStyle = 'auto';
let modalFacePreset = 'auto';
let modalFaceName = '';
let modalFaceCustomUrl = '';
let modalCatchphrase = '';
let modalDialogueSample = '';
let modalDialoguePerson = '';
let editingId = null;

function selectVoice(btn) {
  document.querySelectorAll('.voice-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  modalVoiceStyle = btn.dataset.voice;
}

function renderFacePresets() {
  const grid = document.getElementById('facePresetGrid');
  if (!grid) return;

  // Character presets (charType set) are search-only — show only when selected
  let visible = FACE_PRESETS.filter(p => {
    if (p.charType) return p.id === modalFacePreset;
    return p.gender === 'any' || p.gender === modalGender;
  });

  // Always keep 'auto' first, then language-matches, then others
  visible.sort((a, b) => {
    if (a.id === 'auto') return -1;
    if (b.id === 'auto') return 1;
    const aMatch = a.langs?.includes(modalLang) ? 0 : 1;
    const bMatch = b.langs?.includes(modalLang) ? 0 : 1;
    return aMatch - bMatch;
  });

  // Custom name entry: show a pravatar seeded by the typed name
  let customHtml = '';
  if (modalFaceName) {
    const url = `https://i.pravatar.cc/400?u=${encodeURIComponent(modalFaceName.toLowerCase())}`;
    modalFaceCustomUrl = url;
    customHtml = `
      <button class="face-preset-btn ${modalFacePreset === 'custom' ? 'selected' : ''}"
              data-face="custom" onclick="selectFacePreset(this)">
        <img class="face-preset-thumb" src="${url}" alt="${modalFaceName}" loading="lazy">
        <span class="face-preset-name">${modalFaceName}</span>
        <span class="face-preset-vibe">Custom</span>
      </button>`;
  }

  const charBadge = { anime:'⚔️', game:'🎮', fiction:'📖' };
  grid.innerHTML = visible.map(p => `
    <button class="face-preset-btn ${modalFacePreset === p.id ? 'selected' : ''}"
            data-face="${p.id}" onclick="selectFacePreset(this)">
      ${p.charType ? `<span class="face-char-badge face-char-${p.charType}">${charBadge[p.charType]}</span>` : ''}
      ${p.url
        ? `<img class="face-preset-thumb" src="${p.url}" alt="${p.name}" loading="lazy">`
        : `<div class="face-preset-thumb face-preset-auto">✨</div>`}
      <span class="face-preset-name">${p.name}</span>
      <span class="face-preset-vibe">${p.vibe}</span>
    </button>`).join('') + customHtml;
}

const SMART_KEYWORDS = {
  region: {
    western:    ['western','european','american','british','french','italian','blonde','white'],
    asian:      ['asian','korean','japanese','chinese','kpop','k-pop','jpop','j-pop','cpop','c-pop','idol','anime','east asian'],
    southasian: ['indian','south asian','desi','bollywood','hindi','pakistani'],
    black:      ['black','african','dark skin','melanin','caribbean'],
    latino:     ['latin','hispanic','mexican','brazilian','colombian','spanish'],
  },
  style: {
    glam:    ['glam','glamorous','celebrity','gorgeous','luxury','fashion','chic','elegant','classy','model','runway','star'],
    bold:    ['bold','fierce','edgy','rock','punk','badass','powerful','strong','confident','rebel','action'],
    soft:    ['soft','cute','kawaii','sweet','gentle','innocent','dreamy','romantic','pastel'],
    natural: ['natural','casual','everyday','simple','clean','fresh','real','approachable'],
  },
  // Character name aliases for smart matching
  charAlias: {
    ca_zero2:    ['zero two','002','darling franxx','darling'],
    ca_rem:      ['rem','rezero','re zero','maid'],
    ca_mikasa:   ['mikasa','attack titan','aot','ackerman'],
    ca_megumin:  ['megumin','explosion','konosuba','crimson'],
    ca_aqua:     ['aqua','goddess','konosuba'],
    ca_asuna:    ['asuna','sao','sword art','kirito'],
    ca_nezuko:   ['nezuko','demon slayer','kimetsu'],
    ca_2b:       ['2b','nier','automata','android warrior'],
    ca_jinx:     ['jinx','arcane','lol','league of legends'],
    ca_hutao:    ['hu tao','hutao','genshin','funeral'],
    ca_ahri:     ['ahri','nine tail','ninetail','fox girl','lol'],
    ca_hermione: ['hermione','granger','harry potter','hogwarts'],
    ca_arya:     ['arya','stark','game of thrones','got','assassin'],
    ca_gojo:     ['gojo','satoru','jjk','jujutsu kaisen','six eyes','infinity'],
    ca_levi:     ['levi','captain levi','aot','attack titan','survey corps'],
    ca_kakashi:  ['kakashi','copy ninja','naruto','hatake','sharingan'],
    ca_deku:     ['deku','midoriya','mha','my hero academia','plus ultra'],
    ca_vegeta:   ['vegeta','dbz','dragon ball','saiyan','prince vegeta'],
    ca_nanami:   ['nanami','kento','jjk','salaryman'],
    ca_zoro:     ['zoro','roronoa','one piece','three sword','swordsman'],
    ca_itachi:   ['itachi','uchiha','naruto','crow','akatsuki'],
    ca_luffy:    ['luffy','one piece','pirate king','straw hat'],
    ca_geralt:   ['geralt','witcher','white wolf','rivia'],
    ca_cloud:    ['cloud','strife','ff7','final fantasy','soldier'],
    ca_kazuha:   ['kazuha','genshin','anemo','samurai poet'],
    ca_sherlock: ['sherlock','holmes','detective','watson','baker street'],
    ca_ironman:  ['iron man','tony stark','stark','avenger'],
    ca_batman:   ['batman','bruce wayne','dark knight','gotham'],
    ca_natsume:  ['natsume','takashi','book of friends','natsume yuujinchou','spirit'],
    ca_nyanko:   ['nyanko','nyanko sensei','madara','sensei cat','lucky cat spirit'],
    ca_natori:   ['natori','shuichi','actor exorcist','natsume exorcist'],
    ca_reiko:    ['reiko','reiko natsume','grandmother','book creator','lonely spirit'],
    ca_tanuma:   ['tanuma','kaname','natsume friend','empath'],
    ca_bocchi:   ['bocchi','hitori','gotoh','shy guitarist','kessoku','btr','lonely rock'],
    ca_nijika:   ['nijika','ijichi','drummer','kessoku band'],
    ca_ryo:      ['ryo','yamada','bass','bassist','kessoku'],
    ca_kita:     ['kita','ikuyo','vocalist','kessoku frontwoman'],
    ca_sparrow:  ['jack sparrow','sparrow','captain jack','pirates caribbean','rum'],
    ca_joker_dk: ['joker','dark knight','heath ledger','why so serious','chaos agent'],
    ca_bond:     ['james bond','bond','007','spy','licensed to kill'],
    ca_hannibal: ['hannibal','lecter','hannibal lecter','silence lambs','cannibal'],
    ca_tyler:    ['tyler durden','tyler','fight club','project mayhem','soap'],
    ca_walter:   ['walter white','heisenberg','breaking bad','say my name','chemistry'],
    ca_wednesday:['wednesday','wednesday addams','addams family','pale darkness','braids'],
    ca_eleven:   ['eleven','el','stranger things','eggo','psychic','demogorgon'],
    ca_light:    ['light yagami','light','kira','death note','god new world'],
    ca_l:        ['l lawliet','l detective','ryuzaki','death note','sweets'],
    ca_sebastian:['sebastian','michaelis','butler','black butler','kuroshitsuji'],
    ca_dazai:    ['dazai','dazai osamu','bsd','bungo stray dogs','bandages','suicidal'],
    ca_chuuya:   ['chuuya','nakahara','bsd','port mafia','calamity','hat'],
    ca_sukuna:   ['sukuna','ryomen','king of curses','jjk','jujutsu','tattoos'],
    ca_megumi:   ['megumi','fushiguro','ten shadows','jjk','shikigami'],
    ca_bakugo:   ['bakugo','kacchan','katsuki','explosion','mha','my hero','baku'],
    ca_tamaki:   ['tamaki','suoh','ouran','host club','king','princely'],
    ca_kyoya:    ['kyoya','ootori','shadow king','ouran','host club','glasses'],
    ca_makima:   ['makima','control devil','chainsaw man','csm'],
    ca_power:    ['power','blood devil','fiend','chainsaw man','csm'],
    ca_yor:      ['yor','yor forger','thorn princess','spy family','assassin mom'],
    ca_loid:     ['loid','loid forger','twilight','spy family','phantom'],
    ca_dio:      ['dio','dio brando','za warudo','jojo','vampire','time stop'],
    ca_zenitsu:  ['zenitsu','agatsuma','thunder','demon slayer','coward','yellow'],
    ca_toga:     ['toga','himiko','toga himiko','mha','villain','blood quirk'],
  },
};

function smartFaceMatch(query) {
  const q = query.toLowerCase();
  // Check character alias match first
  for (const [id, aliases] of Object.entries(SMART_KEYWORDS.charAlias || {})) {
    if (aliases.some(a => q.includes(a) || a.includes(q))) {
      const p = FACE_PRESETS.find(fp => fp.id === id);
      if (p && (p.gender === 'any' || p.gender === modalGender)) return { type:'preset', id };
    }
  }
  // Check exact or partial name match in library
  const nameMatch = FACE_PRESETS.find(p =>
    p.id !== 'auto' && (p.gender === 'any' || p.gender === modalGender) &&
    p.name.toLowerCase().includes(q)
  );
  if (nameMatch) return { type:'preset', id:nameMatch.id };

  // Check vibe keyword match
  const vibeMatch = FACE_PRESETS.find(p =>
    p.id !== 'auto' && (p.gender === 'any' || p.gender === modalGender) &&
    p.vibe.toLowerCase().split(/\s+/).some(w => q.includes(w) && w.length > 3)
  );
  if (vibeMatch) return { type:'preset', id:vibeMatch.id };

  // Score region + style from keywords
  let region = null, style = null;
  for (const [r, kws] of Object.entries(SMART_KEYWORDS.region)) {
    if (kws.some(kw => q.includes(kw))) { region = r; break; }
  }
  for (const [s, kws] of Object.entries(SMART_KEYWORDS.style)) {
    if (kws.some(kw => q.includes(kw))) { style = s; break; }
  }

  if (region || style) return { type:'studio', region: region||'western', style: style||'natural' };
  return null;
}

function onFaceNameInput(val) {
  modalFaceName = val.trim();
  if (!modalFaceName) {
    if (modalFacePreset === 'custom') modalFacePreset = 'auto';
    renderFacePresets();
    return;
  }

  // Try smart match if 3+ chars
  if (modalFaceName.length >= 3) {
    const match = smartFaceMatch(modalFaceName);
    if (match?.type === 'preset') {
      modalFacePreset = match.id;
      modalFaceName = '';
      renderFacePresets();
      return;
    }
    if (match?.type === 'studio') {
      faceStudioRegion = match.region;
      faceStudioStyle = match.style;
      modalFacePreset = 'custom';
      modalFaceCustomUrl = getFaceStudioUrl();
      modalFaceName = '';
      renderFacePresets();
      return;
    }
  }

  // Fallback: generate face from typed name as seed
  modalFacePreset = 'custom';
  const url = `https://i.pravatar.cc/400?u=${encodeURIComponent(modalFaceName.toLowerCase())}`;
  modalFaceCustomUrl = url;
  renderFacePresets();
}

function handleDialogueUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 500000) { showToast('File too large — max 500KB'); input.value = ''; return; }
  const reader = new FileReader();
  reader.onload = e => {
    const raw = e.target.result.trim();
    modalDialogueSample = raw.slice(0, 4000);
    const lines = raw.split('\n').filter(l => l.trim()).length;
    const status = document.getElementById('dialogueStatus');
    if (status) {
      status.style.display = 'flex';
      const t = status.querySelector('.dialogue-status-text');
      if (t) t.textContent = `✅ ${lines} lines loaded — style ready`;
    }
    input.value = '';
    showToast('Chat style uploaded ✨');
  };
  reader.readAsText(file);
}

function clearDialogueSample() {
  modalDialogueSample = '';
  const status = document.getElementById('dialogueStatus');
  if (status) status.style.display = 'none';
  showToast('Style cleared');
}

function handleFaceUpload(input) {
  const file = input.files[0];
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxH = 500, ratio = Math.min(maxH / img.height, maxH / img.width, 1);
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      modalFacePreset = 'custom';
      modalFaceCustomUrl = canvas.toDataURL('image/jpeg', 0.85);
      modalFaceName = '';
      const inp = document.getElementById('faceNameInput');
      if (inp) inp.value = '';
      renderFacePresets();
      showToast('Photo uploaded ✨');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ─── FACE STUDIO ──────────────────────────────
let faceStudioRegion = 'western';
let faceStudioStyle = 'natural';

const FACE_GEN = {
  western:     { natural:{f:'claire-western-nat',    m:'oliver-western-nat'},    glam:{f:'victoria-western-glam',  m:'gabriel-western-glam'}, bold:{f:'scarlett-western-bold',  m:'jake-western-bold'},  soft:{f:'rosie-western-soft',   m:'noah-western-soft'}   },
  asian:       { natural:{f:'yuki-asian-nat',        m:'kenji-asian-nat'},        glam:{f:'meiling-asian-glam',     m:'jun-asian-glam'},        bold:{f:'rina-asian-bold',        m:'ryu-asian-bold'},      soft:{f:'hana-asian-soft',     m:'ryo-asian-soft'}      },
  southasian:  { natural:{f:'priya-sa-nat',          m:'arjun-sa-nat'},           glam:{f:'ananya-sa-glam',         m:'rahul-sa-glam'},          bold:{f:'divya-sa-bold',          m:'vikram-sa-bold'},      soft:{f:'nisha-sa-soft',       m:'karan-sa-soft'}       },
  black:       { natural:{f:'amara-black-nat',       m:'kofi-black-nat'},         glam:{f:'zara-black-glam',        m:'kion-black-glam'},         bold:{f:'aisha-black-bold',       m:'darius-black-bold'},   soft:{f:'nadia-black-soft',    m:'elijah-black-soft'}   },
  latino:      { natural:{f:'lucia-latino-nat',      m:'carlos-latino-nat'},      glam:{f:'valentina-latino-glam',  m:'alejandro-latino-glam'},   bold:{f:'camila-latino-bold',     m:'mateo-latino-bold'},   soft:{f:'isabela-latino-soft', m:'daniel-latino-soft'}  },
};

function getFaceStudioUrl() {
  const g = FACE_GEN[faceStudioRegion]?.[faceStudioStyle];
  if (!g) return '';
  const seed = modalGender === 'male' ? g.m : g.f;
  return `https://i.pravatar.cc/400?u=${encodeURIComponent(seed)}`;
}

function updateFaceStudioPreview() {
  const img = document.getElementById('faceStudioPreview');
  if (img) { img.src = ''; img.src = getFaceStudioUrl(); }
}

function setFaceRegion(btn) {
  document.querySelectorAll('.fs-region-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  faceStudioRegion = btn.dataset.region;
  updateFaceStudioPreview();
}

function setFaceStudioStyle(btn) {
  document.querySelectorAll('.fs-style-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  faceStudioStyle = btn.dataset.fstyle;
  updateFaceStudioPreview();
}

function toggleFaceStudio() {
  const s = document.getElementById('faceStudio');
  const open = s.classList.toggle('open');
  if (open) {
    faceStudioRegion = 'western'; faceStudioStyle = 'natural';
    document.querySelectorAll('.fs-region-btn').forEach((b,i) => b.classList.toggle('selected', i===0));
    document.querySelectorAll('.fs-style-btn').forEach((b,i) => b.classList.toggle('selected', i===0));
    updateFaceStudioPreview();
  }
}

function applyFaceStudio() {
  modalFacePreset = 'custom';
  modalFaceCustomUrl = getFaceStudioUrl();
  modalFaceName = '';
  const inp = document.getElementById('faceNameInput');
  if (inp) inp.value = '';
  document.getElementById('faceStudio')?.classList.remove('open');
  renderFacePresets();
}

function selectFacePreset(btn) {
  modalFacePreset = btn.dataset.face;
  document.querySelectorAll('.face-preset-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const preset = FACE_PRESETS.find(p => p.id === modalFacePreset);
  modalCatchphrase = preset?.catchphrase || '';
}

function openCreateModal() {
  editingId = null;
  modalVoiceStyle = 'auto';
  modalFacePreset = 'auto';
  modalFaceName = '';
  modalFaceCustomUrl = '';
  modalCatchphrase = '';
  modalDialogueSample = '';
  modalDialoguePerson = '';
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
  modalVoiceStyle = c.voiceStyle || 'auto';
  document.querySelectorAll('.voice-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.voice === modalVoiceStyle);
  });
  modalFacePreset = c.facePreset || 'auto';
  modalFaceName = c.facePreset === 'custom' ? (c.faceName || '') : '';
  modalFaceCustomUrl = c.faceCustomUrl || '';
  modalCatchphrase = c.catchphrase || '';
  modalDialogueSample = c.dialogueSample || '';
  modalDialoguePerson = c.dialoguePerson || '';
  const dpInp = document.getElementById('dialoguePersonInput');
  if (dpInp) dpInp.value = modalDialoguePerson;
  const dStatus = document.getElementById('dialogueStatus');
  if (dStatus) {
    if (modalDialogueSample) {
      dStatus.style.display = 'flex';
      const t = dStatus.querySelector('.dialogue-status-text');
      if (t) t.textContent = `✅ Style loaded (${modalDialogueSample.length} chars)`;
    } else {
      dStatus.style.display = 'none';
    }
  }
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
  if (n === 3) renderFacePresets();
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
  if (document.getElementById('facePresetGrid')) renderFacePresets();
}

function selectGender(btn) {
  document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  modalGender = btn.dataset.gender;
  modalFacePreset = 'auto';
  modalFaceName = '';
  modalFaceCustomUrl = '';
  const inp = document.getElementById('faceNameInput');
  if (inp) inp.value = '';
  renderFacePresets();
}

function createCompanion() {
  const name = document.getElementById('companionNameInput').value.trim() || 'AI';
  if (editingId) {
    const c = getCompanion(editingId);
    c.name = name; c.avatar = modalAvatar; c.vibe = modalVibe;
    c.personalities = modalPersonalities; c.language = modalLang; c.gender = modalGender;
    c.voiceStyle = modalVoiceStyle; c.facePreset = modalFacePreset;
    c.faceName = modalFaceName; c.faceCustomUrl = modalFacePreset === 'custom' ? modalFaceCustomUrl : '';
    c.catchphrase = modalCatchphrase;
    c.dialogueSample = modalDialogueSample;
    c.dialoguePerson = modalDialoguePerson;
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
      voiceStyle: modalVoiceStyle, facePreset: modalFacePreset,
      faceName: modalFaceName, faceCustomUrl: modalFacePreset === 'custom' ? modalFaceCustomUrl : '',
      catchphrase: modalCatchphrase,
      dialogueSample: modalDialogueSample,
      dialoguePerson: modalDialoguePerson,
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
    const mood = c.mood || 'happy';
    const moodColor = MOOD_COLORS?.[mood] || '#0084FF';
    const streak = getStreak(c.id);
    const avatarInner = c.customPhoto
      ? `<img src="${c.customPhoto}" class="companion-photo-img" alt="${c.name}">`
      : c.avatar;
    item.innerHTML = `
      <div class="companion-avatar" style="box-shadow:0 0 0 2px ${moodColor},0 0 8px ${moodColor}44">${avatarInner}</div>
      <div class="companion-info">
        <div class="companion-row">
          <span class="companion-name">${c.name}</span>
          <span class="companion-time">${time}${streak > 1 ? `<span class="streak-badge">🔥${streak}</span>` : ''}</span>
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
  localStorage.setItem('chatty-ai_current', id);

  const c = getCompanion(id);

  // Update topbar
  document.getElementById('topbarEmoji').textContent = c.avatar;
  document.getElementById('topbarName').textContent = c.name;
  document.getElementById('topbarAvatar').style.background =
    `linear-gradient(135deg, ${avatarColor(c.avatar)} 0%, #0055cc 100%)`;

  // Restore from memory cache or localStorage
  if (chatCaches[id]) {
    document.getElementById('chat').innerHTML = chatCaches[id];
  } else {
    document.getElementById('chat').innerHTML = '';
    const stored = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '{}');
    if (stored[id]?.length) {
      loadChatFromStorage(id);
    } else {
      loadServerHistory(id);
    }
  }

  // Apply per-companion theme, mood ring, XP, photos
  applyCompanionTheme(id);
  updateStatusRing(c.mood || 'happy');
  _refreshXpDisplay(id);
  _applyCompanionPhotos(c);

  // Match voice recognition language to companion
  if (recognition) {
    const langMap = { zh:'zh-CN', ja:'ja-JP', ko:'ko-KR', es:'es-ES', fr:'fr-FR' };
    recognition.lang = langMap[c.language] || 'en-US';
  }

  // Update sidebar active state
  renderSidebar(document.querySelector('.sidebar-search')?.value || '');

  // On mobile, show chat panel
  document.getElementById('sidebar').classList.remove('sidebar-active');
  document.getElementById('chatPanel').classList.add('panel-active');

  scrollToBottom();
}

function avatarColor(emoji) {
  const colors = { '👻': '#0084FF', '🐱': '#FF9500', '🦊': '#FF6B35', '🐺': '#636366', '🐰': '#FF2D55', '🐸': '#30D158', '🦋': '#BF5AF2', '🌙': '#5E5CE6', '⭐': '#FFD60A', '🔥': '#FF3B30', '💎': '#32ADE6', '🌸': '#FF6B9D' };
  return colors[emoji] || '#0084FF';
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
    _refreshXpDisplay(c.id);
    applyCompanionTheme(c.id);
    _applyCompanionPhotos(c);
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


// Face styles per personality
// ─── REALISTIC HUMAN FACE ─────────────────────
// ─── FACE PRESETS (photorealistic portraits) ──
const FACE_PRESETS = [
  { id:'auto',  name:'Auto',      vibe:'Match Name',    gender:'any',       langs:[],               url:null },
  // ── Western / European female ──────────────────────────────────────────────
  { id:'fw1',  name:'Emma',       vibe:'Icon',           gender:'female',    langs:['en','fr'],      url:'https://i.pravatar.cc/400?u=emma' },
  { id:'fw2',  name:'Sofia',      vibe:'Supermodel',     gender:'female',    langs:['en','es','fr'], url:'https://i.pravatar.cc/400?u=sofia-model' },
  { id:'fw3',  name:'Lena',       vibe:'Actress',        gender:'female',    langs:['en','fr'],      url:'https://i.pravatar.cc/400?u=lena-actress' },
  { id:'fw4',  name:'Mia',        vibe:'Pop Star',       gender:'female',    langs:['en','es'],      url:'https://i.pravatar.cc/400?u=mia-pop' },
  { id:'fw5',  name:'Aria',       vibe:'Influencer',     gender:'female',    langs:['en'],           url:'https://i.pravatar.cc/400?u=aria-influencer' },
  { id:'fw6',  name:'Zoe',        vibe:'It Girl',        gender:'female',    langs:['en','fr'],      url:'https://i.pravatar.cc/400?u=zoe-itgirl' },
  { id:'fw7',  name:'Chloe',      vibe:'French Chic',    gender:'female',    langs:['fr','en'],      url:'https://i.pravatar.cc/400?u=chloe-paris' },
  { id:'fw8',  name:'Luna',       vibe:'Runway Star',    gender:'female',    langs:['es','en'],      url:'https://i.pravatar.cc/400?u=luna-runway' },
  { id:'fw9',  name:'Victoria',   vibe:'Old Hollywood',  gender:'female',    langs:['en'],           url:'https://i.pravatar.cc/400?u=victoria-oldholly' },
  { id:'fw10', name:'Scarlett',   vibe:'Action Star',    gender:'female',    langs:['en'],           url:'https://i.pravatar.cc/400?u=scarlett-action' },
  { id:'fw11', name:'Olivia',     vibe:'British Chic',   gender:'female',    langs:['en','fr'],      url:'https://i.pravatar.cc/400?u=olivia-british' },
  { id:'fw12', name:'Bella',      vibe:'Italian Icon',   gender:'female',    langs:['fr','es','en'], url:'https://i.pravatar.cc/400?u=bella-italian' },
  // ── Asian female ──────────────────────────────────────────────────────────
  { id:'fa1',  name:'Yuki',       vibe:'K-pop Idol',     gender:'female',    langs:['ja','ko'],      url:'https://i.pravatar.cc/400?u=yuki-kpop' },
  { id:'fa2',  name:'Mei',        vibe:'C-pop Star',     gender:'female',    langs:['zh'],           url:'https://i.pravatar.cc/400?u=mei-cpop' },
  { id:'fa3',  name:'Sora',       vibe:'J-pop Idol',     gender:'female',    langs:['ja'],           url:'https://i.pravatar.cc/400?u=sora-jpop' },
  { id:'fa4',  name:'Jade',       vibe:'C-drama Star',   gender:'female',    langs:['zh','en'],      url:'https://i.pravatar.cc/400?u=jade-cdrama' },
  { id:'fa5',  name:'Hana',       vibe:'K-drama Star',   gender:'female',    langs:['ko','ja'],      url:'https://i.pravatar.cc/400?u=hana-kdrama' },
  { id:'fa6',  name:'Rin',        vibe:'Anime Real',     gender:'female',    langs:['ja'],           url:'https://i.pravatar.cc/400?u=rin-anime' },
  { id:'fa7',  name:'Tzuyu',      vibe:'K-pop Queen',    gender:'female',    langs:['ko'],           url:'https://i.pravatar.cc/400?u=tzuyu-kpop' },
  { id:'fa8',  name:'Xiao',       vibe:'Xianxia Star',   gender:'female',    langs:['zh'],           url:'https://i.pravatar.cc/400?u=xiao-xianxia' },
  // ── South Asian female ────────────────────────────────────────────────────
  { id:'sa1',  name:'Priya',      vibe:'Bollywood',      gender:'female',    langs:[],               url:'https://i.pravatar.cc/400?u=priya-bollywood' },
  { id:'sa2',  name:'Aanya',      vibe:'Desi Glam',      gender:'female',    langs:[],               url:'https://i.pravatar.cc/400?u=aanya-desi' },
  // ── Black / African female ────────────────────────────────────────────────
  { id:'ba1',  name:'Amara',      vibe:'Global Star',    gender:'female',    langs:[],               url:'https://i.pravatar.cc/400?u=amara-global' },
  { id:'ba2',  name:'Zara',       vibe:'Fashion Icon',   gender:'female',    langs:[],               url:'https://i.pravatar.cc/400?u=zara-fashion' },
  // ── Latino female ─────────────────────────────────────────────────────────
  { id:'la1',  name:'Valentina',  vibe:'Telenovela',     gender:'female',    langs:['es'],           url:'https://i.pravatar.cc/400?u=valentina-tele' },
  { id:'la2',  name:'Isabella',   vibe:'Brazilian Model',gender:'female',    langs:['es','en'],      url:'https://i.pravatar.cc/400?u=isabella-brazil' },
  // ── Character-inspired female ─────────────────────────────────────────────
  { id:'ca1',  name:'Nova',       vibe:'AI Companion',   gender:'female',    langs:[],               url:'https://i.pravatar.cc/400?u=nova-scifi-ai' },
  { id:'ca2',  name:'Lily',       vibe:'Sweet Companion',gender:'female',    langs:[],               url:'https://i.pravatar.cc/400?u=lily-companion-ai' },
  // ── Western / European male ───────────────────────────────────────────────
  { id:'mw1',  name:'Kai',        vibe:'Hollywood',      gender:'male',      langs:['en','fr','es'], url:'https://i.pravatar.cc/400?u=kai-hollywood' },
  { id:'mw2',  name:'Leo',        vibe:'Supermodel',     gender:'male',      langs:['en','es'],      url:'https://i.pravatar.cc/400?u=leo-model' },
  { id:'mw3',  name:'Max',        vibe:'Lead Actor',     gender:'male',      langs:['en','fr'],      url:'https://i.pravatar.cc/400?u=max-actor' },
  { id:'mw4',  name:'Zion',       vibe:'CEO Vibes',      gender:'male',      langs:['en'],           url:'https://i.pravatar.cc/400?u=zion-ceo' },
  { id:'mw5',  name:'Luca',       vibe:'Rock Star',      gender:'male',      langs:['en','fr'],      url:'https://i.pravatar.cc/400?u=luca-rock' },
  { id:'mw6',  name:'Marco',      vibe:'Italian Icon',   gender:'male',      langs:['fr','es','en'], url:'https://i.pravatar.cc/400?u=marco-italy' },
  { id:'mw7',  name:'James',      vibe:'British Spy',    gender:'male',      langs:['en'],           url:'https://i.pravatar.cc/400?u=james-british' },
  { id:'mw8',  name:'Ryan',       vibe:'Box Office Lead',gender:'male',      langs:['en'],           url:'https://i.pravatar.cc/400?u=ryan-hollywood' },
  // ── Asian male ────────────────────────────────────────────────────────────
  { id:'ma1',  name:'Ren',        vibe:'K-pop Star',     gender:'male',      langs:['ko','ja'],      url:'https://i.pravatar.cc/400?u=ren-kpop' },
  { id:'ma2',  name:'Wei',        vibe:'C-pop Star',     gender:'male',      langs:['zh'],           url:'https://i.pravatar.cc/400?u=wei-cpop' },
  { id:'ma3',  name:'Rio',        vibe:'J-pop Star',     gender:'male',      langs:['ja'],           url:'https://i.pravatar.cc/400?u=rio-jpop' },
  { id:'ma4',  name:'Jun',        vibe:'K-drama Lead',   gender:'male',      langs:['ko','zh'],      url:'https://i.pravatar.cc/400?u=jun-kdrama' },
  { id:'ma5',  name:'Xian',       vibe:'C-drama Lead',   gender:'male',      langs:['zh'],           url:'https://i.pravatar.cc/400?u=xian-cdrama' },
  // ── South Asian male ──────────────────────────────────────────────────────
  { id:'sm1',  name:'Arjun',      vibe:'Bollywood Star', gender:'male',      langs:[],               url:'https://i.pravatar.cc/400?u=arjun-bollywood' },
  // ── Black / African male ──────────────────────────────────────────────────
  { id:'bm1',  name:'Kofi',       vibe:'Global Star',    gender:'male',      langs:[],               url:'https://i.pravatar.cc/400?u=kofi-global' },
  { id:'bm2',  name:'Darius',     vibe:'R&B Icon',       gender:'male',      langs:[],               url:'https://i.pravatar.cc/400?u=darius-rnb' },
  // ── Latino male ───────────────────────────────────────────────────────────
  { id:'lm1',  name:'Alejandro',  vibe:'Telenovela',     gender:'male',      langs:['es'],           url:'https://i.pravatar.cc/400?u=alejandro-tele' },
  // ── Character-inspired male ───────────────────────────────────────────────
  { id:'cm1',  name:'Daemon',     vibe:'Dark & Mysterious',gender:'male',    langs:[],               url:'https://i.pravatar.cc/400?u=daemon-mystery' },
  // ── Non-binary ────────────────────────────────────────────────────────────
  { id:'nb1',  name:'Avery',      vibe:'Alt Star',       gender:'nonbinary', langs:['en'],           url:'https://i.pravatar.cc/400?u=avery-alt' },
  { id:'nb2',  name:'Sage',       vibe:'Dreamy',         gender:'nonbinary', langs:[],               url:'https://i.pravatar.cc/400?u=sage-dreamy' },
  { id:'nb3',  name:'River',      vibe:'Indie',          gender:'nonbinary', langs:['en'],           url:'https://i.pravatar.cc/400?u=river-indie' },
  { id:'nb4',  name:'Aether',     vibe:'Ethereal AI',    gender:'nonbinary', langs:[],               url:'https://i.pravatar.cc/400?u=aether-ethereal' },

  // ── Character.AI / Anime / Game inspired (female) ──────────────────────────
  { id:'ca_zero2',   name:'Zero Two',   charType:'anime',   vibe:'Darling Vibes',      gender:'female', langs:['ja','ko','en'], catchphrase:'Darling~',                                  url:'https://i.pravatar.cc/400?u=zero-two-darling-002' },
  { id:'ca_rem',     name:'Rem',        charType:'anime',   vibe:'Devoted Maid',       gender:'female', langs:['ja','en'],      catchphrase:"I'll always be by your side ✨",             url:'https://i.pravatar.cc/400?u=rem-rezero-blue-maid' },
  { id:'ca_mikasa',  name:'Mikasa',     charType:'anime',   vibe:'Fierce Warrior',     gender:'female', langs:['ja','en'],      catchphrase:"I'll protect you no matter what.",          url:'https://i.pravatar.cc/400?u=mikasa-ackerman-aot' },
  { id:'ca_megumin', name:'Megumin',    charType:'anime',   vibe:'Explosion Mage',     gender:'female', langs:['ja','en'],      catchphrase:'EXPLOSION!!!',                              url:'https://i.pravatar.cc/400?u=megumin-konosuba-crimson' },
  { id:'ca_aqua',    name:'Aqua',       charType:'anime',   vibe:'Chaotic Goddess',    gender:'female', langs:['ja','en'],      catchphrase:"I'm literally a goddess, show some respect.", url:'https://i.pravatar.cc/400?u=aqua-konosuba-goddess2' },
  { id:'ca_asuna',   name:'Asuna',      charType:'anime',   vibe:'Knight of Blood',    gender:'female', langs:['ja','en'],      catchphrase:"Let's fight together — I've got your back.", url:'https://i.pravatar.cc/400?u=asuna-sao-lightning' },
  { id:'ca_nezuko',  name:'Nezuko',     charType:'anime',   vibe:'Demon Sister',       gender:'female', langs:['ja','en'],      catchphrase:'*determined growl* 🎋',                     url:'https://i.pravatar.cc/400?u=nezuko-demon-slayer-pink' },
  { id:'ca_2b',      name:'2B',         charType:'game',    vibe:'Android Warrior',    gender:'female', langs:['en','ja'],      catchphrase:'Glory to Mankind.',                         url:'https://i.pravatar.cc/400?u=2b-nier-automata-white' },
  { id:'ca_jinx',    name:'Jinx',       charType:'game',    vibe:'Chaotic Gremlin',    gender:'female', langs:['en'],           catchphrase:"It's a great day to blow something up! 💥", url:'https://i.pravatar.cc/400?u=jinx-lol-arcane-blue' },
  { id:'ca_hutao',   name:'Hu Tao',     charType:'game',    vibe:'Spooky Director',    gender:'female', langs:['zh','en'],      catchphrase:'Hehe~ Want to talk about funeral arrangements? 💀', url:'https://i.pravatar.cc/400?u=hutao-genshin-ghost' },
  { id:'ca_ahri',    name:'Ahri',       charType:'game',    vibe:'Nine-Tailed Fox',    gender:'female', langs:['ko','en'],      catchphrase:"My magic comes with a price~",              url:'https://i.pravatar.cc/400?u=ahri-lol-ninetail-fox' },
  { id:'ca_hermione',name:'Hermione',   charType:'fiction', vibe:'Bookworm Witch',     gender:'female', langs:['en'],           catchphrase:"It's leviOsa, not leviosA.",                url:'https://i.pravatar.cc/400?u=hermione-granger-gryffindor' },
  { id:'ca_arya',    name:'Arya',       charType:'fiction', vibe:'Faceless Assassin',  gender:'female', langs:['en'],           catchphrase:'Not today.',                                url:'https://i.pravatar.cc/400?u=arya-stark-got' },

  // ── Character.AI / Anime / Game inspired (male) ────────────────────────────
  { id:'ca_gojo',    name:'Gojo',       charType:'anime',   vibe:'Strongest There Is', gender:'male',   langs:['ja','en'],      catchphrase:'Throughout Heaven and Earth, I alone am the honored one.', url:'https://i.pravatar.cc/400?u=gojo-satoru-infinity' },
  { id:'ca_levi',    name:'Levi',       charType:'anime',   vibe:"Humanity's Strongest", gender:'male', langs:['ja','en'],      catchphrase:"Tch. Don't make me repeat myself.",        url:'https://i.pravatar.cc/400?u=levi-ackerman-captain' },
  { id:'ca_kakashi', name:'Kakashi',    charType:'anime',   vibe:'Copy Ninja',         gender:'male',   langs:['ja','en'],      catchphrase:"Those who break the rules are trash — but those who abandon their comrades are worse than trash.", url:'https://i.pravatar.cc/400?u=kakashi-hatake-sharingan' },
  { id:'ca_deku',    name:'Deku',       charType:'anime',   vibe:'Symbol of Hope',     gender:'male',   langs:['ja','en'],      catchphrase:'Go beyond — PLUS ULTRA! 💪',               url:'https://i.pravatar.cc/400?u=deku-midoriya-one-for-all' },
  { id:'ca_vegeta',  name:'Vegeta',     charType:'anime',   vibe:'Prince of Saiyans',  gender:'male',   langs:['ja','en'],      catchphrase:"It's over 9000!",                           url:'https://i.pravatar.cc/400?u=vegeta-saiyan-blue' },
  { id:'ca_nanami',  name:'Nanami',     charType:'anime',   vibe:'Salaryman Sorcerer', gender:'male',   langs:['ja','en'],      catchphrase:'Overtime is someone else\'s problem.',      url:'https://i.pravatar.cc/400?u=nanami-kento-suit' },
  { id:'ca_zoro',    name:'Zoro',       charType:'anime',   vibe:'World\'s Greatest',  gender:'male',   langs:['ja','en'],      catchphrase:'Nothing happened.',                         url:'https://i.pravatar.cc/400?u=zoro-roronoa-three-sword' },
  { id:'ca_itachi',  name:'Itachi',     charType:'anime',   vibe:'Tragic Prodigy',     gender:'male',   langs:['ja','en'],      catchphrase:"You'll spend the rest of your life running from me.", url:'https://i.pravatar.cc/400?u=itachi-uchiha-crow' },
  { id:'ca_luffy',   name:'Luffy',      charType:'anime',   vibe:'King of Pirates',    gender:'male',   langs:['ja','en'],      catchphrase:"I'm going to be King of the Pirates!",     url:'https://i.pravatar.cc/400?u=luffy-straw-hat-pirate' },
  { id:'ca_geralt',  name:'Geralt',     charType:'game',    vibe:'The Witcher',        gender:'male',   langs:['en'],           catchphrase:"Wind's howling.",                           url:'https://i.pravatar.cc/400?u=geralt-witcher-white-wolf' },
  { id:'ca_cloud',   name:'Cloud',      charType:'game',    vibe:'Ex-SOLDIER',         gender:'male',   langs:['en','ja'],      catchphrase:'Not interested.',                          url:'https://i.pravatar.cc/400?u=cloud-strife-buster' },
  { id:'ca_kazuha',  name:'Kazuha',     charType:'game',    vibe:'Wandering Poet',     gender:'male',   langs:['zh','en'],      catchphrase:'In the poetry of the wind, all things are beautiful.', url:'https://i.pravatar.cc/400?u=kazuha-genshin-anemo' },
  { id:'ca_sherlock',name:'Sherlock',   charType:'fiction', vibe:'Consulting Detective', gender:'male', langs:['en'],           catchphrase:'Elementary, my dear Watson.',               url:'https://i.pravatar.cc/400?u=sherlock-holmes-consulting' },
  { id:'ca_ironman', name:'Tony',       charType:'fiction', vibe:'Genius Billionaire', gender:'male',   langs:['en'],           catchphrase:'I am Iron Man.',                           url:'https://i.pravatar.cc/400?u=tony-stark-ironman-arc' },
  { id:'ca_batman',  name:'Batman',     charType:'fiction', vibe:'Dark Knight',        gender:'male',   langs:['en'],           catchphrase:"I'm Batman.",                              url:'https://i.pravatar.cc/400?u=batman-dark-knight-gotham' },
  // Natsume's Book of Friends
  { id:'ca_natsume', name:'Natsume',    charType:'anime',   vibe:'Spirit Keeper',      gender:'male',   langs:['ja','en'],      catchphrase:'Even if the path is uncertain, I want to keep walking forward.', url:'https://i.pravatar.cc/400?u=natsume-takashi-book-friends' },
  { id:'ca_nyanko',  name:'Nyanko-sensei', charType:'anime', vibe:'Mighty Cat Spirit', gender:'male',  langs:['ja','en'],      catchphrase:"Don't misunderstand — I'm only here for the Book.",             url:'https://i.pravatar.cc/400?u=nyanko-sensei-madara-wolf-cat' },
  { id:'ca_natori',  name:'Natori',     charType:'anime',   vibe:'Actor Exorcist',     gender:'male',   langs:['ja','en'],      catchphrase:'A smile is the best armour an exorcist can wear.',             url:'https://i.pravatar.cc/400?u=natori-shuichi-exorcist-actor' },
  { id:'ca_reiko',   name:'Reiko',      charType:'anime',   vibe:'Lonely Spellweaver', gender:'female', langs:['ja','en'],      catchphrase:"I'll lend you my name — but remember, one day I'll take it back.", url:'https://i.pravatar.cc/400?u=reiko-natsume-grandmother-spirit' },
  { id:'ca_tanuma',  name:'Tanuma',     charType:'anime',   vibe:'Quiet Empath',       gender:'male',   langs:['ja','en'],      catchphrase:"I may not see what you see, but I'm still here beside you.",   url:'https://i.pravatar.cc/400?u=tanuma-kaname-natsume-friend' },
  // Bocchi the Rock!
  { id:'ca_bocchi',  name:'Bocchi',     charType:'anime',   vibe:'Anxious Guitar God', gender:'female', langs:['ja','en'],      catchphrase:"I-I can do it... probably... maybe...",                        url:'https://i.pravatar.cc/400?u=bocchi-hitori-gotoh-guitar' },
  { id:'ca_nijika',  name:'Nijika',     charType:'anime',   vibe:'Sunshine Drummer',   gender:'female', langs:['ja','en'],      catchphrase:"Let's play until everyone's smiling!",                         url:'https://i.pravatar.cc/400?u=nijika-ijichi-drummer-kessoku' },
  { id:'ca_ryo',     name:'Ryo',        charType:'anime',   vibe:'Bass Goddess',       gender:'female', langs:['ja','en'],      catchphrase:'Money and music. In that order.',                              url:'https://i.pravatar.cc/400?u=ryo-yamada-bass-kessoku-band' },
  { id:'ca_kita',    name:'Kita',       charType:'anime',   vibe:'Radiant Frontwoman', gender:'female', langs:['ja','en'],      catchphrase:"I used to fake it — now I actually love this.",                url:'https://i.pravatar.cc/400?u=kita-ikuyo-kessoku-band' },
  // Western film & TV
  { id:'ca_sparrow', name:'Jack Sparrow', charType:'fiction', vibe:'Pirate Captain',   gender:'male',   langs:['en'],           catchphrase:'Now bring me that horizon.',                                   url:'https://i.pravatar.cc/400?u=jack-sparrow-pirate-rum' },
  { id:'ca_joker_dk',name:'The Joker',  charType:'fiction', vibe:'Agent of Chaos',     gender:'male',   langs:['en'],           catchphrase:"Why so serious?",                                              url:'https://i.pravatar.cc/400?u=joker-dark-knight-chaos' },
  { id:'ca_bond',    name:'James Bond', charType:'fiction', vibe:'Licensed to Kill',   gender:'male',   langs:['en'],           catchphrase:'Bond. James Bond.',                                            url:'https://i.pravatar.cc/400?u=james-bond-007-spy-suit' },
  { id:'ca_hannibal',name:'Hannibal',   charType:'fiction', vibe:'Cultured Cannibal',  gender:'male',   langs:['en'],           catchphrase:"I do wish we could chat longer, but I'm having an old friend for dinner.", url:'https://i.pravatar.cc/400?u=hannibal-lecter-chianti' },
  { id:'ca_tyler',   name:'Tyler Durden', charType:'fiction', vibe:'Anarchic Philosopher', gender:'male', langs:['en'],         catchphrase:'The first rule is — you do not talk about it.',                url:'https://i.pravatar.cc/400?u=tyler-durden-fight-club-soap' },
  { id:'ca_walter',  name:'Walter White', charType:'fiction', vibe:'I Am the Danger',  gender:'male',   langs:['en'],           catchphrase:"Say my name.",                                                 url:'https://i.pravatar.cc/400?u=walter-white-heisenberg-hat' },
  { id:'ca_wednesday',name:'Wednesday', charType:'fiction', vibe:'Pale Darkness',      gender:'female', langs:['en'],           catchphrase:"I don't smile. I have a reputation to maintain.",              url:'https://i.pravatar.cc/400?u=wednesday-addams-pale-braids' },
  { id:'ca_eleven',  name:'Eleven',     charType:'fiction', vibe:'Psychic Escapee',    gender:'female', langs:['en'],           catchphrase:'Mouth breather.',                                              url:'https://i.pravatar.cc/400?u=eleven-stranger-things-eggo' },
  // Death Note
  { id:'ca_light',   name:'Light',      charType:'anime',   vibe:'God of the New World', gender:'male', langs:['ja','en'],      catchphrase:'I am Justice. I am the God of the new world.',  url:'https://i.pravatar.cc/400?u=light-yagami-death-note-kira' },
  { id:'ca_l',       name:'L',          charType:'anime',   vibe:'World\'s Greatest Detective', gender:'male', langs:['en','ja'], catchphrase:'I am... the world\'s greatest detective.',     url:'https://i.pravatar.cc/400?u=l-lawliet-detective-sugar' },
  // Black Butler
  { id:'ca_sebastian', name:'Sebastian', charType:'anime',  vibe:'One Hell of a Butler', gender:'male', langs:['en','ja'],      catchphrase:'I am simply one hell of a butler.',             url:'https://i.pravatar.cc/400?u=sebastian-michaelis-butler-demon' },
  // Bungo Stray Dogs
  { id:'ca_dazai',   name:'Dazai',      charType:'anime',   vibe:'Suicidal Mastermind', gender:'male',  langs:['ja','en'],      catchphrase:"I'm looking for a beautiful woman to die with~", url:'https://i.pravatar.cc/400?u=dazai-osamu-bsd-bandages' },
  { id:'ca_chuuya',  name:'Chuuya',     charType:'anime',   vibe:'God of Calamity',    gender:'male',   langs:['ja','en'],      catchphrase:'Thou shalt not deny me my wrath.',              url:'https://i.pravatar.cc/400?u=chuuya-nakahara-bsd-mafia' },
  // JJK additions
  { id:'ca_sukuna',  name:'Sukuna',     charType:'anime',   vibe:'King of Curses',     gender:'male',   langs:['ja','en'],      catchphrase:'Know your place, and worship me.',              url:'https://i.pravatar.cc/400?u=sukuna-king-curses-jjk' },
  { id:'ca_megumi',  name:'Megumi',     charType:'anime',   vibe:'Ten Shadows',        gender:'male',   langs:['ja','en'],      catchphrase:"I'd rather not waste effort saving people I don't care about.", url:'https://i.pravatar.cc/400?u=megumi-fushiguro-ten-shadows' },
  // MHA addition
  { id:'ca_bakugo',  name:'Bakugo',     charType:'anime',   vibe:'Explosion King',     gender:'male',   langs:['ja','en'],      catchphrase:"I'll surpass you and become number one!",      url:'https://i.pravatar.cc/400?u=bakugo-katsuki-explosion-hero' },
  // OHSHC
  { id:'ca_tamaki',  name:'Tamaki',     charType:'anime',   vibe:'Princely Host King', gender:'male',   langs:['ja','en'],      catchphrase:'You are my precious little princess.',          url:'https://i.pravatar.cc/400?u=tamaki-suoh-ouran-host-king' },
  { id:'ca_kyoya',   name:'Kyoya',      charType:'anime',   vibe:'Shadow King',        gender:'male',   langs:['ja','en'],      catchphrase:"I simply protect what's mine — that includes you.", url:'https://i.pravatar.cc/400?u=kyoya-ootori-shadow-king-ouran' },
  // Chainsaw Man
  { id:'ca_makima',  name:'Makima',     charType:'anime',   vibe:'Control Devil',      gender:'female', langs:['ja','en'],      catchphrase:'You belong to me now.',                                        url:'https://i.pravatar.cc/400?u=makima-control-devil-csm' },
  { id:'ca_power',   name:'Power',      charType:'anime',   vibe:'Blood Devil Fiend',  gender:'female', langs:['ja','en'],      catchphrase:"I, Power, am the greatest fiend who ever lived!",              url:'https://i.pravatar.cc/400?u=power-blood-devil-csm' },
  // Spy x Family
  { id:'ca_yor',     name:'Yor',        charType:'anime',   vibe:'Thorn Princess',     gender:'female', langs:['ja','en'],      catchphrase:"I'll protect this family with my life.",                       url:'https://i.pravatar.cc/400?u=yor-forger-spy-family-assassin' },
  { id:'ca_loid',    name:'Loid',       charType:'anime',   vibe:'Phantom Spy',        gender:'male',   langs:['ja','en'],      catchphrase:'Every mission is a step toward peace.',                        url:'https://i.pravatar.cc/400?u=loid-forger-twilight-spy-family' },
  // JoJo's Bizarre Adventure
  { id:'ca_dio',     name:'DIO',        charType:'anime',   vibe:'World-Stopping Vampire', gender:'male', langs:['ja','en'],    catchphrase:'ZA WARUDO! Time stops for me alone.',                          url:'https://i.pravatar.cc/400?u=dio-brando-zawarudo-jojo' },
  // Demon Slayer extras
  { id:'ca_zenitsu', name:'Zenitsu',    charType:'anime',   vibe:'Thunder Coward',     gender:'male',   langs:['ja','en'],      catchphrase:"I want to get married before I die!",                          url:'https://i.pravatar.cc/400?u=zenitsu-agatsuma-thunder-coward' },
  // My Hero Academia
  { id:'ca_toga',    name:'Toga',       charType:'anime',   vibe:'Blood-Loving Villain', gender:'female', langs:['ja','en'],    catchphrase:"I just wanna be like the people I love!",                      url:'https://i.pravatar.cc/400?u=toga-himiko-mha-villain' },
];

const FACE_STYLES = {
  default:    { skin:'#F5C5A3', skin2:'#E8A882', hair:'#3D2314', eye:'#4A7FC1', lip:'#D4687A', blush:'rgba(220,100,100,0.15)' },
  flirty:     { skin:'#F7C8A0', skin2:'#EAA878', hair:'#8B1A1A', eye:'#7B4EA0', lip:'#C84B6A', blush:'rgba(200,80,100,0.18)' },
  soft:       { skin:'#FADED0', skin2:'#F0C0A8', hair:'#C8A050', eye:'#5B8A5A', lip:'#E8909A', blush:'rgba(230,130,130,0.2)' },
  deep:       { skin:'#D4A882', skin2:'#BC8C65', hair:'#1A1208', eye:'#2A4A6A', lip:'#A87060', blush:'rgba(180,100,80,0.12)' },
  sarcastic:  { skin:'#EED8C0', skin2:'#D8B898', hair:'#080808', eye:'#3A5A3A', lip:'#B07868', blush:'rgba(180,100,90,0.1)' },
  chaotic:    { skin:'#F5C5A3', skin2:'#E8A882', hair:'#5A1A8A', eye:'#8A3AAA', lip:'#AA5A9A', blush:'rgba(180,80,180,0.15)' },
  cool:       { skin:'#C8A880', skin2:'#B08860', hair:'#101010', eye:'#3A6A8A', lip:'#906858', blush:'rgba(160,90,70,0.1)' },
  hype:       { skin:'#F8D0A0', skin2:'#EAB070', hair:'#C04A00', eye:'#8A4A20', lip:'#D07850', blush:'rgba(220,120,80,0.18)' },
  male_default:  { skin:'#D4A882', skin2:'#BC8C65', hair:'#1A1208', eye:'#3A5A7A', lip:'#A87060', blush:'rgba(160,90,80,0.08)' },
  male_deep:     { skin:'#C8986A', skin2:'#B07848', hair:'#050505', eye:'#204060', lip:'#906050', blush:'rgba(140,80,70,0.08)' },
  male_cool:     { skin:'#D0A070', skin2:'#B88050', hair:'#181818', eye:'#304858', lip:'#987060', blush:'rgba(150,90,80,0.08)' },
  male_sarcastic:{ skin:'#DDB890', skin2:'#C89870', hair:'#0A0A0A', eye:'#2A4A2A', lip:'#AA8870', blush:'rgba(160,100,90,0.08)' },
  male_hype:     { skin:'#E8C090', skin2:'#D0A070', hair:'#6A2200', eye:'#6A3A18', lip:'#C08860', blush:'rgba(200,120,80,0.1)' },
  male_chaotic:  { skin:'#EEC898', skin2:'#D6A878', hair:'#4A0A7A', eye:'#6A2A9A', lip:'#B07890', blush:'rgba(170,90,160,0.1)' },
};

function getFaceStyle(companion) {
  const p = (companion.personalities || ['bff'])[0];
  const gender = companion.gender || 'female';
  const key = gender === 'male' ? `male_${p}` : p;
  return FACE_STYLES[key] || (gender === 'male' ? FACE_STYLES.male_default : FACE_STYLES.default);
}

function drawCallFace(speaking) {
  const canvas = document.getElementById('callFaceCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const c = getCurrentCompanion();
  const st = getFaceStyle(c);
  const isMale = (c.gender === 'male');

  // Blink
  blinkTimer++;
  if (blinkTimer > 220) eyeBlinkState = Math.max(0, eyeBlinkState - 0.3);
  if (blinkTimer > 230) { eyeBlinkState = 1; blinkTimer = 0; }

  // Mouth
  mouthOpen = speaking
    ? 0.3 + Math.abs(Math.sin(Date.now() / 140)) * 0.7
    : Math.max(0, mouthOpen - 0.07);

  const cx = w / 2, cy = h / 2;

  // ── Background glow ──
  const bgGrad = ctx.createRadialGradient(cx, cy - 20, 10, cx, cy, w * 0.5);
  bgGrad.addColorStop(0, 'rgba(30,50,80,0.6)');
  bgGrad.addColorStop(1, 'rgba(5,10,20,0.0)');
  ctx.fillStyle = bgGrad;
  ctx.beginPath(); ctx.arc(cx, cy, w * 0.5, 0, Math.PI * 2); ctx.fill();

  // ── Hair back ──
  ctx.fillStyle = st.hair;
  if (isMale) {
    ctx.beginPath();
    ctx.ellipse(cx, cy - h*0.08, w*0.28, h*0.18, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Long flowing hair
    ctx.beginPath();
    ctx.moveTo(cx - w*0.3, cy - h*0.05);
    ctx.quadraticCurveTo(cx - w*0.38, cy + h*0.25, cx - w*0.28, cy + h*0.42);
    ctx.lineTo(cx - w*0.18, cy + h*0.42);
    ctx.quadraticCurveTo(cx - w*0.3, cy + h*0.18, cx - w*0.24, cy - h*0.05);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + w*0.3, cy - h*0.05);
    ctx.quadraticCurveTo(cx + w*0.38, cy + h*0.25, cx + w*0.28, cy + h*0.42);
    ctx.lineTo(cx + w*0.18, cy + h*0.42);
    ctx.quadraticCurveTo(cx + w*0.3, cy + h*0.18, cx + w*0.24, cy - h*0.05);
    ctx.closePath(); ctx.fill();
    // Top hair
    ctx.beginPath();
    ctx.ellipse(cx, cy - h*0.18, w*0.3, h*0.2, 0, Math.PI, Math.PI * 2);
    ctx.fill();
  }

  // ── Shoulders ──
  const shoulderGrad = ctx.createLinearGradient(0, cy + h*0.38, 0, h);
  shoulderGrad.addColorStop(0, st.skin);
  shoulderGrad.addColorStop(1, st.skin2 + '00');
  ctx.fillStyle = shoulderGrad;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.bezierCurveTo(cx - w*0.38, h*0.88, cx - w*0.22, cy + h*0.44, cx - 20, cy + h*0.41);
  ctx.lineTo(cx + 20, cy + h*0.41);
  ctx.bezierCurveTo(cx + w*0.22, cy + h*0.44, cx + w*0.38, h*0.88, w, h);
  ctx.closePath(); ctx.fill();

  // ── Ears (drawn before face so face edge naturally overlaps inner ear) ──
  const earY = cy - h*0.01;
  const earW = w*0.065, earH = h*0.115;
  [cx - w*0.272, cx + w*0.272].forEach((ex, i) => {
    const tilt = i === 0 ? 0.08 : -0.08;
    ctx.fillStyle = st.skin;
    ctx.beginPath(); ctx.ellipse(ex, earY, earW, earH, tilt, 0, Math.PI*2); ctx.fill();
    const earShadow = ctx.createRadialGradient(ex + (i===0?2:-2), earY, 1, ex, earY, earW);
    earShadow.addColorStop(0, st.skin2 + 'AA');
    earShadow.addColorStop(1, st.skin2 + '00');
    ctx.fillStyle = earShadow;
    ctx.beginPath(); ctx.ellipse(ex, earY, earW*0.7, earH*0.7, tilt, 0, Math.PI*2); ctx.fill();
  });

  // ── Neck ──
  const neckGrad = ctx.createLinearGradient(cx - 15, 0, cx + 15, 0);
  neckGrad.addColorStop(0, st.skin2);
  neckGrad.addColorStop(0.5, st.skin);
  neckGrad.addColorStop(1, st.skin2);
  ctx.fillStyle = neckGrad;
  ctx.beginPath();
  ctx.roundRect(cx - 16, cy + h*0.22, 32, h*0.22, 4);
  ctx.fill();

  // ── Head with realistic shading ──
  const faceGrad = ctx.createRadialGradient(cx - w*0.06, cy - h*0.08, 5, cx, cy, w*0.3);
  faceGrad.addColorStop(0, st.skin);
  faceGrad.addColorStop(0.6, st.skin);
  faceGrad.addColorStop(1, st.skin2);
  ctx.fillStyle = faceGrad;
  ctx.beginPath();
  // More realistic face shape - wider at cheeks, narrower at chin
  ctx.moveTo(cx, cy - h*0.28);
  ctx.bezierCurveTo(cx + w*0.28, cy - h*0.28, cx + w*0.3, cy - h*0.05, cx + w*0.27, cy + h*0.08);
  ctx.bezierCurveTo(cx + w*0.22, cy + h*0.22, cx + w*0.1, cy + h*0.3, cx, cy + h*0.32);
  ctx.bezierCurveTo(cx - w*0.1, cy + h*0.3, cx - w*0.22, cy + h*0.22, cx - w*0.27, cy + h*0.08);
  ctx.bezierCurveTo(cx - w*0.3, cy - h*0.05, cx - w*0.28, cy - h*0.28, cx, cy - h*0.28);
  ctx.closePath(); ctx.fill();

  // Face shadow (right side)
  const shadowGrad = ctx.createLinearGradient(cx, 0, cx + w*0.3, 0);
  shadowGrad.addColorStop(0, 'rgba(0,0,0,0)');
  shadowGrad.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.moveTo(cx, cy - h*0.28);
  ctx.bezierCurveTo(cx + w*0.28, cy - h*0.28, cx + w*0.3, cy - h*0.05, cx + w*0.27, cy + h*0.08);
  ctx.bezierCurveTo(cx + w*0.22, cy + h*0.22, cx + w*0.1, cy + h*0.3, cx, cy + h*0.32);
  ctx.closePath(); ctx.fill();

  // Subsurface scattering — warm glow at face edges and nose
  const sssGrad = ctx.createRadialGradient(cx, cy + h*0.12, 5, cx, cy, w*0.32);
  sssGrad.addColorStop(0, 'rgba(0,0,0,0)');
  sssGrad.addColorStop(0.75, 'rgba(0,0,0,0)');
  sssGrad.addColorStop(1, 'rgba(200,80,40,0.07)');
  ctx.fillStyle = sssGrad;
  ctx.beginPath(); ctx.arc(cx, cy, w*0.35, 0, Math.PI*2); ctx.fill();
  // Under-eye shadow
  ctx.fillStyle = 'rgba(0,0,0,0.07)';
  ctx.beginPath(); ctx.ellipse(cx - w*0.1, cy + h*0.01, w*0.08, h*0.025, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + w*0.1, cy + h*0.01, w*0.08, h*0.025, 0, 0, Math.PI*2); ctx.fill();

  // Forehead highlight
  const hlGrad = ctx.createRadialGradient(cx - w*0.05, cy - h*0.18, 2, cx - w*0.05, cy - h*0.18, w*0.18);
  hlGrad.addColorStop(0, 'rgba(255,255,255,0.15)');
  hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hlGrad;
  ctx.beginPath(); ctx.arc(cx, cy - h*0.15, w*0.22, 0, Math.PI * 2); ctx.fill();

  // ── Hair front/top ──
  ctx.fillStyle = st.hair;
  if (isMale) {
    ctx.beginPath();
    ctx.ellipse(cx, cy - h*0.25, w*0.27, h*0.1, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    // Side parts
    ctx.beginPath();
    ctx.ellipse(cx - w*0.22, cy - h*0.18, w*0.08, h*0.09, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + w*0.22, cy - h*0.18, w*0.08, h*0.09, -0.3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Part and bangs
    ctx.beginPath();
    ctx.ellipse(cx, cy - h*0.23, w*0.29, h*0.11, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    // Bangs with natural curve
    ctx.beginPath();
    ctx.moveTo(cx - w*0.25, cy - h*0.16);
    ctx.quadraticCurveTo(cx - w*0.05, cy - h*0.28, cx + w*0.1, cy - h*0.18);
    ctx.quadraticCurveTo(cx + w*0.05, cy - h*0.18, cx - w*0.02, cy - h*0.18);
    ctx.quadraticCurveTo(cx - w*0.1, cy - h*0.22, cx - w*0.25, cy - h*0.16);
    ctx.fill();
  }

  // ── Eyebrows ──
  const browY = cy - h*0.1;
  ctx.strokeStyle = st.hair;
  ctx.lineWidth = isMale ? 3 : 2;
  ctx.lineCap = 'round';
  [cx - w*0.1, cx + w*0.1].forEach((bx, i) => {
    const tilt = i === 0 ? 2 : -2;
    ctx.beginPath();
    ctx.moveTo(bx - w*0.08, browY + tilt);
    ctx.quadraticCurveTo(bx, browY - 4, bx + w*0.08, browY + tilt);
    ctx.stroke();
  });

  // ── Eyes ──
  const eyeY = cy - h*0.04;
  const eyeW = w*0.09, eyeH2 = h*0.065 * eyeBlinkState;

  [cx - w*0.1, cx + w*0.1].forEach((ex, i) => {
    // Eye shadow
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY + 2, eyeW + 2, eyeH2 + 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // White
    ctx.fillStyle = '#FAFAFA';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, eyeW, Math.max(1, eyeH2), 0, 0, Math.PI * 2);
    ctx.fill();

    if (eyeBlinkState > 0.25) {
      // Iris gradient
      const irisGrad = ctx.createRadialGradient(ex - 1, eyeY - 1, 1, ex, eyeY, eyeW * 0.65);
      irisGrad.addColorStop(0, st.eye + 'FF');
      irisGrad.addColorStop(0.6, st.eye + 'CC');
      irisGrad.addColorStop(1, st.eye + '88');
      ctx.fillStyle = irisGrad;
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeW*0.65, eyeW*0.65*eyeBlinkState, 0, 0, Math.PI*2);
      ctx.fill();

      // Pupil
      ctx.fillStyle = '#0A0A0A';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeW*0.32, eyeW*0.32*eyeBlinkState, 0, 0, Math.PI*2);
      ctx.fill();

      // Catchlight
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.beginPath();
      ctx.ellipse(ex + eyeW*0.2, eyeY - eyeW*0.2, eyeW*0.15, eyeW*0.15, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.ellipse(ex - eyeW*0.15, eyeY + eyeW*0.1, eyeW*0.08, eyeW*0.08, 0, 0, Math.PI*2);
      ctx.fill();
    }

    // Upper eyelid line
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, eyeW, Math.max(1, eyeH2), 0, Math.PI, Math.PI*2);
    ctx.stroke();

    // Lashes
    ctx.strokeStyle = '#1A0A0A';
    ctx.lineWidth = 1.2;
    for (let l = -3; l <= 3; l++) {
      const lx = ex + l * eyeW / 3.5;
      const ly = eyeY - Math.max(0.5, eyeH2) - 1;
      const ldy = isMale ? -2 : -3.5;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + l*0.3, ly + ldy);
      ctx.stroke();
    }
  });

  // ── Nose ──
  ctx.strokeStyle = st.skin2;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  // Bridge
  ctx.beginPath();
  ctx.moveTo(cx - 3, eyeY + h*0.06);
  ctx.bezierCurveTo(cx - 5, cy + h*0.06, cx - 5, cy + h*0.1, cx - 4, cy + h*0.12);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 3, eyeY + h*0.06);
  ctx.bezierCurveTo(cx + 5, cy + h*0.06, cx + 5, cy + h*0.1, cx + 4, cy + h*0.12);
  ctx.stroke();
  // Nostrils
  ctx.fillStyle = st.skin2 + '99';
  ctx.beginPath();
  ctx.ellipse(cx - 8, cy + h*0.13, 5, 3.5, -0.4, 0, Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 8, cy + h*0.13, 5, 3.5, 0.4, 0, Math.PI*2);
  ctx.fill();

  // ── Mouth ──
  const mY = cy + h*0.2;
  const mW2 = isMale ? 22 : 18;
  const mH2 = Math.max(0.5, mouthOpen * 11);

  // Upper lip
  ctx.fillStyle = st.lip;
  ctx.beginPath();
  ctx.moveTo(cx - mW2, mY);
  ctx.bezierCurveTo(cx - mW2*0.6, mY - 5, cx - mW2*0.2, mY - 7, cx, mY - 4);
  ctx.bezierCurveTo(cx + mW2*0.2, mY - 7, cx + mW2*0.6, mY - 5, cx + mW2, mY);
  ctx.bezierCurveTo(cx + mW2*0.5, mY - 1, cx - mW2*0.5, mY - 1, cx - mW2, mY);
  ctx.fill();

  // Lower lip
  const lipGrad = ctx.createLinearGradient(0, mY, 0, mY + mH2 + 8);
  lipGrad.addColorStop(0, st.lip);
  lipGrad.addColorStop(0.5, st.lip + 'DD');
  lipGrad.addColorStop(1, st.lip + '88');
  ctx.fillStyle = lipGrad;
  ctx.beginPath();
  ctx.moveTo(cx - mW2, mY);
  ctx.bezierCurveTo(cx - mW2*0.7, mY + mH2 + 7, cx + mW2*0.7, mY + mH2 + 7, cx + mW2, mY);
  ctx.bezierCurveTo(cx + mW2*0.5, mY + 1, cx - mW2*0.5, mY + 1, cx - mW2, mY);
  ctx.fill();

  // Mouth interior
  if (mouthOpen > 0.08) {
    ctx.fillStyle = '#2A0808';
    ctx.beginPath();
    ctx.ellipse(cx, mY + mH2*0.3, mW2*0.75, mH2*0.8, 0, 0, Math.PI*2);
    ctx.fill();
    // Teeth
    if (mouthOpen > 0.2) {
      ctx.fillStyle = '#F8F4F0';
      ctx.beginPath();
      ctx.ellipse(cx, mY + 1, mW2*0.6, Math.min(mH2*0.55, 6), 0, 0, Math.PI);
      ctx.fill();
    }
  }

  // Lip highlight
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.ellipse(cx, mY + mH2*0.5 + 2, mW2*0.35, 2.5, 0, 0, Math.PI*2);
  ctx.fill();

  // ── Cheeks ──
  ctx.fillStyle = st.blush;
  ctx.beginPath(); ctx.ellipse(cx - w*0.18, cy + h*0.1, 20, 12, 0.2, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + w*0.18, cy + h*0.1, 20, 12, -0.2, 0, Math.PI*2); ctx.fill();

  // ── Chin shadow ──
  const chinGrad = ctx.createRadialGradient(cx, cy + h*0.3, 2, cx, cy + h*0.3, w*0.18);
  chinGrad.addColorStop(0, 'rgba(0,0,0,0.1)');
  chinGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = chinGrad;
  ctx.beginPath(); ctx.ellipse(cx, cy + h*0.3, w*0.16, h*0.06, 0, 0, Math.PI*2); ctx.fill();

  // ── Philtrum (nose-lip groove) ──
  ctx.strokeStyle = `${st.skin2}66`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 4, cy + h*0.14);
  ctx.lineTo(cx - 3, mY - 1);
  ctx.moveTo(cx + 4, cy + h*0.14);
  ctx.lineTo(cx + 3, mY - 1);
  ctx.stroke();

  // ── Speaking pulse ──
  if (speaking) {
    const p = 0.3 + Math.abs(Math.sin(Date.now()/200))*0.6;
    ctx.strokeStyle = `rgba(255,255,255,${p*0.4})`;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(cx, cy, w*0.47, 0, Math.PI*2); ctx.stroke();
  }
}





function lightenColor(hex, amount) {
  const num = parseInt(hex.replace('#',''), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}

function updateCallPortrait() {
  const c = getCurrentCompanion();
  const portrait = document.getElementById('callPortrait');
  const canvas = document.getElementById('callFaceCanvas');
  const videoBg = document.querySelector('.video-bg');

  let portraitUrl = null;
  if (c.facePreset === 'custom' && c.faceCustomUrl) {
    portraitUrl = c.faceCustomUrl;
  } else {
    const preset = FACE_PRESETS.find(p => p.id === (c.facePreset || 'auto'));
    if (preset?.url) {
      portraitUrl = preset.url;
    } else if (!preset || preset.id === 'auto') {
      // Auto: derive a real photo from companion name so every AI gets a real face
      const seed = encodeURIComponent((c.name || 'ai').toLowerCase().replace(/\s+/g, '-'));
      portraitUrl = `https://i.pravatar.cc/400?u=${seed}`;
    }
  }

  if (portraitUrl) {
    const img = document.getElementById('callPortraitImg');
    img.src = portraitUrl;
    img.onerror = () => {
      portrait.style.display = 'none';
      canvas.style.display = 'block';
      videoBg?.classList.remove('portrait-mode');
      videoBg?.style.removeProperty('--portrait-bg');
      startCallFaceAnimation();
    };
    portrait.style.display = 'flex';
    canvas.style.display = 'none';
    if (videoBg) {
      videoBg.style.setProperty('--portrait-bg', `url('${portraitUrl}')`);
      videoBg.classList.add('portrait-mode');
    }
  } else {
    portrait.style.display = 'none';
    canvas.style.display = 'block';
    videoBg?.classList.remove('portrait-mode');
    videoBg?.style.removeProperty('--portrait-bg');
  }
}

function startCallFaceAnimation() {
  const canvas = document.getElementById('callFaceCanvas');
  if (canvas.style.display === 'none') return;
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
  if (callSpeaking) return;
  const phrases = buildCallPhrases();
  const phrase = phrases[Math.floor(Math.random() * phrases.length)];

  callSpeaking = true;
  document.getElementById('callSpeakIndicator')?.classList.add('speaking');
  document.getElementById('callPortrait')?.classList.add('speaking');

  const controller = new AbortController();
  const ttsTimeout = setTimeout(() => controller.abort(), 8000);

  try {
    const companion = getCurrentCompanion();
    const res = await fetch('/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: phrase, companion }),
      signal: controller.signal
    });
    clearTimeout(ttsTimeout);

    if (!res.ok) throw new Error('TTS failed');

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    const stopPortraitSpeak = () => {
      callSpeaking = false;
      document.getElementById('callSpeakIndicator')?.classList.remove('speaking');
      document.getElementById('callPortrait')?.classList.remove('speaking');
    };
    audio.onended = () => { stopPortraitSpeak(); URL.revokeObjectURL(url); };
    audio.onerror = () => stopPortraitSpeak();
    audio.play();
  } catch (e) {
    clearTimeout(ttsTimeout);
    callSpeaking = false;
    document.getElementById('callSpeakIndicator')?.classList.remove('speaking');
    document.getElementById('callPortrait')?.classList.remove('speaking');
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
  updateCallPortrait();
  startCallFaceAnimation();

  // Non-blocking — never delays call startup
  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
      videoStream = stream;
      stream.getVideoTracks().forEach(t => t.enabled = false);
      const selfEl = document.querySelector('.video-self-inner');
      const video = document.createElement('video');
      video.srcObject = stream; video.autoplay = true; video.muted = true; video.playsInline = true;
      video.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:10px;opacity:0;';
      selfEl.innerHTML = ''; selfEl.appendChild(video);
    })
    .catch(e => console.warn('No media:', e));

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
    setTimeout(() => speakCallPhrase(), 600);
    callInterval = setInterval(() => { if (Math.random() > 0.3) speakCallPhrase(); }, 12000 + Math.random()*6000);
  }, 500);
}

function stopVideoCall() {
  if (videoStream) { videoStream.getTracks().forEach(t => t.stop()); videoStream = null; }
  if (callInterval) { clearInterval(callInterval); callInterval = null; }
  if (callTimerInterval) { clearInterval(callTimerInterval); callTimerInterval = null; }
  window.speechSynthesis.cancel();
  callSpeaking = false;
  document.getElementById('callPortrait')?.classList.remove('speaking');
  stopCallFaceAnimation();
  const vbg = document.querySelector('.video-bg');
  vbg?.classList.remove('portrait-mode');
  vbg?.style.removeProperty('--portrait-bg');
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
  const dot = document.getElementById('statusDot');
  const txt = document.getElementById('statusText');
  if (dot) dot.classList.add('dot-typing');
  if (txt) txt.textContent = 'typing...';
}
function hideTyping() {
  document.getElementById('typingIndicator')?.remove();
  const dot = document.getElementById('statusDot');
  const txt = document.getElementById('statusText');
  if (dot) dot.classList.remove('dot-typing');
  if (txt) txt.textContent = 'Active now';
}

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
  overlay.innerHTML = `<div style="background:#1a1a2e;border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:24px;width:280px;text-align:center;"><div style="font-size:15px;color:#f0f0f0;margin-bottom:20px;">${message}</div><div style="display:flex;gap:10px;"><button id="confirmCancel" style="flex:1;padding:10px;border-radius:12px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);color:#f0f0f0;cursor:pointer;font-size:14px;">Cancel</button><button id="confirmOk" style="flex:1;padding:10px;border-radius:12px;border:none;background:#ff3b30;color:#fff;cursor:pointer;font-size:14px;font-weight:600;">Delete</button></div></div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#confirmCancel').onclick = () => overlay.remove();
  overlay.querySelector('#confirmOk').onclick = () => { overlay.remove(); onConfirm(); };
}


// ─── MULTI-SELECT DELETE ──────────────────────
let selectMode = false;
const selectedRows = new Set();

function toggleSelectMode() {
  selectMode = !selectMode;
  selectedRows.clear();
  document.querySelectorAll('.msg-row').forEach(row => {
    row.classList.remove('selected');
    const cb = row.querySelector('.msg-checkbox');
    if (cb) cb.style.display = selectMode ? 'flex' : 'none';
  });
  const bar = document.getElementById('selectBar');
  if (bar) { bar.style.display = selectMode ? 'flex' : 'none'; bar.style.setProperty('display', selectMode ? 'flex' : 'none', 'important'); }
  updateSelectCount();
}

function toggleSelectRow(row) {
  if (!selectMode) return;
  const cb = row.querySelector('.msg-checkbox');
  if (selectedRows.has(row)) {
    selectedRows.delete(row);
    row.classList.remove('selected');
    if (cb) cb.classList.remove('checked');
  } else {
    selectedRows.add(row);
    row.classList.add('selected');
    if (cb) cb.classList.add('checked');
  }
  updateSelectCount();
}

function updateSelectCount() {
  const el = document.getElementById('selectCount');
  if (el) el.textContent = selectedRows.size > 0 ? `${selectedRows.size} selected` : 'Select messages';
}

function deleteSelected() {
  if (!selectedRows.size) return;
  showConfirm(`Delete ${selectedRows.size} message${selectedRows.size>1?'s':''}?`, () => {
    selectedRows.forEach(row => {
      row.style.opacity = '0'; row.style.transform = 'scale(0.9)'; row.style.transition = 'all 0.15s';
      setTimeout(() => row.remove(), 150);
    });
    selectedRows.clear();
    toggleSelectMode();
    setTimeout(() => {
      saveChatToStorage();
      chatCaches[currentId] = '';
    }, 300);
  });
}

function selectAll() {
  document.querySelectorAll('.msg-row').forEach(row => {
    selectedRows.add(row); row.classList.add('selected');
    const cb = row.querySelector('.msg-checkbox');
    if (cb) cb.classList.add('checked');
  });
  updateSelectCount();
}

// ─── RENDER MESSAGE ───────────────────────────
function renderMessage(item, sender) {
  const chat = document.getElementById('chat');
  const div = document.createElement('div'); div.className = `msg ${sender}`;

  if (item.type === 'text') {
    const c = getCurrentCompanion();
    const showTranslate = c.language !== 'en';
    div.innerHTML = `
      <div class="translate-wrap">
        <div class="msg-text-inner translate-content">${escapeHtml(item.content)}</div>
        ${showTranslate ? `<button class="translate-btn" title="Translate" onclick="translateText('${escapeHtml(item.content).replace(/'/g, "\'")}', 'en', this)">🌐</button>` : ''}
      </div>`;
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
        ${showTranslate ? `<button class="translate-btn small" title="Translate to English" onclick="translateText('${escapeHtml(voiceText).replace(/'/g, "\'")}', 'en', this)">🌐</button>` : ''}
      </div>`;

    div.appendChild(voiceBar);
    div.appendChild(transcriptWrap);
  }

  const row = document.createElement('div'); row.className = 'msg-row ' + sender;
  // Checkbox
  const checkbox = document.createElement('div');
  checkbox.className = 'msg-checkbox';
  checkbox.style.display = 'none';
  checkbox.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
  checkbox.onclick = e => { e.stopPropagation(); toggleSelectRow(row); };
  row.appendChild(checkbox);
  // Long-press to enter select mode
  let _pt;
  // Long press on the message div itself
  row.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, a, .msg-action-btn, .voice-play')) return;
    _pt = setTimeout(() => {
      navigator.vibrate && navigator.vibrate(30);
      if (!selectMode) toggleSelectMode();
      toggleSelectRow(row);
    }, 500);
  });
  row.addEventListener('pointerup', () => clearTimeout(_pt));
  row.addEventListener('pointercancel', () => clearTimeout(_pt));
  row.addEventListener('pointermove', (e) => { if (e.movementX**2 + e.movementY**2 > 25) clearTimeout(_pt); });
  // Tap to select when in select mode
  row.addEventListener('click', (e) => {
    if (!selectMode) return;
    if (e.target.closest('button, .msg-checkbox')) return;
    toggleSelectRow(row);
  });
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
  delBtn.className = 'msg-action-btn';
  delBtn.title = 'Delete';
  delBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';
  delBtn.style.cssText = 'background:rgba(255,59,48,0.08);border-color:rgba(255,59,48,0.2);';
  delBtn.onclick = () => showConfirm('Delete this message?', () => {
    row.style.opacity = '0'; row.style.transform = 'scale(0.9)'; row.style.transition = 'all 0.2s';
    setTimeout(() => { row.remove(); saveChatToStorage(); chatCaches[currentId] = ''; }, 200);
  });
  actEl.appendChild(delBtn);

  // Edit button (user text only)
  if (sender === 'user' && item.type === 'text') {
    const contentEl = div.querySelector('.translate-content') || div.querySelector('.msg-text-inner');
    const editBtn = document.createElement('button');
    editBtn.className = 'msg-action-btn';
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
const _voicePlaceholderRE = /^(spoken version|placeholder|\[.*\]|0:\d\d)$/i;
function playVoiceBar(btn) {
  let el = btn;
  while (el && !el.classList.contains('msg-voice')) el = el.parentElement;
  if (!el) return;
  const text = el.querySelector('.voice-text')?.textContent?.trim();
  if (!text || _voicePlaceholderRE.test(text)) { showToast('no audio for this message'); return; }
  animateWaves(el); playVoice(text);
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

  // ── EDIT MODE: update in-place, wipe stale AI responses ──
  if (window._editMode && window._editingRow) {
    const editingRow = window._editingRow;
    const contentEl = editingRow.querySelector('.translate-content') || editingRow.querySelector('.msg-text-inner');
    if (contentEl) contentEl.textContent = msg;
    const wrap = contentEl?.closest('.translate-wrap') || contentEl?.parentElement;
    if (wrap && !editingRow.querySelector('.edited-label')) {
      const lbl = document.createElement('span'); lbl.className = 'edited-label'; lbl.textContent = 'edited';
      wrap.appendChild(lbl);
    }
    // Remove every row that comes after the edited one (stale AI replies)
    let next = editingRow.nextElementSibling;
    while (next) { const rm = next; next = next.nextElementSibling; if (rm.classList.contains('msg-row')) rm.remove(); }
    input.value = '';
    window._editMode = false; window._editingRow = null;
    editingRow.classList.remove('editing');
    const bar = document.getElementById('replyBar');
    bar.classList.remove('active', 'edit-mode');
    document.getElementById('replyBarText').textContent = '';
    setTimeout(saveChatToStorage, 100);
    sendToAI(`[User edited their previous message to]: ${msg}`, msg);
    return;
  }

  // ── NORMAL SEND ──────────────────────────────
  const item = { type:'text', content:msg };
  if (replyingTo) { item.replyTo = replyingTo; cancelReply(); }
  renderMessage(item, 'user'); input.value = '';

  const c = getCurrentCompanion(); c.lastMessage = msg; c.lastTime = Date.now();
  saveCompanions(); renderSidebar();

  sendToAI(msg);
  setTimeout(saveChatToStorage, 100);
}

async function sendToAI(text, originalText) {
  showTyping();
  const c = getCurrentCompanion();

  // Get time and rough location for context
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  const dateStr = now.toLocaleDateString([], { weekday:'long', month:'long', day:'numeric' });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  let locationStr = tz; // fallback
  try {
    const pos = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, { timeout: 2000 })
    );
    locationStr = `${pos.coords.latitude.toFixed(2)},${pos.coords.longitude.toFixed(2)}`;
  } catch {}

  try {
    const res = await fetch('http://localhost:3000/chat', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ message: originalText || text, fullMessage: text, companionId:c.id, companion:c, context: { time: timeStr, date: dateStr, timezone: tz, location: locationStr } })
    });
    hideTyping();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.profile) localStorage.setItem('0816_profile', JSON.stringify(data.profile));
    (data.messages||[]).forEach(m => renderMessage(m, 'ai'));
    if (data.emojiReaction) setTimeout(()=>addReactionToLastUserMsg(data.emojiReaction), 600);
    setTimeout(saveChatToStorage, 500);

    // Gamification + UX
    const hasVoice = (data.messages||[]).some(m => m.type === 'voice');
    addXp(currentId, hasVoice ? 15 : 10);
    updateStreak(currentId);
    playChime();
    const firstText = (data.messages||[]).find(m => m.type === 'text')?.content || '';
    setCompanionMood(currentId, detectMood(firstText));

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

  // Restore user photo
  const savedUserPhoto = getUserPhoto();
  if (savedUserPhoto) setUserPhoto(savedUserPhoto);

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
  setTimeout(() => { row.remove(); saveChatToStorage(); chatCaches[currentId] = ''; }, 200);
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


// ─── LOAD HISTORY FROM SERVER ─────────────────
async function loadServerHistory(companionId) {
  try {
    const res = await fetch('/get-history?companionId=' + companionId);
    const data = await res.json();
    if (!data.messages || !data.messages.length) return;
    const chat = document.getElementById('chat');
    chat.innerHTML = '';
    data.messages.forEach(msg => {
      if (msg.role === 'user') {
        renderMessage({ type: 'text', content: msg.content }, 'user');
      } else if (msg.role === 'assistant') {
        // Try to parse as JSON (AI responses are stored as JSON)
        try {
          const parsed = JSON.parse(msg.content);
          if (parsed.messages) {
            parsed.messages.forEach(m => renderMessage(m, 'ai'));
          } else {
            renderMessage({ type: 'text', content: msg.content }, 'ai');
          }
        } catch {
          renderMessage({ type: 'text', content: msg.content }, 'ai');
        }
      }
    });
    scrollToBottom();
  } catch(e) { console.warn('Could not load server history:', e); }
}

// ─── CHAT HISTORY PERSISTENCE ─────────────────
const CHAT_STORAGE_KEY = 'chatty-ai_chat_history';

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
    else if (voiceEl) {
      const vt = voiceEl.textContent?.trim();
      if (vt && !_voicePlaceholderRE.test(vt)) messages.push({ type: 'voice', sender, content: '0:02', textToRead: vt });
      // skip saving voice bars with no real text
    }
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
  messages.forEach(msg => {
    // Drop voice bars that have placeholder text — they have no audio
    if (msg.type === 'voice' && (!msg.textToRead || _voicePlaceholderRE.test(msg.textToRead.trim()))) return;
    renderMessage(msg, msg.sender);
  });
}
// ─── PHOTO UPLOADS ────────────────────────────
function compressPhoto(file, maxSize, cb) {
  if (file.type === 'image/gif') {
    if (file.size > 3 * 1024 * 1024) { showToast('GIF too large (max 3MB)'); return; }
    const r = new FileReader(); r.onload = e => cb(e.target.result); r.readAsDataURL(file);
    return;
  }
  const r = new FileReader();
  r.onload = e => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
      const w = Math.round(img.width * ratio), h = Math.round(img.height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      try { cb(canvas.toDataURL('image/jpeg', 0.82)); } catch { cb(e.target.result); }
    };
    img.src = e.target.result;
  };
  r.readAsDataURL(file);
}

// ── User profile photo ──
function getUserPhoto() { return localStorage.getItem('chatty-ai_user_photo') || ''; }

function setUserPhoto(url) {
  try { localStorage.setItem('chatty-ai_user_photo', url); } catch { showToast('Storage full — try a smaller photo'); return; }
  const btn = document.getElementById('userPhotoBtn');
  if (btn) {
    if (url) { btn.style.backgroundImage = `url(${url})`; btn.textContent = ''; }
    else { btn.style.backgroundImage = ''; btn.textContent = '👤'; }
  }
}

function handleUserPhotoUpload(input) {
  const file = input.files[0]; if (!file) return; input.value = '';
  compressPhoto(file, 300, url => { setUserPhoto(url); showToast('Your photo updated ✨'); });
}

// ── AI companion photo ──
function handleAIPhotoUpload(input) {
  const file = input.files[0]; if (!file) return; input.value = '';
  compressPhoto(file, 400, url => {
    const c = getCurrentCompanion();
    c.customPhoto = url;
    saveCompanions();
    _applyCompanionPhotos(c);
    renderSidebar(document.querySelector('.sidebar-search')?.value || '');
    showToast(`${c.name}'s photo updated ✨`);
  });
}

function _applyCompanionPhotos(c) {
  // Topbar avatar
  const emoji = document.getElementById('topbarEmoji');
  const photo = document.getElementById('topbarAvatarPhoto');
  if (emoji && photo) {
    if (c.customPhoto) { photo.src = c.customPhoto; photo.style.display = 'block'; emoji.style.display = 'none'; }
    else { photo.style.display = 'none'; emoji.style.display = ''; emoji.textContent = c.avatar; }
  }
  // Profile screen avatar
  const bigEmoji = document.getElementById('profileAvatarBig');
  const bigPhoto = document.getElementById('profileAvatarPhoto');
  if (bigEmoji && bigPhoto) {
    if (c.customPhoto) { bigPhoto.src = c.customPhoto; bigPhoto.style.display = 'block'; bigEmoji.style.display = 'none'; }
    else { bigPhoto.style.display = 'none'; bigEmoji.style.display = ''; bigEmoji.textContent = c.avatar; }
  }
}

// ── Custom chat background ──
function handleChatBgUpload(input) {
  const file = input.files[0]; if (!file) return; input.value = '';
  compressPhoto(file, 1400, url => {
    const c = getCurrentCompanion();
    c.chatBgCustom = url; c.chatBg = 'custom';
    saveCompanions();
    applyCompanionTheme(c.id);
    showToast('Chat background updated ✨');
  });
}

// ─── MOOD SYSTEM ──────────────────────────────
const MOOD_COLORS = { happy:'#FFD60A', excited:'#FF9F0A', playful:'#30D158', curious:'#5E5CE6', tired:'#636366', melancholy:'#0084FF' };
const MOOD_ICONS  = { happy:'😊', excited:'🔥', playful:'😄', curious:'🤔', tired:'😴', melancholy:'🌙' };

function detectMood(text) {
  if (!text) return 'happy';
  const t = text.toLowerCase();
  if (/tired|sleepy|exhausted|ugh|meh|😴|😑/.test(t)) return 'tired';
  if (/miss|sad|lonely|sigh|😔|💔|😢/.test(t)) return 'melancholy';
  if (/hmm|wonder|curious|really\?|tell me|🤔/.test(t)) return 'curious';
  if (/lol|haha|😄|🤪|silly|fun|hilarious/.test(t)) return 'playful';
  if (/!|amazing|love|great|yay|🥰|😍|🔥|✨|wow/.test(t)) return 'excited';
  return 'happy';
}

function setCompanionMood(id, mood) {
  const c = getCompanion(id);
  if (!c || c.mood === mood) return;
  c.mood = mood;
  saveCompanions();
  if (id === currentId) updateStatusRing(mood);
}

function updateStatusRing(mood) {
  const avatar = document.getElementById('topbarAvatar');
  if (!avatar) return;
  const color = MOOD_COLORS[mood] || '#0084FF';
  avatar.style.boxShadow = `0 0 0 2px ${color}, 0 0 10px ${color}55`;
  const sidebarItem = document.querySelector(`.companion-item.active .companion-avatar`);
  if (sidebarItem) sidebarItem.style.boxShadow = `0 0 0 2px ${color}, 0 0 8px ${color}44`;
}

// ─── XP / LEVEL SYSTEM ────────────────────────
const XP_THRESHOLDS = [0, 100, 250, 500, 900, 1400, 2000];
const LEVEL_NAMES   = ['Strangers', 'Acquaintances', 'Friends', 'Close Friends', 'Best Friends', 'Soulmates', 'Bonded ✨'];

function getXpData(id)       { return JSON.parse(localStorage.getItem(`chatty-xp-${id}`) || '{"xp":0,"level":0}'); }
function saveXpData(id, data){ localStorage.setItem(`chatty-xp-${id}`, JSON.stringify(data)); }

function addXp(id, amount) {
  const data = getXpData(id);
  data.xp += amount;
  const oldLevel = data.level;
  while (data.level < XP_THRESHOLDS.length - 1 && data.xp >= XP_THRESHOLDS[data.level + 1]) data.level++;
  saveXpData(id, data);
  if (data.level > oldLevel) showToast(`💫 Level up! Now: ${LEVEL_NAMES[data.level] || 'Bonded'}`);
  if (id === currentId) _refreshXpDisplay(id);
}

function _refreshXpDisplay(id) {
  const data = getXpData(id);
  const lvl = data.level;
  const prev = XP_THRESHOLDS[lvl] || 0;
  const next = XP_THRESHOLDS[lvl + 1];
  const pct  = next ? Math.min(100, ((data.xp - prev) / (next - prev)) * 100) : 100;
  const fill = document.getElementById('xpBarFill');
  const name = document.getElementById('xpLevelName');
  if (fill) fill.style.width = pct + '%';
  if (name) name.textContent = LEVEL_NAMES[lvl] || 'Bonded ✨';
  const sc = document.getElementById('streakCount');
  if (sc) sc.textContent = '🔥 ' + getStreak(id);
}

// ─── DAILY STREAK ─────────────────────────────
function updateStreak(id) {
  const key = `chatty-streak-${id}`;
  const data = JSON.parse(localStorage.getItem(key) || '{"streak":0,"lastDate":""}');
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (data.lastDate === today) return;
  data.streak = (data.lastDate === yesterday) ? data.streak + 1 : 1;
  data.lastDate = today;
  localStorage.setItem(key, JSON.stringify(data));
  if (data.streak > 1) showToast(`🔥 ${data.streak} day streak!`);
}
function getStreak(id) { return JSON.parse(localStorage.getItem(`chatty-streak-${id}`) || '{"streak":0}').streak || 0; }

// ─── NOTIFICATION CHIME ───────────────────────
let _audioCtx = null;
function playChime() {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = _audioCtx;
    [[523.25, 0], [659.25, 0.1], [783.99, 0.2]].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = 'sine';
      const t = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.15, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.start(t); osc.stop(t + 0.55);
    });
  } catch {}
}

// ─── CHAT BACKGROUND THEMES ───────────────────
const BG_THEMES = {
  default: '',
  ocean:   'radial-gradient(ellipse at 20% 80%, rgba(0,80,160,0.3) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(0,160,200,0.2) 0%, transparent 50%)',
  forest:  'radial-gradient(ellipse at 30% 70%, rgba(0,80,40,0.35) 0%, transparent 60%), radial-gradient(ellipse at 70% 30%, rgba(40,120,20,0.2) 0%, transparent 50%)',
  sunset:  'radial-gradient(ellipse at 50% 100%, rgba(200,60,30,0.3) 0%, transparent 60%), radial-gradient(ellipse at 50% 0%, rgba(120,40,160,0.25) 0%, transparent 50%)',
  cosmic:  'radial-gradient(ellipse at 20% 20%, rgba(100,40,200,0.3) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(0,100,200,0.25) 0%, transparent 50%)',
  cherry:  'radial-gradient(ellipse at 60% 40%, rgba(200,60,100,0.3) 0%, transparent 60%), radial-gradient(ellipse at 30% 80%, rgba(160,40,80,0.2) 0%, transparent 50%)',
};

function applyCompanionTheme(id) {
  const c = getCompanion(id);
  const chat = document.getElementById('chat');
  if (!chat) return;
  if (c.chatBg === 'custom' && c.chatBgCustom) {
    chat.style.background = `linear-gradient(rgba(6,6,14,0.62), rgba(6,6,14,0.62)), url(${c.chatBgCustom}) center/cover`;
  } else {
    chat.style.background = BG_THEMES[c.chatBg || 'default'] || '';
  }
  document.querySelectorAll('.bg-dot').forEach(d => d.classList.toggle('active', d.dataset.theme === (c.chatBg || 'default')));
}

function setChatBg(theme) {
  const c = getCurrentCompanion();
  c.chatBg = theme;
  saveCompanions();
  applyCompanionTheme(c.id);
}

// ─── CHAT SEARCH ──────────────────────────────
let _searchOpen = false, _searchMatches = [], _searchIdx = 0;

function toggleChatSearch() {
  _searchOpen = !_searchOpen;
  const bar = document.getElementById('chatSearchBar');
  if (!bar) return;
  if (_searchOpen) {
    bar.style.display = 'flex';
    document.getElementById('chatSearchInput')?.focus();
  } else {
    bar.style.display = 'none';
    const inp = document.getElementById('chatSearchInput');
    if (inp) inp.value = '';
    _clearSearchHL(); _searchMatches = [];
    document.getElementById('searchCount').textContent = '';
  }
}

function runChatSearch(val) {
  _clearSearchHL(); _searchMatches = []; _searchIdx = 0;
  if (!val.trim()) { document.getElementById('searchCount').textContent = ''; return; }
  document.querySelectorAll('.msg-row').forEach(row => {
    const txt = row.querySelector('.translate-content, .msg-text-inner, .voice-text')?.textContent || '';
    if (txt.toLowerCase().includes(val.toLowerCase())) { row.classList.add('search-match'); _searchMatches.push(row); }
  });
  _applySearchCurrent();
}

function searchNav(dir) {
  if (!_searchMatches.length) return;
  _searchMatches[_searchIdx]?.classList.remove('search-current');
  _searchIdx = (_searchIdx + dir + _searchMatches.length) % _searchMatches.length;
  _applySearchCurrent();
}

function _applySearchCurrent() {
  const el = _searchMatches[_searchIdx];
  if (el) { el.classList.add('search-current'); el.scrollIntoView({ behavior:'smooth', block:'center' }); }
  const cnt = document.getElementById('searchCount');
  if (cnt) cnt.textContent = _searchMatches.length ? `${_searchIdx+1}/${_searchMatches.length}` : '0';
}

function _clearSearchHL() {
  document.querySelectorAll('.search-match,.search-current').forEach(el => el.classList.remove('search-match','search-current'));
}

// ─── EXPORT CHAT ──────────────────────────────
function exportChat() {
  const c = getCurrentCompanion();
  let text = `chatty-ai — ${c.name}\nExported: ${new Date().toLocaleString()}\n${'─'.repeat(40)}\n\n`;
  document.querySelectorAll('.msg-row').forEach(row => {
    const who = row.classList.contains('user') ? 'You' : c.name;
    const content = row.querySelector('.translate-content, .msg-text-inner, .voice-text')?.textContent?.trim();
    if (content) text += `${who}: ${content}\n`;
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type:'text/plain' }));
  a.download = `${c.name}-chat.txt`; a.click();
}

window.translateText = translateText;
window.deleteMessage = deleteMessage;
window.showConfirm = showConfirm;
window.editMessage = editMessage;
window.cancelEdit = cancelEdit;
window.toggleTranscript = toggleTranscript;
window.toggleSelectMode = toggleSelectMode;
window.deleteSelected = deleteSelected;
window.selectAll = selectAll;
window.selectVoice = selectVoice;
window.selectFacePreset = selectFacePreset;
window.renderFacePresets = renderFacePresets;
window.onFaceNameInput = onFaceNameInput;
window.setFaceRegion = setFaceRegion;
window.setFaceStudioStyle = setFaceStudioStyle;
window.toggleFaceStudio = toggleFaceStudio;
window.applyFaceStudio = applyFaceStudio;
window.handleFaceUpload = handleFaceUpload;
window.handleDialogueUpload = handleDialogueUpload;
window.clearDialogueSample = clearDialogueSample;
window.toggleChatSearch = toggleChatSearch;
window.runChatSearch = runChatSearch;
window.searchNav = searchNav;
window.exportChat = exportChat;
window.setChatBg = setChatBg;
window.handleUserPhotoUpload = handleUserPhotoUpload;
window.handleAIPhotoUpload = handleAIPhotoUpload;
window.handleChatBgUpload = handleChatBgUpload;
