document.addEventListener("DOMContentLoaded", async () => {
  const loginButton = document.getElementById("login-button");
  const profileCard = document.getElementById("profile-card");
  const profileAvatar = document.getElementById("profile-avatar");
  const profileAvatarWrap = profileCard
    ? profileCard.querySelector(".profile-avatar")
    : null;
  const profileUsername = document.getElementById("profile-username");
  const profileStatus = document.getElementById("profile-status");

  if (!profileCard) {
    return;
  }

  let profileMenu = null;
  let profileData = null;

  const profileIcon = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"></path>
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0"></path>
    </svg>
  `;

  const settingsIcon = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"></path>
      <path d="m19 13.2 1.2 1-1.7 2.9-1.5-.5a7.4 7.4 0 0 1-1.8 1l-.2 1.6H11l-.2-1.6a7.4 7.4 0 0 1-1.8-1l-1.5.5-1.7-2.9 1.2-1A7.4 7.4 0 0 1 7 11.8L5.8 11l1.1-3.1 1.6.1a7.6 7.6 0 0 1 1.6-1L10.4 5h3.2l.3 2a7.6 7.6 0 0 1 1.6 1l1.6-.1L18.2 11l-1.2.8a7.4 7.4 0 0 1 .7 1.4Z"></path>
    </svg>
  `;

  const logoutIcon = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10"></path>
      <path d="M13 8l4 4-4 4"></path>
      <path d="M9 12h8"></path>
    </svg>
  `;

  function createMenu(data) {
    if (profileMenu) {
      profileMenu.remove();
    }

    profileMenu = document.createElement("div");
    profileMenu.className = "profile-dropdown";

    let menuItems = "";

    if (data.verified && data.robloxUsername) {
      menuItems += `
        <button class="profile-dropdown-item" type="button" data-action="profile">
          <span class="profile-dropdown-icon">
            ${profileIcon}
          </span>
          <span class="profile-dropdown-label">My Profile</span>
        </button>

        <button class="profile-dropdown-item" type="button" data-action="settings">
          <span class="profile-dropdown-icon">
            ${settingsIcon}
          </span>
          <span class="profile-dropdown-label">Settings</span>
        </button>

        <div class="profile-dropdown-divider"></div>
      `;
    }

    menuItems += `
      <button class="profile-dropdown-item profile-logout" type="button" data-action="logout">
        <span class="profile-dropdown-icon">
          ${logoutIcon}
        </span>
        <span class="profile-dropdown-label">Log Out</span>
      </button>
    `;

    profileMenu.innerHTML = menuItems;
    profileCard.appendChild(profileMenu);

    const profileItem = profileMenu.querySelector('[data-action="profile"]');
    const settingsItem = profileMenu.querySelector('[data-action="settings"]');
    const logoutItem = profileMenu.querySelector('[data-action="logout"]');

    if (profileItem) {
      profileItem.addEventListener("click", () => {
        if (!data.robloxUsername) {
          return;
        }

        window.location.href =
          `/profile/${encodeURIComponent(data.robloxUsername)}`;
      });
    }

    if (settingsItem) {
      settingsItem.addEventListener("click", () => {
        window.location.href = "/settings";
      });
    }

    logoutItem.addEventListener("click", async () => {
      if (logoutItem.disabled) {
        return;
      }

      logoutItem.disabled = true;

      try {
        const response = await fetch("/api/logout", {
          method: "POST",
          credentials: "include",
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error(`Logout failed: ${response.status}`);
        }

        window.location.reload();
      } catch (error) {
        console.error("Logout failed:", error);
        logoutItem.disabled = false;
      }
    });
  }

  function closeProfileMenu() {
    if (!profileMenu) {
      return;
    }

    profileCard.classList.remove("profile-open");
    profileMenu.classList.remove("profile-dropdown-visible");
  }

  function openProfileMenu() {
    if (!profileMenu) {
      return;
    }

    profileCard.classList.add("profile-open");
    profileMenu.classList.add("profile-dropdown-visible");
  }

  function toggleProfileMenu() {
    if (!profileMenu) {
      return;
    }

    if (profileCard.classList.contains("profile-open")) {
      closeProfileMenu();
    } else {
      openProfileMenu();
    }
  }

  async function loadRobloxHeadshot(username) {
    if (!username || !profileAvatar || !profileAvatarWrap) {
      return;
    }

    try {
      const response = await fetch(
        `/api/roblox-headshot?username=${encodeURIComponent(username)}`,
        {
          method: "GET",
          cache: "no-store"
        }
      );

      if (!response.ok) {
        throw new Error(`Roblox headshot failed: ${response.status}`);
      }

      const data = await response.json();

      if (!data.imageUrl) {
        throw new Error("No Roblox headshot returned");
      }

      profileAvatar.src = data.imageUrl;
      profileAvatarWrap.style.display = "block";
    } catch (error) {
      profileAvatar.removeAttribute("src");
      profileAvatarWrap.style.display = "none";
      console.error("Roblox headshot failed:", error);
    }
  }

  async function syncAuthentication() {
    try {
      const response = await fetch(`/api/me?_=${Date.now()}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`Authentication check failed: ${response.status}`);
      }

      const data = await response.json();
      profileData = data;

      closeProfileMenu();

      if (!data.authenticated) {
        if (loginButton) {
          loginButton.style.display = "";
        }

        profileCard.style.display = "none";

        if (profileMenu) {
          profileMenu.remove();
          profileMenu = null;
        }

        return;
      }

      if (loginButton) {
        loginButton.style.display = "none";
      }

      profileCard.style.display = "flex";

      const isVerified =
        Boolean(data.verified && data.robloxUsername);

      profileCard.classList.toggle(
        "profile-guest",
        !isVerified
      );

      profileCard.classList.toggle(
        "profile-verified",
        isVerified
      );

      profileUsername.textContent =
        isVerified
          ? data.robloxUsername
          : data.discordUsername || "Guest";

      profileStatus.textContent =
        isVerified
          ? "VERIFIED"
          : "GUEST";

      if (profileAvatar) {
        profileAvatar.removeAttribute("src");
      }

      if (profileAvatarWrap) {
        profileAvatarWrap.style.display = "none";
      }

      createMenu(data);

      if (isVerified) {
        await loadRobloxHeadshot(data.robloxUsername);
      }
    } catch (error) {
      console.error("Authentication check failed:", error);
    }
  }

  profileCard.addEventListener("click", event => {
    if (event.target.closest(".profile-dropdown")) {
      return;
    }

    toggleProfileMenu();
  });

  document.addEventListener("click", event => {
    if (!profileCard.contains(event.target)) {
      closeProfileMenu();
    }
  });

  await syncAuthentication();
});
