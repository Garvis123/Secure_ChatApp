import Message from "../models/Message.js";

export const getMessages = async (req, res) => {
  const messages = await Message.find({ room: req.params.roomId }).populate("sender");
  res.json(messages);
};

export const sendMessage = async (req, res) => {
  const message = await Message.create({
    sender: req.user.id,
    room: req.params.roomId,
    content: req.body.content
  });
  res.json(message);
};
