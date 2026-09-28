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

  let profileMenu = null;

  function createProfileMenu(data) {
    if (profileMenu) {
      return;
    }

    profileMenu = document.createElement("div");
    profileMenu.className = "profile-dropdown";

    profileMenu.innerHTML = `
      <button class="profile-dropdown-item" type="button" data-action="profile">
        <span class="profile-dropdown-icon">◉</span>
        <span>My Profile</span>
      </button>

      <button class="profile-dropdown-item" type="button" data-action="settings">
        <span class="profile-dropdown-icon">⚙</span>
        <span>Settings</span>
      </button>

      <div class="profile-dropdown-divider"></div>

      <button class="profile-dropdown-item profile-logout" type="button" data-action="logout">
        <span class="profile-dropdown-icon">↪</span>
        <span>Log Out</span>
      </button>
    `;

    profileCard.appendChild(profileMenu);

    const profileItem =
      profileMenu.querySelector(
        '[data-action="profile"]'
      );

    const settingsItem =
      profileMenu.querySelector(
        '[data-action="settings"]'
      );

    const logoutItem =
      profileMenu.querySelector(
        '[data-action="logout"]'
      );

    profileItem.addEventListener("click", () => {
      if (
        data.verified &&
        data.robloxUsername
      ) {
        window.location.href =
          `/profile/${encodeURIComponent(
            data.robloxUsername
          )}`;
      }
    });

    settingsItem.addEventListener("click", () => {
      window.location.href =
        "/settings";
    });

    logoutItem.addEventListener(
      "click",
      async () => {
        if (logoutItem.disabled) {
          return;
        }

        logoutItem.disabled = true;

        try {
          const response =
            await fetch(
              "/api/logout",
              {
                method: "POST",
                credentials: "include",
                cache: "no-store"
              }
            );

          if (!response.ok) {
            throw new Error(
              `Logout failed: ${response.status}`
            );
          }

          window.location.reload();
        } catch (error) {
          console.error(
            "Logout failed:",
            error
          );

          logoutItem.disabled = false;
        }
      }
    );
  }

  function closeProfileMenu() {
    if (!profileMenu) {
      return;
    }

    profileCard.classList.remove(
      "profile-open"
    );

    profileMenu.classList.remove(
      "profile-dropdown-visible"
    );
  }

  function toggleProfileMenu() {
    if (!profileMenu) {
      return;
    }

    const isOpen =
      profileCard.classList.toggle(
        "profile-open"
      );

    profileMenu.classList.toggle(
      "profile-dropdown-visible",
      isOpen
    );
  }

  try {
    const response =
      await fetch(
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

    createProfileMenu(data);

    profileCard.addEventListener(
      "click",
      (event) => {
        if (
          event.target.closest(
            ".profile-dropdown"
          )
        ) {
          return;
        }

        toggleProfileMenu();
      }
    );

    document.addEventListener(
      "click",
      (event) => {
        if (
          !profileCard.contains(
            event.target
          )
        ) {
          closeProfileMenu();
        }
      }
    );
  } catch (error) {
    console.error(
      "Authentication check failed:",
      error
    );
  }
});
