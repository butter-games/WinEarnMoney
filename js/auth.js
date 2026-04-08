window.Auth = (() => {
  // Local cache of user data (refreshed from API)
  var cachedUser = null;

  function isLoggedIn() {
    return API.isAuthenticated();
  }

  function currentUser() {
    return cachedUser;
  }

  function getInitials(name) {
    if (!name) return "?";
    return name
      .split(" ")
      .map(function(w) { return w[0]; })
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  // UI methods
  function showModal(form) {
    var modal = document.getElementById("auth-modal");
    if (!modal) return;
    modal.classList.remove("hidden");
    switchForm(form);
    document.body.style.overflow = "hidden";
  }

  function hideModal() {
    var modal = document.getElementById("auth-modal");
    if (!modal) return;
    modal.classList.add("hidden");
    document.body.style.overflow = "";
    clearErrors();
  }

  function switchForm(form) {
    var el;
    el = document.getElementById("login-form");
    if (el) el.classList.toggle("hidden", form !== "login");
    el = document.getElementById("signup-form");
    if (el) el.classList.toggle("hidden", form !== "signup");
    el = document.getElementById("profile-view");
    if (el) el.classList.toggle("hidden", form !== "profile");
    clearErrors();
  }

  function clearErrors() {
    document.querySelectorAll(".form-error").forEach(function(el) {
      el.classList.add("hidden");
      el.textContent = "";
    });
  }

  function showError(id, message) {
    var el = document.getElementById(id);
    if (el) {
      el.textContent = message;
      el.classList.remove("hidden");
    }
  }

  // Auth actions
  async function signup(e) {
    e.preventDefault();
    var username = document.getElementById("signup-name").value.trim();
    var email = document.getElementById("signup-email").value.trim();
    var password = document.getElementById("signup-password").value;
    var confirm = document.getElementById("signup-confirm").value;

    if (password !== confirm) {
      showError("signup-error", "Passwords do not match.");
      return;
    }

    try {
      // Check for referral code in URL
      var refCode = new URLSearchParams(window.location.search).get("ref") || "";
      cachedUser = await API.signup(username, email, password, refCode);
      hideModal();
      updateUI();
      showWelcomeDialog(username);
    } catch (err) {
      showError("signup-error", err.message);
    }
  }

  function showWelcomeDialog(name) {
    var dialog = document.getElementById("welcome-dialog");
    if (!dialog) {
      dialog = document.createElement("div");
      dialog.id = "welcome-dialog";
      dialog.className = "modal-overlay";
      var subUrl = window.location.pathname.indexOf("/games/") !== -1
        ? "subscription.html"
        : "games/subscription.html";
      dialog.innerHTML =
        '<div class="modal welcome-modal">' +
          '<div class="welcome-content">' +
            '<div class="welcome-icon">&#127881;</div>' +
            '<h2>Account Created!</h2>' +
            '<p class="welcome-name">Welcome, <strong id="welcome-user-name"></strong>!</p>' +
            '<p class="welcome-msg">Your account is ready. Start playing free games now!</p>' +
            '<div class="welcome-upgrade">' +
              '<div class="welcome-upgrade-icon">&#127942;</div>' +
              '<div class="welcome-upgrade-text">' +
                '<strong>Want to compete in tournaments?</strong>' +
                '<p>Upgrade to a subscription to unlock hourly contests, unlimited winnings, and cash prizes.</p>' +
              '</div>' +
            '</div>' +
            '<div class="welcome-buttons">' +
              '<a href="' + subUrl + '" class="btn btn-primary btn-lg btn-full">Upgrade to Pro - $1.99/mo</a>' +
              '<button class="btn btn-outline btn-full" id="welcome-dismiss">Maybe Later</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      document.body.appendChild(dialog);

      dialog.addEventListener("click", function(e) {
        if (e.target === dialog) dialog.classList.add("hidden");
      });
      dialog.querySelector("#welcome-dismiss").addEventListener("click", function() {
        dialog.classList.add("hidden");
      });
    }

    var nameEl = document.getElementById("welcome-user-name");
    if (nameEl) nameEl.textContent = name;
    dialog.classList.remove("hidden");
  }

  async function login(e) {
    e.preventDefault();
    var email = document.getElementById("login-email").value.trim();
    var password = document.getElementById("login-password").value;

    try {
      cachedUser = await API.login(email, password);
      hideModal();
      updateUI();
    } catch (err) {
      showError("login-error", err.message);
    }
  }

  function logout() {
    API.logout();
    cachedUser = null;
    hideUserMenu();
    updateUI();
  }

  async function showProfile() {
    try {
      cachedUser = await API.getProfile();
    } catch (err) {
      console.warn("Failed to fetch profile:", err);
    }

    if (!cachedUser) return;

    var el;
    el = document.getElementById("profile-name");
    if (el) el.textContent = cachedUser.username;
    el = document.getElementById("profile-email");
    if (el) el.textContent = cachedUser.email;
    el = document.getElementById("profile-points");
    if (el) el.textContent = (cachedUser.points || 0).toLocaleString();
    el = document.getElementById("profile-games");
    if (el) el.textContent = (cachedUser.games_played || 0).toLocaleString();
    el = document.getElementById("profile-joined");
    if (el) el.textContent = new Date(cachedUser.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" });
    el = document.getElementById("profile-avatar");
    if (el) el.textContent = getInitials(cachedUser.username);

    showModal("profile");
    hideUserMenu();
  }

  function toggleUserMenu() {
    var menu = document.getElementById("user-menu");
    var avatar = document.getElementById("nav-avatar");
    if (!menu || !avatar) return;

    if (menu.classList.contains("hidden")) {
      var rect = avatar.getBoundingClientRect();
      menu.style.top = (rect.bottom + 8) + "px";
      menu.style.right = (window.innerWidth - rect.right) + "px";
      menu.classList.remove("hidden");
    } else {
      menu.classList.add("hidden");
    }
  }

  function hideUserMenu() {
    var menu = document.getElementById("user-menu");
    if (menu) menu.classList.add("hidden");
  }

  async function addPoints(pts, source, description) {
    // Points are now managed server-side via contest submission
    // This function just refreshes the cached user
    try {
      cachedUser = await API.getProfile();
      updatePointsDisplay();
    } catch (err) {
      console.warn("Failed to refresh points:", err);
    }
  }

  function updatePointsDisplay() {
    var el = document.getElementById("nav-points");
    if (cachedUser && el) {
      el.textContent = (cachedUser.points || 0).toLocaleString() + " pts";
    }
  }

  function updateUI() {
    try {
      var loggedIn = isLoggedIn();

      var navAuth = document.querySelector(".nav-auth");
      var navUser = document.getElementById("nav-user");
      if (navAuth) navAuth.classList.toggle("hidden", loggedIn);
      if (navUser) navUser.classList.toggle("hidden", !loggedIn);

      if (loggedIn && cachedUser) {
        var avatar = document.getElementById("nav-avatar");
        var menuName = document.getElementById("user-menu-name");
        if (avatar) avatar.textContent = getInitials(cachedUser.username);
        if (menuName) menuName.textContent = cachedUser.username;
        updatePointsDisplay();

        var ctaBtn = document.getElementById("cta-btn");
        if (ctaBtn) {
          ctaBtn.textContent = "Go to Games";
          ctaBtn.onclick = function() {
            window.location.href = "games/tournament.html";
          };
        }

        var heroCta = document.getElementById("hero-cta");
        if (heroCta) {
          heroCta.textContent = "Start Playing";
          heroCta.href = "games/tournament.html";
        }
      } else {
        var ctaBtn2 = document.getElementById("cta-btn");
        if (ctaBtn2) {
          ctaBtn2.textContent = "Create Free Account";
          ctaBtn2.onclick = function() { Auth.showModal("signup"); };
        }
      }
    } catch (err) {
      console.warn("Auth updateUI error:", err);
    }
  }

  // Load user profile on page load if authenticated
  async function loadUser() {
    if (isLoggedIn()) {
      try {
        cachedUser = await API.getProfile();
      } catch (err) {
        // Token expired or invalid
        API.logout();
        cachedUser = null;
      }
    }
    updateUI();
  }

  // Bind all events on DOMContentLoaded
  function bindEvents() {
    // Avatar click
    var avatar = document.getElementById("nav-avatar");
    if (avatar) {
      avatar.addEventListener("click", function(e) {
        e.stopPropagation();
        toggleUserMenu();
      });
    }

    // User menu links
    var menu = document.getElementById("user-menu");
    if (menu) {
      menu.addEventListener("click", function(e) {
        var link = e.target.closest("a");
        if (!link) return;
        var action = link.getAttribute("data-action");
        if (action === "profile") {
          e.preventDefault();
          showProfile();
        } else if (action === "logout") {
          e.preventDefault();
          logout();
        }
      });
    }

    // Auth buttons
    document.querySelectorAll("[data-auth]").forEach(function(btn) {
      btn.addEventListener("click", function(e) {
        e.preventDefault();
        showModal(btn.getAttribute("data-auth"));
      });
    });

    // Login form
    var loginForm = document.querySelector("#login-form form");
    if (loginForm) loginForm.addEventListener("submit", login);

    // Signup form
    var signupForm = document.querySelector("#signup-form form");
    if (signupForm) signupForm.addEventListener("submit", signup);

    // Switch form links
    document.querySelectorAll("[data-switch-form]").forEach(function(link) {
      link.addEventListener("click", function(e) {
        e.preventDefault();
        switchForm(link.getAttribute("data-switch-form"));
      });
    });

    // Auth modal close
    var authModal = document.getElementById("auth-modal");
    if (authModal) {
      var closeBtn = authModal.querySelector(".modal-close");
      if (closeBtn) closeBtn.addEventListener("click", hideModal);
      var profileClose = authModal.querySelector("#profile-view .btn-outline");
      if (profileClose) profileClose.addEventListener("click", hideModal);
    }

    // Close on outside click
    document.addEventListener("click", function(e) {
      if (e.target.id === "auth-modal") hideModal();
      if (!e.target.closest("#nav-avatar") && !e.target.closest("#user-menu")) {
        hideUserMenu();
      }
    });

    document.addEventListener("keydown", function(e) {
      if (e.key === "Escape") {
        hideModal();
        hideUserMenu();
      }
    });

    // Mobile menu
    var mobileBtn = document.querySelector(".mobile-menu-btn");
    var navLinks = document.querySelector(".nav-links");
    if (mobileBtn && navLinks) {
      mobileBtn.addEventListener("click", function(e) {
        e.stopPropagation();
        navLinks.classList.toggle("nav-open");
      });
      navLinks.querySelectorAll("a").forEach(function(link) {
        link.addEventListener("click", function() {
          navLinks.classList.remove("nav-open");
        });
      });
      document.addEventListener("click", function(e) {
        if (!e.target.closest(".mobile-menu-btn") && !e.target.closest(".nav-links")) {
          navLinks.classList.remove("nav-open");
        }
      });
    }

    // Load user and update UI
    loadUser();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindEvents);
  } else {
    bindEvents();
  }

  return {
    showModal: showModal,
    hideModal: hideModal,
    switchForm: switchForm,
    signup: signup,
    login: login,
    logout: logout,
    showProfile: showProfile,
    toggleUserMenu: toggleUserMenu,
    isLoggedIn: isLoggedIn,
    currentUser: currentUser,
    addPoints: addPoints,
    updatePointsDisplay: updatePointsDisplay,
  };
})();
