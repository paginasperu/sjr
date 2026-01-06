import { CONFIG } from './config.js';
import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';

// 1. INICIALIZACIÓN DE INTERFAZ
document.title = CONFIG.TITULO;
document.documentElement.style.setProperty('--chat-color', CONFIG.COLOR);
document.getElementById('header-title').innerText = CONFIG.TITULO;
document.getElementById('bot-welcome-text').innerText = CONFIG.SALUDO_INICIAL;

const headerIcon = document.getElementById('header-icon');
if (CONFIG.LOGO) {
    headerIcon.innerHTML = `<img src="${CONFIG.LOGO}">`;
} else {
    headerIcon.innerText = CONFIG.TITULO.charAt(0);
}

document.body.classList.add('ready');

// 2. ESTADO Y ELEMENTOS (PERSISTENCIA CON LOCALSTORAGE)
let systemInstruction = "";
let messageHistory = [];
let messageCount = parseInt(localStorage.getItem('chat_count')) || 0;

const userInput = document.getElementById('userInput'),
      sendBtn = document.getElementById('sendBtn'),
      chatContainer = document.getElementById('chat-container'),
      feedbackLimitText = document.getElementById('feedback-limit-text'),
      WA_LINK = `https://wa.me/${CONFIG.WHATSAPP}`;

// 3. CARGA DE CONFIGURACIÓN
window.onload = async () => {
    try {
        const res = await fetch(`./prompt.txt?v=${CONFIG.VERSION}`);
        systemInstruction = res.ok ? await res.text() : "";
        actualizarContador();
        toggleInput(true);
    } catch (e) { console.error(e); }
};

// 4. FUNCIONES PRINCIPALES
window.enviarMensaje = async () => {
    const text = userInput.value.trim();
    if (!text || userInput.disabled) return;

    // Validación de límite persistente
    if (CONFIG.LIMITE_ACTIVO && messageCount >= CONFIG.MAX_DEMO_MESSAGES) {
        agregarBurbuja(`Límite alcanzado. Contáctanos por <a href="${WA_LINK}">WhatsApp</a>.`, 'bot');
        userInput.value = "";
        return;
    }

    agregarBurbuja(text, 'user');
    userInput.value = "";
    
    // Guardar progreso
    messageCount++;
    localStorage.setItem('chat_count', messageCount);
    actualizarContador();
    
    messageHistory.push({ role: "user", content: text });
    if (messageHistory.length > CONFIG.MAX_HISTORIAL_MESSAGES * 2) {
        messageHistory = messageHistory.slice(-(CONFIG.MAX_HISTORIAL_MESSAGES * 2));
    }

    const loadId = mostrarLoading();
    toggleInput(false);

    try {
        const respuesta = await llamarAPI();
        eliminarLoading(loadId);
        if (respuesta) {
            agregarBurbuja(marked.parse(respuesta), 'bot');
            messageHistory.push({ role: "assistant", content: respuesta });
        }
    } catch (error) {
        eliminarLoading(loadId);
        agregarBurbuja(`Error de conexión. <a href="${WA_LINK}">Escríbenos aquí</a>.`, 'bot');
    } finally {
        toggleInput(true);
        scrollToBottom();
    }
};

async function llamarAPI(intentos = 0) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

    try {
        const res = await fetch(CONFIG.URL_PROXY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: "system", content: systemInstruction }, ...messageHistory],
                model: CONFIG.MODELO,
                temperature: CONFIG.TEMPERATURA,
                max_tokens: CONFIG.MAX_TOKENS_RESPONSE,
                top_p: CONFIG.TOP_P
            }),
            signal: controller.signal
        });
        clearTimeout(timeout);
        const data = await res.json();
        return data.choices?.[0]?.message?.content;
    } catch (e) {
        if (intentos < CONFIG.RETRY_LIMIT) return llamarAPI(intentos + 1);
        throw e;
    }
}

// 5. UTILIDADES
function agregarBurbuja(html, tipo) {
    const div = document.createElement('div');
    div.className = `bubble ${tipo} ${tipo === 'bot' ? 'bot-content' : ''}`;
    div.innerHTML = html;
    chatContainer.appendChild(div);
    scrollToBottom();
}

function mostrarLoading() {
    const id = 'load-' + Date.now(), div = document.createElement('div');
    div.id = id; div.className = "bubble bot";
    div.style.display = "flex"; div.style.gap = "4px";
    div.innerHTML = `<div class="typing-dot"></div><div class="typing-dot" style="animation-delay:0.2s"></div><div class="typing-dot" style="animation-delay:0.4s"></div>`;
    chatContainer.appendChild(div);
    scrollToBottom();
    return id;
}

function eliminarLoading(id) { document.getElementById(id)?.remove(); }
function scrollToBottom() { chatContainer.scrollTop = chatContainer.scrollHeight; }
function toggleInput(s) { userInput.disabled = !s; sendBtn.disabled = !s; if(s) userInput.focus(); }

function actualizarContador() {
    if (!CONFIG.LIMITE_ACTIVO) {
        feedbackLimitText.style.display = 'none';
        return;
    }
    const r = CONFIG.MAX_DEMO_MESSAGES - messageCount;
    feedbackLimitText.innerText = r > 0 ? `MENSAJES: ${r}` : "LÍMITE ALCANZADO";
    feedbackLimitText.style.color = r > 0 ? 'var(--chat-color)' : '#ef4444';
}

sendBtn.onclick = window.enviarMensaje;
userInput.onkeypress = (e) => { if (e.key === 'Enter') window.enviarMensaje(); };
