var mongoose = require('mongoose');
const LiveScore = require('./live-score')
const PointSystem = require('./point-system')

var Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId;

var playerRecordSchema = new Schema({
  "id": {
    "type": Number
  },
  "player_id": {
    "type": Number
  },
  "player_name": {
    "type": String
  },
  "image": {
    "type": String
  },
  "age": {
    "type": String
  },
  "born": {
    "type": String
  },
  "playing_role": {
    "type": String
  },
  "batting_style": {
    "type": String
  },
  "bowling_style": {
    "type": String
  },
  "country": {
    "type": String
  },
  "batting_odiStrikeRate": {
    "type": String
  },
  "batting_odiAverage": {
    "type": String
  },
  "bowling_odiAverage": {
    "type": String
  },
  "bowling_odiStrikeRate": {
    "type": String
  },
  "batting_firstClassStrikeRate": {
    "type": String
  },
  "batting_firstClassAverage": {
    "type": String
  },
  "bowling_firstClassStrikeRate": {
    "type": String
  },
  "bowling_firstClassAverage": {
    "type": String
  },
  "batting_t20iStrikeRate": {
    "type": String
  },
  "batting_t20iAverage": {
    "type": String
  },
  "bowling_t20iStrikeRate": {
    "type": String
  },
  "bowling_t20iAverage": {
    "type": String
  },
  "batting_testStrikeRate": {
    "type": String
  },
  "batting_testAverage": {
    "type": String
  },
  "bowling_testStrikeRate": {
    "type": String
  },
  "bowling_testAverage": {
    "type": String
  },
  "batting_listAStrikeRate": {
    "type": String
  },
  "batting_listAAverage": {
    "type": String
  },
  "bowling_listAStrikeRate": {
    "type": String
  },
  "bowling_listAAverage": {
    "type": String
  },
  "batting_t20sStrikeRate": {
    "type": String
  },
  "batting_t20sAverage": {
    "type": String
  },
  "bowling_t20sStrikeRate": {
    "type": String
  },
  "bowling_t20sAverage": {
    "type": String
  },
  "teams": {
    "type": String
  },
  "sport": {
    "type": Number
  },
  "player_credit": {
    "type": String
  }
});

playerRecordSchema.statics.getPlayerPoint = async function (series_id, match_id, player_id, captain, viceCaptain) {
  let point = 0;
  let mType = '';
  let rePnt = {};
  let record = await LiveScore.findOne({ 'series_id': series_id, 'match_id': match_id, 'player_id': player_id }, { 'point': 1, 'match_type': 1, 'player_name': 1 }).sort({ _id: -1 });
  if (record) {
    record = JSON.parse(JSON.stringify(record));
    point = (record['point']) ? parseFloat(record['point']) : 0;
    mType = record['match_type'];
    if ((mType == 'TEST') || (mType == 'First-class')) {
      rePnt = await PointSystem.findOne({ 'matchType': '3' });
    } else if (mType == 'ODI') {
      rePnt = await PointSystem.findOne({ 'matchType': '2' });
    } else if (mType == 'T20') {
      rePnt = await PointSystem.findOne({ 'matchType': '1' });
    } else if (mType == 'T10' || mType == 'other') {
      rePnt = await PointSystem.findOne({ 'matchType': '4' });
    }
 
    if (rePnt) {
      let captainPoint = rePnt.othersCaptain;
      let viceCaptainPoint = rePnt.othersViceCaptain;
      if (captain == player_id) {
        point = point * captainPoint;
      }
      if (viceCaptain == player_id) {
        point = point * viceCaptainPoint;
      }
    }
  }
  point = (point) ? point : 0;
  return point;//point = {"player_id":player_id, "point": point};
}

