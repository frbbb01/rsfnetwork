const crypto = require("crypto");

const SESSION_SECRET = process.env.SESSION_SECRET;

function verifySession(session) {
  if (!session) return null;

  const parts = session.split(".");

  if (parts.length !== 2) return null;

  const [payload, signature] = parts;

  const expectedSignature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("base64url");

  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);

  if (
    a.length !== b.length ||
    !crypto.timingSafeEqual(a, b)
  ) {
    return null;
  }

  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString()
    );

    if (
      !data.iat ||
      Date.now() - data.iat > 2592000000
    ) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

module.exports = async (req, res) => {
  const session = req.cookies?.rsf_session;

  const user = verifySession(session);

  if (!user) {
    return res.status(200).json({
      authenticated: false
    });
  }

  return res.status(200).json({
    authenticated: true,
    discordId: user.discordId,
    discordUsername: user.discordUsername,
    avatarUrl: user.avatarUrl,
    verified: user.verified,
    robloxUsername: user.robloxUsername
  });
};
