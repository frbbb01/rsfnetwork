const crypto = require("crypto");

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const VERIFIED_ROLE_ID = process.env.DISCORD_VERIFIED_ROLE_ID;
const SESSION_SECRET = process.env.SESSION_SECRET;

const REDIRECT_URI = "https://networkrsf.vercel.app/callback";

function createSession(data) {
  const payload = Buffer.from(
    JSON.stringify({
      ...data,
      iat: Date.now()
    })
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

module.exports = async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send("Missing Discord authorization code.");
    }

    const tokenResponse = await fetch(
      "https://discord.com/api/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: "authorization_code",
          code,
          redirect_uri: REDIRECT_URI
        })
      }
    );

    if (!tokenResponse.ok) {
      return res.status(401).send("Discord authorization failed.");
    }

    const tokenData = await tokenResponse.json();

    const userResponse = await fetch(
      "https://discord.com/api/users/@me",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`
        }
      }
    );

    if (!userResponse.ok) {
      return res.status(401).send("Could not retrieve Discord account.");
    }

    const user = await userResponse.json();

    const memberResponse = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${user.id}`,
      {
        headers: {
          Authorization: `Bot ${BOT_TOKEN}`
        }
      }
    );

    let verified = false;
    let robloxUsername = null;

    if (memberResponse.ok) {
      const member = await memberResponse.json();

      verified = Array.isArray(member.roles) &&
        member.roles.includes(VERIFIED_ROLE_ID);

      if (verified) {
        robloxUsername = member.nick || null;
      }
    }

    const avatarUrl = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
      : `https://cdn.discordapp.com/embed/avatars/${Number(
          BigInt(user.id) % 5n
        )}.png`;

    const session = createSession({
      discordId: user.id,
      discordUsername: user.username,
      avatarUrl,
      verified,
      robloxUsername
    });

    res.setHeader(
      "Set-Cookie",
      `rsf_session=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`
    );

    return res.redirect(302, "/");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Authentication failed.");
  }
};
