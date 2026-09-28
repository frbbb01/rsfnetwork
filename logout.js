async function sendDebugWebhook(
  content
) {
  const webhookUrl =
    process.env.DEBUG_WEBHOOK_URL;

  if (!webhookUrl) {
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify({
        content
      })
    });
  } catch (error) {
    console.error(
      "Debug webhook failed:",
      error
    );
  }
}

export default async function handler(
  req,
  res
) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({
        error:
          "Method Not Allowed"
      });
  }

  res.setHeader(
    "Set-Cookie",
    "rsf_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax"
  );

  await sendDebugWebhook(
    "🚪 **User logged out**"
  );

  return res
    .status(200)
    .json({
      success: true
    });
}
