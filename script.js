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
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth(); // Inicializa o Firebase Auth

const announcementsRef = database.ref("announcements"); // NOVO: Referência para anúncios
const chatRef = database.ref("messages");


// NOVO: Lista de emails de administradores
const adminEmails = [
    "henrique082003@gmail.com",
    "admin@pickleball.com"
];

// Função para verificar se o usuário atual é um administrador
function isAdmin() {
    const currentUser = firebase.auth().currentUser;
    return currentUser && adminEmails.includes(currentUser.email);
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

    startWatchingPosition(court, user);
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

    stopWatchingPosition(user.uid);
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

    const chatWidget = document.getElementById("chat-widget");
    if (chatWidget) {
        setupChatEventListeners(); // <--- ESTA LINHA É CRÍTICA
        listenForChatMessages();
        // ... outras inicializações relacionadas ao chat, se houver
    } else {
        console.warn("Elemento #chat-widget não encontrado. O Cerezão não será inicializado.");
    }
    
    // NOVO: Verifique se os elementos do chat existem antes de inicializar

    await loadCourtAnnouncements(); // Carrega os anúncios das quadras ao iniciar
    await loadEvents(); // Carregar eventos ao iniciar
});

// Sistema de autenticação
let currentUser = null; // Armazena os dados do perfil do utilizador logado

// Inicializar autenticação com listener do Firebase Auth
function initializeAuth() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const userProfile = await getUserProfile(user.uid);

             currentUser = {
            uid: user.uid,
            username: userProfile?.username || user.email || "Usuário Desconhecido",
            lastName: userProfile?.lastName || "",
            email: user.email,
            phone: userProfile?.phone || "",
            totalTime: userProfile?.totalTime || 0,
            joinDate: userProfile?.joinDate || new Date().toISOString(),
            configId: userProfile?.configId || null,
            // ESTA É A LINHA CORRETA DENTRO DO OBJETO currentUser
            playsAt: userProfile?.playsAt || "" 
        };
            updateUserDisplay();



        } else {
            currentUser = null;
            updateUserDisplay();
            showNotification("Você está deslogado.");
            // NOVO: Desvincular listener de notificações quando o usuário faz logout

        }
        updateRankingDisplay();
        Object.keys(courtStatus).forEach(court => updateCourtDisplay(court));
        updateAdminButtonVisibility();
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
    
    if (userProfile && userProfile.username) {
        currentUser = { 
            ...userProfile, 
            uid: user.uid,
            // ESTA É A LINHA CORRETA DENTRO DO OBJETO currentUser
            playsAt: userProfile.playsAt || "" 
        };

        updateUserDisplay();
        showNotification(`Bem-vindo de volta, ${currentUser.username} ${currentUser.lastName || ""}!`);
        // REMOVA A LINHA playsAt: userProfile.playsAt || "" QUE ESTAVA SOLTA AQUI
    } else {
        // Fallback: Se o perfil ou o username estiver faltando, usa o email como username
        currentUser = { 
            uid: user.uid, 
            username: user.email || "Usuário Desconhecido", 
            lastName: "", 
            totalTime: userProfile?.totalTime || 0,
            // ESTA É A LINHA CORRETA DENTRO DO OBJETO currentUser
            playsAt: userProfile?.playsAt || "" 
        };
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
    const lastName = document.getElementById("register-lastname").value.trim();
    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value;
    const confirmPassword = document.getElementById("register-confirm-password").value;
    const phone = document.getElementById("register-phone").value.trim();
    const gender = document.getElementById("register-gender").value;
    const playsAt = document.getElementById("register-plays-at").value.trim();

    // Validações
    if (!username || !lastName || !email || !password || !confirmPassword || !phone || !gender || !playsAt) {
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

        // NOVO: Gerar um ID aleatório para as configurações do usuário
        const userConfigId = generateRandomId(12); // Gera um ID de 12 caracteres

        // 2. Salvar dados adicionais do perfil no Realtime Database
       const newUserProfile = {
            username: username,
            lastName: lastName,
            email: email,
            phone: phone,
            gender: gender,
            totalTime: 0,
            joinDate: new Date().toISOString(),
            configId: userConfigId,
            playsAt: playsAt,
        };
        await database.ref("users/" + uid).set(newUserProfile);

        // 3. Salvar email na lista de emails registrados (se ainda for necessário para algum log)
        await saveRegisteredEmail(email, username);

        // Atualizar currentUser e a exibição imediatamente após o cadastro
        currentUser = { uid: uid, ...newUserProfile };
        updateUserDisplay();

        showNotification(`Conta criada com sucesso! Bem-vindo, ${username} ${lastName}! Seu ID de Configuração é: ${userConfigId}`);

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
    document.getElementById("settings-full-name").textContent = `${currentUser.username} ${currentUser.lastName || ""}`;
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

    document.getElementById("settings-plays-at").textContent = currentUser.playsAt || "Não informado";

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
        chatHeaderText.textContent = "💬 Cerezão"; // Texto quando expandido
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
    const chatMessagesDiv = document.getElementById("chat-messages"); // <-- chatMessagesDiv É DEFINIDO AQUI
    const chatNotificationBadge = document.getElementById("chat-notification-badge");

    if (!chatMessagesDiv) {
        console.error("Elemento #chat-messages não encontrado. O Cerezão não pode ser inicializado.");
        return;
    }

    // AGORA, ESTE BLOCO ESTÁ DENTRO DA FUNÇÃO listenForChatMessages
    chatRef.on("child_added", async (snapshot) => {
        const message = snapshot.val();
        const messageId = snapshot.key;
        const currentUser = getCurrentUser();

        // ... (restante do código para exibir mensagens do chat global) ...
        // A partir daqui, o código só será executado para mensagens que NÃO são "dm"
        // (ou seja, mensagens do chat global ou anúncios).

        const messageElement = document.createElement("div");
        messageElement.classList.add("chat-message");
        messageElement.setAttribute("data-message-id", messageId);

        if (currentUser && message.senderUid === currentUser.uid) {
            messageElement.classList.add("own-message");
        }
        // Remova as classes 'direct-message' e 'received-dm' daqui, pois DMs não serão exibidas aqui
        // if (isDirectMessage) {
        //     messageElement.classList.add("direct-message");
        //     if (currentUser && message.recipientUid === currentUser.uid && message.senderUid !== currentUser.uid) {
        //         messageElement.classList.add("received-dm");
        //     }
        // }

         const senderSpan = document.createElement("span");
        senderSpan.classList.add("sender");
        
        const messageTime = new Date(message.timestamp);
        const formattedTime = messageTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

        // A lógica de busca de nome completo para o chat global
        let finalSenderName = message.senderName;
        if (message.senderUid && message.senderName.includes('@')) {
            const senderProfile = await getUserProfile(message.senderUid);
            if (senderProfile) {
                finalSenderName = `${senderProfile.username || ''} ${senderProfile.lastName || ''}`.trim() || message.senderName;
            }
        }
        
        senderSpan.textContent = `${finalSenderName} (${formattedTime}): `; // Sempre exibe o remetente

        const contentSpan = document.createElement("span");
        contentSpan.classList.add("content");
        contentSpan.textContent = message.text;

        messageElement.appendChild(contentSpan); // Primeiro a mensagem
        messageElement.appendChild(senderSpan); // Depois o nome

        if ((currentUser && message.senderUid === currentUser.uid) || isAdmin()) {
            const deleteButton = document.createElement("button");
            deleteButton.classList.add("delete-message-btn");
            deleteButton.textContent = "X";
            deleteButton.title = "Apagar mensagem";
            deleteButton.onclick = () => deleteChatMessage(messageId);
            messageElement.appendChild(deleteButton);
        }
        
        chatMessagesDiv.appendChild(messageElement); // ESTA LINHA AGORA TERÁ ACESSO A chatMessagesDiv

        chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
    });

    console.log("Novo listener de chat vinculado.");

    // AGORA, ESTE BLOCO TAMBÉM ESTÁ DENTRO DA FUNÇÃO listenForChatMessages
    chatRef.on("child_removed", (snapshot) => {
        const messageId = snapshot.key;
        const messageElement = document.querySelector(`.chat-message[data-message-id="${messageId}"]`);
        if (messageElement) {
            messageElement.remove();
        }
    });
} // <--- A FUNÇÃO listenForChatMessages TERMINA AQUI, AGORA COM OS LISTENERS DENTRO!

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
                    // Remova todas as classes de estado e posicionamento
                    announcementElement.classList.remove("visible", "class-on", "class-off", "left", "right");
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
        // Remova todas as classes de estado e posicionamento antes de adicionar as novas
        announcementElement.classList.remove("class-on", "class-off", "left", "right");
        announcementElement.className = `court-announcement ${announcementData.displayClass} visible`;
        // Adiciona a classe de posição (left/right) que já está no HTML
        if (court === "ceret") {
            announcementElement.classList.add("left");
        } else if (court === "pelezao") {
            announcementElement.classList.add("right");
        }
    }
}

