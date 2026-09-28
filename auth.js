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

  if (!profileCard) {
    return;
  }

  try {
    const response =
      await fetch("/api/me", {
        method: "GET",
        credentials: "include",
        cache: "no-store"
      });

    if (!response.ok) {
      return;
    }

    const data =
      await response.json();

    if (!data.authenticated) {
      if (loginButton) {
        loginButton.style.display = "";
      }

      profileCard.style.display =
        "none";

      return;
    }

    if (loginButton) {
      loginButton.style.display =
        "none";
    }

    profileCard.style.display =
      "flex";

    profileUsername.textContent =
      data.verified &&
      data.robloxUsername
        ? data.robloxUsername
        : data.discordUsername;

    profileStatus.textContent =
      data.verified
        ? "VERIFIED"
        : "GUEST";

    if (data.avatarUrl) {
      profileAvatar.src =
        data.avatarUrl;
    }
  } catch (error) {
    console.error(
      "Authentication check failed:",
      error
    );
  }
});
