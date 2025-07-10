document.addEventListener('DOMContentLoaded', function () {
    
    function startInteractiveTour() {
        if (Shepherd.activeTour) {
            return;
        }

        const tour = new Shepherd.Tour({
            useModalOverlay: true,
            defaultStepOptions: {
                classes: 'shepherd-theme-arrows-plain-buttons',
                scrollTo: { behavior: 'smooth', block: 'center' }
            }
        });

        const isLoggedIn = document.getElementById('logout-btn')?.style.display !== 'none';

        // Passo 1: Boas-vindas
        tour.addStep({
            id: 'welcome',
            title: '👋 Bem-vindo ao Pickleball Notifier!',
            text: 'Este é um tour completo para mostrar todas as funcionalidades do nosso site. Vamos começar?',
            buttons: [{ action() { return this.next(); }, text: 'Vamos lá! &rarr;' }]
        });

        // Passo 2: Status das Quadras
        tour.addStep({
            id: 'court-status',
            title: '🏟️ Status das Quadras',
            text: 'Aqui você pode ver em tempo real se as quadras estão livres ou ocupadas. Clique em "Entrar na Quadra" para marcar sua presença!',
            attachTo: { element: '.court-status', on: 'top' },
            buttons: [
                { action() { return this.back(); }, classes: 'shepherd-button-secondary', text: '&larr; Voltar' },
                { action() { return this.next(); }, text: 'Próximo &rarr;' }
            ]
        });

        // Passo 3: Condicional de Login
        if (!isLoggedIn) {
            tour.addStep({
                id: 'login-register',
                title: '👤 Login e Cadastro',
                text: 'Para interagir, marcar presença na quadra e competir no ranking, você precisa fazer login ou se cadastrar.',
                attachTo: { element: '#login-btn', on: 'bottom' },
                buttons: [
                    { action() { return this.back(); }, classes: 'shepherd-button-secondary', text: '&larr; Voltar' },
                    { action() { return this.next(); }, text: 'Próximo &rarr;' }
                ]
            });
        } else {
            tour.addStep({
                id: 'user-profile',
                title: '👤 Seu Perfil',
                text: 'Clique no seu nome para ver seu perfil, histórico de jogos, adicionar amigos e ver seu ID de configuração!',
                attachTo: { element: '#user-display', on: 'bottom' },
                buttons: [
                    { action() { return this.back(); }, classes: 'shepherd-button-secondary', text: '&larr; Voltar' },
                    { action() { return this.next(); }, text: 'Próximo &rarr;' }
                ]
            });
        }

        // Passo 4: Ranking
        tour.addStep({
            id: 'ranking',
            title: '🏆 Ranking de Jogadores',
            text: 'Clique aqui para ver quem são os jogadores mais ativos! O ranking é atualizado com base no tempo total de jogo.',
            attachTo: { element: '#ranking-btn', on: 'bottom' },
            buttons: [
                { action() { return this.back(); }, classes: 'shepherd-button-secondary', text: '&larr; Voltar' },
                { action() { return this.next(); }, text: 'Próximo &rarr;' }
            ]
        });

        // --- NOVOS PASSOS ADICIONADOS ---

        // Passo 5: Aulas
        tour.addStep({
            id: 'classes',
            title: '📚 Aulas de Pickleball',
            text: 'Interessado em aprender ou aprimorar seu jogo? Nesta seção você encontra os horários e locais das aulas disponíveis.',
            attachTo: { element: '#classes-btn', on: 'bottom' },
            buttons: [
                { action() { return this.back(); }, classes: 'shepherd-button-secondary', text: '&larr; Voltar' },
                { action() { return this.next(); }, text: 'Próximo &rarr;' }
            ]
        });

        // Passo 6: Regras
        tour.addStep({
            id: 'rules',
            title: '📜 Regras do Esporte',
            text: 'Seja você um iniciante ou um jogador experiente querendo tirar uma dúvida, aqui estão as regras oficiais do Pickleball.',
            attachTo: { element: '#rules-btn', on: 'bottom' },
            buttons: [
                { action() { return this.back(); }, classes: 'shepherd-button-secondary', text: '&larr; Voltar' },
                { action() { return this.next(); }, text: 'Próximo &rarr;' }
            ]
        });

        // Passo 7: Quadras
        tour.addStep({
            id: 'courts',
            title: '🏟️ Conheça as Quadras',
            text: 'Explore esta seção para ver detalhes, fotos e informações sobre todas as quadras parceiras da nossa comunidade.',
            attachTo: { element: '#courts-btn', on: 'bottom' },
            buttons: [
                { action() { return this.back(); }, classes: 'shepherd-button-secondary', text: '&larr; Voltar' },
                { action() { return this.next(); }, text: 'Próximo &rarr;' }
            ]
        });

        // --- FIM DOS NOVOS PASSOS ---

        // Passo 8: Eventos e Novidades
        tour.addStep({
            id: 'events',
            title: '📅 Eventos e Novidades',
            text: 'Fique por dentro de todos os campeonatos, passeios e aulas especiais. Todas as novidades da comunidade aparecem aqui!',
            attachTo: { element: '.events-section', on: 'top' },
            buttons: [
                { action() { return this.back(); }, classes: 'shepherd-button-secondary', text: '&larr; Voltar' },
                { action() { return this.next(); }, text: 'Próximo &rarr;' }
            ]
        });

        // Passo 9: Chat da Comunidade
        tour.addStep({
            id: 'chat',
            title: '💬 Chat da Comunidade',
            text: 'Converse com outros jogadores, combine partidas e fique sabendo dos avisos importantes em nosso chat em tempo real.',
            attachTo: { element: '#chat-widget', on: 'left' },
            buttons: [
                { action() { return this.back(); }, classes: 'shepherd-button-secondary', text: '&larr; Voltar' },
                { action() { this.complete(); }, text: 'Finalizar Tour 🎉' }
            ]
        });

        tour.start();
    }

    // Lógica para iniciar o tour (não precisa ser alterada)
    if (sessionStorage.getItem('isNewUser')) {
        setTimeout(startInteractiveTour, 1500);
        sessionStorage.removeItem('isNewUser');
    }

    const helpButton = document.getElementById('help-tour-btn');
    if (helpButton) {
        helpButton.addEventListener('click', startInteractiveTour);
    }
});
