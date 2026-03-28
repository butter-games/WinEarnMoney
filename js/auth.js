const Auth = (() => {
  const STORAGE_KEY = "wem_users";
  const SESSION_KEY = "wem_session";

  function getUsers() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  }

  function saveUsers(users) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  }

  function getSession() {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  }

  function saveSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function isLoggedIn() {
    return getSession() !== null;
  }

  function currentUser() {
    return getSession();
  }

  function getInitials(name) {
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  // UI methods
  function showModal(form) {
    document.getElementById("auth-modal").classList.remove("hidden");
    switchForm(form);
    document.body.style.overflow = "hidden";
  }

  function hideModal() {
    document.getElementById("auth-modal").classList.add("hidden");
    document.body.style.overflow = "";
    clearErrors();
  }

  function switchForm(form) {
    document.getElementById("login-form").classList.toggle("hidden", form !== "login");
    document.getElementById("signup-form").classList.toggle("hidden", form !== "signup");
    document.getElementById("profile-view").classList.toggle("hidden", form !== "profile");
    clearErrors();
  }

  function clearErrors() {
    document.querySelectorAll(".form-error").forEach((el) => {
      el.classList.add("hidden");
      el.textContent = "";
    });
  }

  function showError(id, message) {
    const el = document.getElementById(id);
    el.textContent = message;
    el.classList.remove("hidden");
  }

  // Auth actions
  function signup(e) {
    e.preventDefault();
    const name = document.getElementById("signup-name").value.trim();
    const email = document.getElementById("signup-email").value.trim().toLowerCase();
    const password = document.getElementById("signup-password").value;
    const confirm = document.getElementById("signup-confirm").value;

    if (password !== confirm) {
      showError("signup-error", "Passwords do not match.");
      return;
    }

    const users = getUsers();
    if (users[email]) {
      showError("signup-error", "An account with this email already exists.");
      return;
    }

    const user = {
      name,
      email,
      password,
      points: 0,
      gamesPlayed: 0,
      joined: new Date().toISOString(),
    };

    users[email] = user;
    saveUsers(users);
    saveSession(user);
    hideModal();
    updateUI();
    showWelcomeDialog(name);
  }

  function showWelcomeDialog(name) {
    // Create dialog if it doesn't exist
    let dialog = document.getElementById("welcome-dialog");
    if (!dialog) {
      dialog = document.createElement("div");
      dialog.id = "welcome-dialog";
      dialog.className = "modal-overlay";
      dialog.innerHTML = `
        <div class="modal welcome-modal">
          <div class="welcome-content">
            <div class="welcome-icon">&#127881;</div>
            <h2>Account Created!</h2>
            <p class="welcome-name">Welcome, <strong id="welcome-user-name"></strong>!</p>
            <p class="welcome-msg">Your account is ready. Start playing free games now!</p>
            <div class="welcome-upgrade">
              <div class="welcome-upgrade-icon">&#127942;</div>
              <div class="welcome-upgrade-text">
                <strong>Want to compete in tournaments?</strong>
                <p>Upgrade to a subscription to unlock hourly contests, unlimited winnings, and cash prizes.</p>
              </div>
            </div>
            <div class="welcome-buttons">
              <a href="${getSubscriptionUrl()}" class="btn btn-primary btn-lg btn-full">Upgrade to Pro - $1.99/mo</a>
              <button class="btn btn-outline btn-full" onclick="document.getElementById('welcome-dialog').classList.add('hidden')">Maybe Later</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(dialog);

      // Close on overlay click
      dialog.addEventListener("click", (e) => {
        if (e.target === dialog) dialog.classList.add("hidden");
      });
    }

    document.getElementById("welcome-user-name").textContent = name;
    dialog.classList.remove("hidden");
  }

  function getSubscriptionUrl() {
    // Detect if we're in /games/ or root
    if (window.location.pathname.includes("/games/")) {
      return "subscription.html";
    }
    return "games/subscription.html";
  }

  function login(e) {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim().toLowerCase();
    const password = document.getElementById("login-password").value;

    const users = getUsers();
    const user = users[email];

    if (!user || user.password !== password) {
      showError("login-error", "Invalid email or password.");
      return;
    }

    saveSession(user);
    hideModal();
    updateUI();
  }

  function logout() {
    clearSession();
    hideUserMenu();
    updateUI();
  }

  function showProfile() {
    const user = currentUser();
    if (!user) return;

    document.getElementById("profile-name").textContent = user.name;
    document.getElementById("profile-email").textContent = user.email;
    document.getElementById("profile-points").textContent = user.points.toLocaleString();
    document.getElementById("profile-games").textContent = user.gamesPlayed.toLocaleString();
    document.getElementById("profile-joined").textContent = new Date(user.joined).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });

    const avatar = document.getElementById("profile-avatar");
    avatar.textContent = getInitials(user.name);

    showModal("profile");
    hideUserMenu();
  }

  function toggleUserMenu() {
    const menu = document.getElementById("user-menu");
    const avatar = document.getElementById("nav-avatar");
    if (menu.classList.contains("hidden")) {
      // Position menu below the avatar
      const rect = avatar.getBoundingClientRect();
      menu.style.top = (rect.bottom + 8) + "px";
      menu.style.right = (window.innerWidth - rect.right) + "px";
      menu.classList.remove("hidden");
    } else {
      menu.classList.add("hidden");
    }
  }

  function hideUserMenu() {
    const menu = document.getElementById("user-menu");
    if (menu) menu.classList.add("hidden");
  }

  function addPoints(pts, source, description) {
    const user = currentUser();
    if (!user) return;

    user.points += pts;
    user.gamesPlayed += 1;
    saveSession(user);

    // Also update in users store
    const users = getUsers();
    if (users[user.email]) {
      users[user.email].points = user.points;
      users[user.email].gamesPlayed = user.gamesPlayed;
      saveUsers(users);
    }

    // Log to ledger
    if (typeof Ledger !== "undefined" && pts !== 0) {
      const type = source || Ledger.TYPES.GAME_WIN;
      const desc = description || `Earned ${pts} points`;
      Ledger.addEntry(type, pts, desc);
    }

    updatePointsDisplay();
  }

  function updatePointsDisplay() {
    const user = currentUser();
    if (user) {
      document.getElementById("nav-points").textContent = user.points.toLocaleString() + " pts";
    }
  }

  function updateUI() {
    const loggedIn = isLoggedIn();
    const user = currentUser();

    // Nav auth buttons vs user menu
    const navAuth = document.querySelector(".nav-auth");
    const navUser = document.getElementById("nav-user");
    if (navAuth) navAuth.classList.toggle("hidden", loggedIn);
    if (navUser) navUser.classList.toggle("hidden", !loggedIn);

    if (loggedIn && user) {
      const avatar = document.getElementById("nav-avatar");
      const menuName = document.getElementById("user-menu-name");
      if (avatar) avatar.textContent = getInitials(user.name);
      if (menuName) menuName.textContent = user.name;
      updatePointsDisplay();

      // Update CTA button (only exists on landing page)
      const ctaBtn = document.getElementById("cta-btn");
      if (ctaBtn) {
        ctaBtn.textContent = "Go to Games";
        ctaBtn.onclick = () => {
          const playSection = document.getElementById("play");
          if (playSection) playSection.scrollIntoView({ behavior: "smooth" });
        };
      }

      // Update hero CTA (only exists on landing page)
      const heroCta = document.getElementById("hero-cta");
      if (heroCta) {
        heroCta.textContent = "Start Playing";
        heroCta.onclick = null;
        heroCta.href = "games/index.html";
      }
    } else {
      const ctaBtn = document.getElementById("cta-btn");
      if (ctaBtn) {
        ctaBtn.textContent = "Create Free Account";
        ctaBtn.onclick = () => Auth.showModal("signup");
      }
    }
  }

  function handlePlayClick(e) {
    if (!isLoggedIn()) {
      e.preventDefault();
      showModal("signup");
    }
  }

  // Close modal on overlay click
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-overlay")) {
      hideModal();
    }
    // Close user menu when clicking outside (but not when clicking the menu itself)
    if (!e.target.closest(".nav-user") && !e.target.closest(".user-menu")) {
      hideUserMenu();
    }
  });

  // Close modal on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideModal();
  });

  // Init on load
  document.addEventListener("DOMContentLoaded", updateUI);

  return {
    showModal,
    hideModal,
    switchForm,
    signup,
    login,
    logout,
    showProfile,
    toggleUserMenu,
    handlePlayClick,
    isLoggedIn,
    currentUser,
    addPoints,
  };
})();
