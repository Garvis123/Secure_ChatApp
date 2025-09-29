import express from "express";
import http from "http";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import { Server } from "socket.io";
import connectDB from "./config/database.js";
import authRoutes from "./routes/auth.js";
import chatRoutes from "./routes/chat.js";
import fileRoutes from "./routes/file.js";
import encryptionRoutes from "./routes/encryption.js";
import initSocket from "./config/socket.js";

dotenv.config();
const app = express();
const server = http.createServer(app);

// DB Connection
connectDB();

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/file", fileRoutes);
app.use("/api/encryption", encryptionRoutes);

// Socket.io
const io = new Server(server, { cors: { origin: "*" } });
initSocket(io);

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
