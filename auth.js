const profileCard =
  document.getElementById(
    "profile-card"
  );

const profileAvatarContainer =
  document.getElementById(
    "profile-avatar-container"
  );

const profileAvatar =
  document.getElementById(
    "profile-avatar"
  );

const profileUsername =
  document.getElementById(
    "profile-username"
  );

const profileStatus =
  document.getElementById(
    "profile-status"
  );

const authLoginButton =
  document.getElementById(
    "login-button"
  );

let profileDropdown = null;

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

function closeProfileMenu() {
  if (!profileDropdown) {
    return;
  }

  profileDropdown.classList.remove(
    "open"
  );

  profileCard.classList.remove(
    "open"
  );

  profileCard.setAttribute(
    "aria-expanded",
    "false"
  );
}

function openProfileMenu() {
  if (!profileDropdown) {
    return;
  }

  profileDropdown.classList.add(
    "open"
  );

  profileCard.classList.add(
    "open"
  );

  profileCard.setAttribute(
    "aria-expanded",
    "true"
  );
}

function toggleProfileMenu() {
  if (!profileDropdown) {
    return;
  }

  if (
    profileDropdown.classList.contains(
      "open"
    )
  ) {
    closeProfileMenu();
  } else {
    openProfileMenu();
  }
}

function createProfileMenu(data) {
  if (profileDropdown) {
    profileDropdown.remove();
    profileDropdown = null;
  }

  profileDropdown =
    document.createElement("div");

  profileDropdown.className =
    "profile-dropdown";

  profileDropdown.id =
    "profile-dropdown";

  if (
    data.verified &&
    data.robloxUsername
  ) {
    const profileItem =
      document.createElement(
        "button"
      );

    profileItem.className =
      "profile-dropdown-item";

    profileItem.type = "button";

    profileItem.innerHTML = `
      <span class="profile-dropdown-icon">
        ${createIcon("profile")}
      </span>
      <span>My Profile</span>
    `;

    profileItem.addEventListener(
      "click",
      () => {
        window.location.href =
          `/profile/${encodeURIComponent(
            data.robloxUsername
          )}`;
      }
    );

    profileDropdown.appendChild(
      profileItem
    );

    const settingsItem =
      document.createElement(
        "button"
      );

    settingsItem.className =
      "profile-dropdown-item";

    settingsItem.type = "button";

    settingsItem.innerHTML = `
      <span class="profile-dropdown-icon">
        ${createIcon("settings")}
      </span>
      <span>Settings</span>
    `;

    settingsItem.addEventListener(
      "click",
      () => {
        window.location.href =
          "/settings";
      }
    );

    profileDropdown.appendChild(
      settingsItem
    );
  }

  const logoutItem =
    document.createElement(
      "button"
    );

  logoutItem.className =
    "profile-dropdown-item profile-dropdown-logout";

  logoutItem.type = "button";

  logoutItem.innerHTML = `
    <span class="profile-dropdown-icon">
      ${createIcon("logout")}
    </span>
    <span>Log Out</span>
  `;

  logoutItem.addEventListener(
    "click",
    async () => {
      try {
        await fetch(
          "/api/logout",
          {
            method: "POST",
            credentials: "include"
          }
        );
      } finally {
        window.location.reload();
      }
    }
  );

  profileDropdown.appendChild(
    logoutItem
  );

  profileCard.appendChild(
    profileDropdown
  );
}

async function loadRobloxAvatar(data) {
  profileAvatarContainer.classList.add(
    "guest"
  );

  profileAvatar.removeAttribute(
    "src"
  );

  if (
    !data.verified ||
    !data.robloxUsername
  ) {
    return;
  }

  try {
    const response =
      await fetch(
        "/api/roblox-avatar",
        {
          method: "GET",
          credentials: "include",
          cache: "no-store"
        }
      );

    if (!response.ok) {
      return;
    }

    const avatarData =
      await response.json();

    if (
      !avatarData.robloxAvatarUrl
    ) {
      return;
    }

    profileAvatar.onload = () => {
      profileAvatarContainer.classList.remove(
        "guest"
      );
    };

    profileAvatar.onerror = () => {
      profileAvatarContainer.classList.add(
        "guest"
      );

      profileAvatar.removeAttribute(
        "src"
      );
    };

    profileAvatar.src =
      avatarData.robloxAvatarUrl;
  } catch (error) {
    console.error(
      "Roblox avatar failed to load:",
      error
    );
  }
}

function applyProfile(data) {
  if (
    !data ||
    !data.authenticated
  ) {
    profileCard.style.display =
      "none";

    if (authLoginButton) {
      authLoginButton.style.display =
        "";
    }

    closeProfileMenu();

    return;
  }

  profileCard.style.display =
    "flex";

  if (authLoginButton) {
    authLoginButton.style.display =
      "none";
  }

  const username =
    data.verified &&
    data.robloxUsername
      ? data.robloxUsername
      : data.discordUsername ||
        "User";

  profileUsername.textContent =
    username;

  if (data.verified) {
    profileStatus.textContent =
      "VERIFIED";

    profileCard.classList.add(
      "verified"
    );

    profileCard.classList.remove(
      "guest"
    );
  } else {
    profileStatus.textContent =
      "GUEST";

    profileCard.classList.add(
      "guest"
    );

    profileCard.classList.remove(
      "verified"
    );

    profileAvatarContainer.classList.add(
      "guest"
    );

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
        `Authentication request failed: ${response.status}`
      );
    }

    const data =
      await response.json();

    applyProfile(data);

    if (
      data.authenticated &&
      data.verified
    ) {
      loadRobloxAvatar(data);
    }
  } catch (error) {
    console.error(
      "Authentication sync failed:",
      error
    );

    profileCard.style.display =
      "none";

    if (authLoginButton) {
      authLoginButton.style.display =
        "";
    }
  }
}

if (profileCard) {
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
}

document.addEventListener(
  "click",
  (event) => {
    if (!profileCard) {
      return;
    }

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
  (event) => {
    if (event.key === "Escape") {
      closeProfileMenu();
    }
  }
);

document.addEventListener(
  "DOMContentLoaded",
  () => {
    syncAuthentication();
  }
);