// Função para exibir o modal de detalhes do jogador (VERSÃO CORRETA E COMPLETA)
async function showPlayerDetailsModal(playerUid) {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        showNotification("Por favor, faça login para ver detalhes de outros jogadores!");
        showLoginModal();
        return;
    }

    if (currentUser.uid === playerUid) {
        showNotification("Você clicou no seu próprio perfil. Abrindo suas configurações...");
        hidePlayerDetailsModal();
        showUserSettingsModal();
        return;
    }

    try {
        const playerProfile = await getUserProfile(playerUid);
         console.log("Perfil do jogador encontrado:", playerProfile);

        if (playerProfile) {
            // =======================================================
            // ===== ESTE É O BLOCO DE CÓDIGO QUE ESTAVA FALTANDO =====
            // =======================================================
            document.getElementById("player-detail-name").textContent = `${playerProfile.username} ${playerProfile.lastName || ""}`;
            document.getElementById("player-detail-email").textContent = playerProfile.email || "N/A";
            document.getElementById("player-detail-phone").textContent = playerProfile.phone || "N/A";
            document.getElementById("player-detail-total-time").textContent = formatTime(playerProfile.totalTime || 0);
            const joinDate = playerProfile.joinDate ? new Date(playerProfile.joinDate).toLocaleDateString("pt-BR") : "N/A";
            document.getElementById("player-detail-join-date").textContent = joinDate;
            document.getElementById("player-detail-config-id").textContent = playerProfile.configId || "N/A";
            // =======================================================
            // =======================================================

            // Esta parte, que adiciona o botão, já estava correta
            updateAddFriendButton(playerUid);

            // Mostra o modal
            document.getElementById("player-details-modal").style.display = "flex";
        } else {
            showNotification("Detalhes do jogador não encontrados.");
        }
    } catch (error) {
        console.error("Erro ao carregar detalhes do jogador:", error);
        showNotification("Erro ao carregar detalhes do jogador. Tente novamente.");
    }
}

// NOVO: Função para esconder o modal de detalhes do jogador
function hidePlayerDetailsModal() {
    document.getElementById("player-details-modal").style.display = "none";
}

// Adicione esta linha ao seu window.onclick para fechar o modal ao clicar fora
window.onclick = function(event) {
    const playerSearchResultsModal = document.getElementById("player-search-results-modal");

    if (event.target === playerSearchResultsModal) {
        hidePlayerSearchResultsModal();
    }
}

