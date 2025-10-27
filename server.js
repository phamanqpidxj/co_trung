const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from the root directory
app.use(express.static(__dirname));

const players = {};
const mapFilePath = 'map.json';
let mapLayout = {
    objects: [],
    terrainColor: '#8fbc8f' // Default DarkSeaGreen color
};

// Load map from file on server start
fs.readFile(mapFilePath, 'utf8', (err, data) => {
    if (err) {
        if (err.code === 'ENOENT') {
            fs.writeFile(mapFilePath, JSON.stringify(mapLayout, null, 2), (err) => {
                if (err) console.error('Failed to create map file:', err);
                else console.log('Map file created with default layout.');
            });
        } else {
            console.error('Error reading map file:', err);
        }
    } else {
        try {
            mapLayout = JSON.parse(data);
            console.log('Map layout loaded successfully.');
        } catch (parseErr) {
            console.error('Error parsing map file:', parseErr);
        }
    }
});

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    socket.emit('load map', mapLayout);

    socket.on('new player', (playerData) => {
        players[socket.id] = playerData;
    });

    socket.on('move', (position) => {
        if (players[socket.id]) {
            players[socket.id].x = position.x;
            players[socket.id].y = position.y;
        }
    });

    socket.on('chat message', (message) => {
        if (players[socket.id]) {
            io.emit('chat message', {
                id: socket.id,
                name: players[socket.id].name,
                message: message
            });
        }
    });

    socket.on('save map', (newMapLayout) => {
        mapLayout = newMapLayout;
        fs.writeFile(mapFilePath, JSON.stringify(mapLayout, null, 2), (err) => {
            if (err) console.error('Failed to save map file:', err);
            else console.log('Map layout saved successfully.');
        });
        io.emit('load map', mapLayout);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        delete players[socket.id];
        io.emit('player disconnected', socket.id);
    });
});

setInterval(() => {
    io.emit('update players', players);
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
