document.addEventListener("DOMContentLoaded", async () => {
  const loginButton = document.getElementById("login-button");
  const profileCard = document.getElementById("profile-card");

  if (loginButton) {
    loginButton.addEventListener("click", () => {
      window.location.href = "/api/login";
    });
  }

  try {
    const response = await fetch("/api/me", {
      method: "GET",
      credentials: "include"
    });

    if (!response.ok) return;

    const user = await response.json();

    if (!user.authenticated) return;

    if (loginButton) {
      loginButton.style.display = "none";
    }

    if (profileCard) {
      profileCard.style.display = "flex";

      const username = profileCard.querySelector(".profile-username");
      const status = profileCard.querySelector(".profile-status");

      if (username) {
        username.textContent = user.robloxUsername || user.discordUsername;
      }

      if (status) {
        status.textContent = user.verified ? "VERIFIED" : "GUEST";
      }
    }
  } catch (error) {
    console.error("Authentication check failed:", error);
  }
});
