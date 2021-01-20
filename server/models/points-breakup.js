var mongoose = require('mongoose');
var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var pointsBreakupSchema = new Schema({
  series_id: {
    type: Number
  },
  match_id: {
    type: Number
  },
  player_id: {
    type: Number
  },
  inning_number: {
    type: Number
  },
  in_starting: {
    type: Number
  },
  in_starting_point: {
    type: Number
  },
  runs: {
    type: Number
  },
  runs_point: {
    type: Number
  },
  fours: {
    type: Number
  },
  fours_point: {
    type: Number
  },
  sixes: {
    type: Number
  },
  sixes_point: {
    type: Number
  },
  strike_rate: {
    type: Number
  },
  strike_rate_point: {
    type: Number
  },
  century_halfCentury: {
    type: Number
  },
  century_halfCentury_point: {
    type: Number
  },
  duck_out: {
    type: Number
  },
  duck_out_point: {
    type: Number
  },
  wickets: {
    type: Number
  },
  wickets_point: {
    type: Number
  },
  maiden_over: {
    type: Number
  },
  maiden_over_point: {
    type: Number
  },
  economy_rate: {
    type: Number
  },
  economy_rate_point: {
    type: Number
  },
  bonus: {
    type: Number
  },
  bonus_point: {
    type: Number
  },
  catch: {
    type: Number
  },
  catch_point: {
    type: Number
  },
  run_outStumping: {
    type: Number
  },
  run_outStumping_point: {
    type: Number
  },
  run_out: {
    type: Number
  },
  run_out_point: {
    type: Number
  },
  total_point: {
    type: Number
  },
  
  
  minutes_played: {
    type: Number
  },
  goal: {
    type: Number
  },
  goal_point: {
    type: Number
  },
  assist: {
    type: Number
  },
  assist_point: {
    type: Number
  },
  passes: {
    type: Number
  },
  passes_point: {
    type: Number
  },
  shots_on_target: {
    type: Number
  },
  shots_on_target_point: {
    type: Number
  },
  goal_scored: {
    type: Number
  },
  goal_scored_point: {
    type: Number
  },
  penalty_saved: {
    type: Number
  },
  penalty_saved_point: {
    type: Number
  },
  penalty_missed: {
    type: Number
  },
  penalty_missed_point: {
    type: Number
  },
  clean_sheet: {
    type: Number
  },
  clean_sheet_point: {
    type: Number
  },
  tackle_won: {
    type: Number
  },
  tackle_won_point: {
    type: Number
  },
  goals_conceded: {
    type: Number
  },
  goals_conceded_point: {
    type: Number
  },
  yellow_card: {
    type: Number
  },
  yellow_card_point: {
    type: Number
  },
  red_card: {
    type: Number
  },
  red_card_point: {
    type: Number
  },
  own_goal: {
    type: Number
  },
  own_goal_point: {
    type: Number
  },
  in_substitute: {
    type: Number
  },
  in_substitute_point: {
    type: Number
  },
  chance_created: {
    type: Number
  },
  chance_created_point: {
    type: Number
  },
  interception_won: {
    type: Number
  },
  interception_won_point: {
    type: Number
  },
  blocked_shot: {
    type: Number
  },
  blocked_shot_point: {
    type: Number
  },
  clearance: {
    type: Number
  },
  clearance_point: {
    type: Number
  },
  selected_by: {
    type: String
  },

});

module.exports = mongoose.model('points_breakup', pointsBreakupSchema, 'points_breakup');