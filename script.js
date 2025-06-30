// Estado das quadras
let courtStatus = {
    ceret: {
        occupants: {} // Agora um objeto para armazenar múltiplos ocupantes (UID: {username, startTime})
    },
    pelezao: {
        occupants: {} // Agora um objeto para armazenar múltiplos ocupantes (UID: {username, startTime})
    }
};

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBDOZBWIINdAHkEW7t3IymNNEkiJfvbeOA",
  authDomain: "pickleball-f03ab.firebaseapp.com",
  databaseURL: "https://pickleball-f03ab-default-rtdb.firebaseio.com/",
  projectId: "pickleball-f03ab",
  storageBucket: "pickleball-f03ab.firebasestorage.app",
  messagingSenderId: "655138234475",
  appId: "1:655138234475:web:0cd20d9852a13005d8912e"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig  );
const database = firebase.database();
const auth = firebase.auth(); // Inicializa o Firebase Auth
const chatRef = database.ref("chat"); // NOVO: Referência para o chat no Firebase
const announcementsRef = database.ref("announcements"); // NOVO: Referência para anúncios

// NOVO: Lista de UIDs de administradores
// ATENÇÃO: Substitua estes UIDs pelos UIDs reais dos usuários que serão administradores.
// Você pode encontrar o UID de um usuário no console do Firebase Authentication.
const adminUids = [
    "EyJreSEmsnVnESkfVtYDFQKAIPo1", // Exemplo: "abcdef1234567890abcdef1234567890"
    "SEU_UID_ADMIN_2"  // Adicione mais UIDs conforme necessário
];

// Função para verificar se o usuário atual é um administrador
function isAdmin() {
    const currentUser = getCurrentUser();
    return currentUser && adminUids.includes(currentUser.uid);
}

// Carregar estado das quadras do Firebase
async function loadCourtStatus() {
    return new Promise((resolve) => {
        database.ref("courtStatus").on("value", (snapshot) => {
            const data = snapshot.val();
            if (data) {
                // Garante que 'occupants' seja um objeto, mesmo que venha nulo do Firebase
                courtStatus.ceret.occupants = data.ceret?.occupants || {};
                courtStatus.pelezao.occupants = data.pelezao?.occupants || {};
                
                // Atualizar display das quadras
                Object.keys(courtStatus).forEach(court => {
                    updateCourtDisplay(court);
                });
            }
            resolve();
        });
    });
}

// Salvar estado das quadras no Firebase
async function saveCourtStatus() {
    await database.ref("courtStatus").set(courtStatus);
}

// Alternar status da quadra (Entrar/Sair)
async function toggleCourtStatus(court) {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.uid) {
        showNotification("Por favor, faça login para usar esta funcionalidade!");
        showLoginModal();
        return;
    }

    const currentOccupants = courtStatus[court].occupants || {};
    const isUserOccupying = currentOccupants[currentUser.uid];

    if (isUserOccupying) {
        // Se o usuário já está na quadra, ele quer sair
        await removeOccupant(court, currentUser);
    } else {
        // Se o usuário não está na quadra, ele quer entrar
        await addOccupant(court, currentUser);
    }
}

// Adicionar ocupante à quadra
async function addOccupant(court, user) {
    courtStatus[court].occupants[user.uid] = {
        username: user.username,
        lastName: user.lastName, // Inclui o sobrenome
        startTime: Date.now() // Registra o tempo de entrada
    };
    
    updateCourtDisplay(court);
    await saveCourtStatus(); // Salvar no Firebase
    
    // Não adicionamos tempo aqui, apenas quando o usuário sai
    
    showNotification(`${user.username} ${user.lastName || ""} entrou na Quadra ${court.toUpperCase()}!`);
}

// Remover ocupante da quadra
async function removeOccupant(court, user) {
    const occupantData = courtStatus[court].occupants[user.uid];
    if (occupantData && occupantData.startTime) {
        const duration = Date.now() - occupantData.startTime; // Calcula a duração em milissegundos
        const endTime = Date.now(); // Registra o tempo de saída

        // Salvar a sessão no histórico do usuário
        await database.ref(`userSessions/${user.uid}`).push({
            court: court,
            startTime: occupantData.startTime,
            endTime: endTime,
            duration: duration
        });

        await addTimeToUser(user.uid, duration); // Adiciona o tempo ao utilizador
    }

    delete courtStatus[court].occupants[user.uid];
    
    updateCourtDisplay(court);
    await saveCourtStatus(); // Salvar no Firebase
    
    showNotification(`${user.username} ${user.lastName || ""} saiu da Quadra ${court.toUpperCase()}!`);
}

