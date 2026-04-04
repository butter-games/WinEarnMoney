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
    // Wait for auth to load user
    setTimeout(function() {
      if (!Auth.isLoggedIn()) {
        document.getElementById("earnings-summary").classList.add("hidden");
        document.querySelector(".earnings-filters").classList.add("hidden");
        document.getElementById("earnings-list").classList.add("hidden");
        document.getElementById("earnings-login").classList.remove("hidden");
        return;
      }

      document.getElementById("earnings-login").classList.add("hidden");
      document.getElementById("earnings-summary").classList.remove("hidden");
      document.querySelector(".earnings-filters").classList.remove("hidden");
      document.getElementById("earnings-list").classList.remove("hidden");
      updateSummary();
      applyFilters();
    }, 1000);
  }

  async function updateSummary() {
    try {
      var data = await API.getLedger({ limit: 1 });
      var summary = data.summary;
      var balance = await API.getBalance();

      document.getElementById("sum-balance").textContent = (balance.points || 0).toLocaleString();
      document.getElementById("sum-earned").textContent = parseInt(summary.total_earned || 0).toLocaleString();
      document.getElementById("sum-spent").textContent = parseInt(summary.total_spent || 0).toLocaleString();
      document.getElementById("sum-games").textContent = (parseInt(summary.game_wins || 0) + parseInt(summary.tournament_wins || 0)).toLocaleString();
    } catch (err) {
      console.warn("Failed to load summary:", err);
      // Fallback to local data
      var localSummary = typeof Ledger !== "undefined" ? Ledger.getSummary() : {};
      var user = Auth.currentUser();
      document.getElementById("sum-balance").textContent = (user ? user.points || 0 : 0).toLocaleString();
      document.getElementById("sum-earned").textContent = (localSummary.totalEarned || 0).toLocaleString();
      document.getElementById("sum-spent").textContent = (localSummary.totalSpent || 0).toLocaleString();
      document.getElementById("sum-games").textContent = ((localSummary.gameWins || 0) + (localSummary.tournamentWins || 0)).toLocaleString();
    }
  }

  function filter(amountType, btn) {
    currentAmountFilter = amountType;
    document.querySelectorAll(".filter-tab").forEach(function(t) { t.classList.remove("active"); });
    btn.classList.add("active");
    applyFilters();
  }

  async function applyFilters() {
    var typeFilter = document.getElementById("filter-type").value;
    var dateFrom = document.getElementById("filter-from").value;
    var dateTo = document.getElementById("filter-to").value;

    var filters = { limit: 50 };
    if (typeFilter) filters.type = typeFilter;
    if (dateFrom) filters.from = dateFrom;
    if (dateTo) filters.to = dateTo;

    try {
      var data = await API.getLedger(filters);
      var entries = data.entries || [];

      // Client-side amount filter
      if (currentAmountFilter === "earned") {
        entries = entries.filter(function(e) { return e.amount > 0; });
      } else if (currentAmountFilter === "spent") {
        entries = entries.filter(function(e) { return e.amount < 0; });
      }

      renderEntries(entries);
    } catch (err) {
      console.warn("Failed to load ledger from API, using local:", err);
      // Fallback to local ledger
      var localFilters = {};
      if (currentAmountFilter !== "all") localFilters.amountType = currentAmountFilter;
      if (typeFilter) localFilters.type = typeFilter;
      if (dateFrom) localFilters.dateFrom = dateFrom;
      if (dateTo) localFilters.dateTo = dateTo;
      var entries = typeof Ledger !== "undefined" ? Ledger.getFiltered(localFilters) : [];
      renderEntries(entries);
    }
  }

  function renderEntries(entries) {
    var listEl = document.getElementById("earnings-list");
    var emptyEl = document.getElementById("earnings-empty");

    if (entries.length === 0) {
      listEl.innerHTML = "";
      emptyEl.classList.remove("hidden");
      return;
    }

    emptyEl.classList.add("hidden");

    // Group by date
    var grouped = {};
    entries.forEach(function(e) {
      var dateKey = new Date(e.created_at || e.date).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(e);
    });

    var html = "";
    for (var date in grouped) {
      var items = grouped[date];
      var dayTotal = items.reduce(function(sum, e) { return sum + e.amount; }, 0);
      html += '<div class="earnings-date-group">' +
        '<div class="earnings-date-header">' +
          '<span class="earnings-date">' + date + '</span>' +
          '<span class="earnings-day-total ' + (dayTotal >= 0 ? "positive" : "negative") + '">Earnings ' + (dayTotal >= 0 ? "+" : "") + dayTotal.toLocaleString() + '</span>' +
        '</div>';
      items.forEach(function(e) { html += renderEntry(e); });
      html += '</div>';
    }

    listEl.innerHTML = html;
  }

  function renderEntry(entry) {
    var isPositive = entry.amount >= 0;
    var icon = typeIcons[entry.type] || "&#128176;";
    var label = typeLabels[entry.type] || entry.type;
    var entryDate = new Date(entry.created_at || entry.date);
    var time = entryDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    var fullDate = entryDate.toLocaleString("en-US", {
      weekday: "short", month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });

    var meta = entry.metadata || entry.meta || {};
    var metaDetails = "";
    if (typeof meta === "object" && Object.keys(meta).length > 0) {
      for (var k in meta) {
        metaDetails += '<span>' + k + ': <strong>' + meta[k] + '</strong></span>';
      }
    }

    var balanceAfter = entry.balance_after !== undefined ? entry.balance_after : (entry.balanceAfter || 0);
    var entryId = entry.id || "";

    return '<div class="earnings-entry" onclick="this.classList.toggle(\'expanded\')">' +
      '<div class="earnings-entry-main">' +
        '<div class="earnings-entry-left">' +
          '<div class="earnings-entry-icon ' + (isPositive ? "entry-positive" : "entry-negative") + '">' + icon + '</div>' +
          '<div class="earnings-entry-info">' +
            '<span class="earnings-entry-desc">' + (entry.description || label) + '</span>' +
            '<span class="earnings-entry-meta">' + label + ' &middot; ' + time + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="earnings-entry-right">' +
          '<span class="earnings-entry-amount ' + (isPositive ? "positive" : "negative") + '">Earnings ' + (isPositive ? "+" : "") + entry.amount.toLocaleString() + '</span>' +
          '<span class="earnings-entry-balance">Bal: ' + balanceAfter.toLocaleString() + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="earnings-entry-detail">' +
        '<div class="entry-detail-row"><span>Transaction ID</span><strong>' + entryId + '</strong></div>' +
        '<div class="entry-detail-row"><span>Type</span><strong>' + label + '</strong></div>' +
        '<div class="entry-detail-row"><span>Date &amp; Time</span><strong>' + fullDate + '</strong></div>' +
        '<div class="entry-detail-row"><span>Amount</span><strong class="' + (isPositive ? "positive" : "negative") + '">' + (isPositive ? "+" : "") + entry.amount.toLocaleString() + '</strong></div>' +
        '<div class="entry-detail-row"><span>Balance After</span><strong>' + balanceAfter.toLocaleString() + '</strong></div>' +
        (metaDetails ? '<div class="entry-detail-meta">' + metaDetails + '</div>' : '') +
      '</div>' +
    '</div>';
  }

  document.addEventListener("DOMContentLoaded", init);

  return { filter: filter, applyFilters: applyFilters };
})();
