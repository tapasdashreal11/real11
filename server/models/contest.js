var mongoose = require('mongoose');
let ObjectIds = require('mongodb').ObjectID;
var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;
const SeriesSquad = require('./series-squad');
const MatchContest = require('./match-contest');
const JoinContestDetail = require('./join-contest-detail');
const PlayerTeamContest = require('./player-team-contest');

var contestSchema = new Schema({
  "id": {
    "type": Number
  },
  "old_category_id": {
    "type": Number
  },
  "category_id": {
    "type": ObjectId
  },
  "contest_name": {
    "type": String
  },
  "admin_comission": {
    "type": Number
  },
  "winning_amount": {
    "type": Number
  },
  "contest_size": {
    "type": Number
  },
  "min_contest_size": {
    "type": String
  },
  "contest_type": {
    "type": String
  },
  "entry_fee": {
    "type": Number
  },
  "used_bonus": {
    "type": Number
  },
  "confirmed_winning": {
    "type": String
  },
  "multiple_team": {
    "type": String
  },
  "auto_create": {
    "type": String
  },
  "status": {
    "type": Number
  },
  "sport": {
    "type": Number
  },
  "price_breakup": {
    "type": Number
  },
  "invite_code": {
    "type": String
  },
  "is_auto_create": {
    "type": Number
  },
  "parent_id": {
    "type": ObjectId
  },
  "real_parent_id": {
    "type": ObjectId
  },
  "created": {
    "type": Date
  },
  "infinite_contest_size": {
    "type": Number
  },
  "winner_percent": {
    "type": Number
  },
  "winning_amount_times": {
    "type": Number
  },
  "amount_gadget": {
    "type": String
  },
  "set_breakup": {
    "type": Number
  },
  "is_full" : {
    "type": Boolean, default:false
  },
  "is_private": {
    "type": Number
  },
  "is_private": {
    "type": Number
  },
  "maximum_team_size":{
    "type":Number,
    default:1
  },
  "contest_shareable":{
    "type":Number,
    default:0
  },
  breakup:{
    "type":[{
      name:String, 
      startRank:Number, 
      endRank:Number, 
      percentage:Number, 
      price:Number, 
      price_each:Number, 
      percentage_each:Number,
      image:String,
      gadget_name:String
    }]
  },
  user_contest: {
    "type": [{
      user_id :ObjectId,
      series_id:Number,
      match_id:Number,
      contest_name: String,
      invite_code: String,
    }] 
  },
  "user_created":{
    "type":Number,
    default:0
  },
});

contestSchema.statics.getContestsIdsByCategoryIds = function(categoryIds){
  return this.find({
    // category_id: { $in: categoryIds },
    old_category_id: {$gt:0},
    status:1
  },{_id:1}).sort({winning_amount:-1}).exec();
}

contestSchema.statics.createAutoContest = async function(contestData, series_id, match_id, admin_crate, parentContestId, fn){
  try{

    let catID 	= 	contestData.category_id;
    MatchContest.updateOne({match_id:match_id,contest_id:contestData._id}, {$set: {"is_full":1}});
    console.log("*******parentContestId****", admin_crate, parentContestId)
    let entity = {};
    entity.category_id		  =	catID;
    entity.is_full		  =	false;
    entity.admin_comission	=	contestData.admin_comission;
    entity.winning_amount		=	contestData.winning_amount;
    entity.contest_size		  =	contestData.contest_size;
    entity.min_contest_size	=	contestData.min_contest_size;
    entity.contest_type		  =	contestData.contest_type;
    entity.entry_fee			  =	contestData.entry_fee;
    entity.used_bonus		  	=	contestData.used_bonus;
    entity.confirmed_winning	=	contestData.confirmed_winning;
    entity.multiple_team		=	contestData.multiple_team;
    entity.auto_create		  =	contestData.auto_create;
    entity.status				    =	contestData.status;
    entity.price_breakup		=	contestData.price_breakup;
    entity.invite_code		  =	contestData.invite_code;
    entity.breakup = contestData.breakup;
    entity.created			    =	new Date();
    if(parentContestId) {
      entity.parent_id			  =	parentContestId;
    }else{
      entity.parent_id			  =	contestData._id;
    }
    // if(admin_crate === 1){
    //   entity.parent_id			  =	parentContestId;
    // }else{
    //   entity.parent_id			  =	contestData._id;
    // }
    entity.is_auto_create		=	2;
    this.create(entity, async function(err, contest){
      let newContestId 	= contest._id;
      let entityM	=	{};
      if(parentContestId){
        entityM.parent_contest_id  =	parentContestId;
      } else {
        entityM.parent_contest_id  =	contestData._id;
      }
      
      entityM.match_id		  = match_id;
      entityM.contest_id	  = newContestId;
      entityM.series_id     = series_id;
      entityM.category_id   =	ObjectIds(catID);
      entityM.invite_code	  =	'1Q'+Math.random().toString(36).slice(-6);
      entityM.created		    = new Date();
      entityM.localteam		  =	'';
      entityM.localteam_id	=	'';
      entityM.visitorteam		=	'';
      entityM.visitorteam_id=	'';
      entityM.is_auto_create=	1;
      entityM.admin_create	=	admin_crate;
      entityM.joined_users	=	0;
      entityM.contest	=	{
        entry_fee		:	contestData.entry_fee,
        winning_amount	:	contestData.winning_amount,
        contest_size	:	contestData.contest_size,
        contest_type	:	contestData.contest_type,
        confirmed_winning	:	contestData.confirmed_winning,
        amount_gadget	:	contestData.amount_gadget,
        category_id		:	contestData.category_id,
        multiple_team	:	contestData.multiple_team,
        contest_size	:	contestData.contest_size,
        infinite_contest_size	:	contestData.infinite_contest_size,
        winning_amount_times	:	contestData.winning_amount_times,
        is_auto_create	:	contestData.is_auto_create,
        auto_create		:	contestData.auto_create,
        breakup			:	contestData.breakup
      };
      MatchContest.create(entityM, async function(err, matchContest){
         // console.log("New Auto Match Contest Created",matchContest)          
      });
      fn(contest)
    })
    return true;
  }catch(error){
    console.log("error**", error)
  }
}

