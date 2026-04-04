const pool = require("./pool");

// Seed today's contests - run this daily via cron
async function seedContests() {
  console.log("Seeding contests for today...");

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const date = today.getDate();

  const contests = [
    // Free Daily Contest
    {
      name: "Free Daily Contest",
      type: "free",
      prize_pool: 10.0,
      max_players: 500,
      max_attempts: 10,
      starts_at: new Date(year, month, date, 0, 0),
      ends_at: new Date(year, month, date, 23, 59, 59),
      is_daily: true,
    },
    // Daily Champs League (subscribers)
    {
      name: "Daily Champs League",
      type: "subscriber",
      prize_pool: 50.0,
      max_players: 200,
      max_attempts: 10,
      starts_at: new Date(year, month, date, 0, 0),
      ends_at: new Date(year, month, date, 23, 59, 59),
      is_daily: true,
    },
    // Hourly contests at 9am, 12pm, 3pm, 6pm
    {
      name: "Hourly Contest #1",
      type: "subscriber",
      prize_pool: 25.0,
      max_players: 100,
      max_attempts: 10,
      starts_at: new Date(year, month, date, 9, 0),
      ends_at: new Date(year, month, date, 10, 0),
      is_daily: false,
    },
    {
      name: "Hourly Contest #2",
      type: "subscriber",
      prize_pool: 25.0,
      max_players: 100,
      max_attempts: 10,
      starts_at: new Date(year, month, date, 12, 0),
      ends_at: new Date(year, month, date, 13, 0),
      is_daily: false,
    },
    {
      name: "Hourly Contest #3",
      type: "subscriber",
      prize_pool: 25.0,
      max_players: 100,
      max_attempts: 10,
      starts_at: new Date(year, month, date, 15, 0),
      ends_at: new Date(year, month, date, 16, 0),
      is_daily: false,
    },
    {
      name: "Hourly Contest #4",
      type: "subscriber",
      prize_pool: 25.0,
      max_players: 100,
      max_attempts: 10,
      starts_at: new Date(year, month, date, 18, 0),
      ends_at: new Date(year, month, date, 19, 0),
      is_daily: false,
    },
  ];

  for (const c of contests) {
    // Check if contest already exists for today
    const existing = await pool.query(
      "SELECT id FROM contests WHERE name = $1 AND starts_at = $2",
      [c.name, c.starts_at]
    );

    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO contests (name, type, prize_pool, max_players, max_attempts, starts_at, ends_at, is_daily)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [c.name, c.type, c.prize_pool, c.max_players, c.max_attempts, c.starts_at, c.ends_at, c.is_daily]
      );
      console.log("  Created:", c.name);
    } else {
      console.log("  Exists:", c.name);
    }
  }

  console.log("Seeding complete.");
  await pool.end();
}

seedContests();
