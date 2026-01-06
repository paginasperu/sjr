export const CONFIG = {
  version: "1.1.4",
  brand: {
    name: "Colegio San José y El Redentor",
    whatsapp: "51949973277",
    color: "#003366",
    logo: "https://sjr.edu.pe/wp-content/uploads/2019/11/logo-insignia-sjr.png"
  },
  ai: {
    proxy: "https://deepseek-chat-proxy.precios-com-pe.workers.dev",
    model: "deepseek-chat",
    temp: 0.1,
    maxTokens: 200,
    historyLimit: 3
  },
  chat: {
    welcome: "¡Hola! Bienvenido al colegio San José y El Redentor. ¿En qué puedo ayudarte?",
    placeholder: "Escribe tu consulta...",
    maxInput: 150,
    maxMessages: 10
  }
};
