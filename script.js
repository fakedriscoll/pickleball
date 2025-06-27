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
firebase.initializeApp(firebaseConfig );
const database = firebase.database();
const auth = firebase.auth(); // Inicializa o Firebase Auth

// Carregar estado das quadras do Firebase
async function loadCourtStatus() {
    return new Promise((resolve) => {
        database.ref('courtStatus').on('value', (snapshot) => {
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
    await database.ref('courtStatus').set(courtStatus);
}

// Alternar status da quadra (Entrar/Sair)
async function toggleCourtStatus(court) {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.uid) {
        showNotification('Por favor, faça login para usar esta funcionalidade!');
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
        startTime: Date.now() // Registra o tempo de entrada
    };
    
    updateCourtDisplay(court);
    await saveCourtStatus(); // Salvar no Firebase
    
    // Não adicionamos tempo aqui, apenas quando o usuário sai
    
    showNotification(`${user.username} entrou na Quadra ${court.toUpperCase()}!`);
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
    
    showNotification(`${user.username} saiu da Quadra ${court.toUpperCase()}!`);
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
        statusElement.className = 'occupied';
        statusElement.innerHTML = `<span class="status-indicator occupied"></span>Ocupada por ${numOccupants} jogador(es)`;
    } else {
        statusElement.className = 'free';
        statusElement.innerHTML = '<span class="status-indicator free"></span>Livre';
    }

    // Atualizar texto e estilo do botão
    if (isCurrentUserInCourt) {
        buttonElement.textContent = 'Sair da Quadra';
        buttonElement.style.background = 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)';
    } else {
        buttonElement.textContent = 'Entrar na Quadra';
        buttonElement.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }

    // Gerar e exibir a lista de jogadores
    if (numOccupants > 0) {
        let playersHtml = '<h3>Jogadores na Quadra:</h3><ul>';
        for (const uid in currentOccupants) {
            const occupant = currentOccupants[uid];
            const playerName = occupant.username;
            const timeInCourt = Date.now() - occupant.startTime;
            playersHtml += `<li><span class="player-name">${playerName}</span> <span class="player-action">(${formatTime(timeInCourt)})</span></li>`;
        }
        playersHtml += '</ul>';
        playersListElement.innerHTML = playersHtml;
        playersListElement.style.display = 'block';
    } else {
        playersListElement.innerHTML = '<p style="text-align: center; color: #666; font-size: 0.9em;">Ninguém na quadra ainda.</p>';
        playersListElement.style.display = 'block'; // Sempre mostra a mensagem, mesmo que vazia
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

    const pad = (num) => num.toString().padStart(2, '0');

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
    const options = { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
    return date.toLocaleDateString('pt-BR', options);
}


// Mostrar notificação
function showNotification(message) {
    // Criar elemento de notificação
    const notification = document.createElement('div');
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
    const style = document.createElement('style');
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
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', async function() {
    await loadCourtStatus(); // Carregar status das quadras do Firebase
    initializeAuth(); // Inicializa o listener de autenticação
    await initializeRanking();
});

// Sistema de autenticação
let currentUser = null; // Armazena os dados do perfil do utilizador logado

// Inicializar autenticação com listener do Firebase Auth
function initializeAuth() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const userProfile = await getUserProfile(user.uid);
            // Prioriza o username do perfil, se existir. Caso contrário, usa o email.
            if (userProfile && userProfile.username) {
                currentUser = { ...userProfile, uid: user.uid };
            } else {
                // Fallback: Se o perfil ou o username estiver faltando, usa o email como username
                currentUser = { uid: user.uid, username: user.email || 'Usuário Desconhecido', totalTime: userProfile?.totalTime || 0 };
            }
            updateUserDisplay();
        } else {
            currentUser = null;
            updateUserDisplay();
            showNotification('Você está deslogado.');
        }
        updateRankingDisplay();
        Object.keys(courtStatus).forEach(court => updateCourtDisplay(court));
    });
}

// Obter utilizador atual
function getCurrentUser() {
    return currentUser;
}

// Mostrar modal de login
function showLoginModal() {
    document.getElementById('login-modal').style.display = 'flex'; // Usar flex para centralizar
}

// Esconder modal de login
function hideLoginModal() {
    document.getElementById('login-modal').style.display = 'none';
}

