// Melhorias para o JavaScript do sistema de ranking

// Função melhorada para atualizar o display do ranking
function updateRankingDisplayImproved() {
    const totalRankingList = document.getElementById('ranking-list');
    const weeklyRankingList = document.getElementById('ranking-weekly-list');
    
    if (!totalRankingList || !weeklyRankingList) return;

    // Mostrar loading enquanto carrega os dados
    showRankingLoading(totalRankingList);
    showRankingLoading(weeklyRankingList);

    // Simular carregamento de dados (substitua pela sua lógica real)
    setTimeout(() => {
        updateTotalRanking();
        updateWeeklyRanking();
    }, 1000);
}

// Função para mostrar loading
function showRankingLoading(container) {
    container.innerHTML = `
        <div class="ranking-loading">
            <div class="ranking-loading-spinner"></div>
            <div class="ranking-loading-text">Carregando ranking...</div>
        </div>
    `;
}

// Função para mostrar estado vazio
function showRankingEmpty(container, message = "Nenhum jogador encontrado") {
    container.innerHTML = `
        <div class="ranking-empty">
            <div class="ranking-empty-icon">🏆</div>
            <div class="ranking-empty-text">${message}</div>
            <div class="ranking-empty-subtext">Seja o primeiro a jogar!</div>
        </div>
    `;
}

// Função melhorada para criar item do ranking
function createRankingItemImproved(user, position, timeValue) {
    const positionClass = position === 1 ? 'first' : position === 2 ? 'second' : position === 3 ? 'third' : '';
    
    return `
        <div class="ranking-item" style="animation-delay: ${position * 0.1}s">
            <div class="ranking-position ${positionClass}">
                ${position}°
            </div>
            <div class="ranking-user">
                <div class="ranking-username">${user.username} ${user.lastName || ''}</div>
                <div class="ranking-email">${user.email}</div>
            </div>
            <div class="ranking-points">
                <div class="time-badge">${timeValue}</div>
            </div>
        </div>
    `;
}

// Função para atualizar ranking total com novos estilos
function updateTotalRanking() {
    const rankingList = document.getElementById('ranking-list');
    if (!rankingList) return;

    // Aqui você colocaria sua lógica real de busca de dados
    // Por enquanto, vou usar dados de exemplo
    const users = [
        { username: 'henrique', lastName: 'Gimenes', email: 'henrique082003@gmail.com', totalTime: 454000 },
        { username: 'amanda', lastName: 'soares', email: 'amanda@gmail.com', totalTime: 49000 }
    ];

    if (users.length === 0) {
        showRankingEmpty(rankingList, "Nenhum jogador no ranking total");
        return;
    }

    // Ordenar por tempo total
    users.sort((a, b) => b.totalTime - a.totalTime);

    let html = '';
    users.forEach((user, index) => {
        const position = index + 1;
        const timeFormatted = formatTime(user.totalTime);
        html += createRankingItemImproved(user, position, timeFormatted);
    });

    rankingList.innerHTML = html;
}

// Função para atualizar ranking semanal com novos estilos
function updateWeeklyRanking() {
    const rankingList = document.getElementById('ranking-weekly-list');
    if (!rankingList) return;

    // Aqui você colocaria sua lógica real de busca de dados semanais
    // Por enquanto, vou usar dados de exemplo
    const users = [
        { username: 'henrique', lastName: 'Gimenes', email: 'henrique082003@gmail.com', weeklyTime: 7000 },
        { username: 'amanda', lastName: 'soares', email: 'amanda@gmail.com', weeklyTime: 0 }
    ];

    if (users.length === 0) {
        showRankingEmpty(rankingList, "Nenhum jogador no ranking semanal");
        return;
    }

    // Ordenar por tempo semanal
    users.sort((a, b) => b.weeklyTime - a.weeklyTime);

    let html = '';
    users.forEach((user, index) => {
        const position = index + 1;
        const timeFormatted = formatTime(user.weeklyTime);
        html += createRankingItemImproved(user, position, timeFormatted);
    });

    rankingList.innerHTML = html;
}

// Função melhorada para alternar abas do ranking
function showRankingTabImproved(tabType) {
    // Remover classe active de todas as abas
    document.querySelectorAll('.ranking-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Esconder todo o conteúdo
    document.querySelectorAll('.ranking-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Ativar a aba clicada
    const activeTab = document.querySelector(`.ranking-tab[onclick="showRankingTab('${tabType}')"]`);
    if (activeTab) {
        activeTab.classList.add('active');
    }
    
    // Mostrar o conteúdo correspondente
    const activeContent = document.getElementById(`ranking-${tabType}-content`);
    if (activeContent) {
        activeContent.classList.add('active');
    }
}

// Função para adicionar efeitos de hover nos itens do ranking
function addRankingHoverEffects() {
    document.addEventListener('mouseover', function(e) {
        if (e.target.closest('.ranking-item')) {
            const item = e.target.closest('.ranking-item');
            item.style.transform = 'translateY(-8px) scale(1.02)';
        }
    });
    
    document.addEventListener('mouseout', function(e) {
        if (e.target.closest('.ranking-item')) {
            const item = e.target.closest('.ranking-item');
            item.style.transform = '';
        }
    });
}

// Função para animar a entrada dos itens do ranking
function animateRankingItems() {
    const items = document.querySelectorAll('.ranking-item');
    items.forEach((item, index) => {
        item.style.animationDelay = `${index * 0.1}s`;
        item.classList.add('slideInFromRight');
    });
}

// Inicializar melhorias quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    // Adicionar efeitos de hover
    addRankingHoverEffects();
    
    // Sobrescrever a função original se existir
    if (typeof showRankingTab !== 'undefined') {
        window.showRankingTab = showRankingTabImproved;
    }
    
    // Sobrescrever a função de atualização do ranking se existir
    if (typeof updateRankingDisplay !== 'undefined') {
        window.updateRankingDisplay = updateRankingDisplayImproved;
    }
});

// Função para adicionar animação de shimmer ao header
function addShimmerEffect() {
    const header = document.querySelector('#ranking-modal h2');
    if (header) {
        header.style.position = 'relative';
        header.style.overflow = 'hidden';
    }
}

// Função para melhorar a responsividade do modal
function improveModalResponsiveness() {
    const modal = document.getElementById('ranking-modal');
    if (!modal) return;
    
    function checkScreenSize() {
        if (window.innerWidth <= 768) {
            modal.classList.add('mobile-view');
        } else {
            modal.classList.remove('mobile-view');
        }
    }
    
    window.addEventListener('resize', checkScreenSize);
    checkScreenSize();
}

// Exportar funções para uso global
window.updateRankingDisplayImproved = updateRankingDisplayImproved;
window.showRankingTabImproved = showRankingTabImproved;
window.createRankingItemImproved = createRankingItemImproved;

