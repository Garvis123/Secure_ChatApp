import speakeasy from "speakeasy";

export const generateOTP = (secret) => {
  return speakeasy.totp({ secret, encoding: "base32" });
};
