const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3001;

// Room and Game State Management
const rooms = new Map();

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('join_room', (data) => {
        const { roomId, playerName, password, isCreating } = data;

        let room = rooms.get(roomId);
        if (!room) {
            if (!isCreating) {
                socket.emit('room_error', { message: `THE ROOM ${roomId} WAS NOT FOUND CURRENTLY!` });
                return;
            }
            room = {
                id: roomId,
                players: [],
                gameState: 'WAITING',
                password: password || '',
                selectedMode: 'CLASSIC',
                targetScore: 160,
                petsAllowed: true,
                turn: 1,
                coins: []
            };
            rooms.set(roomId, room);
            console.log(`Room ${roomId} created by ${playerName}`);
        } else if (room.password && room.password !== password) {
            socket.emit('wrong_password', { message: 'Incorrect room password!' });
            return;
        }

        // --- ROOM MANAGEMENT ---
        // If a player with the same name exists on a DIFFERENT socket, create a unique name
        let finalName = playerName;
        const nameCollision = room.players.some(p => p.name === finalName && p.id !== socket.id);
        if (nameCollision) {
            finalName = `${playerName}_${Math.floor(100 + Math.random() * 899)}`;
        }

        // Cleanup: Remove any existing player with the SAME name to prevent ghost duplicates
        const oldIndex = room.players.findIndex(p => p.name === playerName);
        if (oldIndex !== -1) {
            console.log(`Cleaning up old session for ${playerName}`);
            room.players.splice(oldIndex, 1);
        }

        const player = {
            id: socket.id,
            name: finalName,
            team: room.players.length % 2 === 0 ? 1 : 2,
            index: room.players.length + 1
        };

        if (isCreating) {
            room.players.unshift(player);
            console.log(`Host ${finalName} JOINED as index 0. Socket ID: ${socket.id}`);
        } else {
            room.players.push(player);
            console.log(`Participant ${finalName} JOINED. Socket ID: ${socket.id}`);
        }

        socket.join(roomId);
        io.to(roomId).emit('player_joined', {
            players: room.players,
            roomState: room.gameState,
            roomId: roomId,
            hasPassword: !!room.password
        });
    });

    socket.on('player_ready', (data) => {
        const { roomId } = data;
        const room = rooms.get(roomId);
        
        if (!room) {
            socket.emit('room_error', { message: 'ARENA TIMED OUT. PLEASE RECREATE.' });
            return;
        }

        // Security: Only the host (index 0) can start
        if (room.players.length > 0 && room.players[0].id !== socket.id) {
            socket.emit('room_error', { message: 'WAIT FOR OPERATIVE-ONE TO INITIATE.' });
            return;
        }

        if (room.players.length < 2) {
            socket.emit('room_error', { message: 'MINIMUM 2 OPERATIVES REQUIRED TO START.' });
            return;
        }

        console.log(`Match starting in room ${roomId}`);
        room.gameState = 'PLAYING';
        io.to(roomId).emit('game_start', { room });
    });

    socket.on('send_shot', (data) => {
        const { roomId, strikerData } = data;
        socket.to(roomId).emit('receive_shot', strikerData);
    });

    socket.on('chess_move', (data) => {
        const { roomId, move } = data;
        socket.to(roomId).emit('chess_move_received', move);
    });

    socket.on('sync_striker_set', (data) => {
        const { roomId, pos } = data;
        socket.to(roomId).emit('update_striker_set', pos);
    });

    socket.on('sync_coins', (data) => {
        const { roomId, coinsData } = data;
        const room = rooms.get(roomId);
        if (room) {
            room.coins = coinsData; // Save state for new joiners
        }
        // Sync coin positions across all clients
        socket.to(roomId).emit('update_coins', coinsData);
    });

    socket.on('next_turn', (data) => {
        const { roomId, nextPlayerIndex } = data;
        const room = rooms.get(roomId);
        if (room) {
            // Prevent duplicate turn emissions within 200ms
            const now = Date.now();
            if (room.lastTurnTime && now - room.lastTurnTime < 200) return;
            room.lastTurnTime = now;
            
            room.turn = nextPlayerIndex;
            io.to(roomId).emit('turn_changed', { turn: room.turn });
        }
    });

    socket.on('leave_room', (data) => {
        const { roomId } = data;
        const room = rooms.get(roomId);
        if (room) {
            const index = room.players.findIndex(p => p.id === socket.id);
            if (index !== -1) {
                const leaver = room.players.splice(index, 1)[0];
                socket.leave(roomId);
                io.to(roomId).emit('player_left', { leaver, players: room.players });

                if (room.players.length === 0) {
                    rooms.delete(roomId);
                }
            }
        }
    });

    socket.on('update_password', (data) => {
        const { roomId, password } = data;
        const room = rooms.get(roomId);
        if (room) {
            // Security Check: Only the host can update password
            if (room.players.length > 0 && room.players[0].id !== socket.id) return;
            
            room.password = password;
            io.to(roomId).emit('room_password_updated', { password: password });
        }
    });

    socket.on('update_lobby_settings', (data) => {
        const { roomId, settings } = data;
        const room = rooms.get(roomId);
        if (room) {
            // Security Check: Only the host can update lobby settings
            if (room.players.length > 0 && room.players[0].id !== socket.id) return;
            
            if (settings.selectedMode !== undefined) room.selectedMode = settings.selectedMode;
            if (settings.petsAllowed !== undefined) room.petsAllowed = settings.petsAllowed;
            if (settings.targetScore !== undefined) room.targetScore = settings.targetScore;
            if (settings.infectionTime !== undefined) room.infectionTime = settings.infectionTime;

            io.to(roomId).emit('update_lobby_settings', settings);
        }
    });

    socket.on('sync_timer', (data) => {
        const { roomId, timeLeft } = data;
        io.to(roomId).emit('update_timer', { timeLeft });
    });

    socket.on('ping_local', (callback) => {
        if (typeof callback === 'function') callback();
    });

    socket.on('sync_ping', (data) => {
        const { roomId, ping } = data;
        io.to(roomId).emit('update_player_ping', { playerId: socket.id, ping: ping });
    });

    socket.on('send_emote', (data) => {
        const { roomId, emote, playerName } = data;
        io.to(roomId).emit('receive_emote', { emote, playerName });
    });

    socket.on('send_message', (data) => {
        const { roomId, message, playerName } = data;
        // Broadcast to everyone else (Optimistic UI handled by sender)
        socket.broadcast.to(roomId).emit('receive_message', { 
            message, 
            playerName, 
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        });
    });

    socket.on('add_bot', (data) => {
        const { roomId, botData } = data;
        const room = rooms.get(roomId);
        if (room && room.players.length < 4) {
            // Find first empty index
            let indices = room.players.map(p => p.index);
            let nextIndex = 1;
            for (let i = 1; i <= 4; i++) {
                if (!indices.includes(i)) {
                    nextIndex = i;
                    break;
                }
            }

            const bot = {
                id: `bot-${Date.now()}-${nextIndex}`,
                name: botData.name || `BOT ${nextIndex}`,
                team: nextIndex % 2 === 0 ? 2 : 1,
                index: nextIndex,
                isAI: true,
                avatar: botData.avatar || '🤖'
            };
            room.players.push(bot);
            // Sort by index
            room.players.sort((a, b) => a.index - b.index);

            io.to(roomId).emit('player_joined', {
                players: room.players,
                roomState: room.gameState,
                roomId: roomId,
                hasPassword: !!room.password,
                selectedMode: room.selectedMode || 'CLASSIC',
                petsAllowed: room.petsAllowed !== false,
                targetScore: room.targetScore || 160
            });
        }
    });

    socket.on('kick_player', (data) => {
        const { roomId, playerIndex } = data;
        const room = rooms.get(roomId);
        if (room) {
            const index = room.players.findIndex(p => p.index === playerIndex + 1);
            if (index !== -1) {
                const leaver = room.players.splice(index, 1)[0];
                io.to(roomId).emit('player_left', { leaver, players: room.players });

                // If it was a real player, we might need to notify them specifically (though they usually initiate departure)
                if (leaver.id.startsWith('bot-')) {
                    // It was just a bot, no special notification needed
                }
            }
        }
    });

    socket.on('close_room', (data) => {
        const { roomId } = data;
        const room = rooms.get(roomId);
        if (room) {
            // Security: Only the host can terminate the session
            if (room.players.length > 0 && room.players[0].id === socket.id) {
                io.to(roomId).emit('room_closed');
                rooms.delete(roomId);
            }
        }
    });

    socket.on('request_record', (data) => {
        const { roomId } = data;
        socket.to(roomId).emit('record_requested_by_host');
    });

    socket.on('accept_record', (data) => {
        const { roomId } = data;
        socket.to(roomId).emit('record_accepted_by_friend');
    });

    socket.on('decline_record', (data) => {
        const { roomId } = data;
        socket.to(roomId).emit('record_declined_by_friend');
    });

    // High-Fidelity Voice Link Signaling (WebRTC)
    socket.on('webrtc_signal', (data) => {
        const { roomId, signal } = data;
        socket.to(roomId).emit('receive_signal', { signal, from: socket.id });
    });

    // Real-Time Speech-to-Text Synchronization
    socket.on('voice_transcription', (data) => {
        const { roomId, text, playerName } = data;
        socket.to(roomId).emit('receive_transcription', { text, playerName });
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        // Handle player leaving rooms
        rooms.forEach((room, roomId) => {
            const index = room.players.findIndex(p => p.id === socket.id);
            if (index !== -1) {
                const leaver = room.players.splice(index, 1)[0];
                io.to(roomId).emit('player_left', { leaver, players: room.players });

                if (room.players.length === 0) {
                    rooms.delete(roomId);
                }
            }
        });
    });
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
