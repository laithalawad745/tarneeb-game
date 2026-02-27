-- ============================================
-- جداول لعبة تركس - Supabase
-- شغّل هالأوامر بـ Supabase SQL Editor
-- ============================================

-- جدول اللاعبين
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول الغرف/الألعاب
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- كود الغرفة (6 أحرف)
  host_id UUID REFERENCES players(id),
  play_type TEXT DEFAULT 'individual', -- 'partnership' or 'individual'
  phase TEXT DEFAULT 'waiting',
  state JSONB DEFAULT '{}', -- حالة اللعبة الكاملة
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول اللاعبين بالغرفة
CREATE TABLE IF NOT EXISTS game_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id),
  seat_index INT NOT NULL CHECK (seat_index >= 0 AND seat_index <= 3),
  is_connected BOOLEAN DEFAULT TRUE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, seat_index),
  UNIQUE(game_id, player_id)
);

-- جدول النقاط
CREATE TABLE IF NOT EXISTS scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id),
  deal_number INT NOT NULL,
  game_mode TEXT NOT NULL,
  score INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول سجل الغش
CREATE TABLE IF NOT EXISTS cheat_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  accuser_id UUID REFERENCES players(id),
  accused_id UUID REFERENCES players(id),
  was_caught BOOLEAN NOT NULL,
  penalty INT DEFAULT 0,
  game_mode TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- إنشاء Index للبحث السريع
CREATE INDEX IF NOT EXISTS idx_games_code ON games(code);
CREATE INDEX IF NOT EXISTS idx_game_players_game ON game_players(game_id);
CREATE INDEX IF NOT EXISTS idx_scores_game ON scores(game_id);

-- تحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS (Row Level Security) - أمان
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- سياسات الوصول (مفتوحة للمشروع التجريبي)
CREATE POLICY "Allow all on games" ON games FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on players" ON players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on game_players" ON game_players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on scores" ON scores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on cheat_log" ON cheat_log FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE cheat_log ENABLE ROW LEVEL SECURITY;
