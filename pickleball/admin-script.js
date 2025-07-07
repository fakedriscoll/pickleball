// Funcionalidades específicas do painel de administração
console.log("admin-script.js carregado."); // Adicione esta linha no topo do arquivo

// Função para carregar e exibir estatísticas
async function loadAdminStats() {
    const activeEventsCountElement = document.getElementById("active-events-count");
    // const activeTripsCountElement = document.getElementById("active-trips-count"); // Removido
    const registeredUsersCountElement = document.getElementById("registered-users-count");
    const announcementsTodayCountElement = document.getElementById("announcements-today-count");

    // 1. Contar Eventos Ativos (incluindo passeios se eles forem considerados eventos)
    try {
        const eventsSnapshot = await firebase.database().ref("events").once("value");
        const events = eventsSnapshot.val();
        let activeEvents = 0;
        const now = new Date();

        if (events) {
            Object.values(events).forEach(event => {
                const eventDateTime = new Date(`${event.date}T${event.time}`);
                if (eventDateTime >= now) {
                    activeEvents++;
                }
            });
        }
        activeEventsCountElement.textContent = activeEvents;
    } catch (error) {
        console.error("Erro ao carregar eventos ativos:", error);
        activeEventsCountElement.textContent = "Erro";
    }

    // 2. Removido: Contar Passeios Programados (seção de estatísticas)
    /*
    try {
        const tripsSnapshot = await firebase.database().ref("trips").once("value");
        const trips = tripsSnapshot.val();
        let programmedTrips = 0;
        const now = new Date();

        if (trips) {
            Object.values(trips).forEach(trip => {
                const tripDateTime = new Date(`${trip.date}T${trip.time}`);
                if (tripDateTime >= now) {
                    programmedTrips++;
                }
            });
        }
        activeTripsCountElement.textContent = programmedTrips;
    } catch (error) {
        console.error("Erro ao carregar passeios programados:", error);
        activeTripsCountElement.textContent = "Erro";
    }
    */

    // 3. Contar Usuários Registrados
    try {
        const usersSnapshot = await firebase.database().ref("users").once("value");
        const users = usersSnapshot.val();
        const registeredUsers = users ? Object.keys(users).length : 0;
        registeredUsersCountElement.textContent = registeredUsers;
    } catch (error) {
        console.error("Erro ao carregar usuários registrados:", error);
        registeredUsersCountElement.textContent = "Erro";
    }

    // 4. Contar Anúncios Hoje
    try {
        const announcementsSnapshot = await firebase.database().ref("announcements").once("value");
        const announcements = announcementsSnapshot.val();
        let announcementsToday = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Zera a hora para comparar apenas a data

        if (announcements) {
            Object.values(announcements).forEach(announcement => {
                const announcementDate = new Date(announcement.timestamp);
                announcementDate.setHours(0, 0, 0, 0); // Zera a hora do anúncio

                if (announcementDate.getTime() === today.getTime()) {
                    announcementsToday++;
                }
            });
        }
        announcementsTodayCountElement.textContent = announcementsToday;
    } catch (error) {
        console.error("Erro ao carregar anúncios de hoje:", error);
        announcementsTodayCountElement.textContent = "Erro";
    }
}

// Verificar se o usuário é administrador ao carregar a página
document.addEventListener("DOMContentLoaded", function() {
    checkAdminAccess();
    loadAdminEvents();
    loadAdminStats(); 
    toggleEventTypeFields(); // NOVO: Chama para ajustar a visibilidade inicial
});

// Verificar acesso de administrador
function checkAdminAccess() {
    firebase.auth().onAuthStateChanged(function(user) {
        if (!user) {
            alert("Acesso negado. Faça login como administrador.");
            window.location.href = "index.html";
            return;
        }
        
        // Verificar se o usuário é administrador
        const adminEmails = [
            "henrique082003@gmail.com",
            "admin@pickleball.com"
        ];
        
        if (!adminEmails.includes(user.email)) {
            alert("Acesso negado. Você não tem permissões de administrador.");
            window.location.href = "index.html";
            return;
        }
        
        console.log("Acesso de administrador confirmado para:", user.email);
    });
}