// Processar login
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        showNotification('Por favor, preencha todos os campos!');
        return;
    }
    
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        const userProfile = await getUserProfile(user.uid);
        // Prioriza o username do perfil, se existir. Caso contrário, usa o email.
        if (userProfile && userProfile.username) {
            currentUser = { ...userProfile, uid: user.uid };
            updateUserDisplay(); // Atualiza a exibição imediatamente
            showNotification(`Bem-vindo de volta, ${currentUser.username}!`);
        } else {
            // Fallback: Se o perfil ou o username estiver faltando, usa o email como username
            currentUser = { uid: user.uid, username: user.email || 'Usuário Desconhecido', totalTime: userProfile?.totalTime || 0 };
            updateUserDisplay();
            showNotification(`Bem-vindo de volta, ${currentUser.username}!`);
        }

        hideLoginModal();
        document.getElementById('login-form').reset();
    } catch (error) {
        let errorMessage = 'Erro ao fazer login. Por favor, tente novamente.';
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            errorMessage = 'Email ou senha incorretos.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Formato de email inválido.';
        }
        showNotification(errorMessage);
        console.error("Erro de login:", error);
    }
}

// Logout
async function logout() {
    try {
        await auth.signOut();
        showNotification('Logout realizado com sucesso!');
    } catch (error) {
        showNotification('Erro ao fazer logout. Por favor, tente novamente.');
        console.error("Erro de logout:", error);
    }
}

// Mostrar modal de cadastro
function showRegisterModal() {
    document.getElementById('register-modal').style.display = 'flex'; // Usar flex para centralizar
}

