document.getElementById('fetchDataButton').addEventListener('click', fetchAndDisplayStats);

// 🚨 IMPORTANTE: Reemplaza estos valores con tus credenciales.
const BASE_API_URL = "https://graphql-gateway.axieinfinity.com/graphql"; // Endpoint GraphQL
const API_KEY = ""; // <-- ¡Pon tu clave de API real aquí!

// --- FUNCIONES PRINCIPALES ---

async function fetchAndDisplayStats() {
    const playerId = document.getElementById('playerIdInput').value.trim();
    const statsContainer = document.getElementById('playerStats');

    // Limpiar y mostrar mensaje de carga
    statsContainer.innerHTML = '<p class="message">Cargando datos de la API...</p>';
    
    if (!playerId) {
        statsContainer.innerHTML = '<p class="error">🚨 Por favor, ingresa el ID del jugador (Ronin ID).</p>';
        return;
    }

    // 1. Convertir 'ronin:...' a '0x...'
    const roninAddress = playerId.startsWith('ronin:') ? playerId.replace('ronin:', '0x') : playerId;
    
    try {
        const response = await fetchPlayerBattleLog(roninAddress);
        
        // 2. Procesar los logs de batalla para estadísticas diarias
        const dailyStats = processBattleLogs(response.battles, roninAddress); 

        // 3. Mostrar los resultados
        displayResults(dailyStats, statsContainer);
        
    } catch (error) {
        console.error("Error al obtener datos:", error);
        statsContainer.innerHTML = `<p class="error">❌ Error: ${error.message}. Verifica el ID y tu clave API.</p>`;
    }
}

// --- LÓGICA DE CONEXIÓN A LA API (usando GraphQL como es común en Sky Mavis) ---

async function fetchPlayerBattleLog(roninAddress) {
    // La API de Origins es una API GraphQL, por lo que usamos un query
    const graphqlQuery = {
        operationName: "GetBattleLogs",
        query: `
            query GetBattleLogs($accountId: String!) {
                battles(accountId: $accountId, take: 50, skip: 0) {
                    battles {
                        winner
                        finishedAt
                        players {
                            id
                        }
                    }
                }
            }
        `,
        variables: {
            accountId: roninAddress
        }
    };

    const response = await fetch(BASE_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // ESTE ES EL ENCABEZADO DE AUTENTICACIÓN REQUERIDO:
            'X-API-Key': API_KEY, 
        },
        body: JSON.stringify(graphqlQuery)
    });

    if (!response.ok) {
        throw new Error(`Error de red o autenticación: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.errors) {
        throw new Error(`Error GraphQL: ${result.errors[0].message}`);
    }

    // Adaptado al formato de respuesta GraphQL
    return result.data; 
}

// --- LÓGICA DE PROCESAMIENTO DE DATOS ---

function processBattleLogs(battles, currentPlayerId) {
    const statsByDay = {};
    
    if (!battles || !battles.battles || battles.battles.length === 0) {
        return [];
    }
    
    // Iterar sobre todas las batallas obtenidas
    battles.battles.forEach(battle => {
        // Obtener la fecha de la batalla
        const date = new Date(battle.finishedAt * 1000); 
        const dateKey = date.toISOString().split('T')[0];
        
        if (!statsByDay[dateKey]) {
            statsByDay[dateKey] = {
                date: dateKey,
                totalGames: 0,
                wins: 0,
                losses: 0
            };
        }
        
        statsByDay[dateKey].totalGames++;

        // Determinar el ganador
        const winnerId = battle.winner; 
        
        if (winnerId === currentPlayerId) {
            statsByDay[dateKey].wins++;
        } else if (winnerId !== null) { 
            // Si hay ganador y NO es el jugador consultado, es una derrota.
            statsByDay[dateKey].losses++;
        }
        // Las batallas con winner === null se ignoran (empates/abandonos).
    });

    // Devolver un array ordenado por fecha
    return Object.values(statsByDay).sort((a, b) => b.date.localeCompare(a.date));
}

// --- LÓGICA DE PRESENTACIÓN DE RESULTADOS (Display) ---

function displayResults(dailyStats, container) {
    if (dailyStats.length === 0) {
         container.innerHTML = '<p class="message">⚠️ No se encontraron datos de batalla recientes para este jugador.</p>';
         return;
    }
    
    container.innerHTML = '<h2>Resumen de Batallas Diarias (Axie Origins)</h2>';

    dailyStats.forEach(day => {
        const card = document.createElement('div');
        card.className = 'stats-card';
        card.innerHTML = `
            <h3>📅 ${day.date}</h3>
            <p><strong>Partidas Jugadas:</strong> ${day.totalGames}</p>
            <p><strong>Total de Victorias:</strong> ${day.wins} 🎉</p>
            <p><strong>Total de Derrotas:</strong> ${day.losses} 🙁</p>
        `;
        container.appendChild(card);
    });

}
