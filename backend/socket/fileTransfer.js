export default (io, socket) => {
  socket.on("file_upload", ({ roomId, file }) => {
    socket.to(roomId).emit("file_received", file);
  });
};