// Esconder modal de cadastro
function hideRegisterModal() {
    document.getElementById('register-modal').style.display = 'none';
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
    
    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    const phone = document.getElementById('register-phone').value.trim();
    
    // Validações
    if (!username || !email || !password || !confirmPassword) {
        showNotification('Por favor, preencha todos os campos obrigatórios!');
        return;
    }
    
    if (password !== confirmPassword) {
        showNotification('As senhas não coincidem!');
        return;
    }
    
    if (password.length < 6) {
        showNotification('A senha deve ter pelo menos 6 caracteres!');
        return;
    }
    
    try {
        // 1. Criar utilizador no Firebase Authentication
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const uid = userCredential.user.uid;

        // 2. Salvar dados adicionais do perfil no Realtime Database
        const newUserProfile = {
            username: username,
            email: email,
            phone: phone || '',
            totalTime: 0, // Inicializa o tempo total em 0
            joinDate: new Date().toISOString()
        };
        await database.ref('users/' + uid).set(newUserProfile); // Salva sob o UID

        // 3. Salvar email na lista de emails registrados (se ainda for necessário para algum log)
        await saveRegisteredEmail(email, username);
        
        // Atualizar currentUser e a exibição imediatamente após o cadastro
        currentUser = { uid: uid, ...newUserProfile };
        updateUserDisplay(); 
        
        showNotification(`Conta criada com sucesso! Bem-vindo, ${username}!`);
        
        hideRegisterModal(); // Esconde o modal de cadastro
        document.getElementById('register-form').reset(); // Limpa o formulário

    } catch (error) {
        let errorMessage = 'Erro ao criar conta. Por favor, tente novamente.';
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'Este email já está em uso. Tente fazer login ou use outro email.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'A senha é muito fraca. Use pelo menos 6 caracteres.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Formato de email inválido.';
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
    await database.ref('registeredEmails').push(emailData);
}

// Atualizar exibição do utilizador
function updateUserDisplay() {
    const userDisplay = document.getElementById('user-display');
    const userPoints = document.getElementById('user-points'); // Este elemento agora exibirá o tempo
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const logoutBtn = document.getElementById('logout-btn');
    
    if (currentUser) {
        userDisplay.textContent = currentUser.username;
        userPoints.textContent = `${formatTime(currentUser.totalTime || 0)}`; // Exibe o tempo formatado
        userPoints.style.display = 'inline-block';
        loginBtn.style.display = 'none';
        registerBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
    } else {
        userDisplay.textContent = 'Visitante';
        userPoints.textContent = '0s'; // Tempo inicial para visitante
        userPoints.style.display = 'none';
        loginBtn.style.display = 'inline-block';
        registerBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
    }
}

// NOVO: Funções para o Modal de Configurações do Utilizador
async function showUserSettingsModal() { // Tornada async para buscar histórico
    if (!currentUser) {
        showNotification('Por favor, faça login para ver suas configurações!');
        showLoginModal();
        return;
    }

    // Preencher os detalhes do utilizador no modal
    document.getElementById('settings-username').textContent = currentUser.username || 'N/A';
    document.getElementById('settings-email').textContent = currentUser.email || 'N/A';
    document.getElementById('settings-phone').textContent = currentUser.phone || 'N/A';
    document.getElementById('settings-total-time').textContent = formatTime(currentUser.totalTime || 0);
    
    // Formatar a data de entrada
    const joinDate = currentUser.joinDate ? new Date(currentUser.joinDate).toLocaleDateString('pt-BR') : 'N/A';
    document.getElementById('settings-join-date').textContent = joinDate;

    // Preencher o histórico de tempo
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = ''; // Limpa o histórico anterior

    const userSessionsRef = database.ref(`userSessions/${currentUser.uid}`);
    const snapshot = await userSessionsRef.once('value');
    const sessionsData = snapshot.val();

    if (sessionsData) {
        const sessionsArray = Object.values(sessionsData);
        // Opcional: ordenar as sessões, por exemplo, da mais recente para a mais antiga
        sessionsArray.sort((a, b) => b.startTime - a.startTime);

        sessionsArray.forEach(session => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <span><strong>Quadra:</strong> ${session.court.toUpperCase()}</span>
                <span><strong>Entrada:</strong> ${formatDateTime(session.startTime)}</span>
                <span><strong>Saída:</strong> ${formatDateTime(session.endTime)}</span>
                <span><strong>Duração:</strong> ${formatTime(session.duration)}</span>
            `;
            historyList.appendChild(listItem);
        });
    } else {
        historyList.innerHTML = '<li>Nenhum histórico de tempo encontrado.</li>';
    }

    document.getElementById('user-settings-modal').style.display = 'flex';
}

function hideUserSettingsModal() {
    document.getElementById('user-settings-modal').style.display = 'none';
}


// Sistema de ranking

// Função para obter o perfil de um utilizador pelo UID
async function getUserProfile(uid) {
    return new Promise((resolve) => {
        database.ref('users/' + uid).once('value', (snapshot) => {
            resolve(snapshot.val());
        });
    });
}

// Função para obter todos os utilizadores do Firebase (para ranking)
async function getUsers() {
    return new Promise((resolve) => {
        database.ref('users').once('value', (snapshot) => {
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
            updates['users/' + user.uid] = {
                username: user.username,
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
    const userRef = database.ref('users/' + uid);
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
    document.getElementById('ranking-modal').style.display = 'flex'; // Usar flex para centralizar
}

// Esconder modal de ranking
function hideRankingModal() {
    document.getElementById('ranking-modal').style.display = 'none';
}

// Atualizar exibição do ranking
async function updateRankingDisplay() {
    const users = await getUsers();
    // Ordena por totalTime (tempo total) em ordem decrescente
    const sortedUsers = users.sort((a, b) => (b.totalTime || 0) - (a.totalTime || 0));
    const rankingList = document.getElementById('ranking-list');
    
    if (sortedUsers.length === 0) {
        rankingList.innerHTML = '<p style="text-align: center; color: #666;">Nenhum utilizador registado ainda.</p>';
        return;
    }
    
    rankingList.innerHTML = sortedUsers.map((user, index) => {
        const position = index + 1;
        let positionClass = '';
        let medal = '';
        
        if (position === 1) {
            positionClass = 'first';
            medal = '🥇';
        } else if (position === 2) {
            positionClass = 'second';
            medal = '🥈';
        } else if (position === 3) {
            positionClass = 'third';
            medal = '🥉';
        }
        
        return `
            <div class="ranking-item">
                <div class="ranking-position ${positionClass}">
                    ${medal} ${position}º
                </div>
                <div class="ranking-user">
                    <div class="ranking-username">${user.username}</div>
                    <div class="ranking-email">${user.email}</div>
                </div>
                <div class="ranking-points">${formatTime(user.totalTime || 0)}</div> <!-- Exibe o tempo formatado -->
            </div>
        `;
    }).join('');
}

// Inicializar ranking
async function initializeRanking() {
    // Este bloco de código para adicionar usuários de exemplo foi removido.
    // Agora, o ranking dependerá apenas dos usuários reais cadastrados.
    // Se você precisar de usuários de exemplo para testes, adicione-os manualmente
    // ou reintroduza um bloco similar, mas com uma condição para não rodar em produção.
}

// Fechar modais ao clicar fora
window.onclick = function(event) {
    const loginModal = document.getElementById('login-modal');
    const registerModal = document.getElementById('register-modal');
    const rankingModal = document.getElementById('ranking-modal');
    const userSettingsModal = document.getElementById('user-settings-modal'); // NOVO MODAL

    if (event.target === loginModal) {
        hideLoginModal();
    }
    if (event.target === registerModal) {
        hideRegisterModal();
    }
    if (event.target === rankingModal) {
        hideRankingModal();
    }
    if (event.target === userSettingsModal) { // FECHAR NOVO MODAL
        hideUserSettingsModal();
    }
}
