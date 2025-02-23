// ✅ Verifica se a API do Electron está disponível
if (window.electron) {
    const { ipcRenderer } = window.electron;

    document.addEventListener('DOMContentLoaded', () => {
        configurarTema();
        configurarBotoes();
        configurarEventosMensagem();
        carregarMensagens();
        listarNumeros();
    });

    // 🎨 Configuração do tema claro/escuro
    function configurarTema() {
        const toggleTheme = document.getElementById('toggleTheme');
        const currentTheme = localStorage.getItem('theme') || 'light';
        document.body.classList.add(currentTheme + '-mode');
        toggleTheme.checked = currentTheme === 'dark';

        toggleTheme.addEventListener('change', () => {
            document.body.classList.toggle('dark-mode', toggleTheme.checked);
            document.body.classList.toggle('light-mode', !toggleTheme.checked);
            localStorage.setItem('theme', toggleTheme.checked ? 'dark' : 'light');
        });
    }

    // 🏃 Configuração dos botões principais
    function configurarBotoes() {
        document.getElementById("startBot").addEventListener("click", iniciarBot);
        document.getElementById("stopBot").addEventListener("click", pararBot);
        document.getElementById("abrirCadastro").addEventListener("click", () => window.location.href = "cadastro.html");
        document.getElementById("gerenciarMensagens").addEventListener("click", () => window.location.href = "mensagens.html");
    }

    // 📝 Configuração dos eventos da tela de mensagens
    function configurarEventosMensagem() {
        document.getElementById('formMensagem').addEventListener('submit', async (e) => {
            e.preventDefault();
            await salvarMensagem();
        });

        document.getElementById('tempoData').addEventListener('change', function () {
            document.getElementById('dataHoraEnvio').style.display = this.checked ? 'block' : 'none';
        });

        document.getElementById('imagemUpload').addEventListener('change', previewImagem);
    }

    // 🖼 Preview de imagem
    function previewImagem() {
        const preview = document.getElementById('previewImagem');
        preview.innerHTML = '';
        const file = this.files[0];
        if (file) {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.style.maxWidth = '200px';
            img.classList.add('img-thumbnail');
            preview.appendChild(img);
        }
    }

    // 💾 Salvar mensagem automática
    async function salvarMensagem() {
        const tipo = document.getElementById('tipoMensagem').value;
        const mensagem = document.getElementById('mensagemTexto').value.trim();
        const tempo = parseInt(document.getElementById('tempoEnvio').value) || 0;
        const limiteEnvio = parseInt(document.getElementById('limiteEnvio').value) || 1;
        const qtdEnvio = parseInt(document.getElementById('qtdEnvio').value) || 1;
        const ativo = document.getElementById('ativaMensagem').checked;
        const dataHoraEnvio = document.getElementById('dataHoraEnvio').value;

        const tempoConfig = {
            segundo: document.getElementById('tempoSegundo').checked,
            minuto: document.getElementById('tempoMinuto').checked,
            data: document.getElementById('tempoData').checked,
            dataHora: dataHoraEnvio
        };

        const imagemFile = document.getElementById('imagemUpload').files[0];
        let imagemPath = null;
        if (imagemFile) {
            imagemPath = imagemFile.path;
        }

        const resultado = await ipcRenderer.invoke('salvar-mensagem-automatica', {
            tipo, mensagem, tempo, tempoConfig, limiteEnvio, qtdEnvio, ativo, imagemPath
        });

        if (resultado.sucesso) {
            alert('✅ Mensagem salva com sucesso!');
            carregarMensagens();
            document.getElementById('formMensagem').reset();
            document.getElementById('previewImagem').innerHTML = '';
            document.getElementById('dataHoraEnvio').style.display = 'none';
        } else {
            alert(`❌ Erro ao salvar mensagem: ${resultado.erro}`);
        }
    }

    // 📋 Carrega todas as mensagens automáticas cadastradas
    async function carregarMensagens() {
        const lista = document.getElementById('listaMensagens');
        const mensagens = await ipcRenderer.invoke('listar-mensagens-automaticas');
        lista.innerHTML = mensagens.length > 0
            ? mensagens.map(m => `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <strong>📩 ${m.tipo.toUpperCase()}</strong>: ${m.mensagem}
                        ${m.imagemPath ? `<br><img src="file://${m.imagemPath}" style="max-width:100px;" class="img-thumbnail mt-2"/>` : ''}
                        <br><small>⏰ Tempo: ${m.tempo_envio || 'Imediato'} | 🔢 Limite: ${m.limite_envio} | 📦 Qtde: ${m.qtd_envio}</small>
                        <span class="badge bg-${m.ativo ? 'success' : 'secondary'}">${m.ativo ? 'Ativa' : 'Inativa'}</span>
                    </div>
                    <div>
                        <button class="btn btn-sm btn-warning" onclick="editarMensagem(${m.id})">✏️ Editar</button>
                        <button class="btn btn-sm btn-danger" onclick="removerMensagem(${m.id})">🗑 Remover</button>
                    </div>
                </li>`
            ).join('')
            : '<li class="list-group-item text-center">Nenhuma mensagem cadastrada.</li>';
    }

    // ✏️ Editar mensagem automática
    async function editarMensagem(id) {
        const novaMensagem = prompt("✏️ Edite a mensagem:");
        if (novaMensagem) {
            await ipcRenderer.invoke('editar-mensagem-automatica', { id, novaMensagem });
            carregarMensagens();
        }
    }

    // 🗑 Remover mensagem automática
    async function removerMensagem(id) {
        if (confirm('🗑 Tem certeza que deseja remover esta mensagem?')) {
            await ipcRenderer.invoke('remover-mensagem-automatica', id);
            carregarMensagens();
        }
    }

    // 📜 Lista números cadastrados
    async function listarNumeros() {
        try {
            const numeros = await ipcRenderer.invoke("listar-numeros");
            const select = document.getElementById("numeroSelecionado");
            select.innerHTML = numeros.map(n => `<option value="${n.numero}">${n.nome} (${n.numero})</option>`).join('');
            if (numeros.length > 0) carregarDados(numeros[0].numero);
        } catch (err) {
            console.error('❌ Erro ao listar números:', err);
        }
    }

    // 📦 Carrega dados do número selecionado
    function carregarDados(numero) {
        if (numero) {
            loadContacts(numero);
            loadMessages(numero);
        }
    }

    // 📞 Carrega contatos
    async function loadContacts(numero) {
        const contacts = await ipcRenderer.invoke("get-contacts", numero);
        const list = document.getElementById("contacts-list");
        list.innerHTML = contacts.map(c => `<li class="list-group-item">${c.nome} (${c.numero})</li>`).join('');
    }

    // 💬 Carrega mensagens do número
    async function loadMessages(numero) {
        const messages = await ipcRenderer.invoke("get-messages", numero);
        const list = document.getElementById("messages-list");
        list.innerHTML = messages.map(m => `<div class="message received">${m.mensagem} - <b>${m.numero}</b></div>`).join('');
    }

    // 🟢 Inicia o bot
    function iniciarBot() {
        const numeroSelecionado = document.getElementById("numeroSelecionado").value;
        ipcRenderer.send("start-bot", numeroSelecionado);
    }

    // 🔴 Para o bot
    function pararBot() {
        const numeroSelecionado = document.getElementById("numeroSelecionado").value;
        ipcRenderer.send("stop-bot", numeroSelecionado);
    }
} else {
    console.error("❌ Erro: window.electron não está disponível. Verifique o preload.js.");
}
