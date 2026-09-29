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
  if (!session || !process.env.SESSION_SECRET) {
    return null;
  }

  const parts = session.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const encoded = parts[0];
  const signature = parts[1];

  const expectedSignature = crypto
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
      Buffer.from(encoded, "base64url").toString("utf8")
    );

    if (!payload.id) {
      return null;
    }

    if (
      payload.createdAt &&
      Date.now() - payload.createdAt > 2592000000
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

async function supabaseRequest(path, options = {}) {
  const url =
    `${process.env.SUPABASE_URL}/rest/v1/${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      apikey: process.env.SUPABASE_SECRET_KEY,
      Authorization:
        `Bearer ${process.env.SUPABASE_SECRET_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      `Supabase ${response.status}: ${
        typeof data === "string"
          ? data
          : JSON.stringify(data)
      }`
    );
  }

  return data;
}

async function getWebsiteUser(req) {
  const cookies = parseCookies(req);
  const session = verifySession(cookies.rsf_session);

  if (!session) {
    return null;
  }

  const users = await supabaseRequest(
    `users?select=id,discord_id&discord_id=eq.${encodeURIComponent(session.id)}&limit=1`
  );

  if (!users || !users.length) {
    return null;
  }

  return users[0];
}

async function getTargetPlayer(playerId) {
  const players = await supabaseRequest(
    `players?select=id& id=eq.${encodeURIComponent(playerId)}&limit=1`
      .replace("?select=id& id", "?select=id&id")
  );

  if (!players || !players.length) {
    return null;
  }

  const users = await supabaseRequest(
    `users?select=id&id=eq.${encodeURIComponent(playerId)}&limit=1`
  );

  if (!users || !users.length) {
    return null;
  }

  return players[0];
}

export default async function handler(req, res) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return res.status(500).json({
      error: "Supabase environment variables are missing."
    });
  }

  try {
    const playerId =
      typeof req.query.playerId === "string"
        ? req.query.playerId
        : null;

    if (!playerId) {
      return res.status(400).json({
        error: "Player ID is required."
      });
    }

    const targetPlayer =
      await getTargetPlayer(playerId);

    if (!targetPlayer) {
      return res.status(404).json({
        error: "This player is not eligible for follows."
      });
    }

    const followers = await supabaseRequest(
      `follows?select=follower_id&following_id=eq.${encodeURIComponent(playerId)}`
    );

    const following = await supabaseRequest(
      `follows?select=following_id&follower_id=eq.${encodeURIComponent(playerId)}`
    );

    let currentUser = null;
    let isFollowing = false;

    if (req.method !== "GET") {
      currentUser = await getWebsiteUser(req);

      if (!currentUser) {
        return res.status(401).json({
          error: "You must be logged in."
        });
      }

      const currentPlayer =
        await supabaseRequest(
          `players?select=id&id=eq.${encodeURIComponent(currentUser.id)}&limit=1`
        );

      if (!currentPlayer || !currentPlayer.length) {
        return res.status(403).json({
          error: "Only registered players can follow other players."
        });
      }

      if (currentUser.id === playerId) {
        return res.status(400).json({
          error: "You cannot follow yourself."
        });
      }

      const existing =
        await supabaseRequest(
          `follows?select=follower_id,following_id&follower_id=eq.${encodeURIComponent(currentUser.id)}&following_id=eq.${encodeURIComponent(playerId)}&limit=1`
        );

      isFollowing = !!existing.length;
    }

    if (req.method === "GET") {
      currentUser = await getWebsiteUser(req);

      if (currentUser) {
        const currentPlayer =
          await supabaseRequest(
            `players?select=id&id=eq.${encodeURIComponent(currentUser.id)}&limit=1`
          );

        if (currentPlayer && currentPlayer.length) {
          const existing =
            await supabaseRequest(
              `follows?select=follower_id&follower_id=eq.${encodeURIComponent(currentUser.id)}&following_id=eq.${encodeURIComponent(playerId)}&limit=1`
            );

          isFollowing = !!existing.length;
        }
      }
    }

    if (req.method === "GET") {
      return res.status(200).json({
        followers: followers.length,
        following: following.length,
        isFollowing
      });
    }

    if (req.method === "POST") {
      if (isFollowing) {
        return res.status(200).json({
          success: true,
          following: true,
          followers: followers.length,
          message: "Already following."
        });
      }

      await supabaseRequest("follows", {
        method: "POST",
        headers: {
          Prefer: "return=minimal"
        },
        body: JSON.stringify({
          follower_id: currentUser.id,
          following_id: playerId
        })
      });

      return res.status(200).json({
        success: true,
        following: true,
        followers: followers.length + 1,
        followingCount: following.length
      });
    }

    if (req.method === "DELETE") {
      if (!isFollowing) {
        return res.status(200).json({
          success: true,
          following: false,
          followers: followers.length,
          followingCount: following.length
        });
      }

      await supabaseRequest(
        `follows?follower_id=eq.${encodeURIComponent(currentUser.id)}&following_id=eq.${encodeURIComponent(playerId)}`,
        {
          method: "DELETE"
        }
      );

      return res.status(200).json({
        success: true,
        following: false,
        followers: Math.max(0, followers.length - 1),
        followingCount: following.length
      });
    }

    return res.status(405).json({
      error: "Method not allowed."
    });
  } catch (error) {
    console.error("Follow API error:", error);

    return res.status(500).json({
      error: "Failed to process follow request."
    });
  }
}
