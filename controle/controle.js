// Inicialize o Firebase no seu firebase-config.js
// Certifique-se de que 'database' e 'auth' estejam disponíveis globalmente ou passados como parâmetros.
// Ex: const database = firebase.database();

let editingPlayerId = null; // UID do usuário que está sendo editado

// Elementos do DOM
const playerForm = document.getElementById('player-form');
const formTitle = document.getElementById('form-title');
const submitBtn = document.getElementById('submit-btn');
const cancelBtn = document.getElementById('cancel-btn');
const playersGrid = document.getElementById('players-grid');
const emptyState = document.getElementById('empty-state');
const totalCount = document.getElementById('total-count');
const locationFilter = document.getElementById('location-filter');
const locationBadgesContainer = document.getElementById('location-badges'); // Renomeado para evitar conflito

// Event Listeners
playerForm.addEventListener('submit', handleSubmit);
cancelBtn.addEventListener('click', cancelEdit);
locationFilter.addEventListener('change', filterPlayers);

// Inicializar aplicação
init();

async function init() {
    // Carregar dados dos usuários do Firebase
    await loadPlayersFromFirebase();
    renderLocationBadges(); // Renderiza os badges com as contagens iniciais
    updateTotalCount();
}

// Função para carregar jogadores do Firebase
async function loadPlayersFromFirebase() {
    playersGrid.innerHTML = ''; // Limpa o grid antes de carregar
    players = []; // Limpa o array local de jogadores

    const usersRef = firebase.database().ref('users');
    usersRef.on('value', (snapshot) => {
        players = []; // Limpa novamente para cada atualização em tempo real
        snapshot.forEach((childSnapshot) => {
            const userData = childSnapshot.val();
            // Adiciona o UID do Firebase como ID do jogador
            players.push({ id: childSnapshot.key, ...userData });
        });
        renderPlayers(); // Renderiza os jogadores após carregar
        renderLocationBadges(); // Atualiza os badges
        updateTotalCount(); // Atualiza a contagem total
    });
}

async function handleSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('name').value.trim();
    const location = document.getElementById('location').value;
    const phone = document.getElementById('phone').value.trim();
    const email = document.getElementById('email').value.trim();

    if (!name || !location) {
        alert('Por favor, preencha os campos obrigatórios (Nome e Local)');
        return;
    }

    const playerData = {
        username: name, // Usando 'username' para consistência com o Firebase
        playsAt: location, // Usando 'playsAt' para consistência com o Firebase
        phone: phone || null,
        email: email || null,
        updatedAt: new Date().toISOString()
    };

    try {
        if (editingPlayerId) {
            // Atualiza o usuário existente no Firebase
            await firebase.database().ref('users/' + editingPlayerId).update(playerData);
            console.log('Jogador atualizado:', editingPlayerId);
            showNotification('Jogador atualizado com sucesso!');
        } else {
            // Adiciona um novo usuário (gerando um UID aleatório para o Firebase)
            // NOTA: Para usuários reais, eles seriam criados via registro no index.html
            // Esta parte é mais para adicionar jogadores manualmente no painel de controle
            const newUserRef = firebase.database().ref('users').push();
            const newUserData = {
                ...playerData,
                createdAt: new Date().toISOString(),
                totalTime: 0, // Inicializa com 0 para novos jogadores
                weeklyTime: 0,
                lastWeeklyReset: new Date().toISOString(),
                gender: 'Não informado', // Valor padrão
                configId: generateRandomId(12) // Gera um ID de configuração
            };
            await newUserRef.set(newUserData);
            console.log('Novo jogador adicionado:', newUserData);
            showNotification('Jogador adicionado com sucesso!');
        }
    } catch (error) {
        console.error('Erro ao salvar jogador:', error);
        showNotification('Erro ao salvar jogador. Tente novamente.');
    } finally {
        resetForm();
    }
}

async function deletePlayer(id) {
    if (confirm('Tem certeza que deseja excluir este jogador? Esta ação não pode ser desfeita.')) {
        try {
            await firebase.database().ref('users/' + id).remove();
            console.log('Jogador excluído:', id);
            showNotification('Jogador excluído com sucesso!');
        } catch (error) {
            console.error('Erro ao excluir jogador:', error);
            showNotification('Erro ao excluir jogador. Tente novamente.');
        }
    }
}