// Fechar modais ao clicar fora
window.onclick = function(event) {
    const loginModal = document.getElementById("login-modal");
    const registerModal = document.getElementById("register-modal");
    const rankingModal = document.getElementById("ranking-modal");
    const userSettingsModal = document.getElementById("user-settings-modal");
    const adminPanelModal = document.getElementById("admin-panel-modal");
    const forgotPasswordModal = document.getElementById("forgot-password-modal");
    const privateChatModal = document.getElementById("private-chat-modal"); // NOVO: Adicione este

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
    if (event.target === forgotPasswordModal) {
        hideForgotPasswordModal();
    }
    if (event.target === privateChatModal) { // NOVO: Lógica para fechar o modal de chat privado
        closePrivateChatModal();
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





// ===== FUNCIONALIDADES DE EVENTOS E PASSEIOS =====

// Carregar eventos do Firebase
function loadEvents() {
    firebase.database().ref('events').on('value', (snapshot) => {
        const events = snapshot.val();
        displayEvents(events);
    });
}

// Exibir eventos na página principal
function displayEvents(events) {
    const container = document.getElementById('events-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!events) {
        container.innerHTML = `
            <div class="no-events-message">
                <p>Nenhum evento programado no momento.</p>
                <p>Fique atento às novidades!</p>
            </div>
        `;
        return;
    }
    
    // Converter para array e ordenar por data
    const eventsArray = Object.values(events).sort((a, b) => {
        const dateA = new Date(a.date + 'T' + a.time);
        const dateB = new Date(b.date + 'T' + b.time);
        return dateA - dateB;
    });
    
    eventsArray.forEach(event => {
        const eventCard = createEventCard(event);
        container.appendChild(eventCard);
    });
}

// Criar card de evento
function createEventCard(event) {
    const card = document.createElement('div');
    card.className = 'event-card';

    const eventDate = new Date(event.date + 'T' + event.time);
    const formattedDate = eventDate.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    const formattedTime = eventDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const typeIcon = getEventTypeIcon(event.type);
    const typeLabel = getEventTypeLabel(event.type);

    let endDateHtml = '';
    if (event.endDate) {
        const eventEndDate = new Date(event.endDate);
        const formattedEndDate = eventEndDate.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        // Adiciona a classe 'event-datetime' para o ícone de calendário
        endDateHtml = `<p class="event-datetime">Fim: ${formattedEndDate}</p>`;
    }

    let endTimeHtml = '';
    if (event.endTime) {
        // Adiciona a classe 'event-time-detail' para o ícone de relógio
        endTimeHtml = `<p class="event-time-detail">Término: ${event.endTime}</p>`;
    }

    let registrationDatesHtml = '';
    if (event.registrationStartDate && event.registrationEndDate) {
        const regStartDate = new Date(event.registrationStartDate);
        const regEndDate = new Date(event.registrationEndDate);
        // Adiciona a classe 'event-info-detail' para o ícone de caneta/papel
        registrationDatesHtml = `
            <p class="event-info-detail">Inscrições: ${regStartDate.toLocaleDateString("pt-BR")} a ${regEndDate.toLocaleDateString("pt-BR")}</p>
        `;
    } else if (event.registrationStartDate) {
        const regStartDate = new Date(event.registrationStartDate);
        registrationDatesHtml = `<p class="event-info-detail">Início Inscrições: ${regStartDate.toLocaleDateString("pt-BR")}</p>`;
    } else if (event.registrationEndDate) {
        const regEndDate = new Date(event.registrationEndDate);
        registrationDatesHtml = `<p class="event-info-detail">Fim Inscrições: ${regEndDate.toLocaleDateString("pt-BR")}</p>`;
    }

    let priceHtml = '';
    if (event.price && event.price > 0) {
        // Adiciona a classe 'event-price' para o ícone de dinheiro
        priceHtml = `<p class="event-price">Preço: R$ ${parseFloat(event.price).toFixed(2)}</p>`;
    }

    let categoriesHtml = "";
    if (event.type === 'campeonato' && event.categories && event.categories.length > 0) {
        // Adiciona a classe 'event-categories' para o ícone de tag
        categoriesHtml = `<p class="event-categories">Categorias: ${event.categories.join(', ')}</p>`;
    }

    card.innerHTML = `
        <div class="event-header">
            <span class="event-type-icon">${typeIcon}</span>
            <h3>${event.title}</h3>
            <span class="event-type-badge ${event.type}">${typeLabel}</span> <!-- Movi o badge para o header -->
        </div>
        <div class="event-info">
            <p class="event-datetime">Início: ${formattedDate} às ${formattedTime}</p> <!-- Adiciona classe aqui também -->
            ${endDateHtml}
            ${endTimeHtml}
            ${registrationDatesHtml}
            ${categoriesHtml}
            <p class="event-location">Local: ${event.location || 'A definir'}</p> <!-- Adiciona classe aqui também -->
            ${priceHtml}
        </div>
        <div class="event-description">
            <p>${event.description}</p>
        </div>
        ${event.image ? `<div class="event-image-container"><img src="${event.image}" alt="${event.title}" class="event-image"></div>` : ''}
        ${event.type === 'passeio' ? createTripRegistrationButton(event) : ''}
        ${event.type === 'campeonato' ? createChampionshipRegistrationSection(event) : ''}
    `;

    return card;
}

    // Criar botão de inscrição para passeios
    function createTripRegistrationButton(trip) {
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) {
            return '<button class="event-register-btn" onclick="showLoginModal()">Faça login para se inscrever</button>';
        }
        
        const registrations = trip.registrations || {};
        const isRegistered = registrations[currentUser.uid];
        const registrationCount = Object.keys(registrations).length;
    const isFull = registrationCount >= trip.capacity;
    
    if (isRegistered) {
        return `
            <div class="registration-status">
                <p class="registered">✅ Você está inscrito!</p>
                <button class="event-unregister-btn" onclick="unregisterFromTrip('${trip.id}')">Cancelar Inscrição</button>
            </div>
        `;
    } else if (isFull) {
        return `
            <div class="registration-status">
                <p class="full">❌ Passeio lotado (${registrationCount}/${trip.capacity})</p>
            </div>
        `;
    } else {
        return `
            <div class="registration-status">
                <p class="available">Vagas: ${registrationCount}/${trip.capacity}</p>
                <button class="event-register-btn" onclick="registerForTrip('${trip.id}')">Inscrever-se</button>
            </div>
        `;
    }
}

// NOVO: Função para criar a seção de inscrição de campeonato
function createChampionshipRegistrationSection(event) {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
        return '<div class="registration-section"><button class="event-register-btn" onclick="showLoginModal()">Faça login para se inscrever</button></div>';
    }

    const lookingForPartner = event.lookingForPartner || {};
    const isLooking = lookingForPartner[currentUser.uid];
    const playersLookingCount = Object.keys(lookingForPartner).length;

    let playersLookingListHtml = '';
    if (playersLookingCount > 0) {
        playersLookingListHtml = `
    <div class="players-looking-list">
        <h4>Jogadores procurando dupla (${playersLookingCount}):</h4>
        <ul>
            ${Object.values(lookingForPartner).map(p => `
                <li>
                    <span class="player-name-clickable"
                          onclick="showPlayerDetailsModal('${p.uid}')">
                        ${p.displayName} ${p.category ? `(${p.category})` : ''}
                    </span>
                </li>
            `).join('')}
        </ul>
    </div>
`;
    } else {
        playersLookingListHtml = `<p class="no-players-looking">Nenhum jogador procurando dupla ainda.</p>`;
    }

    let categoryOptionsHtml = '';
    if (event.categories && event.categories.length > 0) {
        categoryOptionsHtml = event.categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    } else {
        categoryOptionsHtml = `<option value="">Nenhuma categoria disponível</option>`;
    }

    return `
        <div class="registration-section">
            ${isLooking ? `
                <p class="registered">✅ Você está procurando dupla!</p>
                <p>Na categoria: <strong>${lookingForPartner[currentUser.uid]?.category || 'Não especificada'}</strong></p>
                <button class="event-unregister-btn" onclick="toggleLookingForPartner('${event.id}', false)">Parar de procurar</button>
            ` : `
                <p class="available">Procurando dupla para este campeonato?</p>
                <div class="form-group">
                    <label for="championship-category-${event.id}">Escolha a Categoria:</label>
                    <select id="championship-category-${event.id}" class="form-control" ${event.categories && event.categories.length > 0 ? '' : 'disabled'}>
                        <option value="">Selecione uma categoria</option>
                        ${categoryOptionsHtml}
                    </select>
                </div>
                <button class="event-register-btn" onclick="toggleLookingForPartner('${event.id}', true, 'championship-category-${event.id}')">Procurar dupla</button>
            `}
            ${playersLookingListHtml}
        </div>
    `;
}

