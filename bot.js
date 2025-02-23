require('dotenv').config();
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const { conectarBanco, dbPrincipal } = require('./database');

// 🌱 Configurações carregadas dinamicamente
const numeroBot = process.argv[2];
const sessionFolder = `./wwebjs_auth/session_${numeroBot}`;
const headlessMode = process.env.HEADLESS_MODE === 'true';
const autoReply = process.env.AUTO_REPLY === 'true';
const markAsSeen = process.env.MARK_AS_SEEN === 'true';

// 📂 Conexão ao banco específico do número
const db = conectarBanco(numeroBot);

// 🤖 Configuração segura do cliente WhatsApp
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: sessionFolder }),
    puppeteer: {
        headless: headlessMode,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--incognito']
    }
});

// 📱 Exibição do QR Code
client.on('qr', (qr) => {
    console.log(`🔒 Escaneie o QR Code para ${numeroBot}`);
});

// 🤖 Confirmação quando o bot estiver pronto
client.on('ready', async () => {
    console.log(`🤖 Bot (${numeroBot}) pronto e funcionando.`);
    await gerenciarMensagensAutomaticas();
});

// 💬 Processamento seguro de novas mensagens e contatos
client.on('message', async (msg) => {
    try {
        if (msg.from.includes('@g.us')) return; // 🚫 Ignora grupos

        if (markAsSeen) await msg.markAsSeen();

        const contact = await msg.getContact();
        const nome = contact.pushname || contact.number;
        const numero = contact.number;

        await salvarContato(numero, nome);
        await salvarMensagem(numero, msg.body, new Date().toISOString(), 'individual');

        if (autoReply) {
            await msg.reply(`🤖 Olá, ${nome}! Sua mensagem foi recebida.`);
        }

        ultimaMensagemTimestamp = Date.now();
    } catch (err) {
        console.error(`❌ Erro ao processar mensagem (${numeroBot}):`, err);
    }
});

// 🕒 Controle de inatividade
let ultimaMensagemTimestamp = Date.now();
setInterval(async () => {
    const tempoSemMensagem = Date.now() - ultimaMensagemTimestamp;
    const tempoInatividade = 10 * 60 * 1000; // 🔔 10 minutos

    if (tempoSemMensagem > tempoInatividade) {
        console.log(`⏳ Inatividade detectada. Enviando mensagem de inatividade.`);
        await enviarMensagemInatividade();
        ultimaMensagemTimestamp = Date.now();
    }
}, 5 * 60 * 1000);

// 💡 Função para gerenciar mensagens automáticas
async function gerenciarMensagensAutomaticas() {
    const mensagens = await new Promise((resolve, reject) => {
        dbPrincipal.all("SELECT * FROM mensagens_automaticas WHERE ativo = 1", [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

    for (const mensagem of mensagens) {
        await processarMensagemAutomatica(mensagem);
    }
}

// 💾 Processa e envia mensagens automáticas
async function processarMensagemAutomatica(mensagem) {
    const contatos = await client.getContacts();
    let enviadosHoje = await contatosEnviadosHoje(mensagem.id);

    const contatosParaEnviar = contatos.filter(contact =>
        !enviadosHoje.includes(contact.number) && !contact.isGroup
    ).slice(0, mensagem.limite_envio);

    for (const contato of contatosParaEnviar) {
        await enviarMensagemAutomatica(contato, mensagem);
        await registrarEnvio(mensagem.id, contato.number);
    }
}

// 📩 Envia mensagem automática, com ou sem imagem
async function enviarMensagemAutomatica(contato, mensagem) {
    try {
        if (mensagem.imagem_path) {
            const media = MessageMedia.fromFilePath(mensagem.imagem_path);
            await client.sendMessage(contato.id._serialized, media, { caption: mensagem.mensagem });
        } else {
            await client.sendMessage(contato.id._serialized, mensagem.mensagem);
        }
        console.log(`✅ Mensagem enviada para ${contato.number}`);
    } catch (err) {
        console.error(`❌ Erro ao enviar mensagem para ${contato.number}:`, err);
    }
}

// 📋 Verifica quais contatos já receberam a mensagem hoje
async function contatosEnviadosHoje(idMensagem) {
    return new Promise((resolve, reject) => {
        const hoje = new Date().toISOString().split('T')[0];
        dbPrincipal.all("SELECT numero_contato FROM envios_realizados WHERE id_mensagem = ? AND data_envio LIKE ?", [idMensagem, `${hoje}%`],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(row => row.numero_contato));
            });
    });
}

// 💾 Registra envio no banco para evitar reenvio no mesmo dia
async function registrarEnvio(idMensagem, numeroContato) {
    return new Promise((resolve, reject) => {
        dbPrincipal.run("INSERT INTO envios_realizados (id_mensagem, numero_contato) VALUES (?, ?)",
            [idMensagem, numeroContato], (err) => {
                if (err) reject("❌ Erro ao registrar envio: " + err);
                else resolve();
            });
    });
}

// ⏳ Envia mensagem de inatividade
async function enviarMensagemInatividade() {
    const chats = await client.getChats();
    for (const chat of chats) {
        if (!chat.isGroup) {
            await chat.sendMessage("⚡ Estou aqui caso precise de algo! 😄");
            console.log(`🔔 Mensagem de inatividade enviada para ${chat.name || chat.id.user}.`);
        }
    }
}

// 🚀 Inicializa o bot
(async () => {
    try {
        await client.initialize();
        console.log(`🚀 Bot (${numeroBot}) inicializado com sucesso.`);
    } catch (err) {
        console.error(`❌ Erro ao inicializar o bot (${numeroBot}):`, err);
    }
})();
