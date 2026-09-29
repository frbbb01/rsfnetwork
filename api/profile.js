const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

async function supabaseRequest(path) {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error("Supabase environment variables are missing.");
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${path}`,
    {
      headers: {
        apikey: SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  const text = await response.text();

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

  const username = req.query.username;

  if (!username) {
    return res.status(400).json({
      error: "Missing username"
    });
  }

  try {
    const players = await supabaseRequest(
      `players?select=id,roblox_username,joined_at,updated_at&roblox_username=eq.${encodeURIComponent(username)}&limit=1`
    );

    if (!players || players.length === 0) {
      return res.status(404).json({
        error: "Player not found"
      });
    }

    return res.status(200).json({
      player: players[0]
    });
  } catch (error) {
    console.error("Profile API error:", error);

    return res.status(500).json({
      error: "Internal server error"
    });
  }
}
