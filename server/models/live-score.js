var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var liveScoreSchema = new Schema({
  id: {
    type: Number
  },
  series_id: {
    type: Number
  },
  match_id: {
    type: Number
  },
  team_id: {
    type: Number
  },
  team_type: {
    type: String
  },
  match_type: {
    type: String
  },
  match_status: {
    type: String
  },
  comment: {
    type: String
  },
  player_id: {
    type: Number
  },
  player_name: {
    type: String
  },
  point: {
    type: Number
  },
  run_scored: {
    type: Number
  },
  status: {
    type: String
  },
  ball_faced: {
    type: Number
  },
  s4: {
    type: Number
  },
  s6: {
    type: Number
  },
  batting_strike_rate: {
    type: Number
  },
  is_current_batsman: {
    type: Boolean
  },
  inning_number: {
    type: Number
  },
  extra_run_scored: {
    type: Number
  },
  bowls: {
    type: Number
  },
  wickets: {
    type: Number
  },
  total_inning_score: {
    type: Number
  },
  run_rate: {
    type: Number
  },
  over_bowled: {
    type: Number
  },
  maidens_bowled: {
    type: Number
  },
  runs_conceded: {
    type: Number
  },
  wickets_taken: {
    type: Number
  },
  wide_balls: {
    type: Number
  },
  economy_rates_runs_conceded: {
    type: Number
  },
  no_balls: {
    type: Number
  },
  is_current_bowler: {
    type: Boolean
  },
  stamp_count: {
    type: Number
  },
  run_out_count: {
    type: Number
  },
  thrower: {
    type: Number
  },
  hitter: {
    type: Number
  },
  catch: {
    type: Number
  },
  sport: {
    type: Number
  }
});

module.exports = mongoose.model('live_score', liveScoreSchema, 'live_score');