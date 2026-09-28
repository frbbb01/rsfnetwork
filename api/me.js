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

  if (!process.env.SESSION_SECRET) {
    return null;
  }

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

  const text =
    await response.text();

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

async function getRobloxAvatar(username) {
  if (!username) {
    return null;
  }

  try {
    const userResponse = await fetch(
      "https://users.roblox.com/v1/usernames/users",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          usernames: [username],
          excludeBannedUsers: false
        })
      }
    );

    if (!userResponse.ok) {
      return null;
    }

    const userData =
      await userResponse.json();

    if (
      !Array.isArray(userData.data) ||
      !userData.data.length ||
      !userData.data[0].id
    ) {
      return null;
    }

    const robloxUserId =
      userData.data[0].id;

    const avatarResponse =
      await fetch(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxUserId}&size=150x150&format=Png&isCircular=false`
      );

    if (!avatarResponse.ok) {
      return null;
    }

    const avatarData =
      await avatarResponse.json();

    if (
      !Array.isArray(avatarData.data) ||
      !avatarData.data.length ||
      !avatarData.data[0].imageUrl
    ) {
      return null;
    }

    return avatarData.data[0].imageUrl;
  } catch {
    return null;
  }
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
    let robloxAvatarUrl = null;

    if (memberResult.response.ok) {
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

        if (robloxUsername) {
          robloxAvatarUrl =
            await getRobloxAvatar(
              robloxUsername
            );
        }
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
      robloxUsername,
      robloxAvatarUrl
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
