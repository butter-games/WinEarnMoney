const pool = require("./pool");

const migration = `
-- Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  points INTEGER DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  total_withdrawn NUMERIC(10,2) DEFAULT 0,
  subscribed BOOLEAN DEFAULT FALSE,
  subscription_plan VARCHAR(20),
  subscription_expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contests
CREATE TABLE IF NOT EXISTS contests (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('free', 'subscriber')),
  prize_pool NUMERIC(10,2) DEFAULT 0,
  max_players INTEGER DEFAULT 100,
  max_attempts INTEGER DEFAULT 10,
  min_score_for_points INTEGER DEFAULT 0,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_daily BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add min_score_for_points if not exists
DO $$ BEGIN
  ALTER TABLE contests ADD COLUMN min_score_for_points INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Seed users (fake leaderboard entries for contests)
CREATE TABLE IF NOT EXISTS contest_seed_users (
  id SERIAL PRIMARY KEY,
  contest_id INTEGER REFERENCES contests(id) ON DELETE CASCADE,
  username VARCHAR(50) NOT NULL,
  score INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contest attempts (tracks each play-through)
CREATE TABLE IF NOT EXISTS contest_attempts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  contest_id INTEGER REFERENCES contests(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  answers JSONB DEFAULT '[]',
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Best scores per user per contest (for leaderboard)
CREATE TABLE IF NOT EXISTS contest_leaderboard (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  contest_id INTEGER REFERENCES contests(id) ON DELETE CASCADE,
  best_score INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, contest_id)
);

-- Ledger (all financial events)
CREATE TABLE IF NOT EXISTS ledger (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL CHECK (type IN (
    'game_win', 'tournament_win', 'withdrawal',
    'subscription', 'signup_bonus', 'refund'
  )),
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Withdrawals
CREATE TABLE IF NOT EXISTS withdrawals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  points_deducted INTEGER NOT NULL,
  method VARCHAR(20) NOT NULL CHECK (method IN ('paypal', 'bank', 'giftcard', 'crypto')),
  account_details TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Game config (server-controlled values)
CREATE TABLE IF NOT EXISTS game_config (
  key VARCHAR(50) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contest_attempts_user ON contest_attempts(user_id, contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_leaderboard_contest ON contest_leaderboard(contest_id, best_score DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id, created_at DESC);

-- Referrals
CREATE TABLE IF NOT EXISTS referrals (
  id SERIAL PRIMARY KEY,
  referrer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  referred_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  bonus_awarded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referred_id)
);

-- Add referral_code to users if not exists
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN referral_code VARCHAR(10) UNIQUE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);

-- Insert default game config
INSERT INTO game_config (key, value) VALUES
  ('scoring', '{"basePointsPerQuestion": 6, "decayPerSecond": 1, "decayStartAfter": 0, "minPoints": 0}'),
  ('points_to_dollar', '{"rate": 100}'),
  ('min_withdrawal', '{"amount": 1.00}'),
  ('referral', '{"bonus_referrer": 50, "bonus_referred": 25}')
ON CONFLICT (key) DO NOTHING;
`;

async function migrate() {
  console.log("Running database migration...");
  try {
    await pool.query(migration);
    console.log("Migration complete.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await pool.end();
  }
}

migrate();
