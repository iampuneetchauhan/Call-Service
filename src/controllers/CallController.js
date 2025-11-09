export default function callHandler(io, userSocketMap) {
  // Global map: userId -> socketId
  if (!(userSocketMap instanceof Map)) {
    console.error("❌ userSocketMap is not a Map:", typeof userSocketMap);
    return res.status(500).json({ error: "Internal socket mapping error" });
  }
  // ✅ Attach Socket.IO listeners
  io.on("connection", (socket) => {
    console.log("🟢 Socket connected:", socket.id);

    // ✅ Register user with socket
    socket.on("register-user", ({ userId }) => {
      userSocketMap.set(userId, socket.id);
      socket.data.userId = userId;
      console.log(`✅ User ${userId} registered with socket ${socket.id}`);
    });

    // ✅ Caller initiates call directly via socket
    socket.on("call-user", ({ from, to }) => {
      const receiverSocket = userSocketMap.get(to);
      if (receiverSocket) {
        io.to(receiverSocket).emit("incoming-call", { from });
        console.log(`📞 Incoming call from ${from} to ${to}`);
      } else {
        socket.emit("user-offline", { to });
      }
    });

    // ✅ Receiver accepts/rejects
    socket.on("call-response", ({ from, to, accepted }) => {
      const callerSocket = userSocketMap.get(from);
      if (callerSocket) {
        io.to(callerSocket).emit("call-response", { from: to, accepted });
        console.log(
          `📲 Call ${accepted ? "accepted" : "rejected"} by ${to} for ${from}`
        );
      }
    });

    // ✅ WebRTC signaling exchange
    socket.on("signal", ({ to, data }) => {
      const targetSocket = userSocketMap.get(to);
      if (targetSocket) {
        io.to(targetSocket).emit("signal", { from: socket.data.userId, data });
      }
    });

    // ✅ Hang up
    socket.on("hangup", ({ from }) => {
      for (const [uid, sid] of userSocketMap.entries()) {
        if (uid !== from) io.to(sid).emit("hangup");
      }
      console.log(`📴 ${from} ended call`);
    });

    // ✅ Handle disconnect
    socket.on("disconnect", () => {
      for (const [uid, sid] of userSocketMap.entries()) {
        if (sid === socket.id) userSocketMap.delete(uid);
      }
      console.log("🔴 Socket disconnected:", socket.id);
    });
  });
}
