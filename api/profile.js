export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { username } = req.query;

  if (!username || typeof username !== "string") {
    return res.status(400).json({ error: "Username is required" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Supabase environment variables are missing" });
  }

  try {
    const url = new URL(`${supabaseUrl}/rest/v1/players`);

    url.searchParams.set(
      "select",
      "id,roblox_username,joined_at,updated_at"
    );

    url.searchParams.set(
      "roblox_username",
      `eq.${username}`
    );

    url.searchParams.set("limit", "1");

    const response = await fetch(url, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      }
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Supabase error:", error);
      return res.status(500).json({ error: "Failed to query players" });
    }

    const players = await response.json();

    if (!players.length) {
      return res.status(404).json({ error: "Player not found" });
    }

    return res.status(200).json({
      player: players[0]
    });
  } catch (error) {
    console.error("Profile API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
