require('dotenv').config();
const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const { dbPrincipal } = require('./database');
const { fork } = require('child_process');
const fs = require('fs');

let mainWindow;
let processosBots = {};
const senhaDevTools = process.env.DEVTOOLS_PASSWORD || 'admin123';

// 🔧 Otimização de desempenho
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

// 🚀 Cria a janela principal
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true
        }
    });

    mainWindow.loadFile('index.html');
    criarMenuPersonalizado();
}

// 📋 Menu principal com proteção do DevTools
function criarMenuPersonalizado() {
    const templateMenu = [
        {
            label: 'Arquivo',
            submenu: [
                { role: 'reload', label: '🔄 Recarregar' },
                { role: 'quit', label: '❌ Sair' }
            ]
        },
        {
            label: 'Bots',
            submenu: [
                { label: '🟢 Iniciar Bot', click: () => mainWindow.webContents.send('iniciar-bot') },
                { label: '🔴 Parar Bot', click: () => mainWindow.webContents.send('parar-bot') },
                { label: '💬 Mensagens Automáticas', click: () => mainWindow.loadFile('mensagens.html') }
            ]
        },
        {
            label: 'Visualizar',
            submenu: [
                { label: '🖥️ Tela Cheia', role: 'togglefullscreen' },
                {
                    label: '🛠️ DevTools (F12)',
                    accelerator: 'F12',
                    click: async () => solicitarSenhaDevTools()
                }
            ]
        },
        {
            label: 'Cadastro',
            submenu: [
                { label: '📞 Cadastro de Telefone', click: () => mainWindow.loadFile('cadastro.html') }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(templateMenu);
    Menu.setApplicationMenu(menu);
}

// 🔒 Modal de senha para o DevTools
function solicitarSenhaDevTools() {
    const senhaWindow = new BrowserWindow({
        width: 400,
        height: 200,
        resizable: false,
        modal: true,
        parent: mainWindow,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    senhaWindow.loadURL(`data:text/html,
        <html>
        <body style="display:flex;justify-content:center;align-items:center;height:100%;flex-direction:column;font-family:sans-serif;">
            <h3>🔒 Senha DevTools</h3>
            <input id="senha" type="password" placeholder="Digite a senha" style="padding:10px;width:80%;font-size:16px;" />
            <button onclick="enviarSenha()" style="margin-top:10px;padding:10px 20px;font-size:16px;">🔓 Acessar</button>
            <script>
                const { ipcRenderer } = require('electron');
                function enviarSenha() {
                    const senha = document.getElementById('senha').value;
                    ipcRenderer.send('senha-devtools', senha);
                }
            </script>
        </body>
        </html>`);
}

// 🛡 Validação da senha do DevTools
ipcMain.on('senha-devtools', (event, senha) => {
    if (senha === senhaDevTools) {
        mainWindow.webContents.openDevTools();
        BrowserWindow.getFocusedWindow().close();
    } else {
        BrowserWindow.getFocusedWindow().webContents.executeJavaScript(
            `alert("❌ Senha incorreta para o DevTools!");`
        );
    }
});

// ⚡ Inicialização do app
app.whenReady().then(() => {
    createWindow();
    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// 🔄 Canais IPC para gerenciamento de números
ipcMain.handle('listar-numeros', async () => {
    return new Promise((resolve, reject) => {
        dbPrincipal.all("SELECT * FROM numeros_bot", [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
});

ipcMain.handle('adicionar-numero', async (event, { nome, numero }) => {
    return new Promise((resolve, reject) => {
        dbPrincipal.run("INSERT INTO numeros_bot (nome, numero, ativo) VALUES (?, ?, 0)",
            [nome, numero],
            function (err) {
                if (err) reject({ sucesso: false, erro: err.message });
                else resolve({ sucesso: true });
            });
    });
});

// 💬 Canais IPC para gerenciamento de mensagens automáticas
ipcMain.handle('listar-mensagens-automaticas', async () => {
    return new Promise((resolve, reject) => {
        dbPrincipal.all("SELECT * FROM mensagens_automaticas", [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
});

ipcMain.handle('salvar-mensagem-automatica', async (event, dados) => {
    return new Promise((resolve, reject) => {
        const { tipo, mensagem, tempo, tempoConfig, limiteEnvio, qtdEnvio, ativo, imagemPath } = dados;
        dbPrincipal.run(`INSERT INTO mensagens_automaticas 
            (tipo, mensagem, tempo_envio, unidade_tempo, data_hora_envio, limite_envio, qtd_envio, ativo, imagem_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [tipo, mensagem, tempo, tempoConfig.segundo ? 'segundo' : tempoConfig.minuto ? 'minuto' : 'data',
                tempoConfig.dataHora || null, limiteEnvio, qtdEnvio, ativo ? 1 : 0, imagemPath || null],
            function (err) {
                if (err) reject({ sucesso: false, erro: err.message });
                else resolve({ sucesso: true });
            });
    });
});

// 🖇 Upload de imagens
ipcMain.handle('upload-imagem', async (event, filePath) => {
    try {
        const destino = path.join(__dirname, 'uploads', path.basename(filePath));
        fs.copyFileSync(filePath, destino);
        return { sucesso: true, caminho: destino };
    } catch (err) {
        return { sucesso: false, erro: err.message };
    }
});

// 🤖 Gerenciamento de Bots
ipcMain.on('start-bot', (event, numero) => {
    if (!processosBots[numero]) {
        const processo = fork(path.join(__dirname, 'bot.js'), [numero]);
        processosBots[numero] = processo;
        console.log(`🤖 Bot para o número ${numero} iniciado.`);
    }
});

ipcMain.on('stop-bot', (event, numero) => {
    if (processosBots[numero]) {
        processosBots[numero].kill();
        delete processosBots[numero];
        console.log(`🛑 Bot para o número ${numero} parado.`);
    }
});