function toggleEventTypeFields() {
    const eventTypeSelect = document.getElementById("admin-event-type");
    const categoriesGroup = document.getElementById("admin-event-categories-group");
    const capacityGroup = document.getElementById("admin-event-capacity-group");
    const adminEventCapacityInput = document.getElementById("admin-event-capacity"); // Referência ao input de capacidade

    if (eventTypeSelect.value === "passeio") {
        categoriesGroup.style.display = "none";
        capacityGroup.style.display = "block";
        adminEventCapacityInput.required = true; // Torna o campo de capacidade obrigatório
    } else {
        categoriesGroup.style.display = "block";
        capacityGroup.style.display = "none";
        adminEventCapacityInput.required = false; // Remove a obrigatoriedade
        adminEventCapacityInput.value = ""; // Limpa o valor quando oculto
    }
}

// Manipular submissão de eventos
function handleAdminEventSubmission(event) {
    event.preventDefault();
    console.log("Formulário de evento submetido.");
    
    
    const title = document.getElementById("admin-event-title").value;
    const type = document.getElementById("admin-event-type").value;
    const date = document.getElementById("admin-event-date").value;
    const endDate = document.getElementById("admin-event-end-date").value;
    const time = document.getElementById("admin-event-time").value;
    const endTime = document.getElementById("admin-event-end-time").value;
    const registrationStartDate = document.getElementById("admin-event-registration-start-date").value;
    const registrationEndDate = document.getElementById("admin-event-registration-end-date").value;
    const description = document.getElementById("admin-event-description").value;
    const location = document.getElementById("admin-event-location").value;
    const price = document.getElementById("admin-event-price").value;
    const image = document.getElementById("admin-event-image").value;

    let categories = [];
    let capacity = null;

    // Lógica para pegar o campo correto com base no tipo de evento
    if (type === "passeio") {
        capacity = document.getElementById("admin-event-capacity").value;
        if (!capacity) { // Validação para capacidade
            alert("Por favor, preencha a Capacidade Máxima para o passeio.");
            return;
        }
        capacity = parseInt(capacity);
    } else {
        const categoriesInput = document.getElementById("admin-event-categories").value;
        categories = categoriesInput.split(",").map(cat => cat.trim()).filter(cat => cat !== "");
    }
    
    const eventData = {
        id: Date.now().toString(),
        title: title,
        type: type,
        date: date,
        endDate: endDate,
        time: time,
        endTime: endTime,
        registrationStartDate: registrationStartDate,
        registrationEndDate: registrationEndDate,
        description: description,
        location: location || "A definir",
        price: price ? parseFloat(price) : null,
        image: image || null,
        createdAt: new Date().toISOString(),
        createdBy: firebase.auth().currentUser.email
    };

    // Adiciona categories OU capacity ao eventData
    if (type === "passeio") {
        eventData.capacity = capacity;
        eventData.registrations = {}; // Inicializa o campo de inscrições para passeios
    } else {
        eventData.categories = categories;
    }
    
    // Salvar no Firebase
    firebase.database().ref("events/" + eventData.id).set(eventData)
        .then(() => {
            alert("Evento criado com sucesso!");
            document.getElementById("admin-event-form").reset();
            toggleEventTypeFields(); // Chama para resetar a visibilidade dos campos
            loadAdminEvents();
        })
        .catch((error) => {
            console.error("Erro ao criar evento:", error);
            alert("Erro ao criar evento. Tente novamente.");
        });
}

