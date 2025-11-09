// src/controllers/ConnectController.js
export default function connectController(io, userSocketMap) {
  return async function (req, res) {
    try {
      const { fromUserId, toUserId } = req.body;

      if (!fromUserId || !toUserId)
        return res
          .status(400)
          .json({ error: "Missing fromUserId or toUserId" });

      const fromSocket = userSocketMap.get(fromUserId);
      const toSocket = userSocketMap.get(toUserId);

      if (!toSocket)
        return res
          .status(404)
          .json({ message: "Receiver is offline or not connected" });

      io.to(toSocket).emit("incoming-call", { from: fromUserId });

      console.log(`📞 Call initiated from ${fromUserId} to ${toUserId}`);

      return res.json({ success: true, message: "Call request sent" });
    } catch (err) {
      console.error("❌ Connect API error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  };
}