// NOVO: Função para alternar o status de "procurando dupla"
// Adicionado categorySelectId para pegar a categoria selecionada
async function toggleLookingForPartner(eventId, isLooking, categorySelectId = null) {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
        showLoginModal();
        return;
    }

    const eventRef = firebase.database().ref(`events/${eventId}/lookingForPartner/${currentUser.uid}`);

    try {
        if (isLooking) {
            let selectedCategory = '';
            if (categorySelectId) {
                const categorySelect = document.getElementById(categorySelectId);
                if (categorySelect) {
                    selectedCategory = categorySelect.value;
                    if (!selectedCategory) {
                        showNotification("Por favor, selecione uma categoria para procurar dupla.");
                        return; // Impede a inscrição se nenhuma categoria for selecionada
                    }
                }
            }

           const fullDisplayName = `${currentUser.username || ''} ${currentUser.lastName || ''}`.trim();

            displayName: fullDisplayName || currentUser.email,

            await eventRef.set({
                uid: currentUser.uid,
                displayName: fullDisplayName || currentUser.email,
                email: currentUser.email,
                category: selectedCategory, // NOVO: Salvar a categoria selecionada
                timestamp: new Date().toISOString()
            });
            showNotification(`Você está agora procurando dupla na categoria ${selectedCategory}!`);
        } else {
            await eventRef.remove();
            showNotification("Você não está mais procurando dupla.");
        }
        loadEvents(); // Recarrega os eventos para atualizar a exibição
    } catch (error) {
        console.error("Erro ao atualizar status de procura de dupla:", error);
        showNotification("Erro ao atualizar status. Tente novamente.");
    }
}

// Obter ícone do tipo de evento
function getEventTypeIcon(type) {
    const icons = {
        'campeonato': '🏆',
        'novidade': '📢',
        'passeio': '🚌',
        'aula': '📚',
        'manutencao': '🔧',
        'outro': '📅'
    };
    return icons[type] || '📅';
}

// Obter label do tipo de evento
function getEventTypeLabel(type) {
    const labels = {
        'campeonato': 'Campeonato',
        'novidade': 'Novidade',
        'passeio': 'Passeio',
        'aula': 'Aula Especial',
        'manutencao': 'Manutenção',
        'outro': 'Evento'
    };
    return labels[type] || 'Evento';
}

// Inscrever-se em passeio
function registerForTrip(tripId) {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
        showLoginModal();
        return;
    }
    
    // Verificar se o usuário já está inscrito
    firebase.database().ref(`trips/${tripId}/registrations/${currentUser.uid}`).once('value', (snapshot) => {
        if (snapshot.exists()) {
            alert('Você já está inscrito neste passeio!');
            return;
        }
        
        // Verificar capacidade
        firebase.database().ref(`trips/${tripId}`).once('value', (tripSnapshot) => {
            const trip = tripSnapshot.val();
            const registrations = trip.registrations || {};
            const registrationCount = Object.keys(registrations).length;
            
            if (registrationCount >= trip.capacity) {
                alert('Desculpe, este passeio já está lotado!');
                return;
            }
            
            // Registrar usuário
            const registrationData = {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName || 'Usuário',
                registeredAt: new Date().toISOString()
            };
            
            firebase.database().ref(`trips/${tripId}/registrations/${currentUser.uid}`).set(registrationData)
                .then(() => {
                    alert('Inscrição realizada com sucesso!');
                    loadEvents(); // Recarregar eventos para atualizar botões
                })
                .catch((error) => {
                    console.error('Erro ao se inscrever:', error);
                    alert('Erro ao realizar inscrição. Tente novamente.');
                });
        });
    });
}

