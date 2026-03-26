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
    document.getElementById("user-menu").classList.toggle("hidden");
  }

  function hideUserMenu() {
    document.getElementById("user-menu").classList.add("hidden");
  }

  function addPoints(pts) {
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
    document.querySelector(".nav-auth").classList.toggle("hidden", loggedIn);
    document.getElementById("nav-user").classList.toggle("hidden", !loggedIn);

    if (loggedIn && user) {
      document.getElementById("nav-avatar").textContent = getInitials(user.name);
      document.getElementById("user-menu-name").textContent = user.name;
      updatePointsDisplay();

      // Update CTA button
      const ctaBtn = document.getElementById("cta-btn");
      ctaBtn.textContent = "Go to Games";
      ctaBtn.onclick = () => {
        document.getElementById("play").scrollIntoView({ behavior: "smooth" });
      };

      // Update hero CTA
      const heroCta = document.getElementById("hero-cta");
      heroCta.textContent = "Start Playing";
      heroCta.onclick = null;
      heroCta.href = "#play";
    } else {
      const ctaBtn = document.getElementById("cta-btn");
      ctaBtn.textContent = "Create Free Account";
      ctaBtn.onclick = () => Auth.showModal("signup");
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
    // Close user menu when clicking outside
    if (!e.target.closest(".nav-user")) {
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
