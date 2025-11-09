import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import connection from "./src/config/db/connection.config.js";
import callHandler from "./src/controllers/CallController.js";
import router from "./src/routes/routes.js";
import callRoutes from "./src/routes/Call.routes.js";

dotenv.config();

const app = express();
app.use(express.json());

// ✅ Dynamic CORS setup
const allowedOrigins = [
  "http://localhost:5173",
  "https://letsconnect-online.netlify.app",
  "*",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ✅ MongoDB connection
const connectDB = async () => {
  try {
    await connection();
    console.log("✅ MongoDB connected successfully");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
  }
};

// ✅ Health check
app.get("/", (req, res) => {
  res.send("🚀 Backend + Socket.IO + MongoDB running successfully");
});

// ✅ Normal REST routes
app.use("/api", router);

// ✅ Global state maps
const rooms = new Map();
const userSocketMap = new Map();

// ✅ Socket setup
const attachSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("🔌 Socket connected:", socket.id);

    // ✅ Register user with socket
    socket.on("register-user", ({ userId }) => {
      userSocketMap.set(userId, socket.id);
      socket.data.userId = userId;
      console.log(`✅ User ${userId} registered with socket ${socket.id}`);
    });

    // ✅ Join room (for calls)
    socket.on("join", ({ roomId, userId }) => {
      console.log(`📞 ${userId || "Unknown"} joined room ${roomId}`);
      socket.join(roomId);

      if (!rooms.has(roomId)) rooms.set(roomId, { clients: new Set() });
      rooms.get(roomId).clients.add(socket.id);

      // Notify others in room
      socket.to(roomId).emit("peer-joined", { socketId: socket.id, userId });

      const others = Array.from(rooms.get(roomId).clients).filter(
        (id) => id !== socket.id
      );
      socket.emit("joined", { roomId, participants: others });
    });

    // ✅ WebRTC signaling
    socket.on("signal", ({ roomId, to, data }) => {
      if (to) io.to(to).emit("signal", { from: socket.id, data });
      else socket.to(roomId).emit("signal", { from: socket.id, data });
    });

    // ✅ Leave call manually
    socket.on("leave", ({ roomId }) => {
      leaveRoom(socket, roomId);
    });

    // ✅ Handle hangup (for one-to-one calls)
    socket.on("hangup", ({ from }) => {
      for (const [uid, sid] of userSocketMap.entries()) {
        if (uid !== from) io.to(sid).emit("hangup");
      }
      console.log(`📴 ${from} ended call`);
    });

    // ✅ Handle disconnect safely
    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected:", socket.id);

      // Clean up user map
      for (const [uid, sid] of userSocketMap.entries()) {
        if (sid === socket.id) userSocketMap.delete(uid);
      }

      // Clean up rooms
      for (const [roomId, room] of rooms.entries()) {
        if (room.clients.has(socket.id)) leaveRoom(socket, roomId);
      }
    });

    // ✅ Helper to clean up rooms
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

  // ✅ Attach call controller endpoints (REST + Socket bridge)
  callHandler(io, app, userSocketMap);

  return io;
};

// ✅ Initialize server
const server = createServer(app);
const io = attachSocket(server);

// ✅ Attach REST call routes once
app.use("/api", callRoutes(io, userSocketMap));

// ✅ Server start
if (process.env.VERCEL) {
  console.log("⚡ Running in Vercel Serverless Mode");
  connectDB();
} else {
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, async () => {
    await connectDB();
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

export default app;
