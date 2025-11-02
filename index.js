import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import connection from "./src/config/db/connection.config.js";
import callHandler from "./src/controllers/CallController.js"; // ✅ import your socket call handler

dotenv.config();

// --- App setup ---
const app = express();
app.use(express.json());
app.use(cors());

// --- HTTP + Socket.IO server setup ---
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// --- In-memory room storage ---
const rooms = new Map();

// --- REST API: create/join a room ---
app.post("/join", (req, res) => {
  let { roomId } = req.body || {};
  if (!roomId) roomId = uuidv4();

  if (!rooms.has(roomId)) rooms.set(roomId, { clients: new Set() });
  res.json({ roomId });
});

// --- Health Check ---
app.get("/", (req, res) => {
  res.send("🚀 Signaling + MongoDB + CallHandler server running successfully");
});

// --- Socket.IO Logic ---
io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  socket.on("join", ({ roomId, userId }) => {
    console.log(`📞 Socket ${socket.id} joining room ${roomId}`);
    socket.join(roomId);

    if (!rooms.has(roomId)) rooms.set(roomId, { clients: new Set() });
    rooms.get(roomId).clients.add(socket.id);

    // Notify other clients in the room
    socket.to(roomId).emit("peer-joined", { socketId: socket.id, userId });

    // Send current participants back to the joiner
    const others = Array.from(rooms.get(roomId).clients).filter(
      (id) => id !== socket.id
    );
    socket.emit("joined", { roomId, participants: others });
  });

  socket.on("signal", ({ roomId, to, data }) => {
    if (to) {
      io.to(to).emit("signal", { from: socket.id, data });
    } else {
      socket.to(roomId).emit("signal", { from: socket.id, data });
    }
  });

  socket.on("leave", ({ roomId }) => {
    leaveRoom(socket, roomId);
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
    for (const [roomId, room] of rooms.entries()) {
      if (room.clients.has(socket.id)) {
        leaveRoom(socket, roomId);
      }
    }
  });

  function leaveRoom(socket, roomId) {
    socket.leave(roomId);
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.clients.delete(socket.id);
      socket.to(roomId).emit("peer-left", { socketId: socket.id });
      if (room.clients.size === 0) rooms.delete(roomId);
    }
  }
});

// --- Use Call Handler ---
callHandler(io); // ✅ attaches user-to-user calling logic

const startServer = async () => {
  try {
    await connection(); // Connect to MongoDB first
    app.listen(process.env.PORT || 3000, () => {
      console.log("🚀 Server is running on port:", process.env.PORT || 3000);
    });
  } catch (e) {
    console.error("❌ Error in connecting with MongoDB:", e);
  }
};

startServer();
