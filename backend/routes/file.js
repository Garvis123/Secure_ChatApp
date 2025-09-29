import express from "express";
import multer from "multer";
import { uploadFile, downloadFile } from "../controllers/fileController.js";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/upload", authMiddleware, upload.single("file"), uploadFile);
router.get("/download/:id", authMiddleware, downloadFile);

export default router;
