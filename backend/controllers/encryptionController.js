import Session from "../models/Session.js";

export const exchangeKeys = async (req, res) => {
  const { publicKey } = req.body;
  const session = await Session.findOneAndUpdate(
    { user: req.user.id },
    { publicKey },
    { upsert: true, new: true }
  );
  res.json({ message: "Key exchanged", session });
};
