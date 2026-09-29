import crypto from "node:crypto";

const SUPABASE_URL =
  process.env.SUPABASE_URL;

const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

function parseCookies(req) {
  const header =
    req.headers.cookie || "";

  const cookies = {};

  for (const part of header.split(";")) {
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

function verifySession(session) {
  if (!session) {
    return null;
  }

  if (!process.env.SESSION_SECRET) {
    throw new Error(
      "SESSION_SECRET is missing."
    );
  }

  const parts =
    session.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const encoded =
    parts[0];

  const signature =
    parts[1];

  const expectedSignature =
    crypto
      .createHmac(
        "sha256",
        process.env.SESSION_SECRET
      )
      .update(encoded)
      .digest("base64url");

  const aa =
    Buffer.from(signature);

  const bb =
    Buffer.from(expectedSignature);

  if (
    aa.length !== bb.length ||
    !crypto.timingSafeEqual(
      aa,
      bb
    )
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

    if (!payload.id) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

async function supabaseRequest(
  path,
  options = {}
) {
  if (!SUPABASE_URL) {
    throw new Error(
      "SUPABASE_URL is missing."
    );
  }

  if (!SUPABASE_SECRET_KEY) {
    throw new Error(
      "SUPABASE_SECRET_KEY is missing."
    );
  }

  const response =
    await fetch(
      `${SUPABASE_URL}/rest/v1/${path}`,
      {
        ...options,
        headers: {
          apikey:
            SUPABASE_SECRET_KEY,
          Authorization:
            `Bearer ${SUPABASE_SECRET_KEY}`,
          "Content-Type":
            "application/json",
          ...(options.headers || {})
        }
      }
    );

  const text =
    await response.text();

  let data;

  try {
    data =
      JSON.parse(text);
  } catch {
    data =
      text;
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

async function getAuthenticatedUser(
  req
) {
  const cookies =
    parseCookies(req);

  const session =
    cookies.rsf_session;

  const payload =
    verifySession(session);

  if (!payload) {
    return null;
  }

  const discordId =
    payload.id;

  const users =
    await supabaseRequest(
      `users?select=id,discord_id,discord_username&discord_id=eq.${encodeURIComponent(
        discordId
      )}&limit=1`
    );

  if (
    !Array.isArray(users) ||
    users.length === 0
  ) {
    return null;
  }

  const user =
    users[0];

  const players =
    await supabaseRequest(
      `players?select=id,roblox_username,discord_id&id=eq.${encodeURIComponent(
        user.id
      )}&limit=1`
    );

  if (
    !Array.isArray(players) ||
    players.length === 0
  ) {
    return null;
  }

  return {
    user,
    player:
      players[0]
  };
}

async function getTargetUser(
  playerId
) {
  if (!playerId) {
    return null;
  }

  const players =
    await supabaseRequest(
      `players?select=id,roblox_username,discord_id&id=eq.${encodeURIComponent(
        playerId
      )}&limit=1`
    );

  if (
    !Array.isArray(players) ||
    players.length === 0
  ) {
    return null;
  }

  const player =
    players[0];

  const users =
    await supabaseRequest(
      `users?select=id,discord_id,discord_username&id=eq.${encodeURIComponent(
        player.id
      )}&limit=1`
    );

  if (
    !Array.isArray(users) ||
    users.length === 0
  ) {
    return null;
  }

  return {
    user:
      users[0],
    player
  };
}

async function getFollowData(
  viewerId,
  targetId
) {
  const followers =
    await supabaseRequest(
      `follows?select=follower_id&following_id=eq.${encodeURIComponent(
        targetId
      )}`
    );

  const following =
    await supabaseRequest(
      `follows?select=following_id&follower_id=eq.${encodeURIComponent(
        targetId
      )}`
    );

  let isFollowing =
    false;

  if (viewerId) {
    const existing =
      await supabaseRequest(
        `follows?select=follower_id&follower_id=eq.${encodeURIComponent(
          viewerId
        )}&following_id=eq.${encodeURIComponent(
          targetId
        )}&limit=1`
      );

    isFollowing =
      Array.isArray(existing) &&
      existing.length > 0;
  }

  return {
    followers:
      Array.isArray(followers)
        ? followers.length
        : 0,

    following:
      Array.isArray(following)
        ? following.length
        : 0,

    isFollowing
  };
}

export default async function handler(
  req,
  res
) {
  if (
    req.method !== "GET" &&
    req.method !== "POST" &&
    req.method !== "DELETE"
  ) {
    return res.status(405).json({
      error:
        "Method Not Allowed"
    });
  }

  try {
    const playerId =
      req.method === "GET"
        ? req.query.playerId
        : req.body?.playerId;

    if (!playerId) {
      return res.status(400).json({
        error:
          "Missing playerId"
      });
    }

    const target =
      await getTargetUser(
        playerId
      );

    if (!target) {
      return res.status(404).json({
        error:
          "Target player not found."
      });
    }

    if (req.method === "GET") {
      const authUser =
        await getAuthenticatedUser(
          req
        );

      const viewerId =
        authUser
          ? authUser.user.id
          : null;

      const data =
        await getFollowData(
          viewerId,
          target.user.id
        );

      return res.status(200).json(
        data
      );
    }

    const authUser =
      await getAuthenticatedUser(
        req
      );

    if (!authUser) {
      return res.status(401).json({
        error:
          "You must be logged in as an RSF player to follow people."
      });
    }

    const followerId =
      authUser.user.id;

    const followingId =
      target.user.id;

    if (
      followerId ===
      followingId
    ) {
      return res.status(400).json({
        error:
          "You cannot follow yourself."
      });
    }

    if (
      req.method === "POST"
    ) {
      const existing =
        await supabaseRequest(
          `follows?select=follower_id&follower_id=eq.${encodeURIComponent(
            followerId
          )}&following_id=eq.${encodeURIComponent(
            followingId
          )}&limit=1`
        );

      if (
        !Array.isArray(existing) ||
        existing.length === 0
      ) {
        await supabaseRequest(
          "follows",
          {
            method:
              "POST",

            headers: {
              Prefer:
                "return=minimal"
            },

            body:
              JSON.stringify({
                follower_id:
                  followerId,

                following_id:
                  followingId
              })
          }
        );
      }
    }

    if (
      req.method === "DELETE"
    ) {
      await supabaseRequest(
        `follows?follower_id=eq.${encodeURIComponent(
          followerId
        )}&following_id=eq.${encodeURIComponent(
          followingId
        )}`,
        {
          method:
            "DELETE"
        }
      );
    }

    const data =
      await getFollowData(
        followerId,
        followingId
      );

    return res.status(200).json(
      data
    );

  } catch (error) {
    console.error(
      "FOLLOW API ERROR:",
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        "Internal server error"
    });
  }
}
