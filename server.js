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
    },
    transports: ['websocket', 'polling'],
    pingInterval: 10000,
    pingTimeout: 5000,
    perMessageDeflate: false,
    maxHttpBufferSize: 1e6
});

// Middleware to parse JSON payloads
app.use(express.json());

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

// Whitebox AI Structured Quiz Evaluation REST API Endpoint
app.post('/api/whitebox-ai/evaluate-quiz', async (req, res) => {
    try {
        const { question, options, apiKey } = req.body;
        if (!question || !options || !Array.isArray(options)) {
            return res.status(400).json({ error: "Missing required fields: 'question' (string) and 'options' (array)." });
        }

        const key = apiKey || process.env.GEMINI_API_KEY || process.env.WHITEBOX_API_KEY;

        const systemInstruction = `You are Whitebox AI, an unbiased, fact-checked educational quiz evaluator. 
CRITICAL RULES:
1. You MUST evaluate every option individually against verified real-world facts.
2. Do NOT default to Option A or Option D.
3. NEVER use generic boilerplate text like "Factually invalid for..." or "Satisfies all factual criteria". State real historical, scientific, or geographical facts in the reasoning for every choice.`;

        if (key && key.startsWith('AIzaSy')) {
            const responseSchema = {
                type: "OBJECT",
                properties: {
                    analysis_per_option: {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                option_letter: { type: "STRING" },
                                is_correct: { type: "BOOLEAN" },
                                reasoning: { type: "STRING" }
                            },
                            required: ["option_letter", "is_correct", "reasoning"]
                        }
                    },
                    correct_option_letter: { type: "STRING" },
                    correct_option_full: { type: "STRING" },
                    factual_explanation: { type: "STRING" }
                },
                required: ["analysis_per_option", "correct_option_letter", "correct_option_full", "factual_explanation"]
            };

            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
            const geminiRes = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_instruction: { parts: [{ text: systemInstruction }] },
                    contents: [{ parts: [{ text: `Question: ${question}\nOptions:\n${options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('\n')}` }] }],
                    generationConfig: {
                        temperature: 0.0,
                        response_mime_type: "application/json",
                        response_schema: responseSchema
                    }
                })
            });

            if (geminiRes.ok) {
                const data = await geminiRes.json();
                const jsonText = data.candidates[0].content.parts[0].text;
                return res.json(JSON.parse(jsonText));
            }
        }

        return res.json({
            status: "success",
            engine: "Whitebox AI Primary Engine",
            question: question,
            options_count: options.length,
            message: "Whitebox AI REST API active on server.js at /api/whitebox-ai/evaluate-quiz"
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Redirect root path to arcade_hub.html
app.get('/', (req, res) => {
    res.redirect('/arcade_hub.html');
});

const { exec } = require('child_process');

app.post('/api/set-system-volume', (req, res) => {
    if (process.platform === 'win32') {
        const scriptPath = path.join(__dirname, 'set_volume.ps1');
        exec(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing volume script: ${error.message}`);
                return res.status(500).json({ success: false, error: error.message });
            }
            console.log("System volume set to 60% successfully.");
            return res.json({ success: true });
        });
    } else {
        return res.status(400).json({ success: false, message: "Only Windows is supported." });
    }
});

const PORT = process.env.PORT || 3001;

// Room and Game State Management
const rooms = new Map();

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('hc_check_room', (data, callback) => {
        if (typeof callback !== 'function') return;
        const { roomId } = data || {};
        if (!roomId) {
            callback({ success: false, message: 'PLEASE ENTER A VALID ARENA ROOM CODE!' });
            return;
        }
        const room = rooms.get(roomId);
        if (!room) {
            callback({ success: false, message: `ROOM ID ${roomId} WAS NOT CREATED IN ANY SERVER!` });
            return;
        }
        if (room.players && room.players.length >= 2) {
            callback({ success: false, message: `ROOM ID ${roomId} IS ALREADY FULL (2/2 PLAYERS)!` });
            return;
        }
        if (room.gameState === 'PLAYING') {
            callback({ success: false, message: `MATCH IN ROOM ${roomId} IS ALREADY IN PROGRESS!` });
            return;
        }
        callback({ success: true });
    });

    socket.on('join_room', (data) => {
        const { roomId, playerName, password, isCreating } = data || {};
        if (!roomId) return;

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

        // If room had a pending cleanup timeout from brief disconnect, cancel it
        if (room.cleanupTimeout) {
            clearTimeout(room.cleanupTimeout);
            room.cleanupTimeout = null;
        }
        if (room.playingDisconnectTimeout) {
            clearTimeout(room.playingDisconnectTimeout);
            room.playingDisconnectTimeout = null;
        }

        // --- ROOM MANAGEMENT ---
        // Cleanup: Remove any existing player with the SAME name or socket ID to prevent ghost duplicates on reconnect
        const oldIndex = room.players.findIndex(p => p.name === playerName || p.id === socket.id);
        if (oldIndex !== -1) {
            console.log(`Cleaning up old session for ${playerName}`);
            room.players.splice(oldIndex, 1);
        }

        // If a player with the same name exists on a DIFFERENT socket, create a unique name
        let finalName = playerName || "Player";
        const nameCollision = room.players.some(p => p.name === finalName && p.id !== socket.id);
        if (nameCollision) {
            finalName = `${playerName}_${Math.floor(100 + Math.random() * 899)}`;
        }

        const player = {
            id: socket.id,
            name: finalName,
            team: room.players.length % 2 === 0 ? 1 : 2,
            index: room.players.length + 1
        };

        if (isCreating && room.players.length === 0) {
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

    socket.on('start_match', (data) => {
        const { roomId } = data;
        io.to(roomId).emit('match_started');
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
        const room = rooms.get(roomId);
        if (room) {
            if (!room.chessMoves) room.chessMoves = [];
            room.chessMoves.push(move);
            room.lastChessMove = move;
        }
        socket.to(roomId).emit('chess_move_received', move);
    });

    socket.on('request_chess_sync', (data) => {
        const { roomId } = data;
        const room = rooms.get(roomId);
        if (room && room.lastChessMove) {
            socket.emit('chess_sync_state', {
                lastMove: room.lastChessMove,
                movesCount: room.chessMoves ? room.chessMoves.length : 0
            });
        }
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

    socket.on('hc_toss_spin', (data) => {
        const { roomId, choice, outcome, hostName } = data;
        socket.broadcast.to(roomId).emit('hc_toss_spun', { choice, outcome, hostName });
    });

    socket.on('hc_toss_decision', (data) => {
        const { roomId, decision, winnerName } = data;
        socket.broadcast.to(roomId).emit('hc_toss_decided', { decision, winnerName });
    });

    socket.on('hc_match_move', (data) => {
        const { roomId, num, playerName, role } = data;
        socket.broadcast.to(roomId).emit('hc_match_moved', { num, playerName, role });
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
                
                // If match is PLAYING, preserve room state during page transition (grace period)
                if (room.gameState === 'PLAYING') {
                    if (!room.disconnectedPlayers) room.disconnectedPlayers = [];
                    room.disconnectedPlayers.push(leaver);
                    
                    if (!room.playingDisconnectTimeout) {
                        room.playingDisconnectTimeout = setTimeout(() => {
                            io.to(roomId).emit('player_left', { leaver, players: room.players });
                            room.playingDisconnectTimeout = null;
                            if (room.players.length === 0) {
                                rooms.delete(roomId);
                            }
                        }, 15000); // 15 seconds grace period for navigation to chess_play.html
                    }
                } else {
                    io.to(roomId).emit('player_left', { leaver, players: room.players });
                    if (room.players.length === 0) {
                        rooms.delete(roomId);
                    }
                }
            }
        });

        // Handle Escape Room disconnections
        handleEscapeRoomDisconnect(socket);
    });

    // --- LOGIC ESCAPE ROOM HANDLERS ---
    socket.on('er_create_room', (data) => {
        const { playerName } = data;
        if (!playerName || playerName.trim() === '') {
            socket.emit('er_error', { message: "Player name is required." });
            return;
        }

        let roomCode;
        do {
            roomCode = Math.floor(1000 + Math.random() * 9000).toString();
        } while (escapeRooms.has(roomCode));

        const room = {
            roomCode,
            hostId: socket.id,
            players: [{ id: socket.id, name: playerName.trim(), isHost: true }],
            gameStarted: false,
            currentPuzzle: 1,
            puzzle1Solved: false,
            puzzle2Solved: false,
            puzzle3Solved: false,
            timeRemaining: 300, // 5 minutes
            gameFinished: false,
            winner: false,
            timerInterval: null
        };

        escapeRooms.set(roomCode, room);
        socket.join(`er_${roomCode}`);
        
        console.log(`Escape Room ${roomCode} created by ${playerName}`);
        sendEscapeRoomUpdate(io, roomCode);
    });

    socket.on('er_join_room', (data) => {
        const { roomCode, playerName } = data;
        if (!roomCode || !playerName || playerName.trim() === '') {
            socket.emit('er_error', { message: "Room code and player name are required." });
            return;
        }

        const room = escapeRooms.get(roomCode);
        if (!room) {
            socket.emit('er_error', { message: "Room not found." });
            return;
        }

        if (room.gameStarted) {
            socket.emit('er_error', { message: "This game has already started." });
            return;
        }

        if (room.players.length >= 4) {
            socket.emit('er_error', { message: "Room is full. Maximum 4 players." });
            return;
        }

        room.players.push({ id: socket.id, name: playerName.trim(), isHost: false });
        socket.join(`er_${roomCode}`);

        console.log(`Player ${playerName} joined Escape Room ${roomCode}`);
        
        io.to(`er_${roomCode}`).emit('er_system_message', { text: `${playerName.trim()} has joined the room.` });
        sendEscapeRoomUpdate(io, roomCode);
    });

    socket.on('er_start_game', (data) => {
        const { roomCode } = data;
        const room = escapeRooms.get(roomCode);
        if (!room) {
            socket.emit('er_error', { message: "Room not found." });
            return;
        }

        if (room.hostId !== socket.id) {
            socket.emit('er_error', { message: "Only the host can start the game." });
            return;
        }

        if (room.players.length < 2) {
            socket.emit('er_error', { message: "At least 2 players are required." });
            return;
        }

        if (room.gameStarted) return;

        room.gameStarted = true;
        io.to(`er_${roomCode}`).emit('er_game_start_countdown');

        setTimeout(() => {
            if (!escapeRooms.has(roomCode)) return;
            
            io.to(`er_${roomCode}`).emit('er_game_started');
            
            room.timerInterval = setInterval(() => {
                const activeRoom = escapeRooms.get(roomCode);
                if (!activeRoom) {
                    clearInterval(room.timerInterval);
                    return;
                }

                if (activeRoom.gameFinished) {
                    clearInterval(activeRoom.timerInterval);
                    return;
                }

                activeRoom.timeRemaining--;
                
                if (activeRoom.timeRemaining <= 0) {
                    activeRoom.timeRemaining = 0;
                    activeRoom.gameFinished = true;
                    activeRoom.winner = false;
                    clearInterval(activeRoom.timerInterval);
                    
                    io.to(`er_${roomCode}`).emit('er_game_over', { reason: "time_up" });
                    sendEscapeRoomUpdate(io, roomCode);
                } else {
                    io.to(`er_${roomCode}`).emit('er_timer_tick', { timeRemaining: activeRoom.timeRemaining });
                }
            }, 1000);

            sendEscapeRoomUpdate(io, roomCode);
        }, 3000);
    });

    socket.on('er_submit_answer', (data) => {
        const { roomCode, puzzleNum, answer } = data;
        const room = escapeRooms.get(roomCode);
        if (!room || room.gameFinished || !room.gameStarted) return;

        const player = room.players.find(p => p.id === socket.id);
        const name = player ? player.name : "A player";

        let correct = false;
        const cleanAnswer = answer ? answer.trim().toLowerCase() : "";

        if (puzzleNum === 1 && room.currentPuzzle === 1) {
            correct = (cleanAnswer === "10");
        } else if (puzzleNum === 2 && room.currentPuzzle === 2) {
            correct = (cleanAnswer === "3");
        } else if (puzzleNum === 3 && room.currentPuzzle === 3) {
            correct = (cleanAnswer === "528");
        }

        if (correct) {
            if (puzzleNum === 1) {
                room.puzzle1Solved = true;
                room.currentPuzzle = 2;
                io.to(`er_${roomCode}`).emit('er_system_message', { text: `✓ ${name} solved Puzzle 1! Safe is unlocked.` });
                io.to(`er_${roomCode}`).emit('er_puzzle_solved', { puzzleNum: 1, nextPuzzle: 2 });
            } else if (puzzleNum === 2) {
                room.puzzle2Solved = true;
                room.currentPuzzle = 3;
                io.to(`er_${roomCode}`).emit('er_system_message', { text: `✓ ${name} solved Puzzle 2! Box is unlocked.` });
                io.to(`er_${roomCode}`).emit('er_puzzle_solved', { puzzleNum: 2, nextPuzzle: 3 });
            } else if (puzzleNum === 3) {
                room.puzzle3Solved = true;
                room.gameFinished = true;
                room.winner = true;
                if (room.timerInterval) clearInterval(room.timerInterval);
                io.to(`er_${roomCode}`).emit('er_system_message', { text: `🎉 ${name} unlocked the final door! ESCAPED!` });
                io.to(`er_${roomCode}`).emit('er_game_won', { timeRemaining: room.timeRemaining });
            }
            sendEscapeRoomUpdate(io, roomCode);
        } else {
            socket.emit('er_answer_result', { correct: false, message: "Incorrect answer. Try again." });
            socket.to(`er_${roomCode}`).emit('er_system_message', { text: `✕ ${name} submitted an incorrect answer.` });
        }
    });

    socket.on('er_leave_room', (data) => {
        const { roomCode } = data;
        handleEscapeRoomDisconnect(socket, roomCode);
    });
});

// --- LOGIC ESCAPE ROOM SERVER-SIDE CONFIG ---
const escapeRooms = new Map();

function sendEscapeRoomUpdate(io, roomCode) {
    const room = escapeRooms.get(roomCode);
    if (!room) return;
    io.to(`er_${roomCode}`).emit('er_room_updated', {
        roomCode: room.roomCode,
        hostId: room.hostId,
        players: room.players,
        gameStarted: room.gameStarted,
        currentPuzzle: room.currentPuzzle,
        puzzle1Solved: room.puzzle1Solved,
        puzzle2Solved: room.puzzle2Solved,
        puzzle3Solved: room.puzzle3Solved,
        timeRemaining: room.timeRemaining,
        gameFinished: room.gameFinished,
        winner: room.winner
    });
}

function handleEscapeRoomDisconnect(socket, specificRoomCode) {
    escapeRooms.forEach((room, roomCode) => {
        if (specificRoomCode && roomCode !== specificRoomCode) return;
        
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
            const player = room.players.splice(playerIndex, 1)[0];
            socket.leave(`er_${roomCode}`);
            console.log(`Player ${player.name} left Escape Room ${roomCode}`);

            if (room.players.length === 0) {
                if (room.timerInterval) clearInterval(room.timerInterval);
                escapeRooms.delete(roomCode);
                console.log(`Escape Room ${roomCode} destroyed (no players left)`);
            } else {
                if (player.isHost) {
                    room.hostId = room.players[0].id;
                    room.players[0].isHost = true;
                    io.to(`er_${roomCode}`).emit('er_system_message', { text: `Host left. ${room.players[0].name} is now the host.` });
                } else {
                    io.to(`er_${roomCode}`).emit('er_system_message', { text: `${player.name} has disconnected.` });
                }
                sendEscapeRoomUpdate(io, roomCode);
            }
        }
    });
}

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
