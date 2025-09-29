import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  room: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
  content: { type: String },
  fileUrl: { type: String },
  encrypted: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model("Message", messageSchema);
