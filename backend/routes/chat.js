import express from "express";
import { getMessages, sendMessage } from "../controllers/chatController.js";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

router.get("/:roomId", authMiddleware, getMessages);
router.post("/:roomId", authMiddleware, sendMessage);

export default router;