// Cancelar inscrição em passeio
function unregisterFromTrip(tripId) {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) return;
    
    if (confirm('Tem certeza que deseja cancelar sua inscrição?')) {
        firebase.database().ref(`trips/${tripId}/registrations/${currentUser.uid}`).remove()
            .then(() => {
                alert('Inscrição cancelada com sucesso!');
                loadEvents(); // Recarregar eventos para atualizar botões
            })
            .catch((error) => {
                console.error('Erro ao cancelar inscrição:', error);
                alert('Erro ao cancelar inscrição. Tente novamente.');
            });
    }
}

// Carregar passeios do Firebase
function loadTrips() {
    firebase.database().ref('trips').on('value', (snapshot) => {
        const trips = snapshot.val();
        // Os passeios são exibidos junto com os eventos
        // Esta função pode ser usada para funcionalidades específicas de passeios
    });
}

// Mostrar botão de administração para administradores
function showAdminButton() {
    const adminBtn = document.getElementById('admin-panel-btn');
    if (adminBtn && isAdmin()) {
        adminBtn.style.display = 'inline-block';
    }
}

// Mostrar modal do painel de administração
function showAdminPanelModal() {
    if (!isAdmin()) {
        alert('Acesso negado. Você não tem permissões de administrador.');
        return;
    }
    
    // Redirecionar para a página de administração
    window.location.href = 'admin.html';
}

// Função para abrir o modal de mensagem direta
function openDirectMessageModal(recipientUid, recipientName) {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
        showNotification("Por favor, faça login para enviar mensagens!");
        showLoginModal();
        return;
    }
    if (currentUser.uid === recipientUid) {
        showNotification("Você não pode enviar uma mensagem para si mesmo.");
        return;
    }

    currentDmRecipientUid = recipientUid;
    currentDmRecipientName = recipientName;

    document.getElementById('dm-recipient-name').textContent = recipientName;
    document.getElementById('dm-recipient-uid').value = recipientUid;
    document.getElementById('dm-message-text').value = ''; // Limpa o campo de mensagem
    document.getElementById('direct-message-modal').style.display = 'flex';
}

// Função para esconder o modal de mensagem direta
function hideDirectMessageModal() {
    document.getElementById('direct-message-modal').style.display = 'none';
    currentDmRecipientUid = null;
    currentDmRecipientName = null;
}

// Função para enviar a mensagem direta
async function sendDirectMessage(event) {
    event.preventDefault();

    const messageText = document.getElementById('dm-message-text').value.trim();
    const recipientUid = document.getElementById('dm-recipient-uid').value;
    const recipientName = document.getElementById('dm-recipient-name').textContent; // Pega o nome do span

    const currentUser = getCurrentUser();

    if (!messageText || !recipientUid || !currentUser || !currentUser.uid) {
        showNotification("Erro: Mensagem, destinatário ou remetente inválidos.");
        return;
    }

    // Estrutura da mensagem direta no Firebase
    // Vamos usar um nó 'directMessages' para mensagens privadas
    // Ex: directMessages/{senderUid}_{recipientUid}/{messageId}
    // Ou, para simplificar e usar o chat existente, podemos adicionar um 'type: "dm"'
    // e um 'recipientUid' à mensagem do chat.

    // Opção 1 (Mais simples, usa o chat existente com um flag):
    // Esta opção fará a mensagem aparecer no chat global, mas com um indicador de que é DM.
    // O destinatário precisaria de uma interface para filtrar DMs.
    const message = {
        senderUid: currentUser.uid,
        senderName: `${currentUser.username} ${currentUser.lastName || ""}`,
        text: messageText,
        timestamp: Date.now(),
        type: "dm", // Indica que é uma mensagem direta
        recipientUid: recipientUid,
        recipientName: recipientName
    };

    try {
        await chatRef.push(message);
        showNotification(`Mensagem enviada para ${recipientName}!`);
        hideDirectMessageModal();
    } catch (error) {
        console.error("Erro ao enviar mensagem direta:", error);
        showNotification("Erro ao enviar mensagem. Tente novamente.");
    }
}

// NOVO: Adicionar a função hideDirectMessageModal ao window.onclick para fechar o modal
window.onclick = function(event) {
    // ... (seus outros modais) ...
    const directMessageModal = document.getElementById("direct-message-modal");

    if (event.target === directMessageModal) {
        hideDirectMessageModal();
    }
    // ... (restante do seu window.onclick) ...
}


// NOVO: Função para obter o chat ID entre dois usuários
function getPrivateChatId(uid1, uid2) {
    // Garante que o ID seja sempre o mesmo, independentemente da ordem dos UIDs
    return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

// NOVO: Função para abrir o modal de chat privado
async function openPrivateChatModal(recipientUid, recipientName) {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.uid) {
        showNotification("Por favor, faça login para iniciar um chat privado!");
        showLoginModal();
        return;
    }
    if (currentUser.uid === recipientUid) {
        showNotification("Você não pode iniciar um chat privado consigo mesmo.");
        return;
    }

    currentPrivateChatRecipientUid = recipientUid;
    document.getElementById('private-chat-recipient-name').textContent = recipientName;
    document.getElementById('private-chat-message-input').value = ''; // Limpa o campo de mensagem

    // Esconder o chat global se estiver aberto
    document.getElementById('chat-widget').classList.add('collapsed');

    document.getElementById('private-chat-modal').style.display = 'flex';

    // Iniciar o listener de mensagens privadas
    await setupPrivateChatListener(currentUser.uid, recipientUid);
}

