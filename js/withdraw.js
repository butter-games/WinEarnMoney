const Withdraw = (() => {
  var POINTS_TO_DOLLAR = 100;

  var methodLabels = {
    paypal: "PayPal", bank: "Bank Transfer", giftcard: "Gift Card", crypto: "Crypto (USDT)",
  };
  var methodTimes = {
    paypal: "Instant", bank: "2-3 business days", giftcard: "Instant", crypto: "~30 minutes",
  };
  var methodPlaceholders = {
    paypal: "you@example.com", bank: "Account number", giftcard: "Email for gift card delivery", crypto: "USDT wallet address (TRC-20)",
  };
  var methodDetailLabels = {
    paypal: "PayPal Email", bank: "Bank Account Number", giftcard: "Email Address", crypto: "Wallet Address",
  };

  var selectedMethod = "paypal";

  function init() {
    setTimeout(function() {
      updateUI();
    }, 1000);
  }

  async function updateUI() {
    var loggedIn = Auth.isLoggedIn();

    document.getElementById("withdraw-form-card").classList.toggle("hidden", !loggedIn);
    document.getElementById("wd-login-prompt").classList.toggle("hidden", loggedIn);
    document.getElementById("wd-history").classList.toggle("hidden", !loggedIn);

    if (loggedIn) {
      try {
        var balance = await API.getBalance();
        document.getElementById("balance-amount").textContent = "$" + balance.dollar_balance.toFixed(2);
        document.getElementById("total-earned").textContent = "$" + balance.total_earned.toFixed(2);
        document.getElementById("total-withdrawn").textContent = "$" + balance.total_withdrawn.toFixed(2);
        document.getElementById("balance-pts").textContent = balance.points.toLocaleString() + " pts";
      } catch (err) {
        console.warn("Failed to fetch balance:", err);
        var user = Auth.currentUser();
        if (user) {
          var pts = user.points || 0;
          document.getElementById("balance-amount").textContent = "$" + (pts / POINTS_TO_DOLLAR).toFixed(2);
          document.getElementById("balance-pts").textContent = pts.toLocaleString() + " pts";
        }
      }

      renderHistory();
    }
  }

  function setAmount(val) {
    var input = document.getElementById("wd-amount");
    if (val === "all") {
      var balText = document.getElementById("balance-amount").textContent;
      input.value = parseFloat(balText.replace("$", "")).toFixed(2);
    } else {
      input.value = val.toFixed(2);
    }
    document.querySelectorAll(".wd-quick").forEach(function(btn) { btn.classList.remove("active"); });
    if (event && event.target) event.target.classList.add("active");
  }

  function selectMethod(el, method) {
    selectedMethod = method;
    document.querySelectorAll(".wd-method").forEach(function(m) { m.classList.remove("selected"); });
    el.classList.add("selected");
    document.getElementById("wd-details-label").textContent = methodDetailLabels[method];
    document.getElementById("wd-details-input").placeholder = methodPlaceholders[method];
    document.getElementById("wd-details-input").value = "";
  }

  async function submit() {
    var amountStr = document.getElementById("wd-amount").value;
    var details = document.getElementById("wd-details-input").value.trim();
    document.getElementById("wd-error").classList.add("hidden");

    if (!Auth.isLoggedIn()) { Auth.showModal("login"); return; }

    var amount = parseFloat(amountStr);
    if (!amount || amount <= 0) { showError("Please enter a valid amount."); return; }
    if (amount < 1) { showError("Minimum withdrawal amount is $1.00."); return; }
    if (!details) { showError("Please enter your " + methodDetailLabels[selectedMethod].toLowerCase() + "."); return; }

    try {
      var result = await API.withdraw(amount, selectedMethod, details);

      // Show success
      document.getElementById("wd-success-amount").textContent = "$" + amount.toFixed(2);
      document.getElementById("wd-success-method").textContent = methodLabels[selectedMethod];
      document.getElementById("wd-success-time").textContent = methodTimes[selectedMethod];
      document.getElementById("wd-success-msg").textContent =
        "Your withdrawal of $" + amount.toFixed(2) + " via " + methodLabels[selectedMethod] + " is being processed.";
      document.getElementById("wd-success-modal").classList.remove("hidden");

      // Reset form
      document.getElementById("wd-amount").value = "";
      document.getElementById("wd-details-input").value = "";

      // Refresh balance and history
      Auth.addPoints(0); // refresh profile
      updateUI();
    } catch (err) {
      showError(err.message || "Withdrawal failed. Please try again.");
    }
  }

  function showError(msg) {
    var el = document.getElementById("wd-error");
    el.textContent = msg;
    el.classList.remove("hidden");
  }

  async function renderHistory() {
    var listEl = document.getElementById("wd-history-list");
    var emptyEl = document.getElementById("wd-history-empty");

    try {
      var withdrawals = await API.getWithdrawals();

      if (withdrawals.length === 0) {
        listEl.innerHTML = "";
        emptyEl.classList.remove("hidden");
        return;
      }

      emptyEl.classList.add("hidden");
      listEl.innerHTML = withdrawals.map(function(tx) {
        var statusIcon = tx.status === "completed" ? "&#10003;" : "&#8987;";
        var statusClass = tx.status === "completed" ? "wd-tx-complete" : "wd-tx-pending";
        var dateStr = new Date(tx.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

        return '<div class="wd-tx">' +
          '<div class="wd-tx-left">' +
            '<div class="wd-tx-icon ' + statusClass + '">' + statusIcon + '</div>' +
            '<div class="wd-tx-info">' +
              '<span class="wd-tx-method">' + (methodLabels[tx.method] || tx.method) + '</span>' +
              '<span class="wd-tx-detail">' + dateStr + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="wd-tx-right">' +
            '<span class="wd-tx-amount">-$' + parseFloat(tx.amount).toFixed(2) + '</span>' +
            '<span class="wd-tx-status wd-tx-status-' + tx.status + '">' + tx.status.charAt(0).toUpperCase() + tx.status.slice(1) + '</span>' +
          '</div>' +
        '</div>';
      }).join("");
    } catch (err) {
      console.warn("Failed to fetch withdrawals:", err);
      listEl.innerHTML = "";
      emptyEl.classList.remove("hidden");
    }
  }

  document.addEventListener("DOMContentLoaded", init);

  return { setAmount: setAmount, selectMethod: selectMethod, submit: submit };
})();
