import crypto from "node:crypto";

const GUILD_ID =
  "1554213083096809603";

const VERIFIED_ROLE_ID =
  "1554218963045589073";

function parseCookies(req) {
  const header =
    req.headers.cookie || "";

  const cookies = {};

  for (
    const part of header.split(";")
  ) {
    const index =
      part.indexOf("=");

    if (index === -1) {
      continue;
    }

    const name =
      part.slice(0, index).trim();

    const value =
      part.slice(index + 1).trim();

    cookies[name] =
      decodeURIComponent(value);
  }

  return cookies;
}

function verifySession(token) {
  if (!token) {
    return null;
  }

  const parts =
    token.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const [
    encoded,
    signature
  ] = parts;

  const expected =
    crypto
      .createHmac(
        "sha256",
        process.env.SESSION_SECRET
      )
      .update(encoded)
      .digest("base64url");

  if (
    !signature ||
    !expected ||
    signature.length !==
      expected.length
  ) {
    return null;
  }

  try {
    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
      )
    ) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const payload =
      JSON.parse(
        Buffer
          .from(
            encoded,
            "base64url"
          )
          .toString("utf8")
      );

    if (
      !payload.id ||
      !payload.createdAt
    ) {
      return null;
    }

    if (
      Date.now() -
        payload.createdAt >
      2592000000
    ) {
      return null;
    }

    return payload;

  } catch {
    return null;
  }
}

async function discordRequest(
  url
) {
  const response =
    await fetch(url, {
      headers: {
        Authorization:
          `Bot ${process.env.DISCORD_BOT_TOKEN}`
      }
    });

  const text =
    await response.text();

  let data;

  try {
    data =
      JSON.parse(text);
  } catch {
    data = text;
  }

  return {
    response,
    data
  };
}

async function sendDebugWebhook(
  content
) {
  const webhookUrl =
    process.env.DEBUG_WEBHOOK_URL;

  if (!webhookUrl) {
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify({
        content
      })
    });
  } catch (error) {
    console.error(
      "Debug webhook failed:",
      error
    );
  }
}

export default async function handler(
  req,
  res
) {
  if (req.method !== "GET") {
    return res
      .status(405)
      .json({
        error:
          "Method Not Allowed"
      });
  }

  if (
    !process.env.SESSION_SECRET ||
    !process.env.DISCORD_BOT_TOKEN
  ) {
    return res
      .status(500)
      .json({
        error:
          "Server configuration error."
      });
  }

  const cookies =
    parseCookies(req);

  const session =
    verifySession(
      cookies.rsf_session
    );

  if (!session) {
    return res
      .status(200)
      .json({
        authenticated: false
      });
  }

  try {
    const userResult =
      await discordRequest(
        `https://discord.com/api/v10/users/${session.id}`
      );

    if (
      !userResult.response.ok
    ) {
      throw new Error(
        `Discord user lookup failed: ${userResult.response.status}`
      );
    }

    const user =
      userResult.data;

    const memberResult =
      await discordRequest(
        `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${session.id}`
      );

    let member = null;

    if (
      memberResult.response.status ===
      404
    ) {
      member = null;
    } else if (
      !memberResult.response.ok
    ) {
      throw new Error(
        `Discord guild lookup failed: ${memberResult.response.status}`
      );
    } else {
      member =
        memberResult.data;
    }

    const verified =
      Boolean(
        member &&
        Array.isArray(
          member.roles
        ) &&
        member.roles.includes(
          VERIFIED_ROLE_ID
        )
      );

    const robloxUsername =
      verified &&
      member &&
      member.nick
        ? member.nick
        : null;

    const discordUsername =
      user.global_name ||
      user.username ||
      "Unknown";

    let avatarUrl;

    if (user.avatar) {
      avatarUrl =
        `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
    } else {
      avatarUrl =
        "https://cdn.discordapp.com/embed/avatars/0.png";
    }

    const displayName =
      verified &&
      robloxUsername
        ? robloxUsername
        : discordUsername;

    await sendDebugWebhook(
      `🔎 **Session checked**\n` +
      `Discord: **${discordUsername}**\n` +
      `ID: \`${user.id}\`\n` +
      `Status: **${verified ? "VERIFIED" : "GUEST"}**\n` +
      `Roblox: **${robloxUsername || "None"}**`
    );

    res.setHeader(
      "Cache-Control",
      "no-store"
    );

    return res
      .status(200)
      .json({
        authenticated: true,

        discordId:
          user.id,

        discordUsername,

        displayName,

        avatarUrl,

        verified,

        robloxUsername
      });

  } catch (error) {
    console.error(
      "Session lookup error:",
      error
    );

    await sendDebugWebhook(
      `⚠️ **Session check failed**\n\`${String(
        error.message || error
      ).slice(0, 1500)}\``
    );

    return res
      .status(503)
      .json({
        error:
          "Unable to verify session."
      });
  }
}
