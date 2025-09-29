import User from "../models/User.js";
import { generateToken } from "../config/jwt.js";
import speakeasy from "speakeasy";

export const register = async (req, res) => {
  try {
    const user = await User.create(req.body);
    res.json({ message: "User registered", user });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: "Invalid credentials" });

    // Generate 2FA secret if not exists
    if (!user.twoFactorSecret) {
      user.twoFactorSecret = speakeasy.generateSecret().base32;
      await user.save();
    }

    res.json({ message: "2FA required", userId: user._id });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const verify2FA = async (req, res) => {
  try {
    const { userId, token } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token
    });

    if (!verified) return res.status(401).json({ message: "Invalid 2FA token" });

    const jwtToken = generateToken(user);
    res.json({ token: jwtToken, user });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