// Atualizar exibição da quadra
function updateCourtDisplay(court) {
    const statusElement = document.getElementById(`status-${court}`);
    const buttonElement = document.getElementById(`btn-${court}`);
    const playersListElement = document.getElementById(`players-${court}`); // Novo elemento para a lista de jogadores
    const currentOccupants = courtStatus[court].occupants || {};
    const numOccupants = Object.keys(currentOccupants).length;
    const currentUser = getCurrentUser();
    const isCurrentUserInCourt = currentUser && currentOccupants[currentUser.uid];

    // Atualizar status da quadra
    if (numOccupants > 0) {
        statusElement.className = "occupied";
        statusElement.innerHTML = `<span class="status-indicator occupied"></span>Ocupada por ${numOccupants} jogador(es)`;
    } else {
        statusElement.className = "free";
        statusElement.innerHTML = `<span class="status-indicator free"></span>Livre`;
    }

    // Atualizar texto e estilo do botão
    if (isCurrentUserInCourt) {
        buttonElement.textContent = "Sair da Quadra";
        buttonElement.style.background = "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)";
    } else {
        buttonElement.textContent = "Entrar na Quadra";
        buttonElement.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
    }

    // Gerar e exibir a lista de jogadores
    if (numOccupants > 0) {
        let playersHtml = "<h3>Jogadores na Quadra:</h3><ul>";
        for (const uid in currentOccupants) {
            const occupant = currentOccupants[uid];
            const timeInCourt = Date.now() - occupant.startTime;
            playersHtml += `<li><span class="player-name">${occupant.username} ${occupant.lastName || ""}</span> <span class="player-action">(${formatTime(timeInCourt)})</span></li>`;
        }
        playersHtml += "</ul>";
        playersListElement.innerHTML = playersHtml;
        playersListElement.style.display = "block";
    } else {
        playersListElement.innerHTML = `<p style="text-align: center; color: #666; font-size: 0.9em;">Ninguém na quadra ainda.</p>`;
        playersListElement.style.display = "block"; // Sempre mostra a mensagem, mesmo que vazia
    }
}

// Função para formatar tempo em milissegundos para HH:MM:SS
function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    const displaySeconds = seconds % 60;
    const displayMinutes = minutes % 60;
    const displayHours = hours;

    const pad = (num) => num.toString().padStart(2, "0");

    if (displayHours > 0) {
        return `${pad(displayHours)}h ${pad(displayMinutes)}m ${pad(displaySeconds)}s`;
    } else if (displayMinutes > 0) {
        return `${pad(displayMinutes)}m ${pad(displaySeconds)}s`;
    } else {
        return `${pad(displaySeconds)}s`;
    }
}

