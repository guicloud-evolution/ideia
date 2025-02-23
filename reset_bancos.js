// 📦 Importações necessárias
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// 📝 Caminho para o banco principal e diretório de bancos individuais
const dbPrincipalPath = path.join(__dirname, 'vabot.db');
const databasesFolder = path.join(__dirname, 'databases');

// 🔄 Função para resetar o banco principal
function resetarBancoPrincipal() {
    if (fs.existsSync(dbPrincipalPath)) {
        fs.unlinkSync(dbPrincipalPath);
        console.log("🗑 Banco principal 'vabot.db' removido com sucesso.");
    } else {
        console.log("ℹ️ Banco principal 'vabot.db' não encontrado.");
    }
    criarBancoPrincipal();
}

// 📝 Cria a estrutura do banco principal
function criarBancoPrincipal() {
    const db = new sqlite3.Database(dbPrincipalPath);
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS numeros_bot (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero TEXT UNIQUE,
            nome TEXT NOT NULL,
            ativo INTEGER DEFAULT 0
        )`, (err) => {
            if (err) console.error("❌ Erro ao criar tabela 'numeros_bot':", err);
            else console.log("📋 Tabela 'numeros_bot' recriada com sucesso.");
        });
    });
}

// 🧹 Remove bancos individuais
function resetarBancosIndividuais() {
    if (fs.existsSync(databasesFolder)) {
        fs.readdirSync(databasesFolder).forEach(file => {
            const filePath = path.join(databasesFolder, file);
            if (fs.existsSync(filePath) && file.endsWith('.db')) {
                fs.unlinkSync(filePath);
                console.log(`🗑 Banco individual '${file}' removido com sucesso.`);
            }
        });
    } else {
        console.log("ℹ️ Pasta 'databases' não encontrada.");
    }
}

// 🚀 Reset completo dos bancos
function resetarTodosOsBancos() {
    console.log("⚠️ Iniciando reset completo dos bancos...");
    resetarBancoPrincipal();
    resetarBancosIndividuais();
    console.log("✅ Reset completo finalizado.");
}

// 🌎 Exporta função principal
module.exports = { resetarTodosOsBancos };
