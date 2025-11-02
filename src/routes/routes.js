import express from "express";
import { loginUser, registerUser } from "../controllers/AuthController";
const router = express.Router();

router.get("/users", verifyToken, getAllUsers);
router.post("/registerUser", registerUser);
router.post("/login", loginUser);
export default router;
