import { CONFIG } from './config.js';

const $ = (id) => document.getElementById(id);
const chatContainer = $('chat-container'), userInput = $('userInput'), sendBtn = $('sendBtn'), limitText = $('feedback-limit-text');

// 1. INICIALIZACIÓN DE INTERFAZ
document.title = CONFIG.TITULO;
document.documentElement.style.setProperty('--chat-color', CONFIG.COLOR);
$('header-title').innerText = CONFIG.TITULO;
$('bot-welcome-text').innerText = CONFIG.SALUDO_INICIAL;
userInput.placeholder = CONFIG.PLACEHOLDER_INPUT;

// Favicon Dinámico
if (CONFIG.FAVICON || CONFIG.LOGO) {
    const fav = $('favicon');
    if (fav) fav.href = CONFIG.FAVICON || CONFIG.LOGO;
}

const icon = $('header-icon');
CONFIG.LOGO ? icon.innerHTML = `<img src="${CONFIG.LOGO}">` : icon.innerText = CONFIG.TITULO[0];

document.body.classList.add('ready');

// 2. ESTADO Y PERSISTENCIA
let systemInstruction = "", messageHistory = [];
let messageCount = parseInt(localStorage.getItem('chat_count')) || 0;
const WA_LINK = `https://wa.me/${CONFIG.WHATSAPP}`;

// 3. CARGA INICIAL (CON SOLUCIÓN FINALLY)
window.onload = async () => {
    toggle(false); 
    try {
        const res = await fetch(`./prompt.txt?v=${CONFIG.VERSION}`);
        systemInstruction = res.ok ? await res.text() : "";
        updateUI();
    } catch (e) {
        console.error("Error al cargar configuración inicial:", e);
    } finally {
        toggle(true); // Se desbloquea pase lo que pase
    }
};

// 4. LÓGICA DE ENVÍO
window.enviarMensaje = async () => {
    const text = userInput.value.trim();
    if (!text || userInput.disabled) return;

    if (CONFIG.LIMITE_ACTIVO && messageCount >= CONFIG.MAX_DEMO_MESSAGES) {
        addBubble(`Has alcanzado el límite. Contáctanos por <a href="${WA_LINK}" style="color:inherit; font-weight:bold">WhatsApp</a>.`, 'bot');
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
            const htmlRes = typeof marked !== 'undefined' ? marked.parse(res) : res;
            addBubble(htmlRes, 'bot', true);
            messageHistory.push({ role: "assistant", content: res });
        }
    } catch (e) {
        $(loadId)?.remove();
        addBubble(`Error de conexión. <a href="${WA_LINK}" style="color:inherit; font-weight:bold">Escríbenos</a>.`, 'bot');
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
                model: CONFIG.MODELO, temperature: CONFIG.TEMPERATURA, max_tokens: CONFIG.MAX_TOKENS_RESPONSE,
                top_p: CONFIG.TOP_P, frequency_penalty: CONFIG.FREQUENCY_PENALTY, presence_penalty: CONFIG.PRESENCE_PENALTY
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

// 5. HELPERS UI
function addBubble(html, type, isBot = false) {
    const div = document.createElement('div');
    div.className = `bubble ${type} ${isBot ? 'bot-content' : ''}`;
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
