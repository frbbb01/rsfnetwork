import crypto from "node:crypto";

const GUILD_ID =
  process.env.DISCORD_GUILD_ID ||
  "1554213083096809603";

const VERIFIED_ROLE_ID =
  process.env.DISCORD_VERIFIED_ROLE_ID ||
  "1554218963045589073";

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const cookies = {};

  for (const part of header.split(";")) {
    const index = part.indexOf("=");

    if (index === -1) {
      continue;
    }

    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    cookies[name] = decodeURIComponent(value);
  }

  return cookies;
}

function verifySession(session) {
  if (!session) {
    return null;
  }

  const parts = session.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const [encoded, signature] = parts;

  const expectedSignature =
    crypto
      .createHmac(
        "sha256",
        process.env.SESSION_SECRET
      )
      .update(encoded)
      .digest("base64url");

  const aa = Buffer.from(signature);
  const bb = Buffer.from(expectedSignature);

  if (
    aa.length !== bb.length ||
    !crypto.timingSafeEqual(aa, bb)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(
        encoded,
        "base64url"
      ).toString("utf8")
    );

    if (!payload.id) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

async function discordFetch(url) {
  const response = await fetch(url, {
    headers: {
      Authorization:
        `Bot ${process.env.DISCORD_BOT_TOKEN}`
    }
  });

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return {
    response,
    data
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res
      .status(405)
      .json({
        error: "Method Not Allowed"
      });
  }

  res.setHeader(
    "Cache-Control",
    "no-store"
  );

  if (
    !process.env.SESSION_SECRET ||
    !process.env.DISCORD_BOT_TOKEN
  ) {
    return res
      .status(500)
      .json({
        error: "Server configuration error."
      });
  }

  const cookies = parseCookies(req);

  const session =
    verifySession(
      cookies.rsf_session
    );

  if (!session) {
    return res.json({
      authenticated: false
    });
  }

  try {
    const userResult =
      await discordFetch(
        `https://discord.com/api/v10/users/${session.id}`
      );

    if (!userResult.response.ok) {
      if (
        userResult.response.status === 404
      ) {
        return res.json({
          authenticated: false
        });
      }

      throw new Error(
        `Discord user lookup failed: ${userResult.response.status}`
      );
    }

    const user = userResult.data;

    const memberResult =
      await discordFetch(
        `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${session.id}`
      );

    let verified = false;
    let robloxUsername = null;

    if (
      memberResult.response.ok
    ) {
      const member =
        memberResult.data;

      verified =
        Array.isArray(member.roles) &&
        member.roles.includes(
          VERIFIED_ROLE_ID
        );

      if (verified) {
        robloxUsername =
          member.nick || null;
      }
    } else if (
      memberResult.response.status !== 404
    ) {
      throw new Error(
        `Discord guild lookup failed: ${memberResult.response.status}`
      );
    }

    let avatarUrl;

    if (user.avatar) {
      avatarUrl =
        `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
    } else {
      const discriminator =
        Number(user.discriminator || 0);

      avatarUrl =
        `https://cdn.discordapp.com/embed/avatars/${discriminator % 5}.png`;
    }

    return res.json({
      authenticated: true,
      discordId: user.id,
      discordUsername:
        user.global_name ||
        user.username,
      avatarUrl,
      verified,
      robloxUsername
    });

  } catch (error) {
    console.error(
      "Authentication check failed:",
      error
    );

    return res
      .status(503)
      .json({
        error:
          "Unable to verify Discord account."
      });
  }
}
