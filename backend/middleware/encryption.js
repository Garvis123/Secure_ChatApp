export default function encryptionMiddleware(req, res, next) {
  // For logging or validating encrypted payloads
  console.log("🔒 Encryption middleware active");
  next();
}
