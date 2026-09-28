document.addEventListener("DOMContentLoaded", async () => {
  const loginButton =
    document.getElementById("login-button");

  const profileCard =
    document.getElementById("profile-card");

  const profileAvatar =
    document.getElementById("profile-avatar");

  const profileUsername =
    document.getElementById("profile-username");

  const profileStatus =
    document.getElementById("profile-status");

  if (!loginButton || !profileCard) {
    return;
  }

  try {
    const response = await fetch(
      "/api/me",
      {
        method: "GET",
        credentials: "include",
        cache: "no-store"
      }
    );

    if (!response.ok) {
      return;
    }

    const user = await response.json();

    if (!user.authenticated) {
      return;
    }

    loginButton.style.display = "none";
    profileCard.style.display = "flex";

    if (profileUsername) {
      profileUsername.textContent =
        user.verified && user.robloxUsername
          ? user.robloxUsername
          : user.discordUsername;
    }

    if (profileStatus) {
      profileStatus.textContent =
        user.verified
          ? "VERIFIED"
          : "GUEST";
    }

    if (profileAvatar && user.avatarUrl) {
      profileAvatar.src = user.avatarUrl;
    }
  } catch (error) {
    console.error(
      "Authentication check failed:",
      error
    );
  }
});
