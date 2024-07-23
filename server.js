// Importer les modules nécessaires
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

// Créer une instance d'Express et un serveur HTTP
const app = express();
const server = http.createServer(app);

// Créer une instance du serveur WebSocket
const wss = new WebSocket.Server({ server });

// Stockage des joueurs et des zombies
let players = {};
let zombies = [];

// Fonction pour diffuser un message à tous les clients connectés
function broadcast(message) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Générer un identifiant unique pour chaque joueur
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// Gérer les connexions WebSocket
wss.on('connection', (ws) => {
    const id = generateId();
    players[id] = { ws, position: { x: 0, y: 0, z: 0 } };

    // Envoyer la liste des joueurs aux nouveaux clients
    ws.send(JSON.stringify({ type: 'updatePlayers', players }));

    ws.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.type === 'updatePosition') {
            players[id].position = data.position;
            broadcast(JSON.stringify({ type: 'updatePlayers', players }));
        } else if (data.type === 'spawnZombie') {
            zombies.push(data.position);
            broadcast(JSON.stringify({ type: 'spawnZombie', position: data.position }));
        } else if (data.type === 'shoot') {
            broadcast(JSON.stringify({ type: 'shoot', position: data.position, direction: data.direction }));
        }
    });

    ws.on('close', () => {
        delete players[id];
        broadcast(JSON.stringify({ type: 'updatePlayers', players }));
    });
});

// Configurer Express pour servir les fichiers statiques
app.use(express.static(path.join(__dirname, './public')));

// Démarrer le serveur sur le port 8080
server.listen(8080, () => {
    console.log('Server started on port 8080');
});
