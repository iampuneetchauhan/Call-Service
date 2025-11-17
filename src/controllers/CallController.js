export default function callHandler(io, userSocketMap, socket) {
  socket.on("register-user", ({ userId }) => {
    userSocketMap.set(userId, socket.id);
    socket.data.userId = userId;
  });

  // Caller sends invite
  socket.on("call-user", ({ from, to, roomId }) => {
    const target = userSocketMap.get(to);
    if (target) {
      io.to(target).emit("incoming-call", { from, roomId });
    }
  });

  // Accept/Reject
  socket.on("call-response", ({ from, to, accepted, roomId }) => {
    const caller = userSocketMap.get(from);
    if (caller) {
      io.to(caller).emit("call-response", {
        accepted,
        from: to,
        roomId,
      });
    }
  });

  // hangup
  socket.on("hangup", ({ from, to }) => {
    const target = userSocketMap.get(to);
    if (target) io.to(target).emit("hangup", { from });
  });

  // disconnect remove user
  socket.on("disconnect", () => {
    for (const [k, v] of userSocketMap.entries()) {
      if (v === socket.id) userSocketMap.delete(k);
    }
  });
}
