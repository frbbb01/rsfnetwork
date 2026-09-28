import crypto from "node:crypto";

const REDIRECT_URI = "https://networkrsf.vercel.app/callback";

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).send("Method Not Allowed");
  }

  if (!process.env.DISCORD_CLIENT_ID) {
    return res.status(500).send("Server configuration error.");
  }

  const state = crypto.randomBytes(32).toString("base64url");

  const authorizeUrl = new URL(
    "https://discord.com/oauth2/authorize"
  );

  authorizeUrl.searchParams.set(
    "client_id",
    process.env.DISCORD_CLIENT_ID
  );

  authorizeUrl.searchParams.set(
    "response_type",
    "code"
  );

  authorizeUrl.searchParams.set(
    "redirect_uri",
    REDIRECT_URI
  );

  authorizeUrl.searchParams.set(
    "scope",
    "identify guilds"
  );

  authorizeUrl.searchParams.set(
    "state",
    state
  );

  res.setHeader(
    "Set-Cookie",
    `rsf_oauth_state=${encodeURIComponent(state)}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`
  );

  res.statusCode = 302;
  res.setHeader(
    "Location",
    authorizeUrl.toString()
  );

  res.end();
}
