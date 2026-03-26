const Leaderboard = (() => {
  const players = [
    { name: "CryptoKing99", games: 342, earnings: 2450 },
    { name: "LuckySpinner", games: 289, earnings: 1890 },
    { name: "WheelMaster", games: 256, earnings: 1650 },
    { name: "GoldRush22", games: 198, earnings: 1420 },
    { name: "SpinToWin", games: 187, earnings: 1100 },
    { name: "RewardHunter", games: 165, earnings: 980 },
    { name: "JackpotJane", games: 143, earnings: 870 },
    { name: "PointsCollector", games: 132, earnings: 750 },
    { name: "DailyPlayer", games: 121, earnings: 620 },
    { name: "WinStreak", games: 98, earnings: 540 },
  ];

  function getRankClass(rank) {
    if (rank === 1) return "rank-1";
    if (rank === 2) return "rank-2";
    if (rank === 3) return "rank-3";
    return "rank-default";
  }

  function render() {
    const tbody = document.getElementById("leaderboard-body");
    if (!tbody) return;

    tbody.innerHTML = players
      .map(
        (player, i) => `
      <tr>
        <td><span class="rank-badge ${getRankClass(i + 1)}">${i + 1}</span></td>
        <td class="player-name">${player.name}</td>
        <td>${player.games.toLocaleString()}</td>
        <td class="earnings">$${player.earnings.toLocaleString()}</td>
      </tr>
    `
      )
      .join("");
  }

  return { render };
})();

document.addEventListener("DOMContentLoaded", Leaderboard.render);