contestSchema.statics.saveJoinContestDetail = async function (decoded,bonusAmount,winAmount,cashAmount,playerTeamContestId,contestData, extraAmount,match_sport) {
  // console.log("22222***************");
  let surpriseAmount  = extraAmount || 0;
  let totalAmount = bonusAmount + winAmount + cashAmount + surpriseAmount;
  // let totalAmount = bonusAmount+winAmount+cashAmount;
  if(!contestData){
     contestData = await this.findOne({'_id':decoded['contest_id']});
  }
  // console.log("22222***************",contestData);
  let adminComission = contestData && contestData.admin_comission ? parseFloat(contestData.admin_comission) : 0;
  let winningAmount = contestData.winning_amount;
  let contestSize = contestData.contest_size;
  let comission = 0;
  if(adminComission && adminComission > 0) {
    const profitAmount = Math.ceil((winningAmount * adminComission) / 100);
    let entryfee = contestData.entry_fee;
    comission = (profitAmount / contestSize);
    comission = Math.round(comission,2);
  } else {
    comission = 0;
  }

  // let comission = ((adminComission/100) * totalAmount);
  // comission = comission.toFixed(2);

  let saveEntity	=	{};
  saveEntity.user_id		=	decoded['user_id'];
  saveEntity.contest_id		=	decoded['contest_id'];
  saveEntity.series_id		=	decoded['series_id'];
  saveEntity.match_id		=	decoded['match_id'];
  saveEntity.sport = match_sport;
  saveEntity.bonus_amount	=	bonusAmount;
  saveEntity.winning_amount	=	winAmount;
  saveEntity.deposit_cash	=	cashAmount;
  saveEntity.extra_amount	=	surpriseAmount;
  saveEntity.total_amount   =	totalAmount;
  saveEntity.admin_comission=	parseFloat(comission);
  saveEntity.player_team_contest_id=	playerTeamContestId;
  // console.log("JoinContestDetail*************121221",saveEntity)
  JoinContestDetail.create(saveEntity);
  // PlayerTeamContest.findByIdAndUpdate(ObjectId(playerTeamContestId) , { "total_amount": totalAmount , "bonus_amount": bonusAmount}, { new: true });
  return true;

}
contestSchema.statics.saveJoinContestDetailNew = async function (decoded,bonusAmount,winAmount,cashAmount,playerTeamContestId,contestData, extraAmount,match_sport,retention_bonus_amount) {
  //console.log("22222***************")
  let surpriseAmount  = extraAmount || 0;
  let totalAmount = bonusAmount + winAmount + cashAmount + surpriseAmount;
  // let totalAmount = bonusAmount+winAmount+cashAmount;
  if(!contestData){
    contestData = await this.findOne({'_id':decoded['contest_id']});
 }
 // console.log("22222***************",contestData);
  let adminComission = contestData && contestData.admin_comission ? parseFloat(contestData.admin_comission) : 0;
  let winningAmount = contestData.winning_amount;
  let contestSize = contestData.contest_size;
  let comission = 0;
  if(adminComission && adminComission > 0) {
    const profitAmount = Math.ceil((winningAmount * adminComission) / 100);
    let entryfee = contestData.entry_fee;
    comission = (profitAmount / contestSize);
    comission = Math.round(comission,2);
  } else {
    comission = 0;
  }

  // let comission = ((adminComission/100) * totalAmount);
  // comission = comission.toFixed(2);

  let saveEntity	=	{};
  saveEntity.user_id		=	decoded['user_id'];
  saveEntity.contest_id		=	decoded['contest_id'];
  saveEntity.series_id		=	decoded['series_id'];
  saveEntity.match_id		=	decoded['match_id'];
  saveEntity.sport = match_sport;
  saveEntity.bonus_amount	=	bonusAmount;
  saveEntity.winning_amount	=	winAmount;
  saveEntity.deposit_cash	=	cashAmount;
  saveEntity.extra_amount	=	surpriseAmount;
  saveEntity.total_amount   =	totalAmount;
  saveEntity.admin_comission= comission ? parseFloat(comission):0;
  saveEntity.player_team_contest_id=	playerTeamContestId;
  saveEntity.retention_bonus = retention_bonus_amount|| 0;
  // console.log("JoinContestDetail*************121221");
  JoinContestDetail.create(saveEntity);
  // PlayerTeamContest.findByIdAndUpdate(ObjectId(playerTeamContestId) , { "total_amount": totalAmount , "bonus_amount": bonusAmount}, { new: true });
  return true;

}

module.exports = mongoose.model('contest', contestSchema, 'contest');
