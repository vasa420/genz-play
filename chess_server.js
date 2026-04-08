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

// Serve static files (chess game files)
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3002;

// Chess Room Management
const chessRooms = new Map();

io.on('connection', (socket) => {
    console.log(`Chess Player connected: ${socket.id}`);

    socket.on('chess_join_room', (data) => {
        const { roomId, playerName } = data;
        
        let room = chessRooms.get(roomId);
        if (!room) {
            room = {
                id: roomId,
                players: [],
                gameState: 'WAITING',
                board: null,
                turn: 'white',
                history: []
            };
            chessRooms.set(roomId, room);
        }

        if (room.players.length >= 2) {
            socket.emit('chess_room_full', { message: 'This arena is already full!' });
            return;
        }

        const player = {
            id: socket.id,
            name: playerName,
            color: room.players.length === 0 ? 'white' : 'black'
        };

        room.players.push(player);
        socket.join(roomId);

        console.log(`${playerName} joined Chess Room ${roomId} as ${player.color}`);

        io.to(roomId).emit('chess_player_joined', {
            players: room.players,
            roomState: room.gameState,
            roomId: roomId,
            assignedColor: player.color
        });

        if (room.players.length === 2 && room.gameState === 'WAITING') {
            room.gameState = 'PLAYING';
            io.to(roomId).emit('chess_game_start', { room });
        }
    });

    socket.on('chess_send_move', (data) => {
        const { roomId, move } = data;
        const room = chessRooms.get(roomId);
        if (room) {
            room.board = move.board;
            room.turn = move.nextTurn;
            room.history.push(move);
            // Broadcast move to opponent
            socket.to(roomId).emit('chess_receive_move', move);
        }
    });

    socket.on('chess_game_reset', (data) => {
        const { roomId } = data;
        const room = chessRooms.get(roomId);
        if (room) {
            room.gameState = 'WAITING';
            room.board = null;
            room.turn = 'white';
            room.history = [];
            io.to(roomId).emit('chess_game_reset_sync');
        }
    });

    socket.on('disconnect', () => {
        console.log(`Chess Player disconnected: ${socket.id}`);
        chessRooms.forEach((room, roomId) => {
            const index = room.players.findIndex(p => p.id === socket.id);
            if (index !== -1) {
                const leaver = room.players.splice(index, 1)[0];
                socket.leave(roomId);
                io.to(roomId).emit('chess_player_left', { leaver, players: room.players });

                if (room.players.length === 0) {
                    chessRooms.delete(roomId);
                }
            }
        });
    });
});

server.listen(PORT, () => {
    console.log(`Chess Arena Server running on http://localhost:${PORT}`);
});
