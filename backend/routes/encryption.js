import express from "express";
import { exchangeKeys } from "../controllers/encryptionController.js";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

router.post("/exchange", authMiddleware, exchangeKeys);

export default router;
