const { contextBridge, ipcRenderer } = require("electron");

// 🌉 Expondo métodos seguros ao front-end via window.electron
contextBridge.exposeInMainWorld("electron", {
    ipcRenderer: {
        send: (channel, data) => {
            if (canaisPermitidos.includes(channel)) {
                ipcRenderer.send(channel, data);
            } else {
                console.warn(`⚠️ Tentativa de acesso a canal não permitido: ${channel}`);
            }
        },
        on: (channel, listener) => {
            if (canaisPermitidos.includes(channel)) {
                ipcRenderer.on(channel, (event, ...args) => listener(...args));
            } else {
                console.warn(`⚠️ Tentativa de escuta em canal não permitido: ${channel}`);
            }
        },
        invoke: async (channel, data) => {
            if (canaisPermitidos.includes(channel)) {
                try {
                    return await ipcRenderer.invoke(channel, data);
                } catch (err) {
                    console.error(`❌ Erro ao invocar canal ${channel}:`, err);
                    return null;
                }
            } else {
                console.warn(`⚠️ Tentativa de invocação em canal não permitido: ${channel}`);
                return null;
            }
        }
    }
});

// 🔒 Lista de canais permitidos para segurança
const canaisPermitidos = [
    "start-bot",
    "stop-bot",
    "listar-numeros",
    "adicionar-numero",
    "remover-numero",
    "iniciar-bot-numero",
    "parar-bot-numero",
    "reset-banco",
    "validar-senha-devtools"
];
