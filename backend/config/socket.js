import chatHandler from "../socket/chatHandler.js";
import keyExchange from "../socket/keyExchange.js";
import fileTransfer from "../socket/fileTransfer.js";

const initSocket = (io) => {
  io.on("connection", (socket) => {
    console.log(`🔌 User connected: ${socket.id}`);
    chatHandler(io, socket);
    keyExchange(io, socket);
    fileTransfer(io, socket);

    socket.on("disconnect", () => {
      console.log(`❌ User disconnected: ${socket.id}`);
    });
  });
};

export default initSocket;
