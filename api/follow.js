export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: "Supabase environment variables are missing"
    });
  }

  try {
    const authResponse = await fetch(
      `${req.headers.origin || ""}/api/me`,
      {
        method: "GET",
        headers: {
          cookie: req.headers.cookie || ""
        }
      }
    );

    if (!authResponse.ok) {
      return res.status(401).json({
        error: "Not authenticated"
      });
    }

    const authData = await authResponse.json();

    if (!authData.authenticated || !authData.verified) {
      return res.status(401).json({
        error: "You must be logged in and verified"
      });
    }

    const targetId = req.body?.targetId;

    if (!targetId || typeof targetId !== "string") {
      return res.status(400).json({
        error: "Target user is required"
      });
    }

    const playerUrl = new URL(
      `${supabaseUrl}/rest/v1/players`
    );

    playerUrl.searchParams.set(
      "select",
      "id,roblox_username"
    );

    playerUrl.searchParams.set(
      "roblox_username",
      `eq.${authData.robloxUsername}`
    );

    playerUrl.searchParams.set(
      "limit",
      "1"
    );

    const playerResponse = await fetch(
      playerUrl,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`
        }
      }
    );

    if (!playerResponse.ok) {
      return res.status(500).json({
        error: "Failed to find authenticated player"
      });
    }

    const players = await playerResponse.json();
    const currentPlayer = players[0];

    if (!currentPlayer) {
      return res.status(404).json({
        error: "Authenticated player not found"
      });
    }

    if (currentPlayer.id === targetId) {
      return res.status(400).json({
        error: "You cannot follow yourself"
      });
    }

    if (req.method === "POST") {
      const followResponse = await fetch(
        `${supabaseUrl}/rest/v1/follows`,
        {
          method: "POST",
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal"
          },
          body: JSON.stringify({
            follower_id: currentPlayer.id,
            following_id: targetId
          })
        }
      );

      if (!followResponse.ok) {
        const errorText = await followResponse.text();

        if (
          followResponse.status === 409 ||
          errorText.includes("duplicate")
        ) {
          return res.status(200).json({
            following: true
          });
        }

        console.error(
          "Follow insert failed:",
          followResponse.status,
          errorText
        );

        return res.status(500).json({
          error: "Failed to follow player"
        });
      }

      return res.status(200).json({
        following: true
      });
    }

    if (req.method === "DELETE") {
      const deleteUrl = new URL(
        `${supabaseUrl}/rest/v1/follows`
      );

      deleteUrl.searchParams.set(
        "follower_id",
        `eq.${currentPlayer.id}`
      );

      deleteUrl.searchParams.set(
        "following_id",
        `eq.${targetId}`
      );

      const deleteResponse = await fetch(
        deleteUrl,
        {
          method: "DELETE",
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Prefer: "return=minimal"
          }
        }
      );

      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();

        console.error(
          "Unfollow failed:",
          deleteResponse.status,
          errorText
        );

        return res.status(500).json({
          error: "Failed to unfollow player"
        });
      }

      return res.status(200).json({
        following: false
      });
    }

    return res.status(405).json({
      error: "Method not allowed"
    });
  } catch (error) {
    console.error("Follow API error:", error);

    return res.status(500).json({
      error: "Internal server error"
    });
  }
}