// NOVO: Função para fechar o modal de chat privado
function closePrivateChatModal() {
    document.getElementById('private-chat-modal').style.display = 'none';
    currentPrivateChatRecipientUid = null;
    // Desvincular o listener do chat privado quando o modal é fechado
    if (currentPrivateChatListener) {
        currentPrivateChatListener(); // Chama a função de desvinculação
        currentPrivateChatListener = null;
    }
    // Limpa as mensagens exibidas no modal
    document.getElementById('private-chat-messages').innerHTML = '<div class="no-private-messages"><p>Inicie uma conversa!</p></div>';
}


// NOVO: Função para atualizar o badge de notificação
function updateChatNotificationBadge() {
    const chatNotificationBadge = document.getElementById("chat-notification-badge");
    if (unreadDirectMessagesCount > 0) {
        chatNotificationBadge.textContent = unreadDirectMessagesCount;
        chatNotificationBadge.style.display = 'flex'; // Exibir o badge
    } else {
        chatNotificationBadge.style.display = 'none'; // Esconder o badge
    }
}

// NOVO: Modificar toggleChat para resetar o contador de não lidas ao abrir o chat
function toggleChat() {
    const chatWidget = document.getElementById("chat-widget");
    const chatHeaderText = document.getElementById("chat-header-text");
    // const chatNotificationBadge = document.getElementById("chat-notification-badge"); // Já é acessado por updateChatNotificationBadge

    chatWidget.classList.toggle("collapsed");
    if (chatWidget.classList.contains("collapsed")) {
        chatHeaderText.textContent = "💬 Chat";
    } else {
        chatHeaderText.textContent = "💬 Cerezão";
        const chatMessages = document.getElementById("chat-messages");
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // NOVO: Resetar o contador de mensagens não lidas ao abrir o chat
        unreadDirectMessagesCount = 0;
        updateChatNotificationBadge();
    }
}

function generateRandomId(length = 10) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0987654321';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
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
    document.getElementById("settings-gender").textContent = currentUser.gender || "Não informado";
    document.getElementById("settings-total-time").textContent = formatTime(currentUser.totalTime || 0);

    // Formatar a data de entrada
    const joinDate = currentUser.joinDate ? new Date(currentUser.joinDate).toLocaleDateString("pt-BR") : "N/A";
    document.getElementById("settings-join-date").textContent = joinDate;

    // NOVO: Preencher o ID de Configuração
    document.getElementById("settings-config-id").textContent = currentUser.configId || "N/A";
    document.getElementById("settings-plays-at").textContent = currentUser.playsAt || "Não informado";


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

// NOVO: Função para buscar jogador por ID de configuração
async function searchPlayerById() {
    const searchIdInput = document.getElementById('player-search-id');
    const searchId = searchIdInput.value.trim();
    const searchResultsContentDiv = document.getElementById('player-search-results-content'); // NOVO ID

    searchResultsContentDiv.innerHTML = ''; // Limpa resultados anteriores

    if (!searchId) {
        searchResultsContentDiv.innerHTML = '<p class="no-results">Por favor, digite um ID de configuração para buscar.</p>';
        showPlayerSearchResultsModal(); // Mostra o modal mesmo com mensagem de erro
        return;
    }

    showNotification("Buscando jogador...");

    try {
        const usersRef = firebase.database().ref('users');
        const snapshot = await usersRef.orderByChild('configId').equalTo(searchId).once('value');
        const usersData = snapshot.val();

        if (usersData) {
            const foundUserUid = Object.keys(usersData)[0];
            const foundUserProfile = usersData[foundUserUid];

            displayPlayerSearchResult(foundUserUid, foundUserProfile);
            showNotification("Jogador encontrado!");
        } else {
            searchResultsContentDiv.innerHTML = '<p class="no-results">Nenhum jogador encontrado com este ID de configuração.</p>';
            showNotification("Nenhum jogador encontrado.");
        }
        showPlayerSearchResultsModal(); // Mostra o modal com os resultados ou a mensagem
    } catch (error) {
        console.error("Erro ao buscar jogador por ID:", error);
        searchResultsContentDiv.innerHTML = '<p class="no-results">Erro ao buscar jogador. Tente novamente.</p>';
        showNotification("Erro ao buscar jogador.");
        showPlayerSearchResultsModal(); // Mostra o modal com a mensagem de erro
    }
}

// NOVO: Função para exibir o resultado da pesquisa de jogador (MODIFICADA)
async function displayPlayerSearchResult(uid, profile) {
    const searchResultsContentDiv = document.getElementById('player-search-results-content');
    searchResultsContentDiv.innerHTML = ''; // Limpa resultados anteriores

    const resultCard = document.createElement('div');
    resultCard.className = 'player-search-card';

    // Cria a estrutura do card, incluindo um container para os botões
    resultCard.innerHTML = `
        <h3>${profile.username} ${profile.lastName || ""}</h3>
        <p><strong>ID de Configuração:</strong> ${profile.configId}</p>
        <div class="player-search-actions" id="search-result-actions-${uid}">
            <!-- Botões serão inseridos aqui -->
        </div>
    `;
    
    searchResultsContentDiv.appendChild(resultCard);

    // Agora, vamos preencher os botões dinamicamente
    const actionsContainer = document.getElementById(`search-result-actions-${uid}`);
    const currentUser = getCurrentUser();

    // 1. Adiciona o botão "Ver Detalhes"
    actionsContainer.innerHTML += `<button class="btn-view-details" onclick="showPlayerDetailsModal('${uid}'); hidePlayerSearchResultsModal();">Ver Detalhes</button>`;

    // 2. Adiciona o botão de amizade, se aplicável
    if (currentUser && currentUser.uid !== uid) {
        const friendshipRef = database.ref(`friendships/${currentUser.uid}/${uid}`);
        const snapshot = await friendshipRef.once('value');
        const friendship = snapshot.val();

        let friendButtonHtml = '';
        if (!friendship) {
            friendButtonHtml = `<button class="btn-add-friend" onclick="sendFriendRequest('${uid}')">Enviar Pedido</button>`;
        } else if (friendship.status === 'pending') {
            friendButtonHtml = `<button class="btn-add-friend pending" disabled>Pedido Pendente</button>`;
        } else if (friendship.status === 'friends') {
            friendButtonHtml = `<button class="btn-add-friend friends" disabled>Amigos</button>`;
        }
        actionsContainer.innerHTML += friendButtonHtml;
    }
}

