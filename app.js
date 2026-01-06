import { CONFIG } from './config.js';

const $ = (id) => document.getElementById(id);
const chat = $('chat-container');
const input = $('userInput');
const btn = $('sendBtn');
const limitText = $('feedback-limit-text');

/* =========================
   LÍMITE POR TIEMPO
========================= */
const LIMIT_TIME = CONFIG.chat.limitMinutes * 60 * 1000;
const now = Date.now();

let startTime = parseInt(localStorage.getItem('chat_start')) || now;
let count = parseInt(localStorage.getItem('chat_count')) || 0;

if (now - startTime > LIMIT_TIME) {
  count = 0;
  startTime = now;
  localStorage.setItem('chat_count', 0);
  localStorage.setItem('chat_start', startTime);
}

/* ========================= */

let promptText = "";
let history = [];

const link = `https://wa.me/${CONFIG.brand.whatsapp}`;

const toggle = (s) => {
  input.disabled = btn.disabled = !s;
  if (s) input.focus();
};

const bubble = (html, type) => {
  const div = document.createElement('div');
  div.className = `bubble ${type}`;
  div.innerHTML = html;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
};

const updateLimitText = () => {
  const remaining = CONFIG.chat.maxMessages - count;
  if (remaining > 0) {
    limitText.innerText = `MENSAJES RESTANTES: ${remaining}`;
    limitText.style.color = 'var(--chat-color)';
  } else {
    const minutesLeft = Math.ceil(
      (LIMIT_TIME - (Date.now() - startTime)) / 60000
    );
    limitText.innerText = `LÍMITE ALCANZADO · vuelve en ${minutesLeft} min`;
    limitText.style.color = '#ef4444';
  }
};

async function callAI() {
  const r = await fetch(CONFIG.ai.proxy, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: "system", content: promptText }, ...history],
      model: CONFIG.ai.model,
      temperature: CONFIG.ai.temp,
      max_tokens: CONFIG.ai.maxTokens
    })
  });

  if (!r.ok) throw new Error();
  const d = await r.json();
  return d.choices?.[0]?.message?.content;
}

window.send = async () => {
  const text = input.value.trim();
  if (!text) return;

  // ⛔ Límite alcanzado
  if (count >= CONFIG.chat.maxMessages) {
    bubble(
      `Límite alcanzado. <a href="${link}" target="_blank">Contacto</a>.`,
      'bot'
    );
    toggle(false);
    return;
  }

  bubble(text, 'user');
  input.value = "";

  count++;
  localStorage.setItem('chat_count', count);
  localStorage.setItem('chat_start', startTime);
  updateLimitText();

  history.push({ role: "user", content: text });
  if (history.length > CONFIG.ai.historyLimit * 2) history.shift();

   const typing = document.createElement('div');
   typing.className = "bubble bot";
   typing.innerHTML = `
   <div class="typing-dot"></div>
   <div class="typing-dot" style="animation-delay:.2s"></div>
   <div class="typing-dot" style="animation-delay:.4s"></div>
   `;
   chat.appendChild(typing);

  toggle(false);

  try {
    const res = await callAI();
    typing.remove();
    if (res) {
      bubble(typeof marked !== 'undefined' ? marked.parse(res) : res, 'bot');
      history.push({ role: "assistant", content: res });
    }
  } catch {
    typing.remove();
    // ❌ NO mostrar error si el límite ya se alcanzó
    if (count < CONFIG.chat.maxMessages) {
      bubble(
        `Error. <a href="${link}" target="_blank">Contacto</a>.`,
        'bot'
      );
    }
  } finally {
    if (count < CONFIG.chat.maxMessages) toggle(true);
  }
};

/* =========================
   INIT
========================= */
(async () => {
  document.title = CONFIG.brand.name;
  document.documentElement.style.setProperty('--chat-color', CONFIG.brand.color);

  $('header-title').innerText = CONFIG.brand.name;
  $('bot-welcome-text').innerText = CONFIG.chat.welcome;

  input.placeholder = CONFIG.chat.placeholder;
  input.maxLength = CONFIG.chat.maxInput;

  $('favicon').href = CONFIG.brand.logo;
  $('header-icon').innerHTML = `<img src="${CONFIG.brand.logo}">`;

  const r = await fetch(`./prompt.txt?v=${CONFIG.version}`);
  if (r.ok) promptText = await r.text();

  document.body.classList.add('ready');
  updateLimitText();

  input.disabled = false;
  btn.disabled = false;
  input.focus();

  btn.onclick = window.send;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      window.send();
    }
  });
})();
