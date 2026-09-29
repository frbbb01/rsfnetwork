const SUPABASE_URL = process.env.SUPABASE_URL;

const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

async function supabaseRequest(path) {
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

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${path}`,
    {
      method: "GET",
      headers: {
        apikey: SUPABASE_SECRET_KEY,
        Authorization:
          `Bearer ${SUPABASE_SECRET_KEY}`,
        "Content-Type":
          "application/json"
      }
    }
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
      `Supabase ${response.status}: ${
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
    return res.status(405).json({
      error: "Method Not Allowed"
    });
  }

  const username =
    typeof req.query.username === "string"
      ? req.query.username.trim()
      : "";

  if (!username) {
    return res.status(400).json({
      error: "Missing username"
    });
  }

  try {
    const players =
      await supabaseRequest(
        `players?select=id,roblox_username&roblox_username=eq.${encodeURIComponent(username)}&limit=1`
      );

    if (
      !Array.isArray(players) ||
      players.length === 0
    ) {
      return res.status(404).json({
        error: "Player not found"
      });
    }

    const player =
      players[0];

    if (!player.id) {
      throw new Error(
        "Player does not have an ID."
      );
    }

    const users =
      await supabaseRequest(
        `users?select=id,joined_at,updated_at&id=eq.${encodeURIComponent(player.id)}&limit=1`
      );

    if (
      !Array.isArray(users) ||
      users.length === 0
    ) {
      return res.status(404).json({
        error: "User account not found"
      });
    }

    const user =
      users[0];

    return res.status(200).json({
      player: {
        id: player.id,
        roblox_username:
          player.roblox_username,
        joined_at:
          user.joined_at || null,
        updated_at:
          user.updated_at || null
      }
    });

  } catch (error) {
    console.error(
      "PROFILE API ERROR:",
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        "Internal server error"
    });
  }
}
