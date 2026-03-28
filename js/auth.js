window.Auth = (() => {
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
  function signup(e) {
    e.preventDefault();
    var name = document.getElementById("signup-name").value.trim();
    var email = document.getElementById("signup-email").value.trim().toLowerCase();
    var password = document.getElementById("signup-password").value;
    var confirm = document.getElementById("signup-confirm").value;

    if (password !== confirm) {
      showError("signup-error", "Passwords do not match.");
      return;
    }

    var users = getUsers();
    if (users[email]) {
      showError("signup-error", "An account with this email already exists.");
      return;
    }

    var user = {
      name: name,
      email: email,
      password: password,
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

  function login(e) {
    e.preventDefault();
    var email = document.getElementById("login-email").value.trim().toLowerCase();
    var password = document.getElementById("login-password").value;

    var users = getUsers();
    var user = users[email];

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
    var user = currentUser();
    if (!user) return;

    var el;
    el = document.getElementById("profile-name");
    if (el) el.textContent = user.name;
    el = document.getElementById("profile-email");
    if (el) el.textContent = user.email;
    el = document.getElementById("profile-points");
    if (el) el.textContent = user.points.toLocaleString();
    el = document.getElementById("profile-games");
    if (el) el.textContent = user.gamesPlayed.toLocaleString();
    el = document.getElementById("profile-joined");
    if (el) el.textContent = new Date(user.joined).toLocaleDateString("en-US", { month: "short", year: "numeric" });
    el = document.getElementById("profile-avatar");
    if (el) el.textContent = getInitials(user.name);

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

  function addPoints(pts, source, description) {
    var user = currentUser();
    if (!user) return;

    user.points += pts;
    user.gamesPlayed += 1;
    saveSession(user);

    var users = getUsers();
    if (users[user.email]) {
      users[user.email].points = user.points;
      users[user.email].gamesPlayed = user.gamesPlayed;
      saveUsers(users);
    }

    if (typeof Ledger !== "undefined" && pts !== 0) {
      var type = source || Ledger.TYPES.GAME_WIN;
      var desc = description || "Earned " + pts + " points";
      Ledger.addEntry(type, pts, desc);
    }

    updatePointsDisplay();
  }

  function updatePointsDisplay() {
    var user = currentUser();
    var el = document.getElementById("nav-points");
    if (user && el) {
      el.textContent = user.points.toLocaleString() + " pts";
    }
  }

  function updateUI() {
    try {
      var loggedIn = isLoggedIn();
      var user = currentUser();

      var navAuth = document.querySelector(".nav-auth");
      var navUser = document.getElementById("nav-user");
      if (navAuth) navAuth.classList.toggle("hidden", loggedIn);
      if (navUser) navUser.classList.toggle("hidden", !loggedIn);

      if (loggedIn && user) {
        var avatar = document.getElementById("nav-avatar");
        var menuName = document.getElementById("user-menu-name");
        if (avatar) avatar.textContent = getInitials(user.name);
        if (menuName) menuName.textContent = user.name;
        updatePointsDisplay();

        var ctaBtn = document.getElementById("cta-btn");
        if (ctaBtn) {
          ctaBtn.textContent = "Go to Games";
          ctaBtn.onclick = function() {
            window.location.href = "games/index.html";
          };
        }

        var heroCta = document.getElementById("hero-cta");
        if (heroCta) {
          heroCta.textContent = "Start Playing";
          heroCta.href = "games/index.html";
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

  // Bind all events on DOMContentLoaded - no inline onclick needed
  function bindEvents() {
    // Avatar click → toggle menu
    var avatar = document.getElementById("nav-avatar");
    if (avatar) {
      avatar.addEventListener("click", function(e) {
        e.stopPropagation();
        toggleUserMenu();
      });
    }

    // User menu links with data-action
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
        // Other links (earnings, withdraw, subscription) navigate normally
      });
    }

    // All [data-auth] buttons anywhere on the page (nav, CTA, login prompts)
    document.querySelectorAll("[data-auth]").forEach(function(btn) {
      btn.addEventListener("click", function(e) {
        e.preventDefault();
        showModal(btn.getAttribute("data-auth"));
      });
    });

    // Login form submit
    var loginForm = document.querySelector("#login-form form");
    if (loginForm) {
      loginForm.addEventListener("submit", login);
    }

    // Signup form submit
    var signupForm = document.querySelector("#signup-form form");
    if (signupForm) {
      signupForm.addEventListener("submit", signup);
    }

    // Switch form links
    document.querySelectorAll("[data-switch-form]").forEach(function(link) {
      link.addEventListener("click", function(e) {
        e.preventDefault();
        switchForm(link.getAttribute("data-switch-form"));
      });
    });

    // Auth modal close button (only the one inside #auth-modal)
    var authModal = document.getElementById("auth-modal");
    if (authModal) {
      var closeBtn = authModal.querySelector(".modal-close");
      if (closeBtn) closeBtn.addEventListener("click", hideModal);

      // Profile view close button
      var profileClose = authModal.querySelector("#profile-view .btn-outline");
      if (profileClose) profileClose.addEventListener("click", hideModal);
    }

    // Close modal on overlay click, close menu on outside click
    document.addEventListener("click", function(e) {
      // Only close auth modal overlay (not other overlays like sub-prompt)
      if (e.target.id === "auth-modal") {
        hideModal();
      }
      // Close user menu when clicking outside
      if (!e.target.closest("#nav-avatar") && !e.target.closest("#user-menu")) {
        hideUserMenu();
      }
    });

    // Close modal on Escape
    document.addEventListener("keydown", function(e) {
      if (e.key === "Escape") {
        hideModal();
        hideUserMenu();
      }
    });

    // Mobile hamburger menu toggle (works on ALL pages)
    var mobileBtn = document.querySelector(".mobile-menu-btn");
    var navLinks = document.querySelector(".nav-links");
    if (mobileBtn && navLinks) {
      mobileBtn.addEventListener("click", function(e) {
        e.stopPropagation();
        navLinks.classList.toggle("nav-open");
      });
      // Close mobile menu when a nav link is clicked
      navLinks.querySelectorAll("a").forEach(function(link) {
        link.addEventListener("click", function() {
          navLinks.classList.remove("nav-open");
        });
      });
      // Close mobile menu when clicking outside
      document.addEventListener("click", function(e) {
        if (!e.target.closest(".mobile-menu-btn") && !e.target.closest(".nav-links")) {
          navLinks.classList.remove("nav-open");
        }
      });
    }

    // Run updateUI
    updateUI();
  }

  // Init
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
