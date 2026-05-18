console.log("0816 upgraded v2 - Fixed audio & Snapchat UI");

let audioContext = null;

// Initialize audio context
function initAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
}

// Scroll to bottom
function scrollToBottom() {
  const chat = document.getElementById("chat");
  setTimeout(() => {
    chat.scrollTop = chat.scrollHeight;
  }, 50);
}

// Play voice with Web Audio API (FIXED)
async function playVoice(text) {
  try {
    initAudio();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.lang = "en-US";
    
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  } catch (error) {
    console.error("Voice playback error:", error);
  }
}

// Render message
function renderMessage(item, sender) {
  const chat = document.getElementById("chat");
  const div = document.createElement("div");
  div.className = `msg ${sender}`;

  if (item.type === "text") {
    div.className += " msg-text";
    div.innerText = item.content;
  } else if (item.type === "image") {
    div.className += " msg-image";
    const url = item.content || "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=400";
    div.innerHTML = `<img src="${url}" onerror="this.src='https://via.placeholder.com/200'" />`;
  } else if (item.type === "image-upload") {
    div.className += " msg-image";
    div.innerHTML = `<img src="${item.content}" />`;
  } else if (item.type === "voice") {
    div.className += " msg-voice";
    const duration = item.content || "0:02";
    div.innerHTML = `
      <div class="voice-play" onclick="playVoiceBar(this)">▶</div>
      <div class="voice-waves">
        <div class="wave-bar"></div>
        <div class="wave-bar"></div>
        <div class="wave-bar"></div>
        <div class="wave-bar"></div>
      </div>
      <span class="voice-duration">${duration}</span>
      <span style="display:none;" class="voice-text">${item.textToRead || ""}</span>
    `;
  }

  chat.appendChild(div);
  scrollToBottom();
}

// Play voice bar
function playVoiceBar(element) {
  const text = element.parentElement.querySelector(".voice-text").textContent;
  if (text) {
    playVoice(text);
    animateWaves(element.parentElement);
  }
}

// Animate wave bars
function animateWaves(voiceElement) {
  const bars = voiceElement.querySelectorAll(".wave-bar");
  const interval = setInterval(() => {
    bars.forEach(bar => {
      bar.classList.toggle("active");
    });
  }, 100);
  
  setTimeout(() => clearInterval(interval), 2000);
}

// Send message
async function sendMessage() {
  const input = document.getElementById("input");
  const msg = input.value.trim();
  if (!msg) return;

  renderMessage({ type: "text", content: msg }, "user");
  input.value = "";

  sendToAI(msg);
}

// Core AI call
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

        if (m.type === "voice" && m.textToRead) {
          playVoice(m.textToRead);
        } else if (m.type === "text" && m.textToRead) {
          playVoice(m.textToRead);
        }
      });
    }
  } catch (error) {
    console.error("AI Error:", error);
    renderMessage({ type: "text", content: "Oops! Connection lost 🌙" }, "ai");
  }
}

// Voice input - FIXED (no more multiple listeners)
let recognitionActive = false;
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
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
    .map(result => result[0].transcript)
    .join("");
  
  if (text.trim()) {
    renderMessage({ type: "text", content: text }, "user");
    sendToAI(text);
  }
};

recognition.onerror = (e) => {
  console.error("Speech recognition error:", e.error);
  if (e.error !== "no-speech") {
    renderMessage({ type: "text", content: "Didn't catch that 🎤" }, "ai");
  }
};

document.getElementById("recordBtn").onclick = () => {
  if (recognitionActive) {
    recognition.abort();
  } else {
    try {
      recognition.start();
    } catch (error) {
      console.error("Recording already in progress:", error);
    }
  }
};

// Image upload
const fileInput = document.getElementById("fileInput");

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = e.target.result;
    renderMessage({ type: "image-upload", content: img }, "user");
    
    const desc = prompt("Describe this image (or press Enter to skip):");
    if (desc && desc.trim()) {
      sendToAI("User sent an image: " + desc);
    }
  };
  reader.readAsDataURL(file);
});

// Enter key to send
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
