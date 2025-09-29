export default (io, socket) => {
  socket.on("exchange_key", ({ roomId, key }) => {
    socket.to(roomId).emit("key_received", key);
  });
};
    