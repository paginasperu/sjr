import { CONFIG } from './config.js';
import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';

// 1. UI SETUP (Configuración de Identidad)
const $ = (id) => document.getElementById(id);
const chatContainer = $('chat-container'), userInput = $('userInput'), sendBtn = $('sendBtn'), limitText = $('feedback-limit-text');

document.title = CONFIG.TITULO;
document.documentElement.style.setProperty('--chat-color', CONFIG.COLOR);
$('header-title').innerText = CONFIG.TITULO;
$('bot-welcome-text').innerText = CONFIG.SALUDO_INICIAL;
userInput.placeholder = CONFIG.PLACEHOLDER_INPUT;

const icon = $('header-icon');
CONFIG.LOGO ? icon.innerHTML = `<img src="${CONFIG.LOGO}">` : icon.innerText = CONFIG.TITULO[0];

document.body.classList.add('ready');

// 2. STATE & PERSISTENCE
let systemInstruction = "", messageHistory = [];
let messageCount = parseInt(localStorage.getItem('chat_count')) || 0;
const WA_LINK = `https://wa.me/${CONFIG.WHATSAPP}`;

// 3. INIT
window.onload = async () => {
    try {
        const res = await fetch(`./prompt.txt?v=${CONFIG.VERSION}`);
        systemInstruction = res.ok ? await res.text() : "";
        updateUI();
    } catch (e) { console.error(e); }
};

// 4. CORE LOGIC
window.enviarMensaje = async () => {
    const text = userInput.value.trim();
    if (!text || userInput.disabled) return;

    if (CONFIG.LIMITE_ACTIVO && messageCount >= CONFIG.MAX_DEMO_MESSAGES) {
        addBubble(`Límite alcanzado. Contáctanos por <a href="${WA_LINK}">WhatsApp</a>.`, 'bot');
        return userInput.value = "";
    }

    addBubble(text, 'user');
    userInput.value = "";
    localStorage.setItem('chat_count', ++messageCount);
    updateUI();
    
    messageHistory.push({ role: "user", content: text });
    if (messageHistory.length > CONFIG.MAX_HISTORIAL_MESSAGES * 2) messageHistory.shift();

    const loadId = showLoading();
    toggle(false);

    try {
        const res = await callAPI();
        $(loadId)?.remove();
        if (res) {
            addBubble(marked.parse(res), 'bot');
            messageHistory.push({ role: "assistant", content: res });
        }
    } catch (e) {
        $(loadId)?.remove();
        addBubble(`Error de conexión. <a href="${WA_LINK}">Escríbenos</a>.`, 'bot');
    } finally {
        toggle(true);
    }
};

async function callAPI(retry = 0) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CONFIG.TIMEOUT_MS);

    try {
        const r = await fetch(CONFIG.URL_PROXY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: "system", content: systemInstruction }, ...messageHistory],
                model: CONFIG.MODELO, temperature: CONFIG.TEMPERATURA, max_tokens: CONFIG.MAX_TOKENS_RESPONSE, top_p: CONFIG.TOP_P
            }),
            signal: ctrl.signal
        });
        clearTimeout(timer);
        const d = await r.json();
        return d.choices?.[0]?.message?.content;
    } catch (e) {
        if (retry < CONFIG.RETRY_LIMIT) return callAPI(retry + 1);
        throw e;
    }
}

// 5. HELPERS (UI)
function addBubble(html, type) {
    const div = document.createElement('div');
    div.className = `bubble ${type} ${type === 'bot' ? 'bot-content' : ''}`;
    div.innerHTML = html;
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function showLoading() {
    const id = 'l-' + Date.now(), div = document.createElement('div');
    div.id = id; div.className = "bubble bot"; div.style.display = "flex"; div.style.gap = "4px";
    div.innerHTML = `<div class="typing-dot"></div><div class="typing-dot" style="animation-delay:0.2s"></div><div class="typing-dot" style="animation-delay:0.4s"></div>`;
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return id;
}

function toggle(s) { 
    userInput.disabled = !s; 
    sendBtn.disabled = !s; 
    if(s) userInput.focus(); 
}

function updateUI() {
    if (!CONFIG.LIMITE_ACTIVO) return limitText.style.display = 'none';
    const r = CONFIG.MAX_DEMO_MESSAGES - messageCount;
    limitText.innerText = r > 0 ? `MENSAJES: ${r}` : "LÍMITE ALCANZADO";
    limitText.style.color = r > 0 ? 'var(--chat-color)' : '#ef4444';
}

sendBtn.onclick = window.enviarMensaje;
userInput.onkeypress = (e) => e.key === 'Enter' && window.enviarMensaje();
