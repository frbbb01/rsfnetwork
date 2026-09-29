import crypto from "node:crypto";

const SUPABASE_URL =
  process.env.SUPABASE_URL;

const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const SESSION_MAX_AGE =
  30 * 24 * 60 * 60 * 1000;

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

    try {
      cookies[name] =
        decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }

  return cookies;
}

function safeEqual(a, b) {
  if (!a || !b) {
    return false;
  }

  const aa =
    Buffer.from(a);

  const bb =
    Buffer.from(b);

  if (aa.length !== bb.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    aa,
    bb
  );
}

function getSessionUserId(req) {
  const cookies =
    parseCookies(req);

  const session =
    cookies.rsf_session;

  if (!session) {
    return null;
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

  if (
    !process.env.SESSION_SECRET
  ) {
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

  if (
    !safeEqual(
      signature,
      expectedSignature
    )
  ) {
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
      SESSION_MAX_AGE
    ) {
      return null;
    }

    return payload.id;
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
      text
        ? JSON.parse(text)
        : null;
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

async function getUserById(
  userId
) {
  if (!userId) {
    return null;
  }

  const users =
    await supabaseRequest(
      `users?select=id,discord_id,discord_username&id=eq.${encodeURIComponent(
        userId
      )}&limit=1`
    );

  if (
    !Array.isArray(users) ||
    users.length === 0
  ) {
    return null;
  }

  return users[0];
}

async function getUserByDiscordId(
  discordId
) {
  if (!discordId) {
    return null;
  }

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

  return users[0];
}

async function getPlayerById(
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

  return players[0];
}

async function getPlayerByDiscordId(
  discordId
) {
  if (!discordId) {
    return null;
  }

  const players =
    await supabaseRequest(
      `players?select=id,roblox_username,discord_id&discord_id=eq.${encodeURIComponent(
        discordId
      )}&limit=1`
    );

  if (
    !Array.isArray(players) ||
    players.length === 0
  ) {
    return null;
  }

  return players[0];
}

function getRequestedPlayerId(req) {
  let body =
    req.body;

  if (
    typeof body ===
    "string"
  ) {
    try {
      body =
        JSON.parse(body);
    } catch {
      body = {};
    }
  }

  if (
    typeof req.query.playerId ===
    "string" &&
    req.query.playerId.trim()
  ) {
    return req.query.playerId.trim();
  }

  if (
    body &&
    typeof body.playerId ===
      "string" &&
    body.playerId.trim()
  ) {
    return body.playerId.trim();
  }

  return "";
}

async function getFollowState(
  viewerUserId,
  targetUserId
) {
  if (
    !viewerUserId ||
    !targetUserId
  ) {
    return false;
  }

  const follows =
    await supabaseRequest(
      `follows?select=follower_id&follower_id=eq.${encodeURIComponent(
        viewerUserId
      )}&following_id=eq.${encodeURIComponent(
        targetUserId
      )}&limit=1`
    );

  return (
    Array.isArray(follows) &&
    follows.length > 0
  );
}

async function getFollowCounts(
  userId
) {
  const [
    followers,
    following
  ] = await Promise.all([
    supabaseRequest(
      `follows?select=follower_id&following_id=eq.${encodeURIComponent(
        userId
      )}`
    ),
    supabaseRequest(
      `follows?select=following_id&follower_id=eq.${encodeURIComponent(
        userId
      )}`
    )
  ]);

  return {
    followers:
      Array.isArray(followers)
        ? followers.length
        : 0,

    following:
      Array.isArray(following)
        ? following.length
        : 0
  };
}

export default async function handler(
  req,
  res
) {
  if (
    ![
      "GET",
      "POST",
      "DELETE"
    ].includes(req.method)
  ) {
    return res.status(405).json({
      error:
        "Method Not Allowed"
    });
  }

  try {
    const playerId =
      getRequestedPlayerId(req);

    if (!playerId) {
      return res.status(400).json({
        error:
          "Missing player ID."
      });
    }

    const targetPlayer =
      await getPlayerById(
        playerId
      );

    if (!targetPlayer) {
      return res.status(404).json({
        error:
          "Player not found."
      });
    }

    const targetUser =
      await getUserByDiscordId(
        targetPlayer.discord_id
      );

    if (!targetUser) {
      return res.status(404).json({
        error:
          "This player does not have a website account."
      });
    }

    const sessionUserId =
      getSessionUserId(req);

    const viewerUser =
      sessionUserId
        ? await getUserById(
            sessionUserId
          )
        : null;

    if (req.method === "GET") {
      const [
        counts,
        isFollowing
      ] = await Promise.all([
        getFollowCounts(
          targetUser.id
        ),
        getFollowState(
          viewerUser?.id || null,
          targetUser.id
        )
      ]);

      return res.status(200).json({
        followers:
          counts.followers,

        following:
          counts.following,

        isFollowing,

        isSelf:
          viewerUser?.id ===
          targetUser.id
      });
    }

    if (!viewerUser) {
      return res.status(401).json({
        error:
          "You must be logged in."
      });
    }

    const viewerPlayer =
      await getPlayerByDiscordId(
        viewerUser.discord_id
      );

    if (!viewerPlayer) {
      return res.status(403).json({
        error:
          "You must be a registered RSF player to follow people."
      });
    }

    if (
      viewerUser.id ===
      targetUser.id
    ) {
      return res.status(400).json({
        error:
          "You cannot follow yourself."
      });
    }

    if (req.method === "POST") {
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
                viewerUser.id,

              following_id:
                targetUser.id
            })
        }
      );
    }

    if (req.method === "DELETE") {
      await supabaseRequest(
        `follows?follower_id=eq.${encodeURIComponent(
          viewerUser.id
        )}&following_id=eq.${encodeURIComponent(
          targetUser.id
        )}`,
        {
          method:
            "DELETE",

          headers: {
            Prefer:
              "return=minimal"
          }
        }
      );
    }

    const [
      counts,
      isFollowing
    ] = await Promise.all([
      getFollowCounts(
        targetUser.id
      ),
      getFollowState(
        viewerUser.id,
        targetUser.id
      )
    ]);

    return res.status(200).json({
      followers:
        counts.followers,

      following:
        counts.following,

      isFollowing,

      isSelf:
        viewerUser.id ===
        targetUser.id
    });

  } catch (error) {
    console.error(
      "FOLLOW API ERROR:",
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        "Internal server error."
    });
  }
}
