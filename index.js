// 📦 Importações necessárias
require('dotenv').config();
const { dbPrincipal } = require('./database');
const { conectarBanco } = require('./database');

// 🌱 Configuração inicial
console.log("🚀 Inicialização do sistema Vabot iniciada...");

// 🔄 Carrega números e inicializa bots
function inicializarBots() {
    dbPrincipal.all("SELECT numero FROM numeros_bot WHERE ativo = 1", [], async (err, rows) => {
        if (err) {
            console.error("❌ Erro ao buscar números ativos:", err);
            return;
        }
        if (rows.length === 0) {
            console.log("⚠️ Nenhum número ativo encontrado para iniciar.");
            return;
        }

        for (const { numero } of rows) {
            console.log(`🤖 Inicializando bot para o número ${numero}...`);
            const db = conectarBanco(numero);
            console.log(`📂 Banco de dados conectado para o número ${numero}.`);
        }
    });
}

// 📝 Verifica integridade do banco principal
function verificarBancoPrincipal() {
    dbPrincipal.get("SELECT COUNT(*) as total FROM numeros_bot", (err, row) => {
        if (err) {
            console.error("❌ Erro ao verificar banco principal:", err);
            return;
        }
        console.log(`📋 Banco principal verificado. Total de números cadastrados: ${row.total}`);
    });
}

// 🚀 Processo de inicialização completo
(async () => {
    try {
        console.log("🔄 Verificando banco de dados principal...");
        verificarBancoPrincipal();
        console.log("🔄 Inicializando bots ativos...");
        inicializarBots();
        console.log("✅ Sistema Vabot inicializado com sucesso.");
    } catch (err) {
        console.error("❌ Erro durante o processo de inicialização:", err);
    }
})();
