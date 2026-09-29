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

function safeEqual(a, b) {
  if (!a || !b) {
    return false;
  }

  const aa =
    Buffer.from(a);

  const bb =
    Buffer.from(b);

  if (
    aa.length !== bb.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    aa,
    bb
  );
}

function getSessionId(req) {
  const cookies =
    parseCookies(req);

  const session =
    cookies.rsf_session;

  if (!session) {
    return null;
  }

  const separator =
    session.lastIndexOf(".");

  if (separator === -1) {
    return null;
  }

  const encoded =
    session.slice(
      0,
      separator
    );

  const signature =
    session.slice(
      separator + 1
    );

  if (
    !process.env.SESSION_SECRET
  ) {
    throw new Error(
      "SESSION_SECRET is missing."
    );
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
      !payload ||
      !payload.id
    ) {
      return null;
    }

    return String(
      payload.id
    );

  } catch {
    return null;
  }
}

function encodeQueryValue(
  value
) {
  return encodeURIComponent(
    String(value)
  );
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
        method:
          options.method ||
          "GET",

        headers: {
          apikey:
            SUPABASE_SECRET_KEY,

          Authorization:
            `Bearer ${SUPABASE_SECRET_KEY}`,

          "Content-Type":
            "application/json",

          ...(options.headers || {})
        },

        body:
          options.body
            ? JSON.stringify(
                options.body
              )
            : undefined
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

async function getViewer(
  req
) {

  const discordId =
    getSessionId(req);

  if (!discordId) {
    return null;
  }

  const users =
    await supabaseRequest(
      `users?select=id,discord_id,discord_username&id=eq.${encodeQueryValue(
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
      `players?select=id,roblox_username,discord_id&id=eq.${encodeQueryValue(
        user.id
      )}&limit=1`
    );

  if (
    !Array.isArray(players) ||
    players.length === 0
  ) {
    return {
      user,
      player: null
    };
  }

  return {
    user,
    player: players[0]
  };
}

async function getTarget(
  playerId
) {

  const players =
    await supabaseRequest(
      `players?select=id,roblox_username,discord_id&id=eq.${encodeQueryValue(
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
      `users?select=id,discord_id,discord_username&id=eq.${encodeQueryValue(
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
    player,
    user: users[0]
  };
}

async function getFollowData(
  targetId,
  viewerId
) {

  const [
    followers,
    following,
    existing
  ] = await Promise.all([

    supabaseRequest(
      `follows?select=follower_id&following_id=eq.${encodeQueryValue(
        targetId
      )}`
    ),

    supabaseRequest(
      `follows?select=following_id&follower_id=eq.${encodeQueryValue(
        targetId
      )}`
    ),

    viewerId
      ? supabaseRequest(
          `follows?select=follower_id&follower_id=eq.${encodeQueryValue(
            viewerId
          )}&following_id=eq.${encodeQueryValue(
            targetId
          )}&limit=1`
        )
      : Promise.resolve([])

  ]);

  return {
    followersCount:
      Array.isArray(followers)
        ? followers.length
        : 0,

    followingCount:
      Array.isArray(following)
        ? following.length
        : 0,

    isFollowing:
      Array.isArray(existing) &&
      existing.length > 0,

    isSelf:
      Boolean(
        viewerId &&
        viewerId === targetId
      )
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

    if (req.method === "GET") {

      const playerId =
        typeof req.query.playerId ===
        "string"
          ? req.query.playerId.trim()
          : "";

      if (!playerId) {

        return res.status(400).json({
          error:
            "Missing playerId"
        });

      }

      const target =
        await getTarget(
          playerId
        );

      if (!target) {

        return res.status(404).json({
          error:
            "Player account not found"
        });

      }

      const viewer =
        await getViewer(req);

      const viewerId =
        viewer &&
        viewer.player
          ? viewer.player.id
          : null;

      const data =
        await getFollowData(
          target.player.id,
          viewerId
        );

      return res.status(200).json(
        data
      );

    }

    let body =
      req.body;

    if (
      typeof body === "string"
    ) {

      try {
        body =
          JSON.parse(body);
      } catch {
        body = {};
      }

    }

    const playerId =
      body &&
      typeof body.playerId ===
        "string"
        ? body.playerId.trim()
        : "";

    if (!playerId) {

      return res.status(400).json({
        error:
          "Missing playerId"
      });

    }

    const viewer =
      await getViewer(req);

    if (!viewer) {

      return res.status(401).json({
        error:
          "You must be logged in."
      });

    }

    if (!viewer.player) {

      return res.status(403).json({
        error:
          "You must have a registered RSF player profile to follow players."
      });

    }

    const target =
      await getTarget(
        playerId
      );

    if (!target) {

      return res.status(404).json({
        error:
          "Player account not found"
      });

    }

    const viewerId =
      viewer.player.id;

    const targetId =
      target.player.id;

    if (
      viewerId === targetId
    ) {

      return res.status(400).json({
        error:
          "You cannot follow yourself."
      });

    }

    if (
      req.method === "POST"
    ) {

      await supabaseRequest(
        "follows",
        {
          method: "POST",

          headers: {
            Prefer:
              "resolution=ignore-duplicates,return=minimal"
          },

          body: {
            follower_id:
              viewerId,

            following_id:
              targetId
          }
        }
      );

    }

    if (
      req.method === "DELETE"
    ) {

      await supabaseRequest(
        `follows?follower_id=eq.${encodeQueryValue(
          viewerId
        )}&following_id=eq.${encodeQueryValue(
          targetId
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

    const data =
      await getFollowData(
        targetId,
        viewerId
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
