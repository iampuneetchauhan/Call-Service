import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import connection from "./src/config/db/connection.config.js";
import callHandler from "./src/controllers/CallController.js";
import router from "./src/routes/routes.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:5173", // local dev
      "https://call-service-dipu.vercel.app",
      "*", // your frontend production domain
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.options("*", cors());

// ✅ Connect MongoDB
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

// ✅ API routes
app.use("/api", router);

// ✅ In-memory room store
const rooms = new Map();

// ✅ Join / Create room route
app.post("/join", (req, res) => {
  let { roomId } = req.body || {};
  if (!roomId) roomId = uuidv4();

  if (!rooms.has(roomId)) rooms.set(roomId, { clients: new Set() });
  res.json({ roomId });
});

// ✅ Function to attach socket.io
const attachSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE"],
    },
  });

  io.on("connection", (socket) => {
    console.log("🔌 Socket connected:", socket.id);

    socket.on("join", ({ roomId, userId }) => {
      console.log(`📞 Socket ${socket.id} joining room ${roomId}`);
      socket.join(roomId);

      if (!rooms.has(roomId)) rooms.set(roomId, { clients: new Set() });
      rooms.get(roomId).clients.add(socket.id);

      socket.to(roomId).emit("peer-joined", { socketId: socket.id, userId });

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

    socket.on("leave", ({ roomId }) => leaveRoom(socket, roomId));

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

  callHandler(io);
  return io;
};

// ✅ Create server only if not running in Vercel (serverless)
if (process.env.VERCEL) {
  console.log("⚡ Running in Vercel Serverless Mode");
  const server = createServer(app);
  attachSocket(server);
  connectDB();
  // export default app; // moved to top-level export below for module compatibility
} else {
  const server = createServer(app);
  attachSocket(server);

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, async () => {
    await connectDB();
    console.log(`🚀 Server is running on port ${PORT}`);
  });
}

export default app;
