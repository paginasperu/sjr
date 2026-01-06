import { CONFIG } from './config.js';

const $ = (id) => document.getElementById(id);
const chat = $('chat-container'),
      input = $('userInput'),
      btn = $('sendBtn'),
      limit = $('feedback-limit-text');

let promptText = "";
let history = [];
let count = parseInt(localStorage.getItem('chat_count')) || 0;

const link = `https://wa.me/${CONFIG.brand.whatsapp}`;

const toggle = (s) => {
  input.disabled = btn.disabled = !s;
  if (s) input.focus();
};

const bubble = (html, type, bot = false) => {
  const div = document.createElement('div');
  div.className = `bubble ${type} ${bot ? 'bot-content' : ''}`;
  div.innerHTML = html;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
};

const update = () => {
  const r = CONFIG.chat.maxMessages - count;
  limit.innerText = r > 0 ? `MENSAJES RESTANTES: ${r}` : "LÍMITE ALCANZADO";
  limit.style.color = r > 0 ? 'var(--chat-color)' : '#ef4444';
};

async function call(retry = 0) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);

  try {
    const r = await fetch(CONFIG.ai.proxy, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: "system", content: promptText }, ...history],
        model: CONFIG.ai.model,
        temperature: CONFIG.ai.temp,
        max_tokens: CONFIG.ai.maxTokens
      }),
      signal: ctrl.signal
    });

    clearTimeout(timer);
    if (!r.ok) throw 0;

    const d = await r.json();
    return d.choices?.[0]?.message?.content;

  } catch (e) {
    if (retry < 1) {
      await new Promise(r => setTimeout(r, 1000));
      return call(retry + 1);
    }
    throw 0;
  }
}

window.send = async () => {
  const text = input.value.trim();
  if (!text || input.disabled) return;

  if (count >= CONFIG.chat.maxMessages) {
    bubble(`Límite alcanzado. <a href="${link}" target="_blank">Contacto</a>.`, 'bot');
    return toggle(false);
  }

  bubble(text, 'user');
  input.value = "";

  count++;
  localStorage.setItem('chat_count', count);
  update();

  history.push({ role: "user", content: text });
  if (history.length > CONFIG.ai.historyLimit * 2) history.shift();

  const l = document.createElement('div');
  l.className = "bubble bot";
  l.innerHTML = `
    <div class="typing-dot"></div>
    <div class="typing-dot" style="animation-delay:.2s"></div>
    <div class="typing-dot" style="animation-delay:.4s"></div>
  `;
  chat.appendChild(l);

  toggle(false);

  try {
    const res = await call();
    l.remove();

    if (res) {
      bubble(typeof marked !== 'undefined' ? marked.parse(res) : res, 'bot', true);
      history.push({ role: "assistant", content: res });
    }

  } catch (e) {
    l.remove();
    bubble(`Error. <a href="${link}" target="_blank">Contacto</a>.`, 'bot');
  } finally {
    if (count < CONFIG.chat.maxMessages) toggle(true);
  }
};

(async () => {
  try {
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

  } catch (e) {}

  document.body.classList.add('ready');
  update();

  // 🔴 SOLUCIÓN APLICADA AQUÍ
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
