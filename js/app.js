console.log("0816 v3.0 - Blue UI + Voice Fix");

// ─── AUDIO ────────────────────────────────────────────
let audioContext = null;

function initAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
}

// ─── SCROLL ───────────────────────────────────────────
function scrollToBottom() {
  const chat = document.getElementById("chat");
  setTimeout(() => { chat.scrollTop = chat.scrollHeight; }, 50);
}

// ─── VOICE PLAYBACK (FIXED) ───────────────────────────
// Waits for voices to be ready before speaking
function playVoice(text) {
  if (!text || !text.trim()) return;

  return new Promise((resolve) => {
    const speak = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      utterance.lang = "en-US";
      utterance.onend = resolve;
      utterance.onerror = resolve;
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    };

    // Voices may not be loaded yet on first call
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      speak();
    } else {
      speechSynthesis.addEventListener("voiceschanged", speak, { once: true });
    }
  });
}

// ─── RENDER MESSAGE ───────────────────────────────────
function renderMessage(item, sender) {
  const chat = document.getElementById("chat");
  const div = document.createElement("div");
  div.className = `msg ${sender}`;

  if (item.type === "text") {
    div.className += " msg-text";
    div.innerText = item.content;

  } else if (item.type === "image" || item.type === "image-upload") {
    div.className += " msg-image";
    const url = item.content || "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=400";
    div.innerHTML = `<img src="${url}" onerror="this.src='https://via.placeholder.com/200x200?text=📷'" loading="lazy" />`;

  } else if (item.type === "voice") {
    div.className += " msg-voice";
    const duration = item.content || "0:02";
    div.innerHTML = `
      <button class="voice-play" onclick="playVoiceBar(this)" aria-label="Play voice message">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </button>
      <div class="voice-waves">
        <div class="wave-bar"></div>
        <div class="wave-bar"></div>
        <div class="wave-bar"></div>
        <div class="wave-bar"></div>
        <div class="wave-bar"></div>
        <div class="wave-bar"></div>
      </div>
      <span class="voice-duration">${duration}</span>
      <span class="voice-text" aria-hidden="true">${item.textToRead || ""}</span>
    `;
  }

  chat.appendChild(div);
  scrollToBottom();
}

// ─── VOICE BAR PLAY (FIXED) ───────────────────────────
function playVoiceBar(button) {
  // button is .voice-play inside .msg.msg-voice
  const voiceMsg = button.closest(".msg-voice") || button.parentElement;
  const textEl = voiceMsg.querySelector(".voice-text");
  const text = textEl ? textEl.textContent.trim() : "";

  if (!text) {
    console.warn("No text to read for voice bar");
    return;
  }

  animateWaves(voiceMsg);
  playVoice(text);
}

// ─── WAVE ANIMATION ───────────────────────────────────
function animateWaves(voiceMsgEl) {
  const bars = voiceMsgEl.querySelectorAll(".wave-bar");
  let tick = 0;

  const interval = setInterval(() => {
    bars.forEach((bar, i) => {
      // staggered random-ish pattern
      bar.classList.toggle("active", (tick + i) % 3 !== 0);
    });
    tick++;
  }, 120);

  setTimeout(() => {
    clearInterval(interval);
    bars.forEach(bar => bar.classList.remove("active"));
  }, 2400);
}

// ─── SEND TEXT ────────────────────────────────────────
async function sendMessage() {
  const input = document.getElementById("input");
  const msg = input.value.trim();
  if (!msg) return;

  renderMessage({ type: "text", content: msg }, "user");
  input.value = "";
  sendToAI(msg);
}

// ─── AI CALL ─────────────────────────────────────────
async function sendToAI(text) {
  try {
    const res = await fetch("http://localhost:3000/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    if (data.messages && Array.isArray(data.messages)) {
      data.messages.forEach(m => {
        renderMessage(m, "ai");

        // Auto-play voice text-to-speech for non-voice messages
        if (m.type === "text" && m.textToRead) {
          playVoice(m.textToRead);
        }
        // Voice bar messages are played manually by tapping the play button
      });
    }
  } catch (error) {
    console.error("AI Error:", error);
    renderMessage({ type: "text", content: "Oops! Connection lost 🌙" }, "ai");
  }
}

// ─── SPEECH RECOGNITION (SAFE INIT) ──────────────────
let recognition = null;
let recognitionActive = false;

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognitionAPI) {
  recognition = new SpeechRecognitionAPI();
  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    recognitionActive = true;
    document.getElementById("recordBtn").classList.add("recording");
  };

  recognition.onend = () => {
    recognitionActive = false;
    document.getElementById("recordBtn").classList.remove("recording");
  };

  recognition.onresult = (e) => {
    const text = Array.from(e.results)
      .map(r => r[0].transcript)
      .join("");

    if (text.trim()) {
      renderMessage({ type: "text", content: text }, "user");
      sendToAI(text);
    }
  };

  recognition.onerror = (e) => {
    console.warn("Speech recognition error:", e.error);
    recognitionActive = false;
    document.getElementById("recordBtn").classList.remove("recording");
    if (e.error !== "no-speech" && e.error !== "aborted") {
      renderMessage({ type: "text", content: "Didn't catch that 🎤" }, "ai");
    }
  };
} else {
  console.warn("SpeechRecognition not supported in this browser.");
}

// Record button click
document.getElementById("recordBtn").addEventListener("click", () => {
  if (!recognition) {
    renderMessage({ type: "text", content: "Voice not supported in this browser 😅" }, "ai");
    return;
  }

  if (recognitionActive) {
    recognition.abort();
  } else {
    try {
      recognition.start();
    } catch (err) {
      console.warn("Recognition start error:", err);
    }
  }
});

// ─── IMAGE UPLOAD ─────────────────────────────────────
document.getElementById("fileInput").addEventListener("change", () => {
  const file = document.getElementById("fileInput").files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    renderMessage({ type: "image-upload", content: e.target.result }, "user");
    const desc = prompt("Describe this image (or press Enter to skip):");
    if (desc && desc.trim()) {
      sendToAI("User sent an image: " + desc);
    }
  };
  reader.readAsDataURL(file);
});

// ─── ENTER KEY ────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("input");
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }
});
