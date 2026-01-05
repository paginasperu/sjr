import { CONFIG } from './config.js';
import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';

// 1. CONFIGURACIÓN DE INTERFAZ (Estándar de Plantilla)
document.title = CONFIG.TITULO;
document.documentElement.style.setProperty('--chat-color', CONFIG.COLOR);
document.getElementById('header-title').innerText = CONFIG.TITULO;
document.getElementById('bot-welcome-text').innerText = CONFIG.SALUDO_INICIAL;

const headerIcon = document.getElementById('header-icon');
if (CONFIG.LOGO) {
    headerIcon.innerHTML = `<img src="${CONFIG.LOGO}" class="w-full h-full object-cover">`;
} else {
    headerIcon.innerText = CONFIG.TITULO.charAt(0);
}

// Revelar la web una vez configurada
document.body.classList.add('ready');

// 2. VARIABLES DE ESTADO
let systemInstruction = "";
let messageHistory = [];
let messageCount = 0;

const userInput = document.getElementById('userInput'),
      sendBtn = document.getElementById('sendBtn'),
      chatContainer = document.getElementById('chat-container'),
      feedbackLimitText = document.getElementById('feedback-limit-text'),
      WA_LINK = `https://wa.me/${CONFIG.WHATSAPP}`;

// 3. INICIALIZACIÓN
window.onload = async () => {
    try {
        const res = await fetch(`./prompt.txt?v=${CONFIG.VERSION}`);
        systemInstruction = res.ok ? await res.text() : "";
        actualizarContador();
        toggleInput(true);
    } catch (e) {
        console.error("Error cargando prompt:", e);
    }
};

// 4. LÓGICA DE ENVÍO
window.enviarMensaje = async () => {
    const text = userInput.value.trim();
    if (!text || !sendBtn.disabled === false) return;

    if (messageCount >= CONFIG.MAX_DEMO_MESSAGES) {
        agregarBurbuja(`Límite de consultas alcanzado. Por favor, contáctanos por <a href="${WA_LINK}" class="underline font-bold">WhatsApp</a>.`, 'bot');
        userInput.value = "";
        return;
    }

    agregarBurbuja(text, 'user');
    userInput.value = "";
    messageCount++;
    actualizarContador();
    
    messageHistory.push({ role: "user", content: text });
    if (messageHistory.length > CONFIG.MAX_HISTORIAL_MESSAGES * 2) {
        messageHistory = messageHistory.slice(-(CONFIG.MAX_HISTORIAL_MESSAGES * 2));
    }

    const loadId = mostrarLoading();
    toggleInput(false);

    try {
        const respuesta = await llamarAPIConReintento();
        eliminarLoading(loadId);
        
        if (respuesta) {
            agregarBurbuja(marked.parse(respuesta), 'bot');
            messageHistory.push({ role: "assistant", content: respuesta });
        } else {
            throw new Error("Sin respuesta");
        }
    } catch (error) {
        eliminarLoading(loadId);
        agregarBurbuja(`Lo siento, hubo un error de conexión. Puedes escribirnos al <a href="${WA_LINK}" class="underline font-bold">WhatsApp</a>.`, 'bot');
    } finally {
        toggleInput(true);
        scrollToBottom();
    }
};

// 5. CONEXIÓN A DEEPSEEK (PROXY)
async function llamarAPIConReintento(intentos = 0) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

    try {
        const response = await fetch(CONFIG.URL_PROXY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: "system", content: systemInstruction }, ...messageHistory],
                model: CONFIG.MODELO,
                temperature: CONFIG.TEMPERATURA,
                max_tokens: CONFIG.MAX_TOKENS_RESPONSE,
                top_p: CONFIG.TOP_P,
                frequency_penalty: CONFIG.FREQUENCY_PENALTY,
                presence_penalty: CONFIG.PRESENCE_PENALTY
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`Status ${response.status}`);
        
        const data = await response.json();
        return data.choices?.[0]?.message?.content || "";

    } catch (error) {
        clearTimeout(timeoutId);
        if (intentos < CONFIG.RETRY_LIMIT) {
            await new Promise(r => setTimeout(r, CONFIG.RETRY_DELAY_MS));
            return llamarAPIConReintento(intentos + 1);
        }
        throw error;
    }
}

// 6. UTILIDADES DE UI
function agregarBurbuja(html, tipo) {
    const div = document.createElement('div');
    div.className = tipo === 'user' 
        ? "p-3 max-w-[85%] text-sm text-white rounded-2xl rounded-tr-none self-end ml-auto shadow-md" 
        : "p-3 max-w-[85%] text-sm bg-white border border-gray-200 rounded-2xl rounded-tl-none self-start shadow-sm bot-content";
    
    div.innerHTML = html;
    if (tipo === 'user') div.style.backgroundColor = 'var(--chat-color)';
    chatContainer.appendChild(div);
    scrollToBottom();
}

function mostrarLoading() {
    const id = 'load-' + Date.now(), div = document.createElement('div');
    div.id = id;
    div.className = "p-3 bg-white border border-gray-200 rounded-2xl rounded-tl-none self-start flex gap-1 shadow-sm w-fit";
    div.innerHTML = `<div class="typing-dot"></div><div class="typing-dot" style="animation-delay: 0.2s"></div><div class="typing-dot" style="animation-delay: 0.4s"></div>`;
    chatContainer.appendChild(div);
    scrollToBottom();
    return id;
}

function eliminarLoading(id) { const el = document.getElementById(id); if (el) el.remove(); }
function scrollToBottom() { chatContainer.scrollTop = chatContainer.scrollHeight; }
function toggleInput(state) { userInput.disabled = !state; sendBtn.disabled = !state; if(state) userInput.focus(); }

function actualizarContador() {
    const restantes = CONFIG.MAX_DEMO_MESSAGES - messageCount;
    feedbackLimitText.innerText = restantes > 0 ? `MENSAJES DISPONIBLES: ${restantes}` : "LÍMITE ALCANZADO";
    feedbackLimitText.style.color = restantes > 0 ? 'var(--chat-color)' : '#ef4444';
}

// 7. EVENTOS
sendBtn.onclick = window.enviarMensaje;
userInput.onkeypress = (e) => { if (e.key === 'Enter') window.enviarMensaje(); };
