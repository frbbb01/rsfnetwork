import crypto from "node:crypto";

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
    return res
      .status(401)
      .json({
        error: "Not authenticated."
      });
  }

  try {
    const GUILD_ID =
      process.env.DISCORD_GUILD_ID ||
      "1554213083096809603";

    const VERIFIED_ROLE_ID =
      process.env.DISCORD_VERIFIED_ROLE_ID ||
      "1554218963045589073";

    const memberResult =
      await discordFetch(
        `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${session.id}`
      );

    if (!memberResult.response.ok) {
      return res
        .status(403)
        .json({
          error: "Not a verified RSF member."
        });
    }

    const member =
      memberResult.data;

    const verified =
      Array.isArray(member.roles) &&
      member.roles.includes(
        VERIFIED_ROLE_ID
      );

    if (!verified) {
      return res
        .status(403)
        .json({
          error: "Not verified."
        });
    }

    const robloxUsername =
      member.nick || null;

    if (!robloxUsername) {
      return res
        .status(404)
        .json({
          error: "No Roblox username found."
        });
    }

    const robloxUserResponse =
      await fetch(
        "https://users.roblox.com/v1/usernames/users",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            usernames: [robloxUsername],
            excludeBannedUsers: false
          })
        }
      );

    if (!robloxUserResponse.ok) {
      throw new Error(
        `Roblox user lookup failed: ${robloxUserResponse.status}`
      );
    }

    const robloxUserData =
      await robloxUserResponse.json();

    if (
      !Array.isArray(
        robloxUserData.data
      ) ||
      !robloxUserData.data.length ||
      !robloxUserData.data[0].id
    ) {
      return res
        .status(404)
        .json({
          error:
            "Roblox account not found."
        });
    }

    const robloxUserId =
      robloxUserData.data[0].id;

    const thumbnailResponse =
      await fetch(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxUserId}&size=150x150&format=Png&isCircular=false`
      );

    if (!thumbnailResponse.ok) {
      throw new Error(
        `Roblox thumbnail lookup failed: ${thumbnailResponse.status}`
      );
    }

    const thumbnailData =
      await thumbnailResponse.json();

    if (
      !Array.isArray(
        thumbnailData.data
      ) ||
      !thumbnailData.data.length ||
      !thumbnailData.data[0].imageUrl
    ) {
      return res
        .status(404)
        .json({
          error:
            "Roblox avatar not available."
        });
    }

    return res.json({
      robloxUsername,
      robloxUserId,
      robloxAvatarUrl:
        thumbnailData.data[0].imageUrl
    });
  } catch (error) {
    console.error(
      "Roblox avatar lookup failed:",
      error
    );

    return res
      .status(503)
      .json({
        error:
          "Unable to load Roblox avatar."
      });
  }
}