function editPlayer(id) {
    const player = players.find(p => p.id === id);
    if (!player) return;

    editingPlayerId = id;

    // Preencher formulário
    document.getElementById('name').value = player.username;
    document.getElementById('location').value = player.playsAt;
    document.getElementById('phone').value = player.phone || '';
    document.getElementById('email').value = player.email || '';

    // Atualizar UI do formulário
    formTitle.innerHTML = '<span class="icon">✏️</span> Editar Jogador';
    submitBtn.textContent = 'Atualizar Jogador';
    cancelBtn.style.display = 'block';

    // Scroll para o formulário
    document.querySelector('.form-card').scrollIntoView({ behavior: 'smooth' });
}

function cancelEdit() {
    editingPlayerId = null;
    resetForm();
}

function resetForm() {
    playerForm.reset();
    formTitle.innerHTML = '<span class="icon">👥</span> Adicionar Novo Jogador';
    submitBtn.textContent = 'Adicionar Jogador';
    cancelBtn.style.display = 'none';
    editingPlayerId = null;
}

function renderPlayers() {
    const selectedLocation = locationFilter.value;
    let filteredPlayers = selectedLocation === 'ALL'
        ? players
        : players.filter(p => p.playsAt === selectedLocation);

    playersGrid.innerHTML = ''; // Limpa o grid

    if (filteredPlayers.length === 0) {
        if (players.length === 0) {
            playersGrid.innerHTML = `
                <div class="empty-state" id="empty-state">
                    <div class="empty-icon">👥</div>
                    <p class="empty-title">Nenhum jogador cadastrado</p>
                    <p class="empty-subtitle">Adicione o primeiro jogador usando o formulário acima</p>
                </div>
            `;
        } else {
            playersGrid.innerHTML = `
                <div class="no-players">
                    <p>Nenhum jogador encontrado para o local selecionado</p>
                </div>
            `;
        }
        return;
    }

    filteredPlayers.forEach(player => {
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card';
        playerCard.innerHTML = `
            <div class="player-header">
                <span class="user-icon">👤</span>
                <h4>${escapeHtml(player.username)} ${escapeHtml(player.lastName || '')}</h4>
            </div>

            <div class="player-info">
                <div class="location-badge">${escapeHtml(player.playsAt)}</div>

                <div class="contact-info">
                    ${player.phone ? `<p><strong>Telefone:</strong> ${escapeHtml(player.phone)}</p>` : ''}
                    ${player.email ? `<p><strong>Email:</strong> ${escapeHtml(player.email)}</p>` : ''}
                </div>
            </div>

            <div class="player-actions">
                <button class="btn btn-edit" onclick="editPlayer('${player.id}')">
                    Editar
                </button>
                <button class="btn btn-danger" onclick="deletePlayer('${player.id}')">
                    Excluir
                </button>
            </div>
        `;
        playersGrid.appendChild(playerCard);
    });
}

function renderLocationBadges() {
    const counts = getLocationCounts();
    const selectedLocation = locationFilter.value;

    locationBadgesContainer.innerHTML = ''; // Limpa os badges existentes

    // Garante que 'LOCATIONS' seja um array de strings com os nomes dos locais
    const LOCATIONS = Array.from(new Set(players.map(p => p.playsAt))).sort(); // Pega locais únicos dos jogadores

    // Adiciona a opção "Todos os locais" se não estiver presente
    if (!LOCATIONS.includes('ALL')) {
        LOCATIONS.unshift('ALL');
    }

    LOCATIONS.forEach(location => {
        if (location === 'ALL') return; // Não cria badge para 'ALL'

        const count = counts[location] || 0;
        const isActive = selectedLocation === location;
        const badge = document.createElement('div');
        badge.className = `badge ${isActive ? 'active' : ''}`;
        badge.textContent = `${location} (${count})`;
        badge.onclick = () => selectLocation(location);
        locationBadgesContainer.appendChild(badge);
    });
}

function getLocationCounts() {
    const counts = {};
    players.forEach(player => {
        counts[player.playsAt] = (counts[player.playsAt] || 0) + 1;
    });
    return counts;
}

function selectLocation(location) {
    locationFilter.value = location;
    filterPlayers();
}

function filterPlayers() {
    renderPlayers();
    renderLocationBadges();
}

function updateTotalCount() {
    totalCount.textContent = players.length;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Função de notificação simples (pode ser aprimorada)
function showNotification(message) {
    const notificationDiv = document.createElement('div');
    notificationDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #4CAF50;
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 9999;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    notificationDiv.textContent = message;
    document.body.appendChild(notificationDiv);
    setTimeout(() => {
        notificationDiv.remove();
    }, 3000);
}

// Função para gerar um ID de configuração (se você não estiver usando o UID do Firebase diretamente)
function generateRandomId(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

console.log('Sistema de controle de jogadores de Pickleball iniciado com Firebase!');

