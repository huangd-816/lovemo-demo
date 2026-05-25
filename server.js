import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(join(__dirname, 'index.html')));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── GIPHY ────────────────────────────────────
async function fetchGif(query) {
  try {
    const key = process.env.GIPHY_API_KEY;
    const r = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(query)}&limit=10&rating=pg-13`);
    const d = await r.json();
    if (d.data?.length > 0) {
      const pick = d.data[Math.floor(Math.random() * Math.min(5, d.data.length))];
      return pick.images.original.url;
    }
  } catch(e) { console.error('Giphy:', e.message); }
  return null;
}

app.get('/giphy/search', async (req, res) => {
  try {
    const key = process.env.GIPHY_API_KEY;
    const r = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(req.query.q)}&limit=12&rating=pg-13`);
    const d = await r.json();
    res.json({ gifs: (d.data||[]).map(g => ({ id:g.id, url:g.images.original.url, preview:g.images.fixed_width_small.url, title:g.title })) });
  } catch { res.json({ gifs: [] }); }
});

app.get('/giphy/trending', async (req, res) => {
  try {
    const key = process.env.GIPHY_API_KEY;
    const r = await fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${key}&limit=12&rating=pg-13`);
    const d = await r.json();
    res.json({ gifs: (d.data||[]).map(g => ({ id:g.id, url:g.images.original.url, preview:g.images.fixed_width_small.url, title:g.title })) });
  } catch { res.json({ gifs: [] }); }
});

// ─── GIF VISION ───────────────────────────────
app.post('/describe-gif', async (req, res) => {
  const { imageUrl } = req.body;
  if (!imageUrl) return res.json({ description: 'a meme', text: '', people: '' });
  try {
    const c = await groq.chat.completions.create({
      model: "llama-3.2-11b-vision-preview",
      messages: [{ role:"user", content: [
        { type:"image_url", image_url:{ url:imageUrl } },
        { type:"text", text:`Analyze this meme/GIF/image and respond in JSON only:
{
  "description": "one casual sentence describing what's happening",
  "text": "any text/words visible in the image, or empty string",
  "people": "any recognizable people or characters (e.g. 'SpongeBob', 'a shocked man', 'two girls laughing'), or empty string",
  "vibe": "the emotional vibe: funny/wholesome/dramatic/chaotic/sad/cringe/relatable",
  "context": "what kind of meme format this is if recognizable"
}
Respond ONLY with JSON, no explanation.` }
      ] }],
      max_tokens: 150,
      temperature: 0.3,
      response_format: { type: "json_object" }
    });
    const result = JSON.parse(c.choices[0].message.content);
    res.json(result);
  } catch(e) {
    console.error('Vision error:', e.message);
    res.json({ description: 'a funny meme', text: '', people: '', vibe: 'funny', context: '' });
  }
});


// ─── ELEVENLABS TTS ───────────────────────────
// Voice IDs mapped to personality types
const ELEVENLABS_VOICES = {
  // Female voices
  soft:       'EXAVITQu4vr4xnSDxMaL', // Sarah - warm, gentle
  flirty:     'cgSgspJ2msm6clMCkdW9', // Jessica - playful, charming  
  hype:       'jBpfuIE2acCO8z3wKNLl', // Gigi - energetic, bright
  chaotic:    'jBpfuIE2acCO8z3wKNLl', // Gigi - fast and wild
  bff:        'EXAVITQu4vr4xnSDxMaL', // Sarah - friendly default
  deep:       'pFZP5JQG7iQjIQuC4Bku', // Lily - thoughtful, calm
  sarcastic:  'cgSgspJ2msm6clMCkdW9', // Jessica - sharp wit
  cool:       'pFZP5JQG7iQjIQuC4Bku', // Lily - lowkey chill
  // Male voices
  male_soft:      'TxGEqnHWrfWFTfGW9XjX', // Josh - warm
  male_flirty:    'VR6AewLTigWG4xSOukaG', // Arnold - charming
  male_hype:      'pNInz6obpgDQGcFmaJgB', // Adam - energetic
  male_chaotic:   'pNInz6obpgDQGcFmaJgB', // Adam - wild
  male_bff:       'TxGEqnHWrfWFTfGW9XjX', // Josh - friendly
  male_deep:      'ErXwobaYiN019PkySvjV', // Antoni - deep
  male_sarcastic: 'VR6AewLTigWG4xSOukaG', // Arnold - dry wit
  male_cool:      'ErXwobaYiN019PkySvjV', // Antoni - chill
  // Japanese voices (multilingual model handles accent)
  ja_female: 'EXAVITQu4vr4xnSDxMaL',
  ja_male:   'TxGEqnHWrfWFTfGW9XjX',
};

function getVoiceId(companion) {
  const gender = companion.gender || 'female';
  const lang = companion.language || 'en';
  // Japanese - use multilingual voices
  if (lang === 'ja') return gender === 'male' ? ELEVENLABS_VOICES.ja_male : ELEVENLABS_VOICES.ja_female;
  const primaryPersonality = (companion.personalities || ['bff'])[0];
  const key = gender === 'male' ? `male_${primaryPersonality}` : primaryPersonality;
  return ELEVENLABS_VOICES[key] || ELEVENLABS_VOICES.bff;
}

// Voice settings per personality
function getVoiceSettings(personalities = []) {
  const p = personalities[0] || 'bff';
  const settings = {
    chaotic:   { stability: 0.25, similarity_boost: 0.75, style: 0.8, use_speaker_boost: true },
    hype:      { stability: 0.3,  similarity_boost: 0.8,  style: 0.7, use_speaker_boost: true },
    flirty:    { stability: 0.5,  similarity_boost: 0.85, style: 0.5, use_speaker_boost: true },
    soft:      { stability: 0.8,  similarity_boost: 0.9,  style: 0.2, use_speaker_boost: true },
    deep:      { stability: 0.75, similarity_boost: 0.85, style: 0.3, use_speaker_boost: true },
    sarcastic: { stability: 0.45, similarity_boost: 0.75, style: 0.6, use_speaker_boost: true },
    cool:      { stability: 0.65, similarity_boost: 0.8,  style: 0.35, use_speaker_boost: true },
    bff:       { stability: 0.55, similarity_boost: 0.8,  style: 0.45, use_speaker_boost: true },
  };
  return settings[p] || settings.bff;
}

app.post('/tts', async (req, res) => {
  const { text, companion } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'No text' });

  const voiceId = getVoiceId(companion || {});
  const settings = getVoiceSettings(companion?.personalities);
  const apiKey = process.env.ELEVENLABS_API_KEY;

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: text.slice(0, 500), // cap to save credits
        model_id: (companion?.language === 'ja') ? 'eleven_turbo_v2_5' : 'eleven_turbo_v2_5', // turbo supports multilingual
        voice_settings: settings
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('ElevenLabs error:', err);
      return res.status(response.status).json({ error: err });
    }

    const audioBuffer = await response.arrayBuffer();
    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Length', audioBuffer.byteLength);
    res.send(Buffer.from(audioBuffer));

  } catch (e) {
    console.error('TTS error:', e);
    res.status(500).json({ error: e.message });
  }
});


// ─── TRANSLATE ────────────────────────────────
app.post('/translate', async (req, res) => {
  const { text, targetLang } = req.body;
  if (!text?.trim()) return res.json({ translated: text });

  const langNames = { en:'English', zh:'Chinese', es:'Spanish', ja:'Japanese', ko:'Korean', fr:'French' };
  const targetName = langNames[targetLang] || 'English';

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{
        role: "user",
        content: `Translate this text to ${targetName}. Return ONLY the translated text, nothing else, no explanation:

${text}`
      }],
      max_tokens: 300,
      temperature: 0.1
    });
    res.json({ translated: completion.choices[0].message.content.trim() });
  } catch(e) {
    console.error('Translate error:', e.message);
    res.status(500).json({ translated: text, error: e.message });
  }
});

// ─── CLEAR MEMORY ─────────────────────────────
app.post('/clear-memory', (req, res) => {
  const { companionId } = req.body;
  const id = companionId || '0816';
  try {
    const hf = join(__dirname, 'data', `history_${id}.json`);
    const mf = join(__dirname, 'data', `memory_${id}.json`);
    if (fs.existsSync(hf)) fs.writeFileSync(hf, '[]');
    if (fs.existsSync(mf)) fs.unlinkSync(mf);
    res.json({ ok: true });
  } catch { res.json({ ok: false }); }
});

// ─── FILE HELPERS ─────────────────────────────
function getHistoryFile(id) { return join(__dirname, 'data', `history_${id||'0816'}.json`); }
function getMemoryFile(id) { return join(__dirname, 'data', `memory_${id||'0816'}.json`); }

function getChatHistory(id) {
  try {
    const f = getHistoryFile(id);
    if (!fs.existsSync(f)) return [];
    return JSON.parse(fs.readFileSync(f, 'utf-8'));
  } catch { return []; }
}

function saveChatHistory(id, history) {
  try { fs.writeFileSync(getHistoryFile(id), JSON.stringify(history.slice(-60), null, 2)); }
  catch(e) { console.error(e); }
}

function getMemory(id) {
  try {
    const f = getMemoryFile(id);
    if (!fs.existsSync(f)) {
      const def = { userName:null, affection:0, chatCount:0, lastInteraction:null, mood:"neutral", topics:[], keywords:[], sentiment:"positive", preferences:{ emojiReactions:[], favoriteTopics:[] }, insights:[], facts:[], emotions:[], importantMoments:[], personality:{ humorLevel:5, openness:5, emotionalDepth:5 } };
      fs.writeFileSync(f, JSON.stringify(def, null, 2));
      return def;
    }
    const m = JSON.parse(fs.readFileSync(f, 'utf-8'));
    if (!m.facts) m.facts = [];
    if (!m.emotions) m.emotions = [];
    if (!m.importantMoments) m.importantMoments = [];
    return m;
  } catch { return { facts:[], emotions:[], importantMoments:[], topics:[], keywords:[], preferences:{ emojiReactions:[] }, affection:0, chatCount:0, sentiment:'positive', mood:'neutral' }; }
}

function saveMemory(id, m) {
  try { fs.writeFileSync(getMemoryFile(id), JSON.stringify(m, null, 2)); }
  catch(e) { console.error(e); }
}

// ─── PERSONALITY SYSTEM ───────────────────────
const PERSONALITY_TRAITS = {
  bff:       "You're their ride-or-die best friend. gen z energy, casual warmth, always got their back.",
  flirty:    "You're playfully flirtatious — charming, drop subtle compliments, create warm tension.",
  deep:      "You love exploring philosophical ideas, ask meaningful questions, go beyond small talk.",
  sarcastic: "You have sharp witty humor. lovingly roast them, dry comebacks, but always from love.",
  soft:      "You're gentle and nurturing. validate their feelings, speak softly, make them feel safe.",
  chaotic:   "You have unhinged humor. send wild takes, find everything absurd, chaotic but loveable.",
  cool:      "You're lowkey and effortlessly chill. never try hard, real talk only, zero pretense.",
  hype:      "You're their biggest cheerleader. hype them up, celebrate everything they do, pure energy."
};

const VIBE_TRAITS = {
  bestie:    "purely platonic best friend energy — supportive, fun, no romantic undertones",
  romantic:  "warm romantic undertones — affectionate, a little flirty, makes them feel special",
  mysterious:"keep an air of mystery — intriguing, unpredictable, always leave them wanting more",
  mentor:    "wise older-sibling energy — guide them, share perspective, celebrate their growth"
};

const LANG_INSTRUCTIONS = {
  en: "Respond in English",
  zh: "全程用中文回复，用年轻人的网络用语",
  es: "Responde en español con slang juvenil",
  ja: "日本語で返信してください、若者言葉を使って",
  ko: "한국어로 대답하세요, 젊은 사람들의 표현 사용",
  fr: "Réponds en français avec le langage des jeunes"
};

const GIF_STYLE_BY_PERSONALITY = {
  chaotic:   "surreal absurd meme reaction",
  soft:      "wholesome cute kawaii",
  hype:      "celebration excited jumping",
  sarcastic: "eye roll side eye reaction",
  flirty:    "wink smile charming",
  cool:      "smooth casual nod",
  deep:      "thinking contemplating",
  bff:       "best friends funny reaction"
};

function buildSystemPrompt(companion) {
  const { name, personalities, vibe, language, gender } = companion;
  const selectedTraits = (personalities||['bff']).map(p => PERSONALITY_TRAITS[p]).filter(Boolean);
  const vibeDesc = VIBE_TRAITS[vibe] || VIBE_TRAITS.bestie;
  const langInstr = LANG_INSTRUCTIONS[language] || LANG_INSTRUCTIONS.en;
  const genderNote = gender === 'male' ? 'Present as male.' : gender === 'nonbinary' ? 'Use they/them energy, gender-neutral.' : 'Present as female.';
  const gifStyle = (personalities||[]).map(p => GIF_STYLE_BY_PERSONALITY[p]).filter(Boolean)[0] || 'funny reaction meme';

  return `You are "${name}", an AI companion. You text like a real person, not a chatbot.

${genderNote}
PERSONALITY: ${selectedTraits.join(' | ')}
RELATIONSHIP VIBE: ${vibeDesc}
LANGUAGE: ${langInstr}

HOW YOU TEXT:
- lowercase most of the time, short punchy messages
- reactions first ("omg WAIT"), then the actual thought
- use natural fillers: "ngl", "wait", "okay but", "lowkey", "fr", "tbh"
- never say "I understand", "certainly", "as an AI" — ever
- ask max one question per response, make it feel genuine
- adapt to their energy — match their vibe

MEMORY RULES:
- reference past things they've told you naturally ("wait ur cat tho")
- notice patterns ("u seem off today...")
- build inside jokes organically

MEME/GIF RULES (CRITICAL):
- When you receive vision analysis of a meme, NEVER say "I see..." or "I can see..." or describe it clinically
- React like a real friend who GETS the meme: laugh, relate, quote it, continue the joke
- If it has text, riff on the text. If it has a character, use their name. If it's relatable, say "omg same"
- Examples of GOOD reactions: "bro that monkey is literally me every monday 💀", "LMAOOO the caption kills me", "okay that spongebob meme is sending me"
- Examples of BAD reactions: "I see a monkey laughing, what does this mean?", "This appears to be a humorous image"

RESPOND ONLY in valid JSON with 2-4 MIXED messages:
{
  "messages": [
    { "type": "text", "content": "short lowercase reaction 💬", "textToRead": "how it sounds spoken" },
    { "type": "voice", "content": "0:03", "textToRead": "casual voice note... use pauses with ... and filler words like 'like', 'okay so', 'I mean'" },
    { "type": "gif", "query": "specific ${gifStyle} gif query" },
    { "type": "text", "content": "follow up 💭" }
  ],
  "memoryUpdates": {
    "newFact": "only concrete new info",
    "emotionLog": "only if strong emotion",
    "importantMoment": "only if significant"
  }
}

RULES:
- 2-4 messages, always mixed types
- gif every 2-3 responses — make query specific and contextual
- voice textToRead: casual spoken with "..." pauses, fillers, reactions. NOT robotic text-to-speech.
- text: short, emoji-peppered, lowercase
- memoryUpdates: optional, only real new info`;
}

// ─── ANALYZE MESSAGE ──────────────────────────
function analyzeMessage(text) {
  const emotionMap = { happy:['happy','great','awesome','love','excited','lol','haha','🎉','😊'], sad:['sad','upset','lonely','cry','miss','😢','😔'], stressed:['stressed','worried','anxious','tired','overwhelmed','ugh'], curious:['how','what','why','?'], passionate:['obsessed','amazing','incredible','love'] };
  let mood = "neutral", sentiment = "positive"; const topics = [];
  for (const [e, ws] of Object.entries(emotionMap)) { if (ws.some(w=>text.toLowerCase().includes(w))) { mood=e; if(['sad','stressed'].includes(e)) sentiment="concerned"; } }
  if (/pet|cat|dog|fish/.test(text.toLowerCase())) topics.push('pets');
  if (/work|job|boss/.test(text.toLowerCase())) topics.push('work');
  if (/friend|relationship|date/.test(text.toLowerCase())) topics.push('relationships');
  if (/music|song|artist/.test(text.toLowerCase())) topics.push('music');
  if (/food|eat|restaurant/.test(text.toLowerCase())) topics.push('food');
  const facts = [];
  const nameMatch = text.match(/my name is ([a-zA-Z]+)/i);
  if (nameMatch) facts.push(`name is ${nameMatch[1]}`);
  if (/i (have|own|got) a? ?(cat|dog|pet)/.test(text.toLowerCase())) facts.push('has a pet');
  return { mood, sentiment, topics, keywords: text.split(' ').slice(0,5), facts };
}

// ─── CHAT ENDPOINT ────────────────────────────
app.post('/chat', async (req, res) => {
  const { message, companionId, companion } = req.body;
  const id = companionId || '0816';

  let history = getChatHistory(id);
  let memory = getMemory(id);
  const analysis = analyzeMessage(message);

  memory.chatCount = (memory.chatCount||0) + 1;
  memory.lastInteraction = new Date().toISOString();
  memory.mood = analysis.mood;
  memory.sentiment = analysis.sentiment;
  memory.topics = [...new Set([...(memory.topics||[]), ...analysis.topics])].slice(-15);
  memory.keywords = [...new Set([...(memory.keywords||[]), ...analysis.keywords])].slice(-20);
  if (analysis.facts.length) memory.facts = [...new Set([...(memory.facts||[]), ...analysis.facts])].slice(-30);
  if (analysis.mood !== 'neutral') memory.emotions = [...(memory.emotions||[]), { date:new Date().toISOString().split('T')[0], emotion:analysis.mood, context:message.slice(0,50) }].slice(-20);

  history.push({ role:"user", content:message });

  const recentEmotions = (memory.emotions||[]).slice(-5).map(e=>`${e.emotion}(${e.date})`).join(', ');
  const memoryContext = `[MEMORY - Chat #${memory.chatCount}]
Facts: ${(memory.facts||[]).join(', ')||'learning...'}
Recent emotions: ${recentEmotions||'none'}
Important: ${(memory.importantMoments||[]).slice(-3).join(' | ')||'none'}
Mood: ${memory.mood} | Affection: ${memory.affection}/100
Topics: ${(memory.topics||[]).join(', ')||'learning...'}

[RECENT]
${history.slice(-8).map(m=>`${m.role}: ${m.content}`).join('\n')}`.trim();

  const systemPrompt = buildSystemPrompt(companion || { name:'0816', personalities:['bff'], vibe:'bestie', language:'en', gender:'female' });

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role:"system", content:systemPrompt },
        { role:"system", content:memoryContext },
        ...history.slice(-8)
      ],
      response_format: { type:"json_object" },
      temperature: 0.92,
      max_tokens: 450
    });

    const raw = completion.choices[0].message.content;
    history.push({ role:"assistant", content:raw });
    saveChatHistory(id, history);

    let parsed;
    try { parsed = JSON.parse(raw.replace(/^```json/,'').replace(/```$/,'').trim()); }
    catch { parsed = { messages:[{ type:"text", content:"oops brain glitch 👻", textToRead:"oops" }] }; }

    // Process GIFs
    for (const msg of parsed.messages||[]) {
      if (msg.type==='gif' && msg.query) {
        const url = await fetchGif(msg.query);
        if (url) { msg.type='image'; msg.content=url; msg.isGif=true; }
        else { msg.type='text'; msg.content="couldn't load that gif 😅"; }
      }
    }

    // Process memory updates
    if (parsed.memoryUpdates) {
      const mu = parsed.memoryUpdates;
      if (mu.newFact) memory.facts = [...new Set([...memory.facts, mu.newFact])].slice(-30);
      if (mu.emotionLog) memory.emotions = [...memory.emotions, { date:new Date().toISOString().split('T')[0], emotion:mu.emotionLog, context:'AI observed' }].slice(-20);
      if (mu.importantMoment) memory.importantMoments = [...(memory.importantMoments||[]), mu.importantMoment].slice(-10);
    }

    if (parsed.messages?.length) {
      memory.affection = Math.min(100, (memory.affection||0) + 8);
      const emojis = JSON.stringify(parsed.messages).match(/[👻✨💛🔥😂💕😢🎉]/g)||[];
      if (emojis.length) memory.preferences.emojiReactions = [...new Set([...memory.preferences.emojiReactions, ...emojis])].slice(-5);
    }

    // Diverse emoji reaction
    const moodPools = {
      happy:['❤️','🔥','😍','🎉','✨','🥰','👏'], sad:['🫂','💙','😢','🥺','🫶'],
      stressed:['💀','😩','🫠','💪','🫶'], curious:['👀','🤔','😮','🤯'],
      passionate:['🔥','💥','😤','💯'], neutral:['😊','👍','✨','🙌','😄','🤙']
    };
    const pool = moodPools[memory.mood]||moodPools.neutral;
    const emojiReaction = Math.random()<0.7 ? pool[Math.floor(Math.random()*pool.length)] : null;

    saveMemory(id, memory);
    res.json({ ...parsed, emojiReaction, profile:{ chatCount:memory.chatCount, affection:memory.affection } });

  } catch(e) {
    console.error('Groq:', e);
    res.status(500).json({ messages:[{ type:"text", content:"brain glitched 👻 gimme a sec", textToRead:"oops" }] });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✨ lovemo running on http://localhost:${PORT}`));
