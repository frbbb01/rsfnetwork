import crypto from "node:crypto";

const REDIRECT_URI = "https://networkrsf.vercel.app/callback";

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

function safeEqual(a, b) {
  if (!a || !b) {
    return false;
  }

  const aa = Buffer.from(a);
  const bb = Buffer.from(b);

  if (aa.length !== bb.length) {
    return false;
  }

  return crypto.timingSafeEqual(aa, bb);
}

function createSession(userId) {
  const payload = {
    id: userId,
    createdAt: Date.now()
  };

  const encoded = Buffer
    .from(JSON.stringify(payload))
    .toString("base64url");

  const signature = crypto
    .createHmac(
      "sha256",
      process.env.SESSION_SECRET
    )
    .update(encoded)
    .digest("base64url");

  return `${encoded}.${signature}`;
}

async function sendDebugWebhook(content) {
  const webhookUrl =
    process.env.DEBUG_WEBHOOK_URL;

  if (!webhookUrl) {
    console.error(
      "DEBUG_WEBHOOK_URL is not configured."
    );

    return;
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
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

async function discordFetch(url, options = {}) {
  const response = await fetch(
    url,
    options
  );

  const text =
    await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      `Discord API ${response.status}: ${
        typeof data === "string"
          ? data
          : JSON.stringify(data)
      }`
    );
  }

  return data;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res
      .status(405)
      .send("Method Not Allowed");
  }

  const {
    code,
    state,
    error
  } = req.query;

  if (error) {
    await sendDebugWebhook(
      `❌ **Discord authentication failed**\nError: \`${error}\``
    );

    return res
      .status(400)
      .send(
        `Discord authentication failed: ${error}`
      );
  }

  if (!code) {
    return res
      .status(400)
      .send(
        "Missing Discord authorization code."
      );
  }

  if (!state) {
    return res
      .status(400)
      .send(
        "Missing OAuth state."
      );
  }

  const cookies =
    parseCookies(req);

  if (!cookies.rsf_oauth_state) {
    return res
      .status(400)
      .send(
        "Missing OAuth state cookie."
      );
  }

  if (
    !safeEqual(
      state,
      cookies.rsf_oauth_state
    )
  ) {
    await sendDebugWebhook(
      "⚠️ **OAuth state validation failed**"
    );

    return res
      .status(400)
      .send(
        "Invalid OAuth state."
      );
  }

  if (
    !process.env.DISCORD_CLIENT_ID ||
    !process.env.DISCORD_CLIENT_SECRET ||
    !process.env.SESSION_SECRET
  ) {
    console.error(
      "Required environment variables are missing."
    );

    return res
      .status(500)
      .send(
        "Server configuration error."
      );
  }

  try {
    const tokenResponse =
      await fetch(
        "https://discord.com/api/v10/oauth2/token",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded"
          },
          body:
            new URLSearchParams({
              client_id:
                process.env.DISCORD_CLIENT_ID,

              client_secret:
                process.env.DISCORD_CLIENT_SECRET,

              grant_type:
                "authorization_code",

              code,

              redirect_uri:
                REDIRECT_URI
            })
        }
      );

    const tokenText =
      await tokenResponse.text();

    let tokenData;

    try {
      tokenData =
        JSON.parse(tokenText);
    } catch {
      tokenData = {};
    }

    if (!tokenResponse.ok) {
      console.error(
        "Discord token exchange failed:",
        tokenData
      );

      await sendDebugWebhook(
        `❌ **Discord token exchange failed**\nStatus: \`${tokenResponse.status}\``
      );

      return res
        .status(500)
        .send(
          "Discord authentication failed."
        );
    }

    if (!tokenData.access_token) {
      await sendDebugWebhook(
        "❌ **Discord returned no access token**"
      );

      return res
        .status(500)
        .send(
          "Discord authentication failed."
        );
    }

    const user =
      await discordFetch(
        "https://discord.com/api/v10/users/@me",
        {
          headers: {
            Authorization:
              `Bearer ${tokenData.access_token}`
          }
        }
      );

    if (!user.id) {
      throw new Error(
        "Discord user response did not contain an ID."
      );
    }

    const session =
      createSession(user.id);

    res.setHeader(
      "Set-Cookie",
      [
        `rsf_session=${encodeURIComponent(session)}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`,
        "rsf_oauth_state=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax"
      ]
    );

    const discordName =
      user.global_name ||
      user.username ||
      "Unknown";

    await sendDebugWebhook(
      `🔐 **User logged in**\n` +
      `Discord: **${discordName}**\n` +
      `ID: \`${user.id}\``
    );

    res.statusCode = 302;

    res.setHeader(
      "Location",
      "/"
    );

    res.end();
  } catch (error) {
    console.error(
      "OAuth callback error:",
      error
    );

    await sendDebugWebhook(
      `❌ **OAuth callback error**\n\`${String(
        error.message || error
      ).slice(0, 1500)}\``
    );

    return res
      .status(500)
      .send(
        "Authentication failed. Please try again."
      );
  }
}
