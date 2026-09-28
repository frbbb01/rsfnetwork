export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const username =
    typeof req.query.username === "string"
      ? req.query.username.trim()
      : "";

  if (!username) {
    return res.status(400).json({
      error: "Username is required"
    });
  }

  if (username.length > 20) {
    return res.status(400).json({
      error: "Invalid username"
    });
  }

  try {
    const userResponse = await fetch(
      "https://users.roblox.com/v1/usernames/users",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          usernames: [username],
          excludeBannedUsers: false
        })
      }
    );

    if (!userResponse.ok) {
      return res.status(502).json({
        error: "Roblox user lookup failed"
      });
    }

    const userData = await userResponse.json();
    const user = userData?.data?.[0];

    if (!user || !user.id) {
      return res.status(404).json({
        error: "Roblox user not found"
      });
    }

    const thumbnailResponse = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${encodeURIComponent(
        user.id
      )}&size=150x150&format=Png&isCircular=false`
    );

    if (!thumbnailResponse.ok) {
      return res.status(502).json({
        error: "Roblox thumbnail lookup failed"
      });
    }

    const thumbnailData = await thumbnailResponse.json();
    const imageUrl = thumbnailData?.data?.[0]?.imageUrl;

    if (!imageUrl) {
      return res.status(404).json({
        error: "Roblox headshot unavailable"
      });
    }

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=86400"
    );

    return res.status(200).json({
      userId: user.id,
      username: user.name,
      imageUrl
    });
  } catch (error) {
    console.error("Roblox headshot API error:", error);

    return res.status(500).json({
      error: "Internal server error"
    });
  }
}
