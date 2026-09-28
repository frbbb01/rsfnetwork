document.addEventListener("DOMContentLoaded", async () => {
  const loginButton =
    document.getElementById("login-button");

  const profileCard =
    document.getElementById("profile-card");

  const profileAvatarContainer =
    document.getElementById("profile-avatar-container");

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
  let profileData = null;

  function createIcon(type) {
    if (type === "profile") {
      return `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="8" r="3.25"></circle>
          <path d="M5.5 19c.7-3.25 2.8-5 6.5-5s5.8 1.75 6.5 5"></path>
        </svg>
      `;
    }

    if (type === "settings") {
      return `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"></path>
          <path d="M19 13.5v-3l-2-.5a7.1 7.1 0 0 0-.8-1.8l1.1-1.8-2.1-2.1-1.8 1.1a7.1 7.1 0 0 0-1.8-.8L11.5 3h-3L8 5a7.1 7.1 0 0 0-1.8.8L4.4 4.7 2.3 6.8l1.1 1.8a7.1 7.1 0 0 0-.8 1.8l-2 .5v3l2 .5a7.1 7.1 0 0 0 .8 1.8l-1.1 1.8 2.1 2.1 1.8-1.1a7.1 7.1 0 0 0 1.8.8l.5 2h3l.5-2a7.1 7.1 0 0 0 1.8-.8l1.8 1.1 2.1-2.1-1.1-1.8a7.1 7.1 0 0 0 .8-1.8l2-.5Z"></path>
        </svg>
      `;
    }

    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M10 5H5.5A1.5 1.5 0 0 0 4 6.5v11A1.5 1.5 0 0 0 5.5 19H10"></path>
        <path d="M13 8l4 4-4 4"></path>
        <path d="M17 12H9"></path>
      </svg>
    `;
  }

  function createProfileMenu(data) {
    if (profileMenu) {
      profileMenu.remove();
    }

    profileMenu =
      document.createElement("div");

    profileMenu.className =
      "profile-dropdown";

    const verified =
      Boolean(
        data.verified &&
        data.robloxUsername
      );

    profileMenu.innerHTML = verified
      ? `
        <button
          class="profile-dropdown-item"
          type="button"
          data-action="profile"
        >
          <span class="profile-dropdown-icon">
            ${createIcon("profile")}
          </span>
          <span>My Profile</span>
        </button>

        <button
          class="profile-dropdown-item"
          type="button"
          data-action="settings"
        >
          <span class="profile-dropdown-icon">
            ${createIcon("settings")}
          </span>
          <span>Settings</span>
        </button>

        <div class="profile-dropdown-divider"></div>

        <button
          class="profile-dropdown-item profile-logout"
          type="button"
          data-action="logout"
        >
          <span class="profile-dropdown-icon">
            ${createIcon("logout")}
          </span>
          <span>Log Out</span>
        </button>
      `
      : `
        <button
          class="profile-dropdown-item profile-logout"
          type="button"
          data-action="logout"
        >
          <span class="profile-dropdown-icon">
            ${createIcon("logout")}
          </span>
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

    if (profileItem) {
      profileItem.addEventListener(
        "click",
        event => {
          event.stopPropagation();

          if (
            !data.verified ||
            !data.robloxUsername
          ) {
            return;
          }

          window.location.href =
            `/profile/${encodeURIComponent(
              data.robloxUsername
            )}`;
        }
      );
    }

    if (settingsItem) {
      settingsItem.addEventListener(
        "click",
        event => {
          event.stopPropagation();
          window.location.href = "/settings";
        }
      );
    }

    if (logoutItem) {
      logoutItem.addEventListener(
        "click",
        async event => {
          event.stopPropagation();

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
  }

  function closeProfileMenu() {
    profileCard.classList.remove(
      "profile-open"
    );

    profileCard.setAttribute(
      "aria-expanded",
      "false"
    );

    if (profileMenu) {
      profileMenu.classList.remove(
        "profile-dropdown-visible"
      );
    }
  }

  function openProfileMenu() {
    if (!profileMenu) {
      return;
    }

    profileCard.classList.add(
      "profile-open"
    );

    profileCard.setAttribute(
      "aria-expanded",
      "true"
    );

    profileMenu.classList.add(
      "profile-dropdown-visible"
    );
  }

  function toggleProfileMenu() {
    if (!profileMenu) {
      return;
    }

    if (
      profileCard.classList.contains(
        "profile-open"
      )
    ) {
      closeProfileMenu();
    } else {
      openProfileMenu();
    }
  }

  async function getRobloxHeadshot(username) {
    if (!username) {
      return null;
    }

    try {
      const userResponse =
        await fetch(
          "https://users.roblox.com/v1/usernames/users",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({
              usernames: [username],
              excludeBannedUsers: false
            }),
            cache: "no-store"
          }
        );

      if (!userResponse.ok) {
        return null;
      }

      const userData =
        await userResponse.json();

      const user =
        Array.isArray(userData.data)
          ? userData.data[0]
          : null;

      if (!user || !user.id) {
        return null;
      }

      const thumbnailResponse =
        await fetch(
          `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${encodeURIComponent(
            user.id
          )}&size=150x150&format=Png&isCircular=false`,
          {
            method: "GET",
            cache: "no-store"
          }
        );

      if (!thumbnailResponse.ok) {
        return null;
      }

      const thumbnailData =
        await thumbnailResponse.json();

      const thumbnail =
        Array.isArray(
          thumbnailData.data
        )
          ? thumbnailData.data[0]
          : null;

      if (
        !thumbnail ||
        !thumbnail.imageUrl
      ) {
        return null;
      }

      return thumbnail.imageUrl;
    } catch (error) {
      console.warn(
        "Roblox avatar lookup failed:",
        error
      );

      return null;
    }
  }

  async function loadRobloxAvatar(data) {
    if (
      !data.verified ||
      !data.robloxUsername
    ) {
      profileAvatarContainer.classList.add(
        "guest"
      );

      profileAvatar.removeAttribute(
        "src"
      );

      return;
    }

    profileAvatarContainer.classList.remove(
      "guest"
    );

    const avatarUrl =
      await getRobloxHeadshot(
        data.robloxUsername
      );

    if (
      avatarUrl &&
      profileData === data
    ) {
      profileAvatar.src =
        avatarUrl;
    }
  }

  function applyProfile(data) {
    profileData = data;

    if (!data.authenticated) {
      closeProfileMenu();

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

    const verified =
      Boolean(
        data.verified &&
        data.robloxUsername
      );

    profileCard.classList.toggle(
      "profile-guest",
      !verified
    );

    profileUsername.textContent =
      verified
        ? data.robloxUsername
        : (
            data.discordUsername ||
            "Guest"
          );

    profileStatus.textContent =
      verified
        ? "VERIFIED"
        : "GUEST";

    profileAvatarContainer.classList.toggle(
      "guest",
      !verified
    );

    if (!verified) {
      profileAvatar.removeAttribute(
        "src"
      );
    }

    createProfileMenu(data);
  }

  async function syncAuthentication() {
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
        throw new Error(
          `Authentication check failed: ${response.status}`
        );
      }

      const data =
        await response.json();

      applyProfile(data);

      if (
        data.authenticated &&
        data.verified &&
        data.robloxUsername
      ) {
        await loadRobloxAvatar(data);
      }
    } catch (error) {
      console.error(
        "Authentication check failed:",
        error
      );
    }
  }

  profileCard.addEventListener(
    "click",
    event => {
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
    event => {
      if (
        !profileCard.contains(
          event.target
        )
      ) {
        closeProfileMenu();
      }
    }
  );

  document.addEventListener(
    "keydown",
    event => {
      if (
        event.key === "Escape"
      ) {
        closeProfileMenu();
      }
    }
  );

  await syncAuthentication();
});
