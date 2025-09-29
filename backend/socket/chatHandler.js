import Message from "../models/Message.js";

export default (io, socket) => {
  socket.on("send_message", async ({ roomId, userId, content }) => {
    const message = await Message.create({ sender: userId, room: roomId, content });
    io.to(roomId).emit("receive_message", message);
  });

  socket.on("join_room", (roomId) => {
    socket.join(roomId);
  });
};