// Função para formatar timestamp para data e hora legíveis
function formatDateTime(timestamp) {
    const date = new Date(timestamp);
    const options = { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" };
    return date.toLocaleDateString("pt-BR", options);
}


// Mostrar notificação
function showNotification(message) {
    // Criar elemento de notificação
    const notification = document.createElement("div");
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        z-index: 1000;
        font-weight: 600;
        animation: slideIn 0.3s ease-out;
        max-width: 300px;
    `;
    
    // Adicionar animação CSS
    const style = document.createElement("style");
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Remover após 3 segundos
    setTimeout(() => {
        notification.style.animation = "slideOut 0.3s ease-out";
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Inicializar quando a página carregar
document.addEventListener("DOMContentLoaded", async function() {
    await loadCourtStatus(); // Carregar status das quadras do Firebase
    initializeAuth(); // Inicializa o listener de autenticação
    await initializeRanking();
    listenForChatMessages(); // Inicia o listener de mensagens do chat
    setupChatEventListeners(); // Configura os event listeners do chat
    await loadCourtAnnouncements(); // NOVO: Carrega os anúncios das quadras ao iniciar
});

// Sistema de autenticação
let currentUser = null; // Armazena os dados do perfil do utilizador logado

// Inicializar autenticação com listener do Firebase Auth
function initializeAuth() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const userProfile = await getUserProfile(user.uid);
            // Prioriza o username e lastName do perfil, se existirem. Caso contrário, usa o email.
            if (userProfile && userProfile.username) {
                currentUser = { ...userProfile, uid: user.uid };
            } else {
                // Fallback: Se o perfil ou o username estiver faltando, usa o email como username
                currentUser = { uid: user.uid, username: user.email || "Usuário Desconhecido", lastName: "", totalTime: userProfile?.totalTime || 0 };
            }
            updateUserDisplay();
        } else {
            currentUser = null;
            updateUserDisplay();
            showNotification("Você está deslogado.");
        }
        updateRankingDisplay();
        Object.keys(courtStatus).forEach(court => updateCourtDisplay(court));
        updateAdminButtonVisibility(); // NOVO: Atualiza a visibilidade do botão de admin
    });
}

// Obter utilizador atual
function getCurrentUser() {
    return currentUser;
}

// Mostrar modal de login
function showLoginModal() {
    document.getElementById("login-modal").style.display = "flex"; // Usar flex para centralizar
}

// Esconder modal de login
function hideLoginModal() {
    document.getElementById("login-modal").style.display = "none";
}

// Processar login
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    
    if (!email || !password) {
        showNotification("Por favor, preencha todos os campos!");
        return;
    }
    
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        const userProfile = await getUserProfile(user.uid);
        // Prioriza o username e lastName do perfil, se existirem. Caso contrário, usa o email.
        if (userProfile && userProfile.username) {
            currentUser = { ...userProfile, uid: user.uid };
            updateUserDisplay(); // Atualiza a exibição imediatamente
            showNotification(`Bem-vindo de volta, ${currentUser.username} ${currentUser.lastName || ""}!`);
        } else {
            // Fallback: Se o perfil ou o username estiver faltando, usa o email como username
            currentUser = { uid: user.uid, username: user.email || "Usuário Desconhecido", lastName: "", totalTime: userProfile?.totalTime || 0 };
            updateUserDisplay();
            showNotification(`Bem-vindo de volta, ${currentUser.username} ${currentUser.lastName || ""}!`);
        }

        hideLoginModal();
        document.getElementById("login-form").reset();
    } catch (error) {
        let errorMessage = "Erro ao fazer login. Por favor, tente novamente.";
        if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
            errorMessage = "Email ou senha incorretos.";
        } else if (error.code === "auth/invalid-email") {
            errorMessage = "Formato de email inválido.";
        }
        showNotification(errorMessage);
        console.error("Erro de login:", error);
    }
}

// Logout
async function logout() {
    try {
        await auth.signOut();
        showNotification("Logout realizado com sucesso!");
    } catch (error) {
        showNotification("Erro ao fazer logout. Por favor, tente novamente.");
        console.error("Erro de logout:", error);
    }
}

// Mostrar modal de cadastro
function showRegisterModal() {
    document.getElementById("register-modal").style.display = "flex"; // Usar flex para centralizar
}

// Esconder modal de cadastro
function hideRegisterModal() {
    document.getElementById("register-modal").style.display = "none";
}

// Alternar entre modais
function switchToRegister() {
    hideLoginModal();
    showRegisterModal();
}

function switchToLogin() {
    hideRegisterModal();
    showLoginModal();
}

// Processar cadastro
async function handleRegister(event) {
    event.preventDefault();
    
    const username = document.getElementById("register-username").value.trim();
    const lastName = document.getElementById("register-lastname").value.trim(); // NOVO: Captura o sobrenome
    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value;
    const confirmPassword = document.getElementById("register-confirm-password").value;
    const phone = document.getElementById("register-phone").value.trim();
    
    // Validações
    if (!username || !lastName || !email || !password || !confirmPassword) { // Valida o sobrenome também
        showNotification("Por favor, preencha todos os campos obrigatórios!");
        return;
    }
    
    if (password !== confirmPassword) {
        showNotification("As senhas não coincidem!");
        return;
    }
    
    if (password.length < 6) {
        showNotification("A senha deve ter pelo menos 6 caracteres!");
        return;
    }
    
    try {
        // 1. Criar utilizador no Firebase Authentication
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const uid = userCredential.user.uid;

        // 2. Salvar dados adicionais do perfil no Realtime Database
        const newUserProfile = {
            username: username,
            lastName: lastName, // NOVO: Salva o sobrenome
            email: email,
            phone: phone || "",
            totalTime: 0, // Inicializa o tempo total em 0
            joinDate: new Date().toISOString()
        };
        await database.ref("users/" + uid).set(newUserProfile); // Salva sob o UID

        // 3. Salvar email na lista de emails registrados (se ainda for necessário para algum log)
        await saveRegisteredEmail(email, username);
        
        // Atualizar currentUser e a exibição imediatamente após o cadastro
        currentUser = { uid: uid, ...newUserProfile };
        updateUserDisplay(); 
        
        showNotification(`Conta criada com sucesso! Bem-vindo, ${username} ${lastName}!`);
        
        hideRegisterModal(); // Esconde o modal de cadastro
        document.getElementById("register-form").reset(); // Limpa o formulário

    } catch (error) {
        let errorMessage = "Erro ao criar conta. Por favor, tente novamente.";
        if (error.code === "auth/email-already-in-use") {
            errorMessage = "Este email já está em uso. Tente fazer login ou use outro email.";
        } else if (error.code === "auth/weak-password") {
            errorMessage = "A senha é muito fraca. Use pelo menos 6 caracteres.";
        } else if (error.code === "auth/invalid-email") {
            errorMessage = "Formato de email inválido.";
        }
        showNotification(errorMessage);
        console.error("Erro de cadastro:", error);
    }
}

// Salvar email registrado no Firebase (mantido para compatibilidade, mas pode ser removido se não for mais necessário)
async function saveRegisteredEmail(email, username) {
    const emailData = {
        email: email,
        username: username,
        registeredAt: new Date().toISOString()
    };
    await database.ref("registeredEmails").push(emailData);
}

// Atualizar exibição do utilizador
function updateUserDisplay() {
    const userDisplay = document.getElementById("user-display");
    const userPoints = document.getElementById("user-points"); // Este elemento agora exibirá o tempo
    const loginBtn = document.getElementById("login-btn");
    const registerBtn = document.getElementById("register-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const adminPanelBtn = document.getElementById("admin-panel-btn"); // NOVO

    if (currentUser) {
        userDisplay.textContent = `${currentUser.username} ${currentUser.lastName || ""}`; // Exibe nome completo
        userPoints.textContent = `${formatTime(currentUser.totalTime || 0)}`; // Exibe o tempo formatado
        userPoints.style.display = "inline-block";
        loginBtn.style.display = "none";
        registerBtn.style.display = "none";
        logoutBtn.style.display = "inline-block";
        updateAdminButtonVisibility(); // NOVO: Atualiza a visibilidade do botão de admin
    } else {
        userDisplay.textContent = "Visitante";
        userPoints.textContent = "0s"; // Tempo inicial para visitante
        userPoints.style.display = "none";
        loginBtn.style.display = "inline-block";
        registerBtn.style.display = "inline-block";
        logoutBtn.style.display = "none";
        adminPanelBtn.style.display = "none"; // Esconde o botão de admin se não estiver logado
    }
}

// NOVO: Função para atualizar a visibilidade do botão de admin
function updateAdminButtonVisibility() {
    const adminPanelBtn = document.getElementById("admin-panel-btn");
    if (isAdmin()) {
        adminPanelBtn.style.display = "inline-block";
    } else {
        adminPanelBtn.style.display = "none";
    }
}

// NOVO: Funções para o Modal de Configurações do Utilizador
async function showUserSettingsModal() { // Tornada async para buscar histórico
    if (!currentUser) {
        showNotification("Por favor, faça login para ver suas configurações!");
        showLoginModal();
        return;
    }

    // Preencher os detalhes do utilizador no modal
    document.getElementById("settings-full-name").textContent = `${currentUser.username} ${currentUser.lastName || ""}`; // Nome completo
    document.getElementById("settings-email").textContent = currentUser.email || "N/A";
    document.getElementById("settings-phone").textContent = currentUser.phone || "N/A";
    document.getElementById("settings-total-time").textContent = formatTime(currentUser.totalTime || 0);
    
    // Formatar a data de entrada
    const joinDate = currentUser.joinDate ? new Date(currentUser.joinDate).toLocaleDateString("pt-BR") : "N/A";
    document.getElementById("settings-join-date").textContent = joinDate;

    // Preencher o histórico de tempo
    const historyList = document.getElementById("history-list");
    historyList.innerHTML = ""; // Limpa o histórico anterior

    const userSessionsRef = database.ref(`userSessions/${currentUser.uid}`);
    const snapshot = await userSessionsRef.once("value");
    const sessionsData = snapshot.val();

    if (sessionsData) {
        const sessionsArray = Object.values(sessionsData);
        // Opcional: ordenar as sessões, por exemplo, da mais recente para a mais antiga
        sessionsArray.sort((a, b) => b.startTime - a.startTime);

        sessionsArray.forEach(session => {
            const listItem = document.createElement("li");
            listItem.innerHTML = `
                <span><strong>Quadra:</strong> ${session.court.toUpperCase()}</span>
                <span><strong>Entrada:</strong> ${formatDateTime(session.startTime)}</span>
                <span><strong>Saída:</strong> ${formatDateTime(session.endTime)}</span>
                <span><strong>Duração:</strong> ${formatTime(session.duration)}</span>
            `;
            historyList.appendChild(listItem);
        });
    } else {
        historyList.innerHTML = "<li>Nenhum histórico de tempo encontrado.</li>";
    }

    document.getElementById("user-settings-modal").style.display = "flex";
}

function hideUserSettingsModal() {
    document.getElementById("user-settings-modal").style.display = "none";
}


// Sistema de ranking

// Função para obter o perfil de um utilizador pelo UID
async function getUserProfile(uid) {
    return new Promise((resolve) => {
        database.ref("users/" + uid).once("value", (snapshot) => {
            resolve(snapshot.val());
        });
    });
}

// Função para obter todos os utilizadores do Firebase (para ranking)
async function getUsers() {
    return new Promise((resolve) => {
        database.ref("users").once("value", (snapshot) => {
            const usersData = snapshot.val();
            const usersArray = [];
            if (usersData) {
                // Converte o objeto de utilizadores (UIDs como chaves) para um array
                for (const uid in usersData) {
                    usersArray.push({ uid, ...usersData[uid] });
                }
            }
            resolve(usersArray);
        });
    });
}

// Função para salvar utilizadores no Firebase (usada principalmente para adicionar tempo)
async function saveUsers(users) {
    const updates = {};
    users.forEach(user => {
        if (user.uid) {
            updates["users/" + user.uid] = {
                username: user.username,
                lastName: user.lastName, // Garante que lastName seja salvo
                email: user.email,
                phone: user.phone,
                totalTime: user.totalTime || 0, // Garante que totalTime seja salvo
                joinDate: user.joinDate
            };
        }
    });
    await database.ref().update(updates);
}


// Função para adicionar tempo ao utilizador
async function addTimeToUser(uid, timeToAdd) {
    const userRef = database.ref("users/" + uid);
    userRef.transaction((currentData) => {
        if (currentData) {
            currentData.totalTime = (currentData.totalTime || 0) + timeToAdd;
        }
        return currentData;
    }, (error, committed, snapshot) => {
        if (error) {
            console.error("Erro na transação de tempo:", error);
        } else if (committed) {
            // Atualiza o currentUser localmente se for o mesmo usuário
            if (currentUser && currentUser.uid === uid) {
                currentUser.totalTime = snapshot.val().totalTime;
                updateUserDisplay();
            }
            updateRankingDisplay(); // Atualiza o ranking após a mudança de tempo
        }
    });
}

// Mostrar modal de ranking
function showRankingModal() {
    updateRankingDisplay();
    document.getElementById("ranking-modal").style.display = "flex"; // Usar flex para centralizar
}

// Esconder modal de ranking
function hideRankingModal() {
    document.getElementById("ranking-modal").style.display = "none";
}

// Atualizar exibição do ranking
async function updateRankingDisplay() {
    const users = await getUsers();
    // Ordena por totalTime (tempo total) em ordem decrescente
    const sortedUsers = users.sort((a, b) => (b.totalTime || 0) - (a.totalTime || 0));
    const rankingList = document.getElementById("ranking-list");
    
    if (sortedUsers.length === 0) {
        rankingList.innerHTML = `<p style="text-align: center; color: #666;">Nenhum utilizador registado ainda.</p>`;
        return;
    }
    
    rankingList.innerHTML = sortedUsers.map((user, index) => {
        const position = index + 1;
        let positionClass = "";
        let medal = "";
        
        if (position === 1) {
            positionClass = "first";
            medal = "🥇";
        } else if (position === 2) {
            positionClass = "second";
            medal = "🥈";
        } else if (position === 3) {
            positionClass = "third";
            medal = "🥉";
        }
        
        return `
            <div class="ranking-item">
                <div class="ranking-position ${positionClass}">
                    ${medal} ${position}º
                </div>
                <div class="ranking-user">
                    <div class="ranking-username">${user.username} ${user.lastName || ""}</div> <!-- Exibe nome completo -->
                    <div class="ranking-email">${user.email}</div>
                </div>
                <div class="ranking-points">${formatTime(user.totalTime || 0)}</div> <!-- Exibe o tempo formatado -->
            </div>
        `;
    }).join("");
}

// Inicializar ranking
async function initializeRanking() {
    // Este bloco de código para adicionar usuários de exemplo foi removido.
    // Agora, o ranking dependerá apenas dos usuários reais cadastrados.
    // Se você precisar de usuários de exemplo para testes, adicione-os manualmente
    // ou reintroduza um bloco similar, mas com uma condição para não rodar em produção.
}

// Funções do Chat
function setupChatEventListeners() {
    const chatMessageInput = document.getElementById("chat-message-input");
    const chatSendBtn = document.getElementById("chat-send-btn");

    chatSendBtn.addEventListener("click", sendMessage);
    chatMessageInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            sendMessage();
        }
    });
}

function toggleChat() {
    const chatWidget = document.getElementById("chat-widget");
    const chatHeaderText = document.getElementById("chat-header-text"); // Referência ao h3

    chatWidget.classList.toggle("collapsed");
    if (chatWidget.classList.contains("collapsed")) {
        chatHeaderText.textContent = "💬 Chat"; // Texto para o ícone
    } else {
        chatHeaderText.textContent = "💬 Chat Global"; // Texto quando expandido
        // Rola para o final das mensagens quando o chat é expandido
        const chatMessages = document.getElementById("chat-messages");
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

function sendMessage() {
    const chatMessageInput = document.getElementById("chat-message-input");
    const messageText = chatMessageInput.value.trim();
    const currentUser = getCurrentUser();

    if (messageText && currentUser && currentUser.uid) {
        const message = {
            senderUid: currentUser.uid,
            senderName: `${currentUser.username} ${currentUser.lastName || ""}`,
            text: messageText,
            timestamp: Date.now()
        };
        chatRef.push(message); // Envia a mensagem para o Firebase
        chatMessageInput.value = ""; // Limpa o input
    } else if (!currentUser || !currentUser.uid) {
        showNotification("Por favor, faça login para enviar mensagens no chat!");
        showLoginModal();
    }
}

function listenForChatMessages() {
    const chatMessagesDiv = document.getElementById("chat-messages");

    // Listener para novas mensagens
    chatRef.on("child_added", (snapshot) => {
        const message = snapshot.val();
        const messageId = snapshot.key; // Obter o ID único da mensagem
        const currentUser = getCurrentUser(); // Obter o usuário logado

        const messageElement = document.createElement("div");
        messageElement.classList.add("chat-message");
        messageElement.setAttribute("data-message-id", messageId); // Armazenar o ID da mensagem no elemento

        // Adicionar classe para mensagens do próprio usuário
        if (currentUser && message.senderUid === currentUser.uid) {
            messageElement.classList.add("own-message");
        }

        const senderSpan = document.createElement("span");
        senderSpan.classList.add("sender");
        senderSpan.textContent = message.senderName + ": ";

        const contentSpan = document.createElement("span");
        contentSpan.classList.add("content");
        contentSpan.textContent = message.text;

        messageElement.appendChild(senderSpan);
        messageElement.appendChild(contentSpan);

        // Adicionar botão de apagar se for a própria mensagem OU se for administrador
        if ((currentUser && message.senderUid === currentUser.uid) || isAdmin()) {
            const deleteButton = document.createElement("button");
            deleteButton.classList.add("delete-message-btn");
            deleteButton.textContent = "X"; // Ou um ícone, como '🗑️'
            deleteButton.title = "Apagar mensagem";
            deleteButton.onclick = () => deleteChatMessage(messageId);
            messageElement.appendChild(deleteButton);
        }
        
        chatMessagesDiv.appendChild(messageElement);

        // Rola para o final das mensagens
        chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
    });

    // Listener para mensagens removidas (para atualizar a UI em tempo real)
    chatRef.on("child_removed", (snapshot) => {
        const messageId = snapshot.key;
        const messageElement = document.querySelector(`.chat-message[data-message-id="${messageId}"]`);
        if (messageElement) {
            messageElement.remove();
        }
    });
}

// Função para apagar uma mensagem
async function deleteChatMessage(messageId) {
    if (confirm("Tem certeza que deseja apagar esta mensagem?")) {
        try {
            await chatRef.child(messageId).remove();
            showNotification("Mensagem apagada com sucesso!");
        } catch (error) {
            showNotification("Erro ao apagar mensagem. Tente novamente.");
            console.error("Erro ao apagar mensagem:", error);
        }
    }
}

// NOVO: Funções do Painel de Administração
function showAdminPanelModal() {
    if (!isAdmin()) {
        showNotification("Você não tem permissão para acessar o painel de administração.");
        return;
    }
    document.getElementById("admin-panel-modal").style.display = "flex";
}

function hideAdminPanelModal() {
    document.getElementById("admin-panel-modal").style.display = "none";
}

// NOVO: Alternar campo de motivo
function toggleReasonField() {
    const announcementType = document.getElementById("announcement-type").value;
    const reasonGroup = document.getElementById("announcement-reason-group");
    if (announcementType === "class-off") {
        reasonGroup.style.display = "block";
    } else {
        reasonGroup.style.display = "none";
        document.getElementById("announcement-reason").value = ""; // Limpa o campo de motivo
    }
}

// NOVO: Lidar com o envio do formulário de anúncio
async function handleAnnouncement(event) {
    event.preventDefault();

    const court = document.getElementById("announcement-court").value;
    const announcementType = document.getElementById("announcement-type").value;
    const reason = document.getElementById("announcement-reason").value.trim();
    const currentUser = getCurrentUser();

    if (!court || !announcementType || !currentUser || !currentUser.uid) {
        showNotification("Por favor, preencha todos os campos obrigatórios e faça login.");
        return;
    }

    let announcementText = "";
    let announcementClass = ""; // Para estilização no chat
    let courtAnnouncementText = ""; // Para exibição na quadra
    let courtAnnouncementClass = ""; // Para estilização na quadra

    if (announcementType === "class-on") {
        announcementText = `Haverá aula de Pickleball na Quadra ${court.toUpperCase()}! 🎾`;
        announcementClass = "announcement class-on";
        courtAnnouncementText = "AULA CONFIRMADA ✅";
        courtAnnouncementClass = "class-on";
    } else { // class-off
        announcementText = `NÃO haverá aula de Pickleball na Quadra ${court.toUpperCase()}. Motivo: ${reason || "Não especificado."} 🚫`;
        announcementClass = "announcement class-off";
        courtAnnouncementText = `AULA CANCELADA ❌ (${reason || "Motivo não especificado"})`;
        courtAnnouncementClass = "class-off";
    }

    const announcementMessage = {
        senderUid: currentUser.uid,
        senderName: "ADMIN", // Ou o nome do admin
        text: announcementText,
        timestamp: Date.now(),
        type: "announcement", // Indica que é um anúncio
        announcementDetails: {
            court: court,
            type: announcementType,
            reason: reason || null
        }
    };

    try {
        // Envia o anúncio para o chat
        await chatRef.push(announcementMessage);

        // Salva o último status de anúncio para a quadra específica
        await announcementsRef.child(court).set({
            type: announcementType,
            reason: reason || null,
            timestamp: Date.now(),
            displayMessage: courtAnnouncementText,
            displayClass: courtAnnouncementClass
        });

        // NOVO: Chamar a função para carregar e exibir os anúncios atualizados
        await loadCourtAnnouncements();

        showNotification("Anúncio publicado com sucesso!");
        hideAdminPanelModal();
        document.getElementById("announcement-form").reset();
        toggleReasonField(); // Reseta o campo de motivo
    } catch (error) {
        showNotification("Erro ao publicar anúncio. Tente novamente.");
        console.error("Erro ao publicar anúncio:", error);
    }
}


// NOVO: Listener para anúncios (para exibir no chat)
function listenForAnnouncements() {
    // Já está sendo tratado pelo listenForChatMessages, que verifica o 'type' da mensagem.
    // Esta função pode ser usada para futuras lógicas específicas de anúncios, se necessário.
}

// NOVO: Carregar e exibir o último anúncio para cada quadra
async function loadCourtAnnouncements() {
    const courts = ["ceret", "pelezao"];
    for (const court of courts) {
        try {
            const snapshot = await announcementsRef.child(court).once("value");
            const announcementData = snapshot.val();
            if (announcementData) {
                displayCourtAnnouncement(court, announcementData);
            } else {
                // Se não houver anúncio, limpa e esconde o elemento
                const announcementElement = document.getElementById(`announcement-${court}`);
                if (announcementElement) {
                    announcementElement.innerHTML = "";
                    announcementElement.classList.remove("visible", "class-on", "class-off");
                }
            }
        } catch (error) {
            console.error(`Erro ao carregar anúncio para ${court}:`, error);
        }
    }
}

// NOVO: Exibir o anúncio na quadra
function displayCourtAnnouncement(court, announcementData) {
    const announcementElement = document.getElementById(`announcement-${court}`);
    if (announcementElement) {
        announcementElement.innerHTML = announcementData.displayMessage;
        announcementElement.className = `court-announcement ${announcementData.displayClass} visible`;
        // Adiciona a classe de posição (left/right) que já está no HTML
        if (court === "ceret") {
            announcementElement.classList.add("left");
            announcementElement.classList.remove("right");
        } else if (court === "pelezao") {
            announcementElement.classList.add("right");
            announcementElement.classList.remove("left");
        }
    }
}

// Fechar modais ao clicar fora
window.onclick = function(event) {
    const loginModal = document.getElementById("login-modal");
    const registerModal = document.getElementById("register-modal");
    const rankingModal = document.getElementById("ranking-modal");
    const userSettingsModal = document.getElementById("user-settings-modal");
    const adminPanelModal = document.getElementById("admin-panel-modal"); // NOVO MODAL

    if (event.target === loginModal) {
        hideLoginModal();
    }
    if (event.target === registerModal) {
        hideRegisterModal();
    }
    if (event.target === rankingModal) {
        hideRankingModal();
    }
    if (event.target === userSettingsModal) {
        hideUserSettingsModal();
    }
    if (event.target === adminPanelModal) { // FECHAR NOVO MODAL
        hideAdminPanelModal();
    }
}

// NOVO: Funções para o Modal de Esqueci a Senha
function showForgotPasswordModal() {
    hideLoginModal(); // Esconde o modal de login se estiver aberto
    document.getElementById("forgot-password-modal").style.display = "flex";
}

function hideForgotPasswordModal() {
    document.getElementById("forgot-password-modal").style.display = "none";
    document.getElementById("forgot-password-form").reset(); // Limpa o formulário
}

// NOVO: Lidar com a redefinição de senha
async function handleForgotPassword(event) {
    event.preventDefault();

    const email = document.getElementById("forgot-password-email").value.trim();

    if (!email) {
        showNotification("Por favor, digite seu email.");
        return;
    }

    try {
        await auth.sendPasswordResetEmail(email, {
            url: window.location.origin // Opcional: URL para onde o usuário será redirecionado após redefinir a senha
        });
        showNotification("Um link de redefinição de senha foi enviado para o seu email. Por favor, verifique sua caixa de entrada (e spam).");
        hideForgotPasswordModal();
    } catch (error) {
        let errorMessage = "Erro ao enviar o link de redefinição de senha. Por favor, tente novamente.";
        if (error.code === "auth/user-not-found") {
            errorMessage = "Não há usuário registrado com este email.";
        } else if (error.code === "auth/invalid-email") {
            errorMessage = "O formato do email é inválido.";
        }
        showNotification(errorMessage);
        console.error("Erro ao redefinir senha:", error);
    }
}

// Fechar modais ao clicar fora
window.onclick = function(event) {
    const loginModal = document.getElementById("login-modal");
    const registerModal = document.getElementById("register-modal");
    const rankingModal = document.getElementById("ranking-modal");
    const userSettingsModal = document.getElementById("user-settings-modal");
    const adminPanelModal = document.getElementById("admin-panel-modal");
    const forgotPasswordModal = document.getElementById("forgot-password-modal"); // NOVO MODAL

    if (event.target === loginModal) {
        hideLoginModal();
    }
    if (event.target === registerModal) {
        hideRegisterModal();
    }
    if (event.target === rankingModal) {
        hideRankingModal();
    }
    if (event.target === userSettingsModal) {
        hideUserSettingsModal();
    }
    if (event.target === adminPanelModal) {
        hideAdminPanelModal();
    }
    if (event.target === forgotPasswordModal) { // FECHAR NOVO MODAL
        hideForgotPasswordModal();
    }
}

// Sistema de Eventos
const eventsRef = database.ref("events");

// Carregar eventos do Firebase
async function loadEvents() {
    return new Promise((resolve) => {
        eventsRef.orderByChild("date").on("value", (snapshot) => {
            const events = [];
            snapshot.forEach((childSnapshot) => {
                const event = {
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                };
                events.push(event);
            });
            displayEvents(events);
            displayAdminEvents(events);
            resolve(events);
        });
    });
}

// Exibir eventos na seção principal
function displayEvents(events) {
    const eventsContainer = document.getElementById("events-container");
    
    if (!events || events.length === 0) {
        eventsContainer.innerHTML = `
            <div class="no-events-message">
                <p>Nenhum evento programado no momento.</p>
                <p>Fique atento às novidades!</p>
            </div>
        `;
        return;
    }

    // Filtrar eventos futuros e ordenar por data
    const now = new Date();
    const futureEvents = events.filter(event => {
        const eventDateTime = new Date(`${event.date}T${event.time}`);
        return eventDateTime >= now;
    }).sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`);
        const dateB = new Date(`${b.date}T${b.time}`);
        return dateA - dateB;
    });

    if (futureEvents.length === 0) {
        eventsContainer.innerHTML = `
            <div class="no-events-message">
                <p>Nenhum evento futuro programado.</p>
                <p>Fique atento às novidades!</p>
            </div>
        `;
        return;
    }

    let eventsHtml = "";
    futureEvents.forEach(event => {
        const eventDate = new Date(event.date);
        const formattedDate = eventDate.toLocaleDateString("pt-BR", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        });
        
        const formattedTime = event.time;

        eventsHtml += `
            <div class="event-card ${event.type}">
                <div class="event-header">
                    <h3 class="event-title">${event.title}</h3>
                    <span class="event-type-badge ${event.type}">${getEventTypeIcon(event.type)} ${getEventTypeName(event.type)}</span>
                </div>
                <div class="event-datetime">
                    <div class="event-date">
                        📅 ${formattedDate}
                    </div>
                    <div class="event-time">
                        🕐 ${formattedTime}
                    </div>
                </div>
                <div class="event-description">
                    ${event.description}
                </div>
                ${event.location ? `
                    <div class="event-location">
                        📍 ${event.location}
                    </div>
                ` : ""}
                ${isAdmin() ? `
                    <div class="event-actions">
                        <button class="event-edit-btn" onclick="editEvent('${event.id}')">Editar</button>
                        <button class="event-delete-btn" onclick="deleteEvent('${event.id}')">Excluir</button>
                    </div>
                ` : ""}
            </div>
        `;
    });

    eventsContainer.innerHTML = eventsHtml;
}

