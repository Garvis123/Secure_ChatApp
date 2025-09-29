import fs from "fs";
import path from "path";

export const uploadFile = async (req, res) => {
  res.json({ message: "File uploaded", file: req.file });
};

export const downloadFile = async (req, res) => {
  const filePath = path.join("uploads", req.params.id);
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File not found" });
  res.download(filePath);
};
