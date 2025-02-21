// 📦 Importações necessárias
require('dotenv').config();
const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const { dbPrincipal } = require('./database');
const { fork } = require('child_process');
const fs = require('fs');

app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

let mainWindow;
let processosBots = {};

// 🚀 Cria a janela principal
function createWindow() {
    mainWindow = new BrowserWindow({
        width: parseInt(process.env.WINDOW_WIDTH) || 1000,
        height: parseInt(process.env.WINDOW_HEIGHT) || 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true
        }
    });

    mainWindow.loadFile('index.html');
    criarMenuPersonalizado();
}

// 📋 Menu principal com proteção de DevTools
function criarMenuPersonalizado() {
    const templateMenu = [
        {
            label: 'Arquivo',
            submenu: [
                { role: 'reload', label: 'Recarregar' },
                { role: 'quit', label: 'Sair' }
            ]
        },
        {
            label: 'Bots',
            submenu: [
                { label: 'Iniciar Bot', click: () => mainWindow.webContents.send('iniciar-bot') },
                { label: 'Parar Bot', click: () => mainWindow.webContents.send('parar-bot') }
            ]
        },
        {
            label: 'Visualizar',
            submenu: [
                { label: 'Tela Cheia', role: 'togglefullscreen' },
                {
                    label: 'DevTools (F12 com senha)',
                    accelerator: 'F12',
                    click: async () => {
                        const senhaCorreta = process.env.DEVTOOLS_PASSWORD || 'admin123';
                        const { response } = await dialog.showMessageBox(mainWindow, {
                            type: 'question',
                            buttons: ['Cancelar', 'Confirmar'],
                            title: '🔒 Acesso ao DevTools',
                            message: 'Digite a senha para acessar o DevTools:',
                            inputType: 'password'
                        });
                        if (response === 1) mainWindow.webContents.openDevTools();
                        else console.log('❌ Senha incorreta para abrir DevTools.');
                    }
                }
            ]
        },
        {
            label: 'Cadastro',
            submenu: [
                { label: 'Cadastro de Telefone', click: () => mainWindow.loadFile('cadastro.html') }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(templateMenu);
    Menu.setApplicationMenu(menu);
}

// ⚡ Inicializa o app
app.whenReady().then(() => {
    createWindow();
    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// 🔄 Canal para cadastro de número
ipcMain.handle('adicionar-numero', async (event, { nome, numero }) => {
    try {
        await new Promise((resolve, reject) => {
            dbPrincipal.run(
                "INSERT INTO numeros_bot (nome, numero, ativo) VALUES (?, ?, 0)",
                [nome, numero],
                function (err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
        return { sucesso: true };
    } catch (error) {
        return { sucesso: false, erro: error.message };
    }
});

// 🔄 Canal para listar números
ipcMain.handle('listar-numeros', async () => {
    try {
        return await new Promise((resolve, reject) => {
            dbPrincipal.all("SELECT * FROM numeros_bot", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    } catch (error) {
        console.error("❌ Erro ao listar números:", error);
        return [];
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