// Removido: Manipular submissão de passeios (handleAdminTripSubmission)
/*
function handleAdminTripSubmission(event) {
    event.preventDefault();
    
    const title = document.getElementById("admin-trip-title").value;
    const destination = document.getElementById("admin-trip-destination").value;
    const date = document.getElementById("admin-trip-date").value;
    const time = document.getElementById("admin-trip-time").value;
    const description = document.getElementById("admin-trip-description").value;
    const price = document.getElementById("admin-trip-price").value;
    const capacity = document.getElementById("admin-trip-capacity").value;
    const meetingPoint = document.getElementById("admin-trip-meeting-point").value;
    const image = document.getElementById("admin-trip-image").value;
    
    const tripId = Date.now().toString();
    
    const tripData = {
        id: tripId,
        title: title,
        type: "passeio",
        destination: destination,
        date: date,
        time: time,
        description: description,
        price: parseFloat(price),
        capacity: parseInt(capacity),
        meetingPoint: meetingPoint,
        image: image || null,
        registrations: {},
        createdAt: new Date().toISOString(),
        createdBy: firebase.auth().currentUser.email
    };
    
    const eventData = {
        id: tripId,
        title: title,
        type: "passeio",
        date: date,
        time: time,
        description: description,
        location: `Saída: ${meetingPoint}`,
        price: parseFloat(price),
        image: image || null,
        destination: destination,
        capacity: parseInt(capacity),
        meetingPoint: meetingPoint,
        registrations: {},
        createdAt: new Date().toISOString(),
        createdBy: firebase.auth().currentUser.email
    };
    
    Promise.all([
        firebase.database().ref("trips/" + tripId).set(tripData),
        firebase.database().ref("events/" + tripId).set(eventData)
    ])
        .then(() => {
            alert("Passeio criado com sucesso!");
            document.getElementById("admin-trip-form").reset();
            loadAdminTrips();
        })
        .catch((error) => {
            console.error("Erro ao criar passeio:", error);
            alert("Erro ao criar passeio. Tente novamente.");
        });
}
*/

// Carregar eventos para administração - CORRIGIDO
async function loadAdminEvents() {
    const container = document.getElementById("admin-events-container");
    
    firebase.database().ref("events").on("value", async (snapshot) => {
        const events = snapshot.val();
        container.innerHTML = "";
        
        if (!events) {
            container.innerHTML = "<div class=\"no-events\">Nenhum evento cadastrado.</div>";
            return;
        }
        
        // Usar Promise.all para aguardar todas as chamadas assíncronas de createAdminEventCard
        const eventCardsPromises = Object.values(events)
            // REMOVA OU COMENTE A LINHA ABAIXO:
            // .filter(event => event.type !== "passeio") // Filtra eventos que não são do tipo 'passeio'
            .map(async event => {
            const eventCard = await createAdminEventCard(event);
            return eventCard;
        });

        const eventCards = await Promise.all(eventCardsPromises);

        eventCards.forEach(card => {
            if (card) {
                container.appendChild(card);
            }
        });
    });
}

// Removido: Carregar passeios para administração (loadAdminTrips)
/*
async function loadAdminTrips() {
    const container = document.getElementById("admin-trips-container");
    
    firebase.database().ref("trips").on("value", async (snapshot) => {
        const trips = snapshot.val();
        container.innerHTML = "";
        
        if (!trips) {
            container.innerHTML = "<div class=\"no-events\">Nenhum passeio cadastrado.</div>";
            return;
        }
        
        const tripCardsPromises = Object.values(trips).map(async trip => {
            const tripCard = await createAdminTripCard(trip);
            return tripCard;
        });

        const tripCards = await Promise.all(tripCardsPromises);

        tripCards.forEach(card => {
            if (card) {
                container.appendChild(card);
            }
        });
    });
}
*/

// NOVA FUNÇÃO: Buscar nome completo do usuário pelo UID
async function getUserFullName(uid) {
    try {
        const userSnapshot = await firebase.database().ref("users/" + uid).once("value");
        const userData = userSnapshot.val();
        
        if (userData && userData.username) {
            return `${userData.username} ${userData.lastName || ""}`.trim();
        }
        
        return "Usuário Desconhecido";
    } catch (error) {
        console.error("Erro ao buscar dados do usuário:", error);
        return "Usuário Desconhecido";
    }
}