// Exibir eventos no painel de administração
function displayAdminEvents(events) {
    const adminEventsList = document.getElementById("admin-events-list");
    
    if (!isAdmin()) {
        return;
    }

    if (!events || events.length === 0) {
        adminEventsList.innerHTML = `
            <div style="text-align: center; color: #666; padding: 20px;">
                Nenhum evento criado ainda.
            </div>
        `;
        return;
    }

    // Ordenar eventos por data (mais recentes primeiro)
    const sortedEvents = events.sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`);
        const dateB = new Date(`${b.date}T${b.time}`);
        return dateB - dateA;
    });

    let adminEventsHtml = "";
    sortedEvents.forEach(event => {
        const eventDate = new Date(event.date);
        const formattedDate = eventDate.toLocaleDateString("pt-BR");
        const isPastEvent = new Date(`${event.date}T${event.time}`) < new Date();
        
        adminEventsHtml += `
            <div class="admin-event-item ${isPastEvent ? 'past-event' : ''}">
                <div class="admin-event-info">
                    <div class="admin-event-title">${event.title}</div>
                    <div class="admin-event-details">
                        ${getEventTypeName(event.type)} • ${formattedDate} às ${event.time}
                        ${event.location ? ` • ${event.location}` : ""}
                        ${isPastEvent ? " • <strong>Evento passado</strong>" : ""}
                    </div>
                </div>
                <div class="admin-event-actions">
                    <button class="admin-edit-btn" onclick="editEvent('${event.id}')">Editar</button>
                    <button class="admin-delete-btn" onclick="deleteEvent('${event.id}')">Excluir</button>
                </div>
            </div>
        `;
    });

    adminEventsList.innerHTML = adminEventsHtml;
}

// Obter ícone do tipo de evento
function getEventTypeIcon(type) {
    const icons = {
        campeonato: "🏆",
        novidade: "📢",
        passeio: "🚌",
        aula: "📚",
        manutencao: "🔧",
        outro: "📅"
    };
    return icons[type] || "📅";
}

// Obter nome do tipo de evento
function getEventTypeName(type) {
    const names = {
        campeonato: "Campeonato",
        novidade: "Novidade",
        passeio: "Passeio",
        aula: "Aula Especial",
        manutencao: "Manutenção",
        outro: "Outro"
    };
    return names[type] || "Evento";
}

// Processar submissão de evento
async function handleEventSubmission(event) {
    event.preventDefault();
    
    if (!isAdmin()) {
        showNotification("Apenas administradores podem criar eventos!");
        return;
    }

    const title = document.getElementById("event-title").value.trim();
    const type = document.getElementById("event-type").value;
    const date = document.getElementById("event-date").value;
    const time = document.getElementById("event-time").value;
    const description = document.getElementById("event-description").value.trim();
    const location = document.getElementById("event-location").value.trim();

    if (!title || !type || !date || !time || !description) {
        showNotification("Por favor, preencha todos os campos obrigatórios!");
        return;
    }

    // Verificar se a data não é no passado
    const eventDateTime = new Date(`${date}T${time}`);
    const now = new Date();
    if (eventDateTime < now) {
        showNotification("Não é possível criar eventos no passado!");
        return;
    }

    try {
        const currentUser = getCurrentUser();
        const newEvent = {
            title: title,
            type: type,
            date: date,
            time: time,
            description: description,
            location: location || "",
            createdBy: currentUser.uid,
            createdAt: new Date().toISOString()
        };

        await eventsRef.push(newEvent);
        
        showNotification("Evento criado com sucesso!");
        document.getElementById("event-form").reset();
        
    } catch (error) {
        showNotification("Erro ao criar evento. Tente novamente.");
        console.error("Erro ao criar evento:", error);
    }
}

// Editar evento
async function editEvent(eventId) {
    if (!isAdmin()) {
        showNotification("Apenas administradores podem editar eventos!");
        return;
    }

    try {
        const snapshot = await eventsRef.child(eventId).once("value");
        const event = snapshot.val();
        
        if (!event) {
            showNotification("Evento não encontrado!");
            return;
        }

        // Preencher formulário com dados do evento
        document.getElementById("event-title").value = event.title;
        document.getElementById("event-type").value = event.type;
        document.getElementById("event-date").value = event.date;
        document.getElementById("event-time").value = event.time;
        document.getElementById("event-description").value = event.description;
        document.getElementById("event-location").value = event.location || "";

        // Alterar o comportamento do formulário para edição
        const form = document.getElementById("event-form");
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.textContent = "Atualizar Evento";
        
        // Remover listener anterior e adicionar novo para edição
        form.onsubmit = async (e) => {
            e.preventDefault();
            await updateEvent(eventId);
        };

        showNotification("Dados carregados para edição!");
        
    } catch (error) {
        showNotification("Erro ao carregar evento para edição.");
        console.error("Erro ao carregar evento:", error);
    }
}

// Atualizar evento
async function updateEvent(eventId) {
    if (!isAdmin()) {
        showNotification("Apenas administradores podem atualizar eventos!");
        return;
    }

    const title = document.getElementById("event-title").value.trim();
    const type = document.getElementById("event-type").value;
    const date = document.getElementById("event-date").value;
    const time = document.getElementById("event-time").value;
    const description = document.getElementById("event-description").value.trim();
    const location = document.getElementById("event-location").value.trim();

    if (!title || !type || !date || !time || !description) {
        showNotification("Por favor, preencha todos os campos obrigatórios!");
        return;
    }

    try {
        const currentUser = getCurrentUser();
        const updatedEvent = {
            title: title,
            type: type,
            date: date,
            time: time,
            description: description,
            location: location || "",
            updatedBy: currentUser.uid,
            updatedAt: new Date().toISOString()
        };

        await eventsRef.child(eventId).update(updatedEvent);
        
        showNotification("Evento atualizado com sucesso!");
        
        // Resetar formulário para modo de criação
        resetEventForm();
        
    } catch (error) {
        showNotification("Erro ao atualizar evento. Tente novamente.");
        console.error("Erro ao atualizar evento:", error);
    }
}

// Resetar formulário de eventos
function resetEventForm() {
    const form = document.getElementById("event-form");
    const submitButton = form.querySelector('button[type="submit"]');
    
    form.reset();
    submitButton.textContent = "Criar Evento";
    
    // Restaurar comportamento original do formulário
    form.onsubmit = handleEventSubmission;
}

// Excluir evento
async function deleteEvent(eventId) {
    if (!isAdmin()) {
        showNotification("Apenas administradores podem excluir eventos!");
        return;
    }

    if (!confirm("Tem certeza que deseja excluir este evento? Esta ação não pode ser desfeita.")) {
        return;
    }

    try {
        await eventsRef.child(eventId).remove();
        showNotification("Evento excluído com sucesso!");
        
    } catch (error) {
        showNotification("Erro ao excluir evento. Tente novamente.");
        console.error("Erro ao excluir evento:", error);
    }
}

// Atualizar inicialização para carregar eventos
document.addEventListener("DOMContentLoaded", async function() {
    await loadCourtStatus(); // Carregar status das quadras do Firebase
    initializeAuth(); // Inicializa o listener de autenticação
    await initializeRanking();
    listenForChatMessages(); // Inicia o listener de mensagens do chat
    setupChatEventListeners(); // Configura os event listeners do chat
    await loadCourtAnnouncements(); // Carrega os anúncios das quadras ao iniciar
    await loadEvents(); // NOVO: Carregar eventos ao iniciar
});

