// 📦 Importações necessárias
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

// 🔒 Função de criptografia para dados sensíveis
function criptografar(texto) {
    const algoritmo = 'aes-256-cbc';
    const chave = crypto.scryptSync(process.env.SECRET_KEY || 'default_secret', 'salt', 32);
    const iv = Buffer.alloc(16, 0);
    const cipher = crypto.createCipheriv(algoritmo, chave, iv);
    let criptografado = cipher.update(texto, 'utf8', 'hex');
    criptografado += cipher.final('hex');
    return criptografado;
}

// 🌱 Caminho do banco de dados dinâmico
function getDatabasePath(numero) {
    const dbFolder = path.join(__dirname, 'databases');
    if (!fs.existsSync(dbFolder)) fs.mkdirSync(dbFolder, { recursive: true });
    return path.join(dbFolder, `vabot_${numero}.db`);
}

// 📂 Conexão dinâmica ao banco de dados
function conectarBanco(numero) {
    const dbPath = getDatabasePath(numero);
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) console.error(`❌ Erro ao abrir o banco (${numero}):`, err);
        else console.log(`📂 Banco '${dbPath}' conectado.`);
    });

    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS contatos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero TEXT UNIQUE,
            nome TEXT
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS mensagens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero TEXT,
            mensagem TEXT,
            tipo TEXT DEFAULT 'individual',
            data TEXT DEFAULT CURRENT_TIMESTAMP
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS arquivos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero TEXT NOT NULL,
            tipo TEXT NOT NULL,
            caminho TEXT NOT NULL,
            nome_arquivo TEXT NOT NULL,
            data_recebimento TEXT DEFAULT CURRENT_TIMESTAMP
        )`);
        db.run("CREATE INDEX IF NOT EXISTS idx_mensagens_numero ON mensagens(numero)");
        db.run("CREATE INDEX IF NOT EXISTS idx_contatos_numero ON contatos(numero)");
    });

    return db;
}

// 💾 Função para salvar contato com criptografia
async function salvarContato(db, numero, nome) {
    const numeroCripto = criptografar(numero);
    const nomeCripto = criptografar(nome);
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM contatos WHERE numero = ?", [numeroCripto], (err, row) => {
            if (err) return reject("❌ Erro ao buscar contato: " + err);
            if (row) {
                if (row.nome !== nomeCripto) {
                    db.run("UPDATE contatos SET nome = ? WHERE numero = ?", [nomeCripto, numeroCripto], (err) => {
                        if (err) return reject("❌ Erro ao atualizar contato: " + err);
                        resolve(`🔄 Contato atualizado: ${nome} (${numero})`);
                    });
                } else {
                    resolve(`ℹ️ Contato já existente: ${nome} (${numero})`);
                }
            } else {
                db.run("INSERT INTO contatos (numero, nome) VALUES (?, ?)", [numeroCripto, nomeCripto], (err) => {
                    if (err) return reject("❌ Erro ao salvar novo contato: " + err);
                    resolve(`✅ Contato salvo: ${nome} (${numero})`);
                });
            }
        });
    });
}

// 💬 Função para salvar mensagens
async function salvarMensagem(db, numero, mensagem, data, tipo = 'individual') {
    const numeroCripto = criptografar(numero);
    const mensagemCripto = criptografar(mensagem);
    return new Promise((resolve, reject) => {
        db.run("INSERT INTO mensagens (numero, mensagem, data, tipo) VALUES (?, ?, ?, ?)",
            [numeroCripto, mensagemCripto, data, tipo], (err) => {
                if (err) return reject("❌ Erro ao salvar mensagem: " + err);
                resolve(`💬 Mensagem ${tipo} salva de ${numero}: ${mensagem}`);
            });
    });
}

// 📝 Banco principal com tabelas para mensagens automáticas e controle de envios
const dbPrincipal = new sqlite3.Database('vabot.db');
dbPrincipal.serialize(() => {
    dbPrincipal.run(`CREATE TABLE IF NOT EXISTS numeros_bot (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero TEXT UNIQUE,
        nome TEXT NOT NULL,
        ativo INTEGER DEFAULT 0
    )`, (err) => {
        if (err) console.error("❌ Erro ao criar tabela 'numeros_bot':", err);
        else console.log("📋 Tabela 'numeros_bot' pronta.");
    });

    dbPrincipal.run(`CREATE TABLE IF NOT EXISTS mensagens_automaticas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo TEXT NOT NULL,
        mensagem TEXT NOT NULL,
        tempo_envio INTEGER DEFAULT NULL,
        unidade_tempo TEXT DEFAULT 'minuto',
        data_hora_envio TEXT DEFAULT NULL,
        limite_envio INTEGER DEFAULT 1,
        qtd_envio INTEGER DEFAULT 1,
        ativo INTEGER DEFAULT 1,
        imagem_path TEXT DEFAULT NULL
    )`, (err) => {
        if (err) console.error("❌ Erro ao criar tabela 'mensagens_automaticas':", err);
        else console.log("📩 Tabela 'mensagens_automaticas' criada com sucesso.");
    });

    dbPrincipal.run(`CREATE TABLE IF NOT EXISTS arquivos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero TEXT NOT NULL,
        tipo TEXT NOT NULL,
        caminho TEXT NOT NULL,
        nome_arquivo TEXT NOT NULL,
        data_recebimento TEXT DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error("❌ Erro ao criar tabela 'arquivos':", err);
        else console.log("📁 Tabela 'arquivos' criada com sucesso.");
    });

    dbPrincipal.run(`CREATE TABLE IF NOT EXISTS envios_realizados (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_mensagem INTEGER NOT NULL,
        numero_contato TEXT NOT NULL,
        data_envio TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (id_mensagem, numero_contato, data_envio)
    )`, (err) => {
        if (err) console.error("❌ Erro ao criar tabela 'envios_realizados':", err);
        else console.log("📈 Tabela 'envios_realizados' criada com sucesso.");
    });
});

// 🌎 Exporta funções e banco principal
module.exports = { conectarBanco, salvarContato, salvarMensagem, dbPrincipal };
