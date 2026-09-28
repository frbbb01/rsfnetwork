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

    cookies[name] =
      decodeURIComponent(value);
  }

  return cookies;
}

function getSessionUserId(session) {
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

  const expected =
    crypto
      .createHmac(
        "sha256",
        process.env.SESSION_SECRET
      )
      .update(encoded)
      .digest("base64url");

  const aa = Buffer.from(signature);
  const bb = Buffer.from(expected);

  if (
    aa.length !== bb.length ||
    !crypto.timingSafeEqual(aa, bb)
  ) {
    return null;
  }

  try {
    const payload =
      JSON.parse(
        Buffer.from(
          encoded,
          "base64url"
        ).toString("utf8")
      );

    return payload.id || null;
  } catch {
    return null;
  }
}

async function sendDebugWebhook(content) {
  const webhook =
    process.env.DEBUG_WEBHOOK_URL;

  if (!webhook) {
    return;
  }

  try {
    await fetch(webhook, {
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({
        error: "Method Not Allowed"
      });
  }

  const cookies =
    parseCookies(req);

  const userId =
    getSessionUserId(
      cookies.rsf_session
    );

  res.setHeader(
    "Set-Cookie",
    [
      "rsf_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
      "rsf_oauth_state=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax"
    ]
  );

  if (userId) {
    await sendDebugWebhook(
      `🚪 **User logged out**\nID: \`${userId}\``
    );
  }

  return res.json({
    success: true
  });
}
