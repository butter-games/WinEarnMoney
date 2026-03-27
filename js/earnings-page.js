const EarningsPage = (() => {
  let currentAmountFilter = "all";

  const typeLabels = {
    game_win: "Game Win",
    tournament_win: "Tournament Win",
    withdrawal: "Withdrawal",
    subscription: "Subscription",
    signup_bonus: "Signup Bonus",
    refund: "Refund",
  };

  const typeIcons = {
    game_win: "&#127922;",
    tournament_win: "&#127942;",
    withdrawal: "&#128184;",
    subscription: "&#128081;",
    signup_bonus: "&#127873;",
    refund: "&#128260;",
  };

  function init() {
    if (!Auth.isLoggedIn()) {
      document.getElementById("earnings-summary").classList.add("hidden");
      document.querySelector(".earnings-filters").classList.add("hidden");
      document.getElementById("earnings-list").classList.add("hidden");
      document.getElementById("earnings-login").classList.remove("hidden");
      return;
    }

    updateSummary();
    applyFilters();

    // Re-check auth periodically
    setInterval(() => {
      if (Auth.isLoggedIn()) {
        document.getElementById("earnings-login").classList.add("hidden");
        document.getElementById("earnings-summary").classList.remove("hidden");
        document.querySelector(".earnings-filters").classList.remove("hidden");
        document.getElementById("earnings-list").classList.remove("hidden");
        updateSummary();
        applyFilters();
      }
    }, 2000);
  }

  function updateSummary() {
    const summary = Ledger.getSummary();
    const user = Auth.currentUser();

    document.getElementById("sum-balance").textContent = (user ? user.points || 0 : 0).toLocaleString();
    document.getElementById("sum-earned").textContent = summary.totalEarned.toLocaleString();
    document.getElementById("sum-spent").textContent = summary.totalSpent.toLocaleString();
    document.getElementById("sum-games").textContent = (summary.gameWins + summary.tournamentWins).toLocaleString();
  }

  function filter(amountType, btn) {
    currentAmountFilter = amountType;
    document.querySelectorAll(".filter-tab").forEach((t) => t.classList.remove("active"));
    btn.classList.add("active");
    applyFilters();
  }

  function applyFilters() {
    const typeFilter = document.getElementById("filter-type").value;
    const dateFrom = document.getElementById("filter-from").value;
    const dateTo = document.getElementById("filter-to").value;

    const filters = {};
    if (currentAmountFilter !== "all") filters.amountType = currentAmountFilter;
    if (typeFilter) filters.type = typeFilter;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;

    const entries = Ledger.getFiltered(filters);
    renderEntries(entries);
  }

  function renderEntries(entries) {
    const listEl = document.getElementById("earnings-list");
    const emptyEl = document.getElementById("earnings-empty");

    if (entries.length === 0) {
      listEl.innerHTML = "";
      emptyEl.classList.remove("hidden");
      return;
    }

    emptyEl.classList.add("hidden");

    // Group by date
    const grouped = {};
    entries.forEach((e) => {
      const dateKey = new Date(e.date).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(e);
    });

    let html = "";
    for (const [date, items] of Object.entries(grouped)) {
      const dayTotal = items.reduce((sum, e) => sum + e.amount, 0);
      html += `
        <div class="earnings-date-group">
          <div class="earnings-date-header">
            <span class="earnings-date">${date}</span>
            <span class="earnings-day-total ${dayTotal >= 0 ? "positive" : "negative"}">${dayTotal >= 0 ? "+" : ""}${dayTotal.toLocaleString()} pts</span>
          </div>
          ${items.map((e) => renderEntry(e)).join("")}
        </div>
      `;
    }

    listEl.innerHTML = html;
  }

  function renderEntry(entry) {
    const isPositive = entry.amount >= 0;
    const icon = typeIcons[entry.type] || "&#128176;";
    const label = typeLabels[entry.type] || entry.type;
    const time = new Date(entry.date).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

    return `
      <div class="earnings-entry">
        <div class="earnings-entry-left">
          <div class="earnings-entry-icon ${isPositive ? "entry-positive" : "entry-negative"}">${icon}</div>
          <div class="earnings-entry-info">
            <span class="earnings-entry-desc">${entry.description}</span>
            <span class="earnings-entry-meta">${label} &middot; ${time}</span>
          </div>
        </div>
        <div class="earnings-entry-right">
          <span class="earnings-entry-amount ${isPositive ? "positive" : "negative"}">
            ${isPositive ? "+" : ""}${entry.amount.toLocaleString()} pts
          </span>
          <span class="earnings-entry-balance">Bal: ${entry.balanceAfter.toLocaleString()}</span>
        </div>
      </div>
    `;
  }

  document.addEventListener("DOMContentLoaded", init);

  return { filter, applyFilters };
})();
