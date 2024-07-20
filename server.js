// server.js

const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let players = {};
let zombies = [];

wss.on('connection', (ws) => {
    const id = generateId();
    players[id] = { ws, position: { x: 0, y: 0, z: 0 } };

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

function broadcast(message) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

server.listen(8080, () => {
    console.log('Server started on port 8080');
});

app.use(express.static('public'));