playerRecordSchema.statics.getPlayerPointPreview = async function (series_id, match_id, player_ids, captain, viceCaptain, type, sport) {
  let point = 0;
  let mType = type;
  let rePnt = {};

  //let record = await LiveScore.find({ 'series_id': series_id, 'match_id': match_id, 'player_id': { $in: player_ids }, sport: sport }, { 'point': 1, 'match_type': 1, 'player_name': 1 , "player_id": 1}).sort({ _id: -1 });
  let record = await LiveScore.aggregate([
    {
      $match: {'series_id': series_id, 'match_id': match_id, 'player_id': { $in: player_ids }, sport: sport}
    },
    {
      $group: {
        "_id":"$player_id",
        "point": {$sum: "$point"},
        "match_type": {$first: "$match_type"},
        "player_name": {$first: "$player_name"},
        "player_id": {$first: "$player_id"},
        "player_role": {$first: "$player_role"},
      }
    },
    { $sort: { _id: -1 } }
  ]);
  if ((mType == 'Test') || (mType == 'TEST') || (mType == 'First-class')) {
    rePnt = await PointSystem.findOne({ 'matchType': '3' });
  } else if (mType == 'ODI') {
    rePnt = await PointSystem.findOne({ 'matchType': '2' });
  } else if (mType == 'T20') {
    rePnt = await PointSystem.findOne({ 'matchType': '1' });
  } else if (mType == 'T10' || mType == 'other') {
    rePnt = await PointSystem.findOne({ 'matchType': '4' });
  } else if (mType == 'T100') {
    rePnt = await PointSystem.findOne({ 'matchType': '5' });
  }

  let teamDataArray = {}

  if (record) {
    for (let i = 0; i < record.length; i++) {

      recordItem = JSON.parse(JSON.stringify(record[i]));
      point = (recordItem['point']) ? parseFloat(recordItem['point']) : 0;

      if (rePnt) {
        let captainPoint = rePnt.othersCaptain;
        let viceCaptainPoint = rePnt.othersViceCaptain;
        if (captain == record[i].player_id) {
          point = point * captainPoint;
        }
        if (viceCaptain == record[i].player_id) {
          point = point * viceCaptainPoint;
        }
      }

      //teamDataArray[recordItem.player_id] = point;
      teamDataArray[recordItem.player_id] = [];
      teamDataArray[recordItem.player_id]["point"]  =  point;
      teamDataArray[recordItem.player_id]["player_role"]  = recordItem['player_role'] ? recordItem['player_role'] : '';
    }
  }
  return teamDataArray
}

playerRecordSchema.statics.getPlayerPointPreviewForXSystem = async function (series_id, match_id, player_ids,three_x, two_x, one_five_x, type, sport) {
  let point = 0;
  let mType = type;
  let rePnt = {};
  let record = await LiveScore.aggregate([
    {
      $match: {'series_id': series_id, 'match_id': match_id, 'player_id': { $in: player_ids }, sport: sport}
    },
    {
      $group: {
        "_id":"$player_id",
        "point": {$sum: "$point"},
        "match_type": {$first: "$match_type"},
        "player_name": {$first: "$player_name"},
        "player_id": {$first: "$player_id"},
        "player_role": {$first: "$player_role"},
      }
    },
    { $sort: { _id: -1 } }
  ]);

  let teamDataArray = {}

  if (record) {
    for (let i = 0; i < record.length; i++) {

      recordItem = JSON.parse(JSON.stringify(record[i]));
      point = (recordItem['point']) ? parseFloat(recordItem['point']) : 0;

      if (three_x == record[i].player_id) {
        point = point * 3;
      }
      if (two_x == record[i].player_id) {
        point = point * 2;
      }
      if (one_five_x == record[i].player_id) {
        point = point * 1.5;
      }

      //teamDataArray[recordItem.player_id] = point;
      teamDataArray[recordItem.player_id] = [];
      teamDataArray[recordItem.player_id]["point"]  =  point;
      teamDataArray[recordItem.player_id]["player_role"]  = recordItem['player_role'] ? recordItem['player_role'] : '';
    }
  }
  return teamDataArray
}

module.exports = mongoose.model('player_record', playerRecordSchema, 'player_record');