// Criar card de evento para administração
async function createAdminEventCard(event) {
    const card = document.createElement("div");
    card.className = "event-card";

    const eventDate = new Date(event.date + "T" + event.time);
    const formattedDate = eventDate.toLocaleDateString("pt-BR");
    const formattedTime = eventDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    let endDateHtml = "";
    if (event.endDate) {
        const eventEndDate = new Date(event.endDate);
        const formattedEndDate = eventEndDate.toLocaleDateString("pt-BR");
        endDateHtml = `<p><strong>Data de Término:</strong> ${formattedEndDate}</p>`;
    }

    let endTimeHtml = "";
    if (event.endTime) {
        endTimeHtml = `<p><strong>Horário de Término:</strong> ${event.endTime}</p>`;
    }

    let registrationDatesHtml = "";
    if (event.registrationStartDate && event.registrationEndDate) {
        const regStartDate = new Date(event.registrationStartDate);
        const regEndDate = new Date(event.registrationEndDate);
        registrationDatesHtml = `
            <p><strong>Inscrições:</strong> ${regStartDate.toLocaleDateString("pt-BR")} a ${regEndDate.toLocaleDateString("pt-BR")}</p>
        `;
    } else if (event.registrationStartDate) {
        const regStartDate = new Date(event.registrationStartDate);
        registrationDatesHtml = `<p><strong>Início Inscrições:</strong> ${regStartDate.toLocaleDateString("pt-BR")}</p>`;
    } else if (event.registrationEndDate) {
        const regEndDate = new Date(event.registrationEndDate);
        registrationDatesHtml = `<p><strong>Fim Inscrições:</strong> ${regEndDate.toLocaleDateString("pt-BR")}</p>`;
    }

    let categoriesOrCapacityHtml = ""; // Variável para categorias OU capacidade
    if (event.type === "campeonato" && event.categories && event.categories.length > 0) {
        categoriesOrCapacityHtml = `<p><strong>Categorias:</strong> ${event.categories.join(", ")}</p>`;
    } else if (event.type === "passeio" && event.capacity) { // NOVO: Exibir capacidade para passeios
        categoriesOrCapacityHtml = `<p><strong>Capacidade:</strong> ${event.capacity} pessoas</p>`;
    }

    let registrationsHtml = "";
    // Lógica para exibir inscritos em passeios ou jogadores procurando dupla em campeonatos
    if (event.type === "passeio" && event.registrations) {
        const participants = Object.values(event.registrations);
        if (participants.length > 0) {
            const participantsWithRealNames = await Promise.all(
                participants.map(async (participant) => {
                    const realName = await getUserFullName(participant.uid);
                    return realName;
                })
            );
            registrationsHtml = `
                <div class=\"admin-registrations-list\">
                    <h5>Inscritos (${participants.length}/${event.capacity || 'N/A'}):</h5>
                    <ul>
                         ${participantsWithRealNames.map(name => `<li>${name}</li>`).join("")}
                    </ul>
                </div>
            `;
        } else {
            registrationsHtml = `<p class=\"no-registrations\">Nenhum inscrito ainda.</p>`;
        }
    } else if (event.type === "campeonato" && event.lookingForPartner) {
        const players = Object.values(event.lookingForPartner);
        if (players.length > 0) {
            const playersWithRealNames = await Promise.all(
                players.map(async (player) => {
                    const realName = await getUserFullName(player.uid);
                    return realName;
                })
            );
            
            registrationsHtml = `
                <div class=\"admin-registrations-list\">
                    <h5>Jogadores procurando dupla (${players.length}):</h5>
                    <ul>
                         ${playersWithRealNames.map(name => `<li>${name}</li>`).join("")}
                    </ul>
                </div>
            `;
        } else {
            registrationsHtml = `<p class=\"no-registrations\">Nenhum jogador procurando dupla.</p>`;
        }
    } else if (event.type === "aula" || event.type === "novidade" || event.type === "outro") {
        if (event.registrations) {
            const participants = Object.values(event.registrations);
            if (participants.length > 0) {
                const participantsWithRealNames = await Promise.all(
                    participants.map(async (participant) => {
                        const realName = await getUserFullName(participant.uid);
                        return realName;
                    })
                );
                
                registrationsHtml = `
                    <div class=\"admin-registrations-list\">
                        <h5>Participantes (${participants.length}):</h5>
                        <ul>
                             ${participantsWithRealNames.map(name => `<li>${name}</li>`).join("")}
                        </ul>
                    </div>
                `;
            } else {
                registrationsHtml = `<p class=\"no-registrations\">Nenhum participante inscrito.</p>`;
            }
        } else {
            registrationsHtml = `<p class=\"no-registrations\">Nenhum participante inscrito.</p>`;
        }
    }

    card.innerHTML = `
        <h4>${event.title}</h4>
        <span class=\"event-type ${event.type}\">${getEventTypeLabel(event.type)}</span>
        <div class=\"event-details\">
            <p><strong>Data:</strong> ${formattedDate}</p>
            ${endDateHtml}
            <p><strong>Horário:</strong> ${formattedTime}</p>
            ${endTimeHtml}
            ${registrationDatesHtml}
            ${categoriesOrCapacityHtml} <!-- AGORA EXIBE CATEGORIAS OU CAPACIDADE -->
            <p><strong>Local:</strong> ${event.location || "A definir"}</p>
            ${event.price ? `<p><strong>Preço:</strong> R$ ${event.price.toFixed(2)}</p>` : ""}
            <p><strong>Descrição:</strong> ${event.description}</p>
        </div>
        ${registrationsHtml}
        <div class=\"event-actions\">
            <button class=\"btn-edit\" onclick=\"editEvent(\'${event.id}\')\">Editar</button>
            <button class=\"btn-delete\" onclick=\"deleteEvent(\'${event.id}\')\">Excluir</button>
        </div>
    `;

    return card;
}