// NOVO: Funções para o modal de resultados da busca
function showPlayerSearchResultsModal() {
    document.getElementById("player-search-results-modal").style.display = "flex";
}

function hidePlayerSearchResultsModal() {
    document.getElementById("player-search-results-modal").style.display = "none";
}


// =================================================================
// ===== INÍCIO DO CÓDIGO DE GEOLOCALIZAÇÃO ========================
// =================================================================

// Objeto para armazenar as coordenadas das quadras
const courtCoordinates = {
    ceret: { lat: -23.558889, lon: -46.554167 }, // Latitude e Longitude do CERET
    pelezao: { lat: -23.5275, lon: -46.719167 }  // Latitude e Longitude do Pelezão
};

// Objeto para armazenar o ID do monitoramento de posição de cada jogador
const positionWatchers = {};

/**
 * Converte graus para radianos.
 * @param {number} deg - O valor em graus.
 * @returns {number} O valor em radianos.
 */
function toRad(deg) {
    return deg * (Math.PI / 180);
}

/**
 * Calcula a distância entre duas coordenadas geográficas usando a fórmula de Haversine.
 * @param {number} lat1 - Latitude do ponto 1.
 * @param {number} lon1 - Longitude do ponto 1.
 * @param {number} lat2 - Latitude do ponto 2.
 * @param {number} lon2 - Longitude do ponto 2.
 * @returns {number} A distância em quilômetros.
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Raio da Terra em km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const radLat1 = toRad(lat1);
    const radLat2 = toRad(lat2);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(radLat1) * Math.cos(radLat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c; // Distância em km
}

/**
 * Inicia o monitoramento da posição do jogador para uma quadra específica.
 * @param {string} court - O nome da quadra ('ceret' ou 'pelezao').
 * @param {object} user - O objeto do usuário atual.
 */
function startWatchingPosition(court, user) {
    // Verifica se o navegador suporta geolocalização
    if (!navigator.geolocation) {
        console.warn("Geolocalização não é suportada por este navegador.");
        return;
    }

    // Para qualquer monitoramento anterior para evitar duplicatas
    if (positionWatchers[user.uid]) {
        stopWatchingPosition(user.uid);
    }

    const courtCoords = courtCoordinates[court];

    const watcherId = navigator.geolocation.watchPosition(
        (position) => {
            // Sucesso ao obter a posição
            const userLat = position.coords.latitude;
            const userLon = position.coords.longitude;

            const distance = haversineDistance(courtCoords.lat, courtCoords.lon, userLat, userLon);
            console.log(`Distância da quadra ${court.toUpperCase()}: ${distance.toFixed(2)} km`);

            // Se a distância for maior que 1 km, remove o jogador da quadra
            if (distance > 1) {
                showNotification(`Você se afastou mais de 1km da quadra ${court.toUpperCase()} e foi removido automaticamente.`);
                removeOccupant(court, user); // Reutiliza a função existente para remover o jogador
                stopWatchingPosition(user.uid); // Para o monitoramento
            }
        },
        (error) => {
            // Erro ao obter a posição
            console.error("Erro na geolocalização:", error.message);
            showNotification("Não foi possível obter sua localização. A remoção automática pode não funcionar.");
            // Para o monitoramento em caso de erro para não ficar tentando indefinidamente
            stopWatchingPosition(user.uid);
        },
        {
            // Opções para alta precisão
            enableHighAccuracy: true,
            timeout: 10000, // Tempo máximo para obter a posição (10 segundos)
            maximumAge: 0 // Não usar cache de posição
        }
    );

    // Armazena o ID do watcher para poder pará-lo depois
    positionWatchers[user.uid] = watcherId;
    console.log(`Iniciando monitoramento de posição para o usuário ${user.username} na quadra ${court}. Watcher ID: ${watcherId}`);
}

/**
 * Para o monitoramento da posição de um jogador.
 * @param {string} uid - O UID do usuário.
 */
function stopWatchingPosition(uid) {
    if (positionWatchers[uid]) {
        navigator.geolocation.clearWatch(positionWatchers[uid]);
        console.log(`Parando monitoramento de posição para o usuário ${uid}. Watcher ID: ${positionWatchers[uid]}`);
        delete positionWatchers[uid];
    }
}

// =================================================================
// ===== FIM DO CÓDIGO DE GEOLOCALIZAÇÃO ===========================
// =================================================================


// Função para navegação por abas no modal de configurações
function openUserSettingsTab(evt, tabName) {
    let i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tab-content");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }
    tablinks = document.getElementsByClassName("tab-link");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";

    // Carrega os dados da aba de amigos apenas quando ela for aberta
    if (tabName === 'Friends') {
        loadFriendsData();
    }
}

