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

// =========================
//   CORS FIX
// =========================
const allowedOrigins = [
  "http://localhost:5173",
  "https://letsconnect-online.netlify.app",
  "*",
];

app.use(
  cors({
    origin: (origin, cb) =>
      !origin || allowedOrigins.includes(origin)
        ? cb(null, true)
        : cb(new Error("Blocked by CORS")),
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

// =========================
//   DB CONNECTION
// =========================
const connectDB = async () => {
  try {
    await connection();
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.log("❌ MongoDB ERROR:", err.message);
  }
};

app.get("/", (req, res) =>
  res.send("🚀 Backend + Socket.IO + MongoDB running successfully")
);

// Normal REST routes
app.use("/api", router);

// =========================
//   SOCKET.IO SETUP
// =========================
const rooms = new Map();
const userSocketMap = new Map();

const server = createServer(app);

// 1️⃣ FIRST create io
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  },
});

// 2️⃣ THEN pass io to handler
io.on("connection", (socket) => {
  console.log("🔌:", socket.id);

  // -----------------------
  // ROOM CREATION / JOINING
  // -----------------------
  socket.on("create-room", ({ roomId, userId }) => {
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.userId = userId;

    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    rooms.get(roomId).add(socket.id);

    console.log(`📞 Room created: ${roomId}`);
    socket.emit("room-created", { roomId });
  });

  socket.on("join-room", ({ roomId, userId }) => {
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.userId = userId;

    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    rooms.get(roomId).add(socket.id);

    socket.to(roomId).emit("peer-joined", {
      socketId: socket.id,
      userId,
    });

    socket.emit("joined", {
      participants: Array.from(rooms.get(roomId)).filter(
        (id) => id !== socket.id
      ),
    });

    console.log(`👤 ${userId} joined ${roomId}`);
  });

  // -----------------------
  // WEBRTC SIGNALING
  // -----------------------
  socket.on("signal", ({ to, data }) => {
    io.to(to).emit("signal", {
      from: socket.id,
      data,
    });
  });

  // -----------------------
  // CALL INVITE HANDLER
  // -----------------------
  callHandler(io, userSocketMap, socket);

  // -----------------------
  // DISCONNECT CLEANUP
  // -----------------------
  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;

    if (roomId && rooms.has(roomId)) {
      rooms.get(roomId).delete(socket.id);
      socket.to(roomId).emit("peer-left", { socketId: socket.id });

      if (rooms.get(roomId).size === 0) rooms.delete(roomId);
    }

    for (const [uid, sid] of userSocketMap.entries()) {
      if (sid === socket.id) userSocketMap.delete(uid);
    }

    console.log("❌:", socket.id);
  });
});

// REST callRoutes AFTER io exists
app.use("/api", callRoutes(io, userSocketMap));

// =========================
// START SERVER
// =========================
if (process.env.VERCEL) {
  connectDB();
} else {
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, async () => {
    await connectDB();
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

export default app;
