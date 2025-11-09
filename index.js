import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import connection from "./src/config/db/connection.config.js";
import callHandler from "./src/controllers/CallController.js";
import router from "./src/routes/routes.js";
import callRoutes from "./src/routes/Call.routes.js";

dotenv.config();

const app = express();
app.use(express.json());

// ✅ Proper dynamic CORS setup
const allowedOrigins = [
  "http://localhost:5173", // local dev
  "https://call-service-dipu.vercel.app", // deployed frontend
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ✅ Connect MongoDB
const connectDB = async () => {
  try {
    await connection();
    console.log("✅ MongoDB connected successfully");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
  }
};

// ✅ Health check route
app.get("/", (req, res) => {
  res.send("🚀 Backend + Socket.IO + MongoDB running successfully");
});

// ✅ Normal REST routes
app.use("/api", router);

// ✅ In-memory store for active rooms
const rooms = new Map();

// ✅ Socket.IO attachment
const attachSocket = (server, userSocketMap) => {
  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("🔌 Socket connected:", socket.id);

    // ✅ Join room
    socket.on("join", ({ roomId, userId }) => {
      console.log(`📞 ${userId || "Unknown"} joined room ${roomId}`);
      socket.join(roomId);

      if (!rooms.has(roomId)) rooms.set(roomId, { clients: new Set() });
      rooms.get(roomId).clients.add(socket.id);

      socket.to(roomId).emit("peer-joined", { socketId: socket.id, userId });

      const others = Array.from(rooms.get(roomId).clients).filter(
        (id) => id !== socket.id
      );
      socket.emit("joined", { roomId, participants: others });
    });

    // ✅ WebRTC signaling exchange
    socket.on("signal", ({ roomId, to, data }) => {
      if (to) {
        io.to(to).emit("signal", { from: socket.id, data });
      } else {
        socket.to(roomId).emit("signal", { from: socket.id, data });
      }
    });

    // ✅ Leave manually
    socket.on("leave", ({ roomId }) => leaveRoom(socket, roomId));

    // ✅ Disconnect cleanup
    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected:", socket.id);
      for (const [roomId, room] of rooms.entries()) {
        if (room.clients.has(socket.id)) leaveRoom(socket, roomId);
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

  // ✅ Attach call controller
  callHandler(io, app, userSocketMap);

  return io;
};

// ✅ Start logic (Local + Vercel both)
const userSocketMap = new Map();
const server = createServer(app);
const io = attachSocket(server, userSocketMap);

// ✅ REST call routes
app.use("/api", callRoutes(io, userSocketMap));

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
