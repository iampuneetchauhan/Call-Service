export default function callHandler(io) {
  const userSocketMap = new Map(); // userId -> socketId

  io.on("connection", (socket) => {
    console.log("🟢 Socket connected:", socket.id);

    // Register user
    socket.on("register-user", ({ userId }) => {
      userSocketMap.set(userId, socket.id);
      socket.data.userId = userId; // store for later use
      console.log(`✅ User ${userId} registered with socket ${socket.id}`);
    });

    // Caller initiates call
    socket.on("call-user", ({ from, to }) => {
      const receiverSocket = userSocketMap.get(to);
      if (receiverSocket) {
        io.to(receiverSocket).emit("incoming-call", { from });
        console.log(`📞 Incoming call from ${from} to ${to}`);
      } else {
        socket.emit("user-offline", { to });
      }
    });

    // Receiver accepts/rejects
    socket.on("call-response", ({ from, to, accepted }) => {
      const callerSocket = userSocketMap.get(from);
      if (callerSocket) {
        io.to(callerSocket).emit("call-response", { from: to, accepted });
      }
    });

    // WebRTC signaling
    socket.on("signal", ({ to, data }) => {
      const targetSocket = userSocketMap.get(to);
      if (targetSocket) {
        io.to(targetSocket).emit("signal", { from: socket.data.userId, data });
      }
    });

    // Hang up call
    socket.on("hangup", ({ from }) => {
      for (const [uid, sid] of userSocketMap.entries()) {
        if (uid !== from) io.to(sid).emit("hangup");
      }
      console.log(`📴 ${from} ended call`);
    });

    // Disconnect
    socket.on("disconnect", () => {
      for (const [uid, sid] of userSocketMap.entries()) {
        if (sid === socket.id) userSocketMap.delete(uid);
      }
      console.log("🔴 Socket disconnected:", socket.id);
    });
  });
}
