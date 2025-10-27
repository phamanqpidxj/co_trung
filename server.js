const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static(__dirname));

const players = {};
const zones = ['trung', 'bac', 'nam', 'dong', 'tay'];
const mapLayouts = {};

const zoneLayout = {
    'trung': { 'up': 'bac', 'down': 'nam', 'left': 'tay', 'right': 'dong' },
    'bac':   { 'down': 'trung' },
    'nam':   { 'up': 'trung' },
    'tay':   { 'right': 'trung' },
    'dong':  { 'left': 'trung' }
};


// Load all map files on server start synchronously
zones.forEach(zone => {
    const mapFilePath = path.join(__dirname, 'maps', `${zone}.json`);
    try {
        const data = fs.readFileSync(mapFilePath, 'utf8');
        mapLayouts[zone] = JSON.parse(data);
        console.log(`Map layout for ${zone} loaded successfully.`);
    } catch (err) {
        if (err.code === 'ENOENT') {
            try {
                const defaultLayout = { objects: [], terrainColor: '#8fbc8f' };
                fs.writeFileSync(mapFilePath, JSON.stringify(defaultLayout, null, 2));
                mapLayouts[zone] = defaultLayout;
                console.log(`Map file for ${zone} created with default layout.`);
            } catch (writeErr) {
                console.error(`Failed to create map file for ${zone}:`, writeErr);
            }
        } else {
            console.error(`Error loading or parsing map file for ${zone}:`, err);
        }
    }
});

function getPlayersInZone(zone) {
    return Object.values(players).filter(p => p.zone === zone);
}

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('new player', (playerData) => {
        const zone = 'trung'; // Default starting zone
        socket.join(zone);

        players[socket.id] = {
            ...playerData,
            id: socket.id,
            zone: zone
        };

        socket.emit('load map', { map: mapLayouts[zone], zone: zone });
        socket.emit('zone layout', zoneLayout);
        socket.emit('current players', getPlayersInZone(zone));

        socket.to(zone).emit('new player connected', players[socket.id]);
        io.in(zone).emit('update member list', getPlayersInZone(zone));
    });

    socket.on('change zone', (newZone) => {
        const player = players[socket.id];
        if (!player || !zones.includes(newZone)) return;

        const oldZone = player.zone;


        // Leave old zone and notify players
        socket.leave(oldZone);
        io.to(oldZone).emit('player disconnected', socket.id);

        // Update player's state for the new zone
        player.zone = newZone;
        player.x = 800; // Reset to center X
        player.y = 450; // Reset to center Y

        // Join new zone
        socket.join(newZone);

        // Send the new map and the full list of players in the new zone
        socket.emit('load map', { map: mapLayouts[newZone], zone: newZone });
        socket.emit('current players', getPlayersInZone(newZone));

        // Notify other players in the new zone that this player has connected
        socket.to(newZone).emit('new player connected', player);

        // Update member lists for all players in both old and new zones
        io.to(oldZone).emit('update member list', getPlayersInZone(oldZone));
        io.to(newZone).emit('update member list', getPlayersInZone(newZone));
    });


    socket.on('move', (position) => {
        if (players[socket.id]) {
            players[socket.id].x = position.x;
            players[socket.id].y = position.y;
            socket.to(players[socket.id].zone).emit('player moved', {
                id: socket.id,
                x: position.x,
                y: position.y
            });
        }
    });

    socket.on('chat message', (message) => {
        if (players[socket.id]) {
            io.in(players[socket.id].zone).emit('chat message', {
                id: socket.id,
                name: players[socket.id].name,
                message: message
            });
        }
    });

    socket.on('save map', (newMapLayout) => {
        const player = players[socket.id];
        if (player && (player.role === 'admin' || player.role === 'moderator')) {
            const zone = player.zone;
            mapLayouts[zone] = newMapLayout;
            const mapFilePath = path.join(__dirname, 'maps', `${zone}.json`);
            fs.writeFile(mapFilePath, JSON.stringify(mapLayouts[zone], null, 2), (err) => {
                if (err) console.error(`Failed to save map file for ${zone}:`, err);
                else console.log(`Map layout for ${zone} saved successfully.`);
            });
            io.in(zone).emit('load map', mapLayouts[zone]);
        }
    });

    socket.on('change role', (data) => {
        if (players[socket.id] && players[socket.id].role === 'admin') {
            const targetPlayer = players[data.targetId];
            if (targetPlayer) {
                targetPlayer.role = data.newRole;
                const zone = targetPlayer.zone;
                io.in(zone).emit('role changed', { playerId: data.targetId, newRole: data.newRole });
                io.in(zone).emit('update member list', getPlayersInZone(zone));
            }
        }
    });

    socket.on('delete object', (objectData) => {
         const player = players[socket.id];
        if (player && (player.role === 'admin' || player.role === 'moderator')) {
            const zone = player.zone;
            if (mapLayouts[zone].objects) {
                mapLayouts[zone].objects = mapLayouts[zone].objects.filter(obj => obj.src !== objectData.src);
                const mapFilePath = path.join(__dirname, 'maps', `${zone}.json`);
                fs.writeFile(mapFilePath, JSON.stringify(mapLayouts[zone], null, 2), (err) => {
                    if (err) console.error(`Failed to save map file for ${zone} after deletion:`, err);
                    else console.log(`Map layout for ${zone} saved after object deletion.`);
                });
                io.in(zone).emit('load map', mapLayouts[zone]);
            }
        }
    });

    socket.on('disconnect', () => {
        if (players[socket.id]) {
            const zone = players[socket.id].zone;
            console.log(`User ${socket.id} disconnected from ${zone}`);
            delete players[socket.id];
            io.in(zone).emit('player disconnected', socket.id);
            io.in(zone).emit('update member list', getPlayersInZone(zone));
        } else {
            console.log('An un-initialized user disconnected:', socket.id);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
