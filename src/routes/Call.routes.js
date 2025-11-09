// src/routes/call.routes.js
import express from "express";
import connectController from "../controllers/ConnectController.js";

export default function callRoutes(io, userSocketMap) {
  const router = express.Router();
  router.post("/connect", connectController(io, userSocketMap));
  return router;
}
