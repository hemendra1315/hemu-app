-- Migration 0022: Fix Batting Rankings View Batting Average Calculation
-- Corrects batting_average in v_batting_rankings to calculate Runs / (Innings - NotOuts) instead of Runs / Innings.

CREATE OR REPLACE VIEW v_batting_rankings AS
  SELECT
    ps.academy_id,
    ps.player_id,
    am.user_id,
    p.full_name,
    p.avatar_url,
    ps.batting_runs,
    ps.batting_innings,
    ps.batting_highest_score,
    CASE 
      WHEN (ps.batting_innings - ps.batting_not_outs) > 0 
        THEN ROUND(ps.batting_runs::numeric / (ps.batting_innings - ps.batting_not_outs), 2)
      WHEN ps.batting_innings > 0 
        THEN ps.batting_runs::numeric
      ELSE 0 
    END AS batting_average,
    CASE 
      WHEN ps.balls_faced_sum > 0 
        THEN ROUND(100.0 * ps.batting_runs / ps.balls_faced_sum, 2) 
      ELSE 0 
    END AS strike_rate_placeholder,
    ps.batting_fifties,
    ps.batting_centuries,
    ps.batting_fours,
    ps.batting_sixes,
    ps.matches_played,
    ps.awards_player_of_match
  FROM player_statistics ps
  JOIN academy_members am ON am.id = ps.player_id
  JOIN profiles p ON p.id = am.user_id
  ORDER BY ps.batting_runs DESC NULLS LAST;
