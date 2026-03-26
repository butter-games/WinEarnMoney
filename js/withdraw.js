const Withdraw = (() => {
  const POINTS_TO_DOLLAR = 100; // 100 pts = $1
  const HISTORY_KEY = "wem_withdrawals";

  const methodLabels = {
    paypal: "PayPal",
    bank: "Bank Transfer",
    giftcard: "Gift Card",
    crypto: "Crypto (USDT)",
  };

  const methodTimes = {
    paypal: "Instant",
    bank: "2-3 business days",
    giftcard: "Instant",
    crypto: "~30 minutes",
  };

  const methodPlaceholders = {
    paypal: "you@example.com",
    bank: "Account number",
    giftcard: "Email for gift card delivery",
    crypto: "USDT wallet address (TRC-20)",
  };

  const methodDetailLabels = {
    paypal: "PayPal Email",
    bank: "Bank Account Number",
    giftcard: "Email Address",
    crypto: "Wallet Address",
  };

  let selectedMethod = "paypal";

  function init() {
    updateUI();

    // Re-check on auth changes
    const origLogin = Auth.login;
    const origSignup = Auth.signup;

    // Poll for auth changes (simple approach)
    setInterval(updateUI, 1000);
  }

  function updateUI() {
    const loggedIn = Auth.isLoggedIn();

    document.getElementById("withdraw-form-card").classList.toggle("hidden", !loggedIn);
    document.getElementById("wd-login-prompt").classList.toggle("hidden", loggedIn);
    document.getElementById("wd-history").classList.toggle("hidden", !loggedIn);

    if (loggedIn) {
      const user = Auth.currentUser();
      const points = user.points || 0;
      const dollarBalance = points / POINTS_TO_DOLLAR;
      const withdrawn = user.totalWithdrawn || 0;
      const totalEarned = dollarBalance + withdrawn;

      document.getElementById("balance-amount").textContent = `$${dollarBalance.toFixed(2)}`;
      document.getElementById("total-earned").textContent = `$${totalEarned.toFixed(2)}`;
      document.getElementById("total-withdrawn").textContent = `$${withdrawn.toFixed(2)}`;
      document.getElementById("balance-pts").textContent = `${points.toLocaleString()} pts`;

      renderHistory();
    }
  }

  function setAmount(val) {
    const input = document.getElementById("wd-amount");
    if (val === "all") {
      const user = Auth.currentUser();
      const balance = (user.points || 0) / POINTS_TO_DOLLAR;
      input.value = balance.toFixed(2);
    } else {
      input.value = val.toFixed(2);
    }

    // Highlight selected quick button
    document.querySelectorAll(".wd-quick").forEach((btn) => btn.classList.remove("active"));
    event.target.classList.add("active");
  }

  function selectMethod(el, method) {
    selectedMethod = method;
    document.querySelectorAll(".wd-method").forEach((m) => m.classList.remove("selected"));
    el.classList.add("selected");

    document.getElementById("wd-details-label").textContent = methodDetailLabels[method];
    document.getElementById("wd-details-input").placeholder = methodPlaceholders[method];
    document.getElementById("wd-details-input").value = "";
  }

  function submit() {
    const amountStr = document.getElementById("wd-amount").value;
    const details = document.getElementById("wd-details-input").value.trim();
    const errorEl = document.getElementById("wd-error");

    errorEl.classList.add("hidden");

    if (!Auth.isLoggedIn()) {
      Auth.showModal("login");
      return;
    }

    const amount = parseFloat(amountStr);
    if (!amount || amount <= 0) {
      showError("Please enter a valid amount.");
      return;
    }

    if (amount < 1) {
      showError("Minimum withdrawal amount is $1.00.");
      return;
    }

    if (!details) {
      showError(`Please enter your ${methodDetailLabels[selectedMethod].toLowerCase()}.`);
      return;
    }

    const user = Auth.currentUser();
    const balance = (user.points || 0) / POINTS_TO_DOLLAR;

    if (amount > balance) {
      showError(`Insufficient balance. You have $${balance.toFixed(2)} available.`);
      return;
    }

    // Process withdrawal
    const pointsToDeduct = Math.round(amount * POINTS_TO_DOLLAR);
    user.points = Math.max(0, (user.points || 0) - pointsToDeduct);
    user.totalWithdrawn = (user.totalWithdrawn || 0) + amount;

    // Save to session and users store
    localStorage.setItem("wem_session", JSON.stringify(user));
    const users = JSON.parse(localStorage.getItem("wem_users") || "{}");
    if (users[user.email]) {
      users[user.email].points = user.points;
      users[user.email].totalWithdrawn = user.totalWithdrawn;
      localStorage.setItem("wem_users", JSON.stringify(users));
    }

    // Save transaction
    const transaction = {
      id: Date.now(),
      amount,
      method: selectedMethod,
      details: maskDetails(details, selectedMethod),
      status: "processing",
      date: new Date().toISOString(),
    };

    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    history.unshift(transaction);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));

    // Simulate processing -> complete after random delay
    setTimeout(() => {
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      const tx = h.find((t) => t.id === transaction.id);
      if (tx) {
        tx.status = "completed";
        localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
        renderHistory();
      }
    }, 5000 + Math.random() * 10000);

    // Show success
    document.getElementById("wd-success-amount").textContent = `$${amount.toFixed(2)}`;
    document.getElementById("wd-success-method").textContent = methodLabels[selectedMethod];
    document.getElementById("wd-success-time").textContent = methodTimes[selectedMethod];
    document.getElementById("wd-success-msg").textContent =
      `Your withdrawal of $${amount.toFixed(2)} via ${methodLabels[selectedMethod]} is being processed.`;
    document.getElementById("wd-success-modal").classList.remove("hidden");

    // Reset form
    document.getElementById("wd-amount").value = "";
    document.getElementById("wd-details-input").value = "";

    // Update nav points
    if (typeof Auth !== "undefined") {
      Auth.updatePointsDisplay?.();
    }
    document.getElementById("nav-points").textContent = user.points.toLocaleString() + " pts";

    updateUI();
  }

  function maskDetails(details, method) {
    if (method === "paypal" || method === "giftcard") {
      const parts = details.split("@");
      if (parts.length === 2) {
        return parts[0].slice(0, 2) + "***@" + parts[1];
      }
    }
    if (method === "bank") {
      return "***" + details.slice(-4);
    }
    if (method === "crypto") {
      return details.slice(0, 6) + "..." + details.slice(-4);
    }
    return "***";
  }

  function showError(msg) {
    const el = document.getElementById("wd-error");
    el.textContent = msg;
    el.classList.remove("hidden");
  }

  function renderHistory() {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    const listEl = document.getElementById("wd-history-list");
    const emptyEl = document.getElementById("wd-history-empty");

    if (history.length === 0) {
      listEl.innerHTML = "";
      emptyEl.classList.remove("hidden");
      return;
    }

    emptyEl.classList.add("hidden");
    listEl.innerHTML = history.slice(0, 20).map((tx) => `
      <div class="wd-tx">
        <div class="wd-tx-left">
          <div class="wd-tx-icon ${tx.status === 'completed' ? 'wd-tx-complete' : 'wd-tx-pending'}">
            ${tx.status === 'completed' ? '&#10003;' : '&#8987;'}
          </div>
          <div class="wd-tx-info">
            <span class="wd-tx-method">${methodLabels[tx.method] || tx.method}</span>
            <span class="wd-tx-detail">${tx.details} &middot; ${formatDate(tx.date)}</span>
          </div>
        </div>
        <div class="wd-tx-right">
          <span class="wd-tx-amount">-$${tx.amount.toFixed(2)}</span>
          <span class="wd-tx-status wd-tx-status-${tx.status}">${capitalize(tx.status)}</span>
        </div>
      </div>
    `).join("");
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  document.addEventListener("DOMContentLoaded", init);

  return { setAmount, selectMethod, submit };
})();