// Função principal para carregar dados de amigos e pedidos
async function loadFriendsData() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const friendshipsRef = database.ref(`friendships/${currentUser.uid}`);
    friendshipsRef.on('value', async (snapshot) => {
        const allFriendships = snapshot.val() || {};
        
        const friendRequests = [];
        const friendsList = [];

        for (const friendUid in allFriendships) {
            const friendship = allFriendships[friendUid];
            if (friendship.status === 'pending' && friendship.sentBy !== currentUser.uid) {
                const userProfile = await getUserProfile(friendUid);
                friendRequests.push({ uid: friendUid, ...userProfile });
            } else if (friendship.status === 'friends') {
                const userProfile = await getUserProfile(friendUid);
                friendsList.push({ uid: friendUid, ...userProfile });
            }
        }
        
        displayFriendRequests(friendRequests);
        displayFriendsList(friendsList);
    });
}

// Exibe a lista de pedidos de amizade
function displayFriendRequests(requests) {
    const container = document.getElementById('friend-requests-list');
    if (requests.length === 0) {
        container.innerHTML = '<p class="no-requests">Nenhum pedido de amizade pendente.</p>';
        return;
    }
    container.innerHTML = requests.map(user => `
        <div class="request-item">
            <span class="friend-info">${user.username} ${user.lastName || ''}</span>
            <div class="request-actions">
                <button class="btn-accept" onclick="handleFriendRequest('${user.uid}', true)">Aceitar</button>
                <button class="btn-decline" onclick="handleFriendRequest('${user.uid}', false)">Recusar</button>
            </div>
        </div>
    `).join('');
}

// Exibe a lista de amigos
function displayFriendsList(friends) {
    const container = document.getElementById('friends-list-container');
    if (friends.length === 0) {
        container.innerHTML = '<p class="no-friends">Você ainda não adicionou nenhum amigo.</p>';
        return;
    }
    container.innerHTML = friends.map(user => `
        <div class="friend-item">
            <span class="friend-info">${user.username} ${user.lastName || ''}</span>
            <div class="friend-actions">
                <button class="btn-remove-friend" onclick="removeFriend('${user.uid}')">Remover</button>
            </div>
        </div>
    `).join('');
}

// Envia um pedido de amizade
async function sendFriendRequest(recipientUid) {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.uid === recipientUid) return;

    const friendshipPath1 = `friendships/${currentUser.uid}/${recipientUid}`;
    const friendshipPath2 = `friendships/${recipientUid}/${currentUser.uid}`;

    const requestData = {
        status: 'pending',
        sentBy: currentUser.uid,
        timestamp: new Date().toISOString()
    };

    const updates = {};
    updates[friendshipPath1] = requestData;
    updates[friendshipPath2] = requestData;

    await database.ref().update(updates);
    showNotification('Pedido de amizade enviado!');
    updateAddFriendButton(recipientUid); // Atualiza o botão
}

// Aceita ou recusa um pedido de amizade
async function handleFriendRequest(senderUid, accept) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const friendshipPath1 = `friendships/${currentUser.uid}/${senderUid}`;
    const friendshipPath2 = `friendships/${senderUid}/${currentUser.uid}`;

    if (accept) {
        const acceptData = {
            status: 'friends',
            since: new Date().toISOString()
        };
        const updates = {};
        updates[friendshipPath1] = acceptData;
        updates[friendshipPath2] = acceptData;
        await database.ref().update(updates);
        showNotification('Amigo adicionado com sucesso!');
    } else {
        // Remove o pedido de ambos os usuários
        const updates = {};
        updates[friendshipPath1] = null;
        updates[friendshipPath2] = null;
        await database.ref().update(updates);
        showNotification('Pedido de amizade recusado.');
    }
}

// Remove um amigo
async function removeFriend(friendUid) {
    if (!confirm('Tem certeza que deseja remover este amigo?')) return;
    
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const friendshipPath1 = `friendships/${currentUser.uid}/${friendUid}`;
    const friendshipPath2 = `friendships/${friendUid}/${currentUser.uid}`;

    const updates = {};
    updates[friendshipPath1] = null;
    updates[friendshipPath2] = null;
    await database.ref().update(updates);
    showNotification('Amigo removido.');
}

// Atualiza o botão "Adicionar Amigo" com base no status da amizade
async function updateAddFriendButton(profileUid) {
    const currentUser = getCurrentUser();
    const actionsContainer = document.getElementById('player-profile-actions');
    actionsContainer.innerHTML = ''; // Limpa o botão anterior

    if (!currentUser || currentUser.uid === profileUid) {
        return; // Não mostra botão para si mesmo ou se não estiver logado
    }

    const friendshipRef = database.ref(`friendships/${currentUser.uid}/${profileUid}`);
    const snapshot = await friendshipRef.once('value');
    const friendship = snapshot.val();

    let buttonHtml = '';
    if (!friendship) {
        buttonHtml = `<button class="btn-add-friend" onclick="sendFriendRequest('${profileUid}')">Adicionar Amigo</button>`;
    } else if (friendship.status === 'pending') {
        buttonHtml = `<button class="btn-add-friend pending" disabled>Pedido Pendente</button>`;
    } else if (friendship.status === 'friends') {
        buttonHtml = `<button class="btn-add-friend friends" disabled>Amigos</button>`;
    }
    
    actionsContainer.innerHTML = buttonHtml;
}

// Modifique a função showPlayerDetailsModal para chamar a atualização do botão
async function showPlayerDetailsModal(playerUid) {
    // ... (código existente da função) ...
    try {
        const playerProfile = await getUserProfile(playerUid);
        if (playerProfile) {
            // ... (código existente para preencher detalhes) ...
            
            // ADICIONE ESTA LINHA NO FINAL DO BLOCO 'if (playerProfile)'
            updateAddFriendButton(playerUid);

            document.getElementById("player-details-modal").style.display = "flex";
        } else {
            showNotification("Detalhes do jogador não encontrados.");
        }
    } catch (error) {
        // ... (código de erro existente) ...
    }
}