// Removido: Criar card de passeio para administração (createAdminTripCard)
/*
async function createAdminTripCard(trip) {
    const card = document.createElement("div");
    card.className = "event-card";

    const tripDate = new Date(trip.date + "T" + trip.time);
    const formattedDate = tripDate.toLocaleDateString("pt-BR");
    const formattedTime = tripDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    const registrationCount = trip.registrations ? Object.keys(trip.registrations).length : 0;

    let participantsListHtml = "";
    if (registrationCount > 0) {
        const participants = Object.values(trip.registrations);
        
        const participantsWithRealNames = await Promise.all(
            participants.map(async (participant) => {
                const realName = await getUserFullName(participant.uid);
                return realName;
            })
        );
        
        participantsListHtml = `
            <div class=\"admin-registrations-list\">
                <h5>Inscritos (${registrationCount}/${trip.capacity}):</h5>
                <ul>
                    ${participantsWithRealNames.map(name => `<li>${name}</li>`).join("")}
                </ul>
            </div>
        `;
    } else {
        participantsListHtml = `<p class=\"no-registrations\">Nenhum inscrito ainda.</p>`;
    }

    card.innerHTML = `
        <h4>${trip.title}</h4>
        <span class=\"event-type passeio\">🚌 Passeio</span>
        <div class=\"event-details\">
            <p><strong>Destino:</strong> ${trip.destination}</p>
            <p><strong>Data:</strong> ${formattedDate}</p>
            <p><strong>Saída:</strong> ${formattedTime}</p>
            <p><strong>Ponto de Encontro:</strong> ${trip.meetingPoint}</p>
            <p><strong>Preço:</strong> R$ ${trip.price.toFixed(2)}</p>
            <p><strong>Inscritos:</strong> ${registrationCount}/${trip.capacity}</p>
            <p><strong>Descrição:</strong> ${trip.description}</p>
        </div>
        ${participantsListHtml}
        <div class=\"event-actions\">
            <button class=\"btn-edit\" onclick=\"editTrip(\'${trip.id}\')\">Editar</button>
            <button class=\"btn-delete\" onclick=\"deleteTrip(\'${trip.id}\')\">Excluir</button>
        </div>
    `;

    return card;
}
*/

