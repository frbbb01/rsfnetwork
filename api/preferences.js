import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

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

async function getAuthenticatedUser(req) {
  const cookies = parseCookies(req);

  const session =
    verifySession(
      cookies.rsf_session
    );

  if (!session) {
    return null;
  }

  const GUILD_ID =
    process.env.DISCORD_GUILD_ID ||
    "1554213083096809603";

  const VERIFIED_ROLE_ID =
    process.env.DISCORD_VERIFIED_ROLE_ID ||
    "1554218963045589073";

  const response =
    await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${session.id}`,
      {
        headers: {
          Authorization:
            `Bot ${process.env.DISCORD_BOT_TOKEN}`
        }
      }
    );

  if (!response.ok) {
    return null;
  }

  const member =
    await response.json();

  const verified =
    Array.isArray(member.roles) &&
    member.roles.includes(
      VERIFIED_ROLE_ID
    );

  if (!verified) {
    return null;
  }

  return session;
}

export default async function handler(req, res) {
  if (
    req.method !== "GET" &&
    req.method !== "POST"
  ) {
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
    !process.env.SUPABASE_URL ||
    !process.env.SUPABASE_SECRET_KEY ||
    !process.env.SESSION_SECRET ||
    !process.env.DISCORD_BOT_TOKEN
  ) {
    return res
      .status(500)
      .json({
        error: "Server configuration error."
      });
  }

  try {
    const user =
      await getAuthenticatedUser(req);

    if (!user) {
      return res
        .status(401)
        .json({
          error:
            "Authentication required."
        });
    }

    const discordId =
      user.id;

    if (req.method === "GET") {
      const { data, error } =
        await supabase
          .from("user_preferences")
          .select("theme")
          .eq(
            "discord_id",
            discordId
          )
          .maybeSingle();

      if (error) {
        console.error(
          "Preference lookup failed:",
          error
        );

        return res
          .status(500)
          .json({
            error:
              "Unable to load preferences."
          });
      }

      if (!data) {
        const { data: created, error: createError } =
          await supabase
            .from("user_preferences")
            .insert({
              discord_id:
                discordId,
              theme: "blue"
            })
            .select("theme")
            .single();

        if (createError) {
          console.error(
            "Preference creation failed:",
            createError
          );

          return res
            .status(500)
            .json({
              error:
                "Unable to create preferences."
            });
        }

        return res.json({
          theme:
            created.theme
        });
      }

      return res.json({
        theme:
          data.theme
      });
    }

    const body =
      typeof req.body === "object" &&
      req.body !== null
        ? req.body
        : {};

    const validThemes = [
      "dark",
      "light",
      "blue",
      "royal",
      "ocean"
    ];

    const theme =
      body.theme;

    if (
      typeof theme !== "string" ||
      !validThemes.includes(theme)
    ) {
      return res
        .status(400)
        .json({
          error:
            "Invalid theme."
        });
    }

    const { error } =
      await supabase
        .from("user_preferences")
        .upsert(
          {
            discord_id:
              discordId,
            theme,
            updated_at:
              new Date().toISOString()
          },
          {
            onConflict:
              "discord_id"
          }
        );

    if (error) {
      console.error(
        "Preference save failed:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Unable to save preferences."
        });
    }

    return res.json({
      success: true,
      theme
    });
  } catch (error) {
    console.error(
      "Preferences API failed:",
      error
    );

    return res
      .status(500)
      .json({
        error:
          "Unable to process preferences."
      });
  }
}
