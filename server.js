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
        let { roomId, playerName, password, isCreating } = data;
        roomId = String(roomId).trim();

        let room = rooms.get(roomId);
        if (!room) {
            if (!isCreating) {
                socket.emit('room_error', { message: 'ROOM NOT FOUND.\n\nPLEASE MAKE SURE THE HOST HAS CREATED THE ROOM FIRST.' });
                return;
            }
            room = {
                id: roomId,
                players: [],
                gameState: 'WAITING',
                password: password || '', // Store password for the room
                selectedMode: 'CLASSIC',
                targetScore: 160,
                petsAllowed: true,
                turn: 1, // Player 1 starts
                coins: [] // To sync board state
            };
            rooms.set(roomId, room);
        } else {
            // Check password if room has one
            if (room.password && room.password !== password) {
                if (!password) {
                    socket.emit('wrong_password', { message: 'PASSWORD_REQUIRED', roomId: roomId });
                } else {
                    socket.emit('wrong_password', { message: 'Incorrect room password!' });
                }
                return;
            }
        }

        if (room.players.length >= 4) {
            socket.emit('room_full', { message: 'Room is full! (Max 4 players)' });
            return;
        }

        // Handle Reconnections: Remove any existing player with the same name
        const existingPlayerIndex = room.players.findIndex(p => p.name === playerName);
        if (existingPlayerIndex !== -1) {
            room.players.splice(existingPlayerIndex, 1);
        }

        // Find DO NOT use .length+1! Find the first available index hole (1-4)
        let indices = room.players.map(p => p.index);
        let nextIndex = 1;
        for (let i = 1; i <= 4; i++) {
            if (!indices.includes(i)) {
                nextIndex = i;
                break;
            }
        }

        const player = {
            id: socket.id,
            name: playerName,
            team: nextIndex % 2 === 0 ? 2 : 1, // Odd = Team 1, Even = Team 2
            index: nextIndex
        };

        room.players.push(player);
        // Keep players sorted by index for UI consistency
        room.players.sort((a, b) => a.index - b.index);
        socket.join(roomId);

        console.log(`${playerName} joined room ${roomId} (Pass: ${room.password ? 'YES' : 'NO'})`);

        // Notify all players in the room
        io.to(roomId).emit('player_joined', {
            players: room.players,
            roomState: room.gameState,
            roomId: roomId,
            password: room.password || '',
            hasPassword: !!room.password,
            selectedMode: room.selectedMode || 'CLASSIC',
            petsAllowed: room.petsAllowed !== false,
            targetScore: room.targetScore || 160,
            currentTurn: room.turn,
            coins: room.coins || []
        });
    });

    socket.on('player_ready', (data) => {
        const { roomId } = data;
        const room = rooms.get(roomId);
        if (!room) return;

        // Security: Only the host (Player 0) can start the game
        if (room.players.length > 0 && room.players[0].id !== socket.id) {
            socket.emit('room_error', { message: 'ONLY THE HOST CAN START THE GAME!' });
            return;
        }

        if (room.players.length < 2) {
            socket.emit('room_error', { message: 'WAIT FOR AT LEAST ONE OPPONENT TO JOIN!' });
            return;
        }

        console.log(`Starting game in room: ${roomId}`);
        room.gameState = 'PLAYING';
        room.turn = 1;
        io.to(roomId).emit('game_start', { room });
    });

    socket.on('send_shot', (data) => {
        const { roomId, strikerData } = data;
        // Broadcast the shot to other players in the room
        socket.to(roomId).emit('receive_shot', strikerData);
    });

    socket.on('chess_move', (data) => {
        const { roomId, move } = data;
        // Broadcast chess move to the opponent
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

    // Real-Time Chess Betting Sync
    socket.on('bet_request', (data) => {
        const { roomId, amount } = data;
        socket.to(roomId).emit('bet_requested_by_friend', { amount });
    });

    socket.on('bet_response', (data) => {
        const { roomId, accepted, amount } = data;
        socket.to(roomId).emit('bet_response_received', { accepted, amount });
    });

    socket.on('bet_split_executed', (data) => {
        const { roomId, amount } = data;
        socket.to(roomId).emit('bet_split_sync', { amount });
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