// Obter label do tipo de evento
function getEventTypeLabel(type) {
    const labels = {
        "campeonato": "🏆 Campeonato",
        "novidade": "📢 Novidade",
        "passeio": "🚌 Passeio",
        "aula": "📚 Aula Especial",
        "manutencao": "🔧 Manutenção",
        "outro": "📅 Outro"
    };
    return labels[type] || "📅 Evento";
}

// Editar evento
function editEvent(eventId) {
    firebase.database().ref("events/" + eventId).once("value", (snapshot) => {
        const event = snapshot.val();
        if (event) {
            document.getElementById("admin-event-title").value = event.title;
            document.getElementById("admin-event-type").value = event.type;
            
            // Chamar toggleEventTypeFields para ajustar a visibilidade ANTES de preencher
            toggleEventTypeFields(); 

            document.getElementById("admin-event-date").value = event.date;
            document.getElementById("admin-event-end-date").value = event.endDate || "";
            document.getElementById("admin-event-time").value = event.time;
            document.getElementById("admin-event-end-time").value = event.endTime || "";
            document.getElementById("admin-event-registration-start-date").value = event.registrationStartDate || "";
            document.getElementById("admin-event-registration-end-date").value = event.registrationEndDate || "";
            document.getElementById("admin-event-description").value = event.description;
            
            // Preencher o campo correto
            if (event.type === "passeio") {
                document.getElementById("admin-event-capacity").value = event.capacity || "";
            } else {
                document.getElementById("admin-event-categories").value = event.categories ? event.categories.join(", ") : "";
            }
            
            document.getElementById("admin-event-location").value = event.location;
            document.getElementById("admin-event-price").value = event.price || "";
            document.getElementById("admin-event-image").value = event.image || "";
            
            const form = document.getElementById("admin-event-form");
            const submitBtn = form.querySelector("button[type=\"submit\"]");
            submitBtn.textContent = "Atualizar Evento";
            submitBtn.onclick = function(e) {
                e.preventDefault();
                updateEvent(eventId);
            };
            
            form.scrollIntoView({ behavior: "smooth" });
        }
    });
}

// Ajustar updateEvent para salvar o campo correto
function updateEvent(eventId) {
    const title = document.getElementById("admin-event-title").value;
    const type = document.getElementById("admin-event-type").value;
    const date = document.getElementById("admin-event-date").value;
    const endDate = document.getElementById("admin-event-end-date").value;
    const time = document.getElementById("admin-event-time").value;
    const endTime = document.getElementById("admin-event-end-time").value;
    const registrationStartDate = document.getElementById("admin-event-registration-start-date").value;
    const registrationEndDate = document.getElementById("admin-event-registration-end-date").value;
    const description = document.getElementById("admin-event-description").value;
    const location = document.getElementById("admin-event-location").value;
    const price = document.getElementById("admin-event-price").value;
    const image = document.getElementById("admin-event-image").value;

    let categories = [];
    let capacity = null;

    if (type === "passeio") {
        capacity = document.getElementById("admin-event-capacity").value;
        if (!capacity) { // Validação para capacidade
            alert("Por favor, preencha a Capacidade Máxima para o passeio.");
            return;
        }
        capacity = parseInt(capacity);
    } else {
        const categoriesInput = document.getElementById("admin-event-categories").value;
        categories = categoriesInput.split(",").map(cat => cat.trim()).filter(cat => cat !== "");
    }
    
    const updates = {
        title: title,
        type: type,
        date: date,
        endDate: endDate,
        time: time,
        endTime: endTime,
        registrationStartDate: registrationStartDate,
        registrationEndDate: registrationEndDate,
        description: description,
        location: location || "A definir",
        price: price ? parseFloat(price) : null,
        image: image || null,
        updatedAt: new Date().toISOString(),
        updatedBy: firebase.auth().currentUser.email
    };

    // Adiciona categories OU capacity aos updates
    if (type === "passeio") {
        updates.capacity = capacity;
        // Se o tipo mudou de não-passeio para passeio, garantir que categories seja removido
        updates.categories = firebase.database.ServerValue.delete(); 
    } else {
        updates.categories = categories;
        // Se o tipo mudou de passeio para não-passeio, garantir que capacity e registrations sejam removidos
        updates.capacity = firebase.database.ServerValue.delete();
        updates.registrations = firebase.database.ServerValue.delete();
    }
    
    firebase.database().ref("events/" + eventId).update(updates)
        .then(() => {
            alert("Evento atualizado com sucesso!");
            resetEventForm();
            loadAdminEvents();
        })
        .catch((error) => {
            console.error("Erro ao atualizar evento:", error);
            alert("Erro ao atualizar evento. Tente novamente.");
        });
}

// Ajustar resetEventForm para chamar toggleEventTypeFields
function resetEventForm() {
    const form = document.getElementById("admin-event-form");
    form.reset();
    const submitBtn = form.querySelector("button[type=\"submit\"]");
    submitBtn.textContent = "Criar Evento";
    submitBtn.onclick = null;
    toggleEventTypeFields(); // Chama para resetar a visibilidade dos campos para o estado inicial
}

// Excluir passeio
function deleteTrip(tripId) {
    if (confirm("Tem certeza que deseja excluir este passeio?")) {
        // Remover do Firebase em ambas as coleções
        Promise.all([
            firebase.database().ref("trips/" + tripId).remove(),
            firebase.database().ref("events/" + tripId).remove()
        ])
            .then(() => {
                alert("Passeio excluído com sucesso!");
                loadAdminTrips();
            })
            .catch((error) => {
                console.error("Erro ao excluir passeio:", error);
                alert("Erro ao excluir passeio. Tente novamente.");
            });
    }
}

// Manipular anúncios de administração
function handleAdminAnnouncement(event) {
    event.preventDefault();
    
    const court = document.getElementById("admin-announcement-court").value;
    const type = document.getElementById("admin-announcement-type").value;
    const reason = document.getElementById("admin-announcement-reason").value;
    
    let courtAnnouncementText = ""; // Para exibição na quadra
    let courtAnnouncementClass = ""; // Para estilização na quadra

    if (type === "class-on") {
        courtAnnouncementText = "AULA CONFIRMADA ✅";
        courtAnnouncementClass = "class-on";
    } else { // class-off
        courtAnnouncementText = `AULA CANCELADA ❌ (${reason || "Motivo não especificado"})`;
        courtAnnouncementClass = "class-off";
    }

    const announcementData = {
        court: court, // Já está aqui, mas bom manter explícito
        type: type,
        reason: reason || null,
        timestamp: new Date().toISOString(),
        createdBy: firebase.auth().currentUser.email,
        // ADICIONE ESTAS DUAS LINHAS:
        displayMessage: courtAnnouncementText,
        displayClass: courtAnnouncementClass
    };
    
    firebase.database().ref("announcements/" + court).set(announcementData)
        .then(() => {
            alert("Anúncio publicado com sucesso!");
            document.getElementById("admin-announcement-form").reset();
            toggleAdminReasonField();
            // Chame loadCourtAnnouncements() para atualizar a interface do usuário
            // no index.html. Esta função está no script.js
            loadCourtAnnouncements(); 
        })
        .catch((error) => {
            console.error("Erro ao publicar anúncio:", error);
            alert("Erro ao publicar anúncio. Tente novamente.");
        });
}

// Toggle do campo de motivo no formulário de administração
function toggleAdminReasonField() {
    const type = document.getElementById("admin-announcement-type").value;
    const reasonGroup = document.getElementById("admin-announcement-reason-group");
    
    if (type === "class-off") {
        reasonGroup.style.display = "block";
        document.getElementById("admin-announcement-reason").required = true;
    } else {
        reasonGroup.style.display = "none";
        document.getElementById("admin-announcement-reason").required = false;
        document.getElementById("admin-announcement-reason").value = "";
    }
}