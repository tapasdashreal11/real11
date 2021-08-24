const _ = require("lodash");
let ObjectId = require('mongodb').ObjectID;
const config = require('../config');
const moment = require('moment');
var imageurl = config.imageBaseUrl;

const ReferralCodeDetails = require('../models/user-referral-code-details');
const Transaction = require('../models/transaction');
const Users = require("../models/user");
const MyContestModel = require("../models/my-contest-model");
const SeriesSquadModel = require("../models/series-squad");

const { TransactionTypes, MatchStatus } = require('../constants/app');

class ModelService {

    constructor(collection) {
        this.collection = collection;
    }

    getMatchContestLatestNew(categories,filter,limit,is_all){
        is_all = false;
        return new Promise((resolve, reject) => {
            try{
                var is_joined = false;
                this.collection.aggregate([
                    {
                        $match: {status:1}
                    },                                       
                    {
                        $lookup: {
                            from: 'match_contest',
                            let: { catId: "$_id" },
                            pipeline: [
                                {
                                    $match: {  
                                        $expr:{ 
                                            $and: [ 
                                                { $eq: [ "$category_id", "$$catId" ]},
                                                { $eq: [ "$match_id",  filter.match_id ]},
                                                { $eq: [ "$sport",  filter.sport ]},
                                                { $ne: [ "$is_full", 1 ]},
                                                { $ne: [ "$is_private", 1 ]},
                                            ]  
                                        }
                                    }
                                },
                                //{$limit : limit},
                                { $sort: {"created": -1}},                           
                                { $project: { joined_users:1, contest:1,localteam: 1, visitorteam_id:1, series_id: 1, status:1, category_id:1,parent_contest_id:1, contest_id:1, invite_code : 1, match_id:1, before_time_bonus :1, after_time_bonus :1, usable_bonus_time:1 } }
                            ],
                            as: 'matchContest',
                        }
                    },
                    {
                        $unwind: {
                            path: "$matchContest",
                            preserveNullAndEmptyArrays: false
                        }
                    },   
                    {
                        $group : {
                            _id : "$_id",
                            category_name : {$first : "$category_name"},
                            description : {$first : "$description"},
                            image : {$first: "$categories.image"},
                            status : {$first : "$status"},
                            sequence : {$first : "$sequence"},
                            match_id : {$first : "$matchContest.match_id"},
                            match_contest_id : {$first : "$matchContest._id"},
                            contests : {$push : "$matchContest"}
                        }
                    },
                    {
                        $project: {
                            _id:"$_id",
                            match_id: "$match_id",
                            category_id:"$_id",
                            "category_title": "$category_name",
                            "sequence": "$sequence",
                            "category_desc": "$description",
                            category_image: "$image",
                            "contests": {
                                $map: {
                                    "input": "$contests",
                                    as: "sec",
                                    in: {
                                        "contest_id": "$$sec.contest_id",
                                        "parent_contest_id":"$$sec.parent_contest_id",
                                        "entry_fee": "$$sec.contest.entry_fee",
                                        "prize_money": "$$sec.contest.winning_amount",
                                        "is_full": "$$sec.contest.is_full",
                                        "confirm_winning": {$cond: { if: { $eq: [ "$$sec.contest.confirmed_winning", "yes" ] }, then: "yes", else: 'no' }},
                                        "is_gadget": {$cond: { if: { $eq: [ "$$sec.contest.amount_gadget", "gadget" ] }, then: true, else: false }},
                                        "category_id": "$$sec.contest.category_id",
                                        "is_auto_create": "$$sec.contest.is_auto_create",                                       
                                        "multiple_team": {$cond: { if: { $in: [ "$$sec.contest.multiple_team", ["yes",true] ] }, then: true, else: false }},
                                        "invite_code": "$$sec.invite_code",
                                        "breakup_detail": { 
                                            $map: {
                                                "input": "$$sec.contest.breakup",
                                                as: "break",
                                                in: {
                                                    "rank": {$cond: { if: { $eq: [ "$$break.startRank", "$$break.endRank" ] }, then: { $concat: [ "Rank ", {$toString: "$$break.startRank" } ] }, else:  "$$break.name" }},
                                                    "gadget_name": {$cond: { if: { $ne: [ "$$break.gadget_name", "" ] }, then: "$$break.gadget_name", else: "" }},
                                                    "image": {$cond: { if: { $ne: [ "$$break.image", "" ] }, then: { $concat: [ imageurl, "/", "$$break.image" ] }, else: "" }},
                                                    "price": {$cond: { if: { $gt: [ "$$break.price_each", 0 ] }, then: {$trunc : ["$$break.price_each", 2]}, else: {$trunc : ["$$break.price", 2]} }},
                                                }
                                            }
                                        },
                                        "after_time_bonus":  "$$sec.after_time_bonus",
                                        "before_time_bonus": "$$sec.before_time_bonus",
                                        "current_date": new Date(),
                                        "usable_bonus_time":'$$sec.usable_bonus_time',
                                        "use_bonus": {$cond: { if: { $ifNull: [ "$$sec.usable_bonus_time", false ] }, then: { $cond: { if: { $gt: [new Date(),'$$sec.usable_bonus_time'] },then: {$toString: "$$sec.before_time_bonus"},else: {$toString: "$$sec.after_time_bonus"} } }, else: {$toString: "$$sec.contest.used_bonus"} }},
                                        "is_infinite": {$cond: { if: { $eq: [ "$$sec.contest.infinite_contest_size", 1 ] }, then: true, else: false }},
                                        "teams_joined": "$$sec.joined_users",
                                        "total_teams": "$$sec.contest.contest_size",
                                        "total_winners": { $arrayElemAt: [ "$$sec.contest.breakup", -1 ] },
                                        "is_joined": is_joined, 
                                        "infinite_breakup" : {$cond: { if: { $eq: [ "$$sec.contest.infinite_contest_size", 1 ] }, then: {"winner_percent": "$$sec.contest.winner_percent", "winner_amount": "$$sec.contest.winning_amount_times"}, else: {} }},
                                        "is_aakash_team": {$cond: { if: { $eq: [ "$$sec.contest.amount_gadget", "aakash" ] }, then: true, else: false }},
                                        "is_favourite":false,
                                        "maximum_team_size": {$cond: { if: { $in: [ "$$sec.contest.multiple_team", ["yes",true] ] }, then: { $cond: { if: { $ifNull: ["$$sec.contest.maximum_team_size",false] },then: "$$sec.contest.maximum_team_size",else: 9 } }, else: 1 }},
                                        "contest_shareable": {$cond: { if: { $ifNull: [ "$$sec.contest.contest_shareable", false ] }, then: "$$sec.contest.contest_shareable", else: 0 }} 
                                    }
                                }
                            },
                        }
                    },
                    {$sort : {sequence : 1}}
                ], (err, data) => {
                    if (err) {
                        reject(err);
                    }
                    if (!err) {
                        if(is_all && data && data.length > 0){
                            var conArry = [];
                            var dlength = data.length;
                            _.forEach(data, function(k, i){
                                conArry.push(k.contests)
                                if(i === (dlength - 1)){
                                    var newArray = Array.prototype.concat.apply([], conArry);
                                    resolve([{"contests": newArray}]);
                                }
                            })
                        }else{
                            resolve(data);
                        }
                    }
                });
            }catch(err){
                reject(err);
            } 
        });
    }
    getMatchContestLatestWithoutCat(categories,filter,limit,is_all){
        is_all = false;
        return new Promise((resolve, reject) => {
            try{
                var is_joined = false;
                this.collection.aggregate([
                    {
                        $match: {match_id:parseInt(filter.match_id),sport:parseInt(filter.sport),is_full:0,is_private:0}
                    },   
                    {
                        $group : {
                            _id : "$category_id",
                            category_name : {$first : "$category_name"},
                            sequence : {$first : "$category_seq"},
                            description : {$first : "$category_description"},
                            status : {$first : "$status"},
                            match_id : {$first : "$match_id"},
                            match_contest_id : {$first : "$_id"},
                            contests : {$push : "$$ROOT"}
                        }
                    },
                    {
                        $project: {
                            _id:"$_id",
                            match_id: "$match_id",
                            category_id:"$_id",
                            "category_title": "$category_name",
                            "sequence": "$sequence",
                            "category_desc": "$description",
                            category_image: "",
                            "contests": {
                                $map: {
                                    "input": "$contests",
                                    as: "sec",
                                    in: {
                                        "contest_id": "$$sec.contest_id",
                                        "parent_contest_id":"$$sec.parent_contest_id",
                                        "entry_fee": "$$sec.contest.entry_fee",
                                        "prize_money": "$$sec.contest.winning_amount",
                                        "is_full": "$$sec.contest.is_full",
                                        "confirm_winning": {$cond: { if: { $eq: [ "$$sec.contest.confirmed_winning", "yes" ] }, then: "yes", else: 'no' }},
                                        "is_gadget": {$cond: { if: { $eq: [ "$$sec.contest.amount_gadget", "gadget" ] }, then: true, else: false }},
                                        "category_id": "$$sec.contest.category_id",
                                        "is_auto_create": "$$sec.contest.is_auto_create",                                       
                                        "multiple_team": {$cond: { if: { $in: [ "$$sec.contest.multiple_team", ["yes",true] ] }, then: true, else: false }},
                                        "invite_code": "$$sec.invite_code",
                                        "breakup_detail": { 
                                            $map: {
                                                "input": "$$sec.contest.breakup",
                                                as: "break",
                                                in: {
                                                    "rank": {$cond: { if: { $eq: [ "$$break.startRank", "$$break.endRank" ] }, then: { $concat: [ "Rank ", {$toString: "$$break.startRank" } ] }, else:  "$$break.name" }},
                                                    "gadget_name": {$cond: { if: { $ne: [ "$$break.gadget_name", "" ] }, then: "$$break.gadget_name", else: "" }},
                                                    "image": {$cond: { if: { $ne: [ "$$break.image", "" ] }, then: { $concat: [ imageurl, "/", "$$break.image" ] }, else: "" }},
                                                    "price": {$cond: { if: { $gt: [ "$$break.price_each", 0 ] }, then: {$trunc : ["$$break.price_each", 2]}, else: {$trunc : ["$$break.price", 2]} }},
                                                }
                                            }
                                        },
                                        "after_time_bonus":  "$$sec.after_time_bonus",
                                        "before_time_bonus": "$$sec.before_time_bonus",
                                        "current_date": new Date(),
                                        "usable_bonus_time":'$$sec.usable_bonus_time',
                                        "use_bonus": {$cond: { if: { $ifNull: [ "$$sec.usable_bonus_time", false ] }, then: { $cond: { if: { $gt: [new Date(),'$$sec.usable_bonus_time'] },then: {$toString: "$$sec.before_time_bonus"},else: {$toString: "$$sec.after_time_bonus"} } }, else: {$toString: "$$sec.contest.used_bonus"} }},
                                        "is_infinite": {$cond: { if: { $eq: [ "$$sec.contest.infinite_contest_size", 1 ] }, then: true, else: false }},
                                        "is_offerable": {$cond: { if: { $eq: [ "$$sec.is_offerable", 1 ] }, then: true, else: false }},
                                        "offer_after_join":{ $ifNull: [ "$$sec.offer_after_join", 0 ] },
                                        "offerable_amount":{ $ifNull: [ "$$sec.offerable_amount", 0 ] },
                                        "teams_joined": "$$sec.joined_users",
                                        "total_teams": "$$sec.contest.contest_size",
                                        "total_winners": { $arrayElemAt: [ "$$sec.contest.breakup", -1 ] },
                                        "is_joined": is_joined, 
                                        "infinite_breakup" : {$cond: { if: { $eq: [ "$$sec.contest.infinite_contest_size", 1 ] }, then: {"winner_percent": "$$sec.contest.winner_percent", "winner_amount": "$$sec.contest.winning_amount_times"}, else: {} }},
                                        "is_aakash_team": {$cond: { if: { $eq: [ "$$sec.contest.amount_gadget", "aakash" ] }, then: true, else: false }},
                                        "is_favourite":false,
                                        "maximum_team_size": {$cond: { if: { $in: [ "$$sec.contest.multiple_team", ["yes",true] ] }, then: { $cond: { if: { $ifNull: ["$$sec.contest.maximum_team_size",false] },then: "$$sec.contest.maximum_team_size",else: 9 } }, else: 1 }},
                                        "contest_shareable": {$cond: { if: { $ifNull: [ "$$sec.contest.contest_shareable", false ] }, then: "$$sec.contest.contest_shareable", else: 0 }} 
                                    }
                                }
                            },
                        }
                    },
                    {$sort : {sequence : 1}}
                ], (err, data) => {
                    if (err) {
                        reject(err);
                    }
                    if (!err) {
                        if(is_all && data && data.length > 0){
                            var conArry = [];
                            var dlength = data.length;
                            _.forEach(data, function(k, i){
                                conArry.push(k.contests)
                                if(i === (dlength - 1)){
                                    var newArray = Array.prototype.concat.apply([], conArry);
                                    resolve([{"contests": newArray}]);
                                }
                            })
                        }else{
                            resolve(data);
                        }
                    }
                });
            }catch(err){
                reject(err);
            } 
        });
    }
    getMatchContestLatest(categories,filter,limit,is_all){
        is_all = false;
        return new Promise((resolve, reject) => {
            try{
                var is_joined = false;
                this.collection.aggregate([
                    {
                        $match: {status:1}
                    },                                       
                    {
                        $lookup: {
                            from: 'match_contest',
                            let: { catId: "$_id" },
                            pipeline: [
                                {
                                    $match: {  
                                        $expr:{ 
                                            $and: [ 
                                                { $eq: [ "$category_id", "$$catId" ]},
                                                { $eq: [ "$match_id",  filter.match_id ]},
                                                { $eq: [ "$sport",  filter.sport ]},
                                                { $ne: [ "$is_full", 1 ]},
                                                { $ne: [ "$is_private", 1 ]},
                                                //{ $ne: [ "$admin_create", 1 ]},
                                            ]  
                                        }
                                    }
                                },
                               // {$limit : limit},
                                { $sort: {"created": -1}},                           
                                { $project: { joined_users:1, contest:1,localteam: 1, visitorteam_id:1, series_id: 1, status:1, category_id:1,parent_contest_id:1, contest_id:1, invite_code : 1, match_id:1, before_time_bonus :1, after_time_bonus :1, usable_bonus_time:1 } }
                            ],
                            as: 'matchContest',
                        }
                    },
                    {
                        $unwind: {
                            path: "$matchContest",
                            preserveNullAndEmptyArrays: false
                        }
                    },   
                    {
                        $group : {
                            _id : "$_id",
                            category_name : {$first : "$category_name"},
                            description : {$first : "$description"},
                            image : {$first: "$categories.image"},
                            status : {$first : "$status"},
                            sequence : {$first : "$sequence"},
                            match_id : {$first : "$matchContest.match_id"},
                            match_contest_id : {$first : "$matchContest._id"},
                            contests : {$push : "$matchContest"}
                        }
                    },
                    {
                        $project: {
                            _id:"$_id",
                            match_id: "$match_id",
                            category_id:"$_id",
                            "category_title": "$category_name",
                            "sequence": "$sequence",
                            "category_desc": "$description",
                            category_image: "$image",
                            "contests": {
                                $map: {
                                    "input": "$contests",
                                    as: "sec",
                                    in: {
                                        "contest_id": "$$sec.contest_id",
                                        "parent_contest_id":"$$sec.parent_contest_id",
                                        "entry_fee": "$$sec.contest.entry_fee",
                                        "prize_money": "$$sec.contest.winning_amount",
                                        "is_full": "$$sec.contest.is_full",
                                        "confirm_winning": {$cond: { if: { $eq: [ "$$sec.contest.confirmed_winning", "yes" ] }, then: "yes", else: 'no' }},
                                        "is_gadget": {$cond: { if: { $eq: [ "$$sec.contest.amount_gadget", "gadget" ] }, then: true, else: false }},
                                        "category_id": "$$sec.contest.category_id",
                                        "is_auto_create": "$$sec.contest.is_auto_create",                                       
                                        "multiple_team": {$cond: { if: { $in: [ "$$sec.contest.multiple_team", ["yes",true] ] }, then: true, else: false }},
                                        "invite_code": "$$sec.invite_code",
                                        "breakup_detail": { 
                                            $map: {
                                                "input": "$$sec.contest.breakup",
                                                as: "break",
                                                in: {
                                                    "rank": {$cond: { if: { $eq: [ "$$break.startRank", "$$break.endRank" ] }, then: { $concat: [ "Rank ", {$toString: "$$break.startRank" } ] }, else:  "$$break.name" }},
                                                    "gadget_name": {$cond: { if: { $ne: [ "$$break.gadget_name", "" ] }, then: "$$break.gadget_name", else: "" }},
                                                    "image": {$cond: { if: { $ne: [ "$$break.image", "" ] }, then: { $concat: [ imageurl, "/", "$$break.image" ] }, else: "" }},
                                                    "price": {$cond: { if: { $gt: [ "$$break.price_each", 0 ] }, then: {$trunc : ["$$break.price_each", 2]}, else: {$trunc : ["$$break.price", 2]} }},
                                                }
                                            }
                                        },
                                        "after_time_bonus":  "$$sec.after_time_bonus",
                                        "before_time_bonus": "$$sec.before_time_bonus",
                                        "current_date": new Date(),
                                        "usable_bonus_time":'$$sec.usable_bonus_time',
                                        "use_bonus": {$cond: { if: { $ifNull: [ "$$sec.usable_bonus_time", false ] }, then: { $cond: { if: { $gt: [new Date(),'$$sec.usable_bonus_time'] },then: {$toString: "$$sec.before_time_bonus"},else: {$toString: "$$sec.after_time_bonus"} } }, else: {$toString: "$$sec.contest.used_bonus"} }},
                                        "is_infinite": {$cond: { if: { $eq: [ "$$sec.contest.infinite_contest_size", 1 ] }, then: true, else: false }},
                                        "teams_joined": "$$sec.joined_users",
                                        "total_teams": "$$sec.contest.contest_size",
                                        "total_winners": { $arrayElemAt: [ "$$sec.contest.breakup", -1 ] },
                                        "is_joined": is_joined, 
                                        "infinite_breakup" : {$cond: { if: { $eq: [ "$$sec.contest.infinite_contest_size", 1 ] }, then: {"winner_percent": "$$sec.contest.winner_percent", "winner_amount": "$$sec.contest.winning_amount_times"}, else: {} }},
                                        "is_aakash_team": {$cond: { if: { $eq: [ "$$sec.contest.amount_gadget", "aakash" ] }, then: true, else: false }},
                                        "is_favourite":false,
                                        "maximum_team_size": {$cond: { if: { $in: [ "$$sec.contest.multiple_team", ["yes",true] ] }, then: { $cond: { if: { $ifNull: ["$$sec.contest.maximum_team_size",false] },then: "$$sec.contest.maximum_team_size",else: 9 } }, else: 1 }},
                                        "contest_shareable": {$cond: { if: { $ifNull: [ "$$sec.contest.contest_shareable", false ] }, then: "$$sec.contest.contest_shareable", else: 0 }} 
                                    }
                                }
                            },
                        }
                    },
                    {$sort : {sequence : 1}}
                ], (err, data) => {
                    if (err) {
                        reject(err);
                    }
                    if (!err) {
                        if(is_all && data && data.length > 0){
                            var conArry = [];
                            var dlength = data.length;
                            _.forEach(data, function(k, i){
                                conArry.push(k.contests)
                                if(i === (dlength - 1)){
                                    var newArray = Array.prototype.concat.apply([], conArry);
                                    resolve([{"contests": newArray}]);
                                }
                            })
                        }else{
                            resolve(data);
                        }
                    }
                });
            }catch(err){
                reject(err);
            } 
        });
    }

    getMatchContest(caty, filter, uid, limit, is_all) {
        return new Promise((resolve, reject) => {
            try{
                var is_joined = false;
                this.collection.aggregate([
                    {
                        $match: caty
                    },
                    {
                        $lookup: {
                            from: 'match_contest',
                            let: { catId: "$_id" },
                            pipeline: [
                                {
                                    $match: {  
                                        $expr:{ 
                                            $and: [ 
                                                { $eq: [ "$category_id", "$$catId" ]},
                                                { $eq: [ "$match_id",  filter.match_id ]},
                                                { $eq: [ "$sport",  filter.sport ]},
                                                { $ne: [ "$is_full", 1 ]},
                                                //{ $ne: [ "$admin_create", 1 ]},
                                            ]  
                                        }
                                    }
                                },
                                {$limit : limit},
                                { $sort: {"created": -1}},                           
                                { $project: { localteam: 1, visitorteam_id:1, series_id: 1, status:1, category_id:1, contest_id:1, invite_code : 1, match_id:1, before_time_bonus :1, after_time_bonus :1, usable_bonus_time:1 } }
                            ],
                            as: 'matchContest',
                        }
                    },
                    {
                        $unwind: {
                            path: "$matchContest",
                            preserveNullAndEmptyArrays: false // optional
                        }
                    },
                    {
                        $lookup: {
                            from: 'contest',
                            let: { constid: "$matchContest.contest_id" },
                            pipeline: [
                                {
                                    $match: {
                                        $expr:{ 
                                            $and: [
                                                { $eq: [ "$_id", "$$constid" ]},
                                                { $ne: [ "$is_private", 1 ]},
                                            ]  
                                        }
                                    }
                                },
                            ],
                            as: 'matchContest.contest',
                        }
                    },
                    {
                        $unwind: {
                            path: "$matchContest.contest",
                            preserveNullAndEmptyArrays: false // optional
                        }
                    },
                    {
                        $lookup: {
                            from: 'player_team_contest',
                            let: { contestId: "$matchContest.contest_id" },
                            pipeline: [
                                {
                                    $match: {  
                                        $expr:{ 
                                            $and: [
                                                {$eq: [ "$match_id", filter.match_id ]},
                                                { $eq: [ "$sport",  filter.sport ]},
                                                { $eq: [ "$contest_id",  "$$contestId" ]},
                                            ]  
                                        }
                                    }
                                },
                                // { $sort: {"createdAt":-1}},
                                { $project: { _id: 1, match_id:1, contest_id:1} }
                            ],
                            as: 'matchContest.player_team_contest_count',
                        }
                    },              
                    {
                        $lookup: {
                            from: 'player_team_contest',
                            let: { contestId: "$matchContest.contest_id" },
                            pipeline: [
                                {
                                    $match: {  
                                        $expr:{ 
                                            $and: [
                                            {$eq: [ "$match_id", filter.match_id ]},
                                            { $eq: [ "$sport",  filter.sport ]},
                                            { $eq: [ "$contest_id",  "$$contestId" ]},
                                            { $eq: [ "$user_id",  ObjectId(uid) ]},
                                            ]  
                                        }
                                    }
                                },
                                // { $sort: {"createdAt":-1}},
                                { $project: { _id: 1,player_team_id:1} }
                            ],
                            as: 'matchContest.player_team_contest',
                        }
                    },   
                    {
                        $group : {
                            _id : "$_id",
                            category_name : {$first : "$category_name"},
                            description : {$first : "$description"},
                            image : {$first: "$categories.image"},
                            status : {$first : "$status"},
                            sequence : {$first : "$sequence"},
                            match_id : {$first : "$matchContest.match_id"},
                            match_contest_id : {$first : "$matchContest._id"},
                            contests : {$push : "$matchContest"}
                        }
                    },
                    {
                        $project: {
                            _id:"$_id",
                            match_id: "$match_id",
                            category_id:"$_id",
                            "category_title": "$category_name",
                            "sequence": "$sequence",
                            "category_desc": "$description",
                            category_image: "$image",
                            "contests": {
                                $map: {
                                    "input": "$contests",
                                    as: "sec",
                                    in: {
                                        "contest_id": "$$sec.contest._id",
                                        "parent_id": "$$sec.contest.parent_id",
                                        "entry_fee": "$$sec.contest.entry_fee",
                                        "prize_money": "$$sec.contest.winning_amount",
                                        "is_full": "$$sec.contest.is_full",
                                        "confirm_winning": {$cond: { if: { $eq: [ "$$sec.contest.confirmed_winning", "yes" ] }, then: "yes", else: 'no' }},
                                        "is_gadget": {$cond: { if: { $eq: [ "$$sec.contest.amount_gadget", "gadget" ] }, then: true, else: false }},
                                        "category_id": "$$sec.contest.category_id",
                                        "is_auto_create": "$$sec.contest.is_auto_create",
                                        "multiple_team": {$cond: { if: { $in: [ "$$sec.contest.multiple_team", ["yes",true] ] }, then: true, else: false }},
                                        "invite_code": "$$sec.invite_code",
                                        "breakup_detail": { 
                                            $map: {
                                                "input": "$$sec.contest.breakup",
                                                as: "break",
                                                in: {
                                                    "rank": {$cond: { if: { $eq: [ "$$break.startRank", "$$break.endRank" ] }, then: { $concat: [ "Rank ", {$toString: "$$break.startRank" } ] }, else:  "$$break.name" }},
                                                    "gadget_name": {$cond: { if: { $ne: [ "$$break.gadget_name", "" ] }, then: "$$break.gadget_name", else: "" }},
                                                    "image": {$cond: { if: { $ne: [ "$$break.image", "" ] }, then: { $concat: [ imageurl, "/", "$$break.image" ] }, else: "" }},
                                                    "price": {$cond: { if: { $gt: [ "$$break.price_each", 0 ] }, then: {$trunc : ["$$break.price_each", 2]}, else: {$trunc : ["$$break.price", 2]} }},
                                                }
                                            }
                                        },
                                        "after_time_bonus":  "$$sec.after_time_bonus",
                                        "before_time_bonus": "$$sec.before_time_bonus",
                                        "current_date": new Date(),
                                        "usable_bonus_time":'$$sec.usable_bonus_time',
                                        "use_bonus": {$cond: { if: { $ifNull: [ "$$sec.usable_bonus_time", false ] }, then: { $cond: { if: { $gt: [new Date(),'$$sec.usable_bonus_time'] },then: {$toString: "$$sec.before_time_bonus"},else: {$toString: "$$sec.after_time_bonus"} } }, else: {$toString: "$$sec.contest.used_bonus"} }},
                                        "is_infinite": {$cond: { if: { $eq: [ "$$sec.contest.infinite_contest_size", 1 ] }, then: true, else: false }},
                                        "teams_joined": {$size : "$$sec.player_team_contest_count"},
                                        "total_teams": "$$sec.contest.contest_size",
                                        "my_team_ids":  "$$sec.player_team_contest",
                                        "total_winners": { $arrayElemAt: [ "$$sec.contest.breakup", -1 ] },
                                        "is_joined": is_joined, //{$cond: { if: { $gt: [ {$size : "$$sec.player_team_contest"}, 0 ] }, then: true, else: false }},
                                        "infinite_breakup" : {$cond: { if: { $eq: [ "$$sec.contest.infinite_contest_size", 1 ] }, then: {"winner_percent": "$$sec.contest.winner_percent", "winner_amount": "$$sec.contest.winning_amount_times"}, else: {} }},
                                        "is_aakash_team": {$cond: { if: { $eq: [ "$$sec.contest.amount_gadget", "aakash" ] }, then: true, else: false }},
                                    }
                                }
                            },
                        }
                    },
                    {$sort : {sequence : 1}}
                ], (err, data) => {
                    if (err) {
                        reject(err);
                    }
                    if (!err) {
                        
                        if(is_all && data && data.length > 0){
                            var conArry = [];
                            var dlength = data.length;
                            _.forEach(data, function(k, i){
                                conArry.push(k.contests)
                                if(i === (dlength - 1)){
                                    var newArray = Array.prototype.concat.apply([], conArry);
                                    resolve([{"contests": newArray}]);
                                }
                            })
                        } else {
                            resolve(data);
                        }
                        
                    }
                });
            }catch(err){
                reject(err);
            } 
        });               
    }

    getMatchContestByCategory(filter, uid, limit, is_all) {
        return new Promise((resolve, reject) => {
           
            try{
                var is_joined = false;
                this.collection.aggregate([
                    {
                        $match: filter
                    },   
                    { $limit : limit},
                    { $sort: {"created": -1}},
                    {
                        $lookup: {
                            from: 'contest',
                            let: { constid: "$contest_id" },
                            pipeline: [
                                {
                                    $match: {
                                        // $expr: { $eq: [ "$_id", "$$constid" ]},
                                        $expr:{ 
                                            $and: [
                                                { $eq: [ "$_id", "$$constid" ]},
                                                { $ne: [ "$is_private", 1 ]},
                                            ]  
                                        }
                                    }
                                },
                                //{ $sort: {"createdAt": -1}},                                
                                //{ $project: { localteam: 1, visitorteam_id:1, series_id: 1, status:1, category_id:1, category_id:1, invite_code : 1, match_id:1} }
                            ],
                            as: 'contest',
                        }
                    },
                    {
                        $unwind: {
                            path: "$contest",
                            preserveNullAndEmptyArrays: false // optional
                        }
                    },
                    {
                        $lookup: {
                            from: 'player_team_contest',
                            let: { contestId: "$contest_id" },
                            pipeline: [
                                {
                                    $match: {  
                                        $expr:{ 
                                            $and: [
                                                {$eq: [ "$match_id", filter.match_id ]},
                                                { $eq: [ "$contest_id",  "$$contestId" ]},
                                            ]  
                                        }
                                    }
                                },
                                // { $sort: {"createdAt":-1}},
                                { $project: { _id: 1, match_id:1, contest_id:1} }
                            ],
                            as: 'player_team_contest_count',
                        }
                    },              
                    {
                        $lookup: {
                            from: 'player_team_contest',
                            let: { contestId: "$contest_id" },
                            pipeline: [
                                {
                                    $match: {  
                                        $expr:{ 
                                            $and: [
                                            {$eq: [ "$match_id", filter.match_id ]},
                                            { $eq: [ "$contest_id",  "$$contestId" ]},
                                            { $eq: [ "$user_id",  ObjectId(uid) ]},
                                            ]  
                                        }
                                    }
                                },
                                { $project: { _id: 1,player_team_id:1} }
                            ],
                            as: 'player_team_contest',
                        }
                    },   
                    // {
                    //     $group : {
                    //         _id : "$_id",
                    //         category_name : {$first : "$category_name"},
                    //         description : {$first : "$description"},
                    //         //image : '', //{$first : { $concat: [ imageurl, "/", "$categories.image" ] }},
                    //         status : {$first : "$status"},
                    //         sequence : {$first : "$sequence"},
                    //         match_id : {$first : "$match_id"},
                    //         match_contest_id : {$first : "$_id"},
                    //         contests : {$push : "$matchContest"}
                    //     }
                    // },
                    // {
                    //     $project: {
                    //         _id:"$_id",
                    //         //match_contest_id:"$match_contest_id",
                    //         match_id: "$match_id",
                    //         category_id:"$_id",
                    //         "category_title": "$category_name",
                    //         "sequence": "$sequence",
                    //         "category_desc": "$description",
                    //         category_image: "$image",
                    //         "contests": {
                    //             $map: {
                    //                 "input": "$contests",
                    //                 as: "sec",
                    //                 in: {
                    //                     "contest_id": "$$sec.contest._id",
                    //                     "parent_id": "$$sec.contest.parent_id",
                    //                     "entry_fee": "$$sec.contest.entry_fee",
                    //                     "prize_money": "$$sec.contest.winning_amount",
                    //                     "is_full": "$$sec.contest.is_full",
                    //                     "confirm_winning": {$cond: { if: { $eq: [ "$$sec.contest.confirmed_winning", "yes" ] }, then: "yes", else: 'no' }},
                    //                     "is_gadget": {$cond: { if: { $eq: [ "$$sec.contest.amount_gadget", "gadget" ] }, then: true, else: false }},
                    //                     // "category_id": "$$sec.contest.amount_gadget",
                    //                     "category_id": "$$sec.contest.category_id",
                    //                     "is_auto_create": "$$sec.contest.is_auto_create",                                       
                    //                     "multiple_team": {$cond: { if: { $in: [ "$$sec.contest.multiple_team", ["yes",true] ] }, then: true, else: false }},
                    //                     //"invite_code": {$cond: { if: { $gt: [ {$size : "$$sec.invite_code"}, 0 ] }, then: { $arrayElemAt: [ "$$sec.invite_code.invite_code", 0 ] }, else: "" }},
                    //                     "invite_code": "$$sec.invite_code",
                    //                     "breakup_detail": { 
                    //                         $map: {
                    //                             "input": "$$sec.contest.breakup",
                    //                             as: "break",
                    //                             in: {
                    //                                 "rank": {$cond: { if: { $eq: [ "$$break.startRank", "$$break.endRank" ] }, then: { $concat: [ "Rank ", {$toString: "$$break.startRank" } ] }, else:  "$$break.name" }},
                    //                                 "gadget_name": {$cond: { if: { $ne: [ "$$break.gadget_name", "" ] }, then: "$$break.gadget_name", else: "" }},
                    //                                 "image": {$cond: { if: { $ne: [ "$$break.image", "" ] }, then: { $concat: [ imageurl, "/", "$$break.image" ] }, else: "" }},
                    //                                 // "price": {$cond: { if: { $gt: [ "$$break.price", 0 ] }, then: "$$break.price", else: 0 }}
                    //                                 "price": {$cond: { if: { $gt: [ "$$break.price_each", 0 ] }, then: {$trunc : ["$$break.price_each", 2]}, else: {$trunc : ["$$break.price", 2]} }},
                    //                             }
                    //                         }
                    //                     },
                    //                     "after_time_bonus":  "$$sec.after_time_bonus",
                    //                     "before_time_bonus": "$$sec.before_time_bonus",
                    //                     "current_date": new Date(),
                    //                     "usable_bonus_time":'$$sec.usable_bonus_time',
                    //                     "use_bonus": {$cond: { if: { $ifNull: [ "$$sec.usable_bonus_time", false ] }, then: { $cond: { if: { $gt: [new Date(),'$$sec.usable_bonus_time'] },then: {$toString: "$$sec.before_time_bonus"},else: {$toString: "$$sec.after_time_bonus"} } }, else: {$toString: "$$sec.contest.used_bonus"} }},                                        
                    //                     //"use_bonus": {$toString: "$$sec.contest.used_bonus"} ,
                    //                     "is_infinite": {$cond: { if: { $eq: [ "$$sec.contest.infinite_contest_size", 1 ] }, then: true, else: false }},
                    //                     "teams_joined": {$size : "$$sec.player_team_contest_count"},//  {$cond: { if: { $eq: [ {$size : "$$sec.contest.player_team_contest_count"}, 1 ] }, then: {$size : "$$sec.contest.player_team_contest_count"}, else: 0 }},
                    //                     "total_teams": "$$sec.contest.contest_size",
                    //                     "my_team_ids":  "$$sec.player_team_contest",
                    //                     "total_winners": { $arrayElemAt: [ "$$sec.contest.breakup", -1 ] },
                    //                     "is_joined": is_joined, //{$cond: { if: { $gt: [ {$size : "$$sec.player_team_contest"}, 0 ] }, then: true, else: false }},
                    //                     "infinite_breakup" : {$cond: { if: { $eq: [ "$$sec.contest.infinite_contest_size", 1 ] }, then: {"winner_percent": "$$sec.contest.winner_percent", "winner_amount": "$$sec.contest.winning_amount_times"}, else: {} }}
                    //                 }
                    //             }
                    //         },
                    //     }
                    // },
                    // {$sort : {sequence : 1}}
                ], (err, data) => {
                    //console.log("data", data)
                    if (err) {
                        reject(err);
                    }
                    if (!err) {
                        
                        resolve(data);
                        
                    }
                });
            }catch(err){
                reject(err);
            } 
        });
    }

    getAllMatchesContest(filter, uid, limit) {
        return new Promise((resolve, reject) => {
            //console.log("filter, uid", filter, uid)
            try{
                this.collection.aggregate([
                    {
                        $match: filter
                    },
                    { $limit : 500 },
                    { $sort : {"contestStartDateTime":-1} },
                    {
                        $lookup: {
                            from: 'contest',
                            let: { contestid: "$contest_id" },
                            pipeline: [
                                {
                                    $match: {                                          
                                        $expr:{
                                            $and: [
                                                { $eq: [ "$_id", "$$contestid" ]},
                                                { $eq: [ "$is_full",  false ]},
                                            ]  
                                        }
                                    }
                                },
                                {$sort : {"created":-1}},
                                { $project: { winner_percent: 1, is_full: 1, is_auto_create:1, invite_code:1, category_id:1, contest_id:1, infinite_contest_size:1, multiple_team:1, category_id:1, contest_size:1, entry_fee:1, winning_amount:1, winning_amount_times:1, used_bonus:1, breakup:1, confirmed_winning:1} },
                                
                            ],
                            as: 'contests',
                        }
                    }, 
                    // {
                    //     $unwind: {
                    //         path: "$contests",
                    //         preserveNullAndEmptyArrays: true // optional
                    //     }
                    // },
                    // {
                    //     $lookup: {
                    //         from: 'player_team_contest',
                    //         let: { contestId: "$contests._id" },
                    //         pipeline: [
                    //             {
                    //                 $match: {  
                    //                     $expr:{ 
                    //                         $and: [
                    //                             {$eq: [ "$match_id", filter.match_id ]},
                    //                             { $eq: [ "$contest_id",  "$$contestId" ]},
                    //                         ]  
                    //                     }
                    //                 }
                    //             },
                    //             // { $sort: {"createdAt":-1}},
                    //             { $project: { _id: 1, match_id:1, contest_id:1} }
                    //         ],
                    //         as: 'player_team_contest_count',
                    //     }
                    // },      
                    // {
                    //     $unwind: {
                    //         path: "$player_team_contest",
                    //         preserveNullAndEmptyArrays: false // optional
                    //     }
                    // },        
                    // {
                    //     $lookup: {
                    //         from: 'player_team_contest',
                    //         let: { contestId: "$contests._id" },
                    //         pipeline: [
                    //             {
                    //                 $match: {  
                    //                     $expr:{ 
                    //                         $and: [
                    //                             {$eq: [ "$match_id", filter.match_id ]},
                    //                             { $eq: [ "$contest_id",  "$$contestId" ]},
                    //                             //{ $eq: [ "$user_id",  ObjectId(uid) ]},
                    //                         ]  
                    //                     }
                    //                 }
                    //             },
                    //             // { $sort: {"createdAt":-1}},
                    //             { $project: { _id: 1,player_team_id:1} }
                    //         ],
                    //         as: 'player_team_contest',
                    //     }
                    // },
                    // {
                    //     $unwind: {
                    //         path: "$player_team_contest",
                    //         preserveNullAndEmptyArrays: false // optional
                    //     }
                    // },
                    {
                        $project : {
                            _id : "$_id",
                            contestStartDateTime: "$contestStartDateTime",
                            contest_id:"$contest_id",
                            match_contest_id:"$_id" ,
                            match_id: "$match_id" ,
                            invite_code:"$invite_code",
                            contests: "$contests",
                            player_team_contest_count : "$player_team_contest_count",
                            player_team_contest : "$player_team_contest"
                        }
                    }
                ], (err, data) => {
                    //console.log("data", data)
                    if (err) {
                        reject(err);
                    }
                    if (!err) {
                        resolve(data);
                    }
                });
            }catch(err){
                reject(err);
            } 
        });               
    }

    getMatchList(sport) {
        return new Promise((resolve, reject) => {
            var serverTime1 = moment(new Date()).format(config.DateFormat.datetime);
            try {
                this.collection.aggregate([
                    {
                        $match:{time: {$gte: new Date()},is_parent:true, status:1,match_status:"Not Started",sport:sport}
                    },
                    { $sort : {sort: -1, time : 1} },
                    { $limit : 100 },
                    {
                        $lookup: {
                            from: 'series',
                            let: { seriesId: "$series_id"},
                            pipeline: [
                                {
                                    $match: {
                                        $expr:{
                                            $and : [
                                                { $eq: [ "$id_api", "$$seriesId" ] },
                                                { $eq: [ "$status", 1 ] }
                                            ]
                                        }
                                    }
                                },
                                {$project : {"name":1, "short_name" : 1}}
                            ],
                            as: 'series',
                        }
                    },
                    {
                        $unwind: {
                            path: "$series",
                            preserveNullAndEmptyArrays: false // optional
                        }
                    },
                    {
                        $project:{
                            "_id":"$_id",
                            "match_id": "$match_id",
                            "local_team_id":"$localteam_id",
                            "visitor_team_id": "$visitorteam_id",
                            "series_id":"$series_id",
                            "is_leaderboard":"$is_leaderboard",
                            "live_match_close":"$live_match_close",
                            "match_comment":"$match_comment",
                            "local_team_flag":{ $concat: [ imageurl, "/", "$local_flag" ] },
                            "visitor_team_flag":{ $concat: [ imageurl, "/", "$visitor_flag" ] },
                            "series_name": {$cond: { if: { $ne: [ "$series_name", '' ] }, then: "$series_name", else : "$series.short_name"}},
                            "local_team_name": {$cond: { if: { $ne: [ "$localteam_short_name", "" ] }, then: "$localteam_short_name", else: "$localteam" }},
                            "visitor_team_name": {$cond: { if: { $ne: [ "$visitorteam_short_name", "" ] }, then: "$visitorteam_short_name", else: "$visitorteam" }},
                            "star_date":{ $dateToString: {date: "$date", format: "%Y-%m-%d" } },
                            "star_time":{ $dateToString: {date: "$time", format: "%H:%M" } },
                            "total_contest": {$cond: { if: { $ne: [ "$contest_count", 0 ] }, then: "$contest_count", else: 0 }},
                            // "total_contest": {$size : "$match_contest_count"},
                            "server_time": serverTime1,
                            "over_match":{ $ifNull: [ "$over_match", false ] },
                            "playing_11": "$playing_11",
                            "sort": "$sort",
                            "xfactors":"$xfactors",
                            "is_notification":{$cond: { if: { $eq: [ "$notification_status", 'active' ] }, then: true, else: false }},
                            "notification_title":"$notification_title",
                            "match_banner":{$cond: { if: { $eq: [ "$match_banner", '' ] }, then: "", else: { $concat: [ imageurl, "/", "$match_banner" ] } }},
                            "active_giveaway":{ $ifNull: [ "$active_giveaway", false ] },
                            "live_fantasy":{ $ifNull: [ "$custom_live_fantasy", false ] },
                            "local_color_code":{ $ifNull: [ "$local_color_code", '' ] },
                            "visitor_color_code":{ $ifNull: [ "$visitor_color_code", '' ] },
                            "is_highlight":{ $ifNull: [ "$is_highlight", 0 ] },
                            "winning_comment":{ $ifNull: [ "$winning_comment", '' ] },
                            "parent_id":"$parent_id"
                        }
                    }
                ], (err, data) => {
                    if (err) {
                        reject(err);
                    }
                    if (!err) {
                        resolve(data);
                    }
                });
            }catch(error){
                console.log("error", error)
            }
        });
    }
    getMatchLiveFantasyList(sport) {
        return new Promise((resolve, reject) => {
            var serverTime1 = moment(new Date()).format(config.DateFormat.datetime);
            try {
                this.collection.aggregate([
                    {
                        $match:{$or: [{over_match:true,status:1,match_status:"In Progress",live_match_close:0,sport:1},{custom_live_fantasy:true,status:1,match_status:"In Progress",live_match_close:0,sport:1}]}
                    },
                    { $sort : {sort: -1, time : 1} },
                    { $limit : 100 },
                    {
                        $lookup: {
                            from: 'series',
                            let: { seriesId: "$series_id"},
                            pipeline: [
                                {
                                    $match: {
                                        $expr:{
                                            $and : [
                                                { $eq: [ "$id_api", "$$seriesId" ] },
                                                { $eq: [ "$status", 1 ] }
                                            ]
                                        }
                                    }
                                },
                                {$project : {"name":1, "short_name" : 1}}
                            ],
                            as: 'series',
                        }
                    },
                    {
                        $unwind: {
                            path: "$series",
                            preserveNullAndEmptyArrays: false // optional
                        }
                    },
                    {
                        $project:{
                            "_id":"$_id",
                            "match_id": "$match_id",
                            "local_team_id":"$localteam_id",
                            "visitor_team_id": "$visitorteam_id",
                            "series_id":"$series_id",
                            "is_leaderboard":"$is_leaderboard",
                            "live_match_close":"$live_match_close",
                            // "match_comment":"$match_comment",
                            "local_team_flag":{ $concat: [ imageurl, "/", "$local_flag" ] },
                            "visitor_team_flag":{ $concat: [ imageurl, "/", "$visitor_flag" ] },
                            "series_name": {$cond: { if: { $ne: [ "$series_name", '' ] }, then: "$series_name", else : "$series.short_name"}},
                            "local_team_name": {$cond: { if: { $ne: [ "$localteam_short_name", "" ] }, then: "$localteam_short_name", else: "$localteam" }},
                            "visitor_team_name": {$cond: { if: { $ne: [ "$visitorteam_short_name", "" ] }, then: "$visitorteam_short_name", else: "$visitorteam" }},
                            "star_date":{ $dateToString: {date: "$date", format: "%Y-%m-%d" } },
                            "star_time":{ $dateToString: {date: "$time", format: "%H:%M" } },
                            "total_contest": {$cond: { if: { $ne: [ "$contest_count", 0 ] }, then: "$contest_count", else: 0 }},
                            // "total_contest": {$size : "$match_contest_count"},
                            "server_time": serverTime1,
                            "over_match":{ $ifNull: [ "$over_match", false ] },
                            "playing_11": "$playing_11",
                            "sort": "$sort",
                            "xfactors":"$xfactors",
                            "is_notification":{$cond: { if: { $eq: [ "$notification_status", 'active' ] }, then: true, else: false }},
                            "notification_title":"$notification_title",
                            "match_type" : "live-fantasy",
                            "active_giveaway":{ $ifNull: [ "$active_giveaway", false ] },
                            "live_fantasy":{ $ifNull: [ "$custom_live_fantasy", false ] }, 
                            "local_color_code":{ $ifNull: [ "$local_color_code", '' ] },
                            "visitor_color_code":{ $ifNull: [ "$visitor_color_code", '' ] },
                            "is_highlight":{ $ifNull: [ "$is_highlight", 0 ] },
                            "winning_comment":{ $ifNull: [ "$winning_comment", '' ] },
                        }
                    }
                ], (err, data) => {
                    if (err) {
                        reject(err);
                    }
                    if (!err) {
                        resolve(data);
                    }
                });
            }catch(error){
                console.log("error", error)
            }
        });
    }

    getPlayerTeamList(filter, team_id){
        return new Promise((resolve, reject) => {
            //console.log("filter, uid", filter)
            try{
                this.collection.aggregate([
                    {
                        $match: filter
                    },                    
                    {
                        $lookup: {
                            from: 'player_record',
                            let: { playersIds: "$players" },
                            pipeline: [
                                {
                                    $match: { 
                                        $expr:{ 
                                            $and: [
                                                {$in: [ "$player_id", "$$playersIds" ]},
                                                {$eq: [ "$series_id",  filter.series_id  ]},
                                            ]  
                                        }
                                    }
                                },
                                // { $sort: {"createdAt":-1}},
                                //{ $project: { category_name: 1, description:1, image:1, status:1} }
                            ],
                            as: 'playerRecord',
                        }
                    },
                    
                    {
                        $unwind: {
                            path: "$playerRecord",
                            preserveNullAndEmptyArrays: true // optional
                        }
                    },

                    {
                        $lookup: {
                            from: 'series_players',
                            let: { playersId: "$playerRecord.player_id" },
                            pipeline: [
                                {
                                    $match: {  
                                        $expr:{ 
                                            $and: [
                                                {$eq: [ "$player_id", "$$playersId" ]},
                                                {$eq: [ "$team_id",  team_id ]},
                                                {$eq: [ "$series_id",  filter.series_id  ]},
                                            ]  
                                        }
                                    }
                                },
                                // { $sort: {"createdAt":-1}},
                                { $project: { _id: 1} }
                            ],
                            as: 'playerRecord.is_local_team',
                        }
                    }, 
                    // {
                    //     $lookup: {
                    //         from: 'live_score',
                    //         let: { playersId: "$playerRecord.player_id" },
                    //         pipeline: [
                    //             {
                    //                 $match: {  
                    //                     $expr:{ 
                    //                         $and: [ 
                    //                             {$eq: [ "$player_id", "$$playersId" ]},
                    //                             {$eq: [ "$match_id",  team_id ]},
                    //                             {$eq: [ "$series_id",  filter.series_id  ]},
                    //                         ]  
                    //                     }
                    //                 }
                    //             },
                    //             { $sort: {_id:-1}},
                    //             { $project: {'point':1,'match_type':1,'player_name':1} }
                    //         ],
                    //         as: 'playerRecord.point',
                    //     }
                    // },

                    // {
                    //     $lookup: {
                    //         from: 'player_record',
                    //         let: { playersIds: "$players" },
                    //         pipeline: [
                    //             {
                    //                 $match: {  
                    //                     $expr:{ 
                    //                         $and: [
                    //                             {$in: [ "$player_id", "$$playersIds" ]},
                    //                             {$eq: [ "$playing_role",  "Wicketkeeper" ]},
                    //                             {$eq: [ "$series_id",  filter.series_id  ]},
                    //                         ]  
                    //                     }
                    //                 }
                    //             },
                    //             // { $sort: {"createdAt":-1}},
                    //             { $project: { _id: 1, Wicketkeeper: 1} }
                    //         ],
                    //         as: 'playerRecordWicketKeeper',
                    //     }
                    // }, 
                    // {
                    //     $lookup: {
                    //         from: 'player_record',
                    //         let: { playersIds: "$players" },
                    //         pipeline: [
                    //             {
                    //                 $match: {  
                    //                     $expr:{ 
                    //                         $and: [
                    //                             {$in: [ "$player_id", "$$playersIds" ]},
                    //                             {$eq: [ "$playing_role",  "Bowler" ]},
                    //                             {$eq: [ "$series_id",  filter.series_id  ]},
                    //                         ]  
                    //                     }
                    //                 }
                    //             },
                    //             // { $sort: {"createdAt":-1}},
                    //             { $project: { _id: 1, Wicketkeeper: 1} }
                    //         ],
                    //         as: 'playerRecordBowler',
                    //     }
                    // }, 
                    // {
                    //     $lookup: {
                    //         from: 'player_record',
                    //         let: { playersIds: "$players" },
                    //         pipeline: [
                    //             {
                    //                 $match: {  
                    //                     $expr:{ 
                    //                         $and: [
                    //                             {$in: [ "$player_id", "$$playersIds" ]},
                    //                             {$eq: [ "$playing_role",  "Batsman" ]},
                    //                             {$eq: [ "$series_id",  filter.series_id  ]},
                    //                         ]  
                    //                     }
                    //                 }
                    //             },
                    //             // { $sort: {"createdAt":-1}},
                    //             { $project: { _id: 1, Wicketkeeper: 1} }
                    //         ],
                    //         as: 'playerRecordBatsman',
                    //     }
                    // }, 
                    // {
                    //     $lookup: {
                    //         from: 'player_record',
                    //         let: { playersIds: "$players" },
                    //         pipeline: [
                    //             {
                    //                 $match: {  
                    //                     $expr:{ 
                    //                         $and: [
                    //                             {$in: [ "$player_id", "$$playersIds" ]},
                    //                             {$eq: [ "$playing_role",  "Allrounder" ]},
                    //                             {$eq: [ "$series_id",  filter.series_id  ]},
                    //                         ]  
                    //                     }
                    //                 }
                    //             },
                    //             // { $sort: {"createdAt":-1}},
                    //             { $project: { _id: 1, Wicketkeeper: 1} }
                    //         ],
                    //         as: 'playerRecordAllrounder',
                    //     }
                    // },
                    {
                        $group : {
                            _id: "$_id",
                            team_number: {$first : "$team_count"},
                            captain_player_id: {$first : "$captain"},
                            vice_captain_player_id: {$first: "$vice_captain"},
                            match_id: {$first : "$match_id"},
                            series_id: {$first : "$series_id"},
                            total_point : {$first: {$cond: { if: { $ne: [ "$points", "" ] }, then: 0, else: "$points" }}},                           
                            // "total_wicketkeeper":{$first :  {$size : "$playerRecordWicketKeeper"} },
                            // "total_bowler": {$first : {$size : "$playerRecordBowler"} },
                            // "total_batsman":{$first :  {$size : "$playerRecordBatsman"} },
                            // "total_allrounder": {$first : {$size : "$playerRecordAllrounder"} },
                            player_record: {$push : "$playerRecord"},
                            createdAt: {$first : "$createdAt"},
                        }
                    },
                    {
                        $project : {
                            teamid: "$_id",
                            team_number: "$team_number",
                            total_point : "$total_point",
                            captain_player_id: "$captain_player_id",
                            vice_captain_player_id: "$vice_captain_player_id",
                            match_id: "$match_id",
                            series_id: "$series_id",
                            // substitute_detail: {},
                            // my_teams : 0,
                            // my_contests: 0,
                            // "total_wicketkeeper": "$total_wicketkeeper",
                            // "total_bowler": "$total_bowler",
                            // "total_batsman": "$total_batsman",
                            // "total_allrounder": "$total_allrounder",
                            "player_details": { 
                                $map: {
                                    "input": "$player_record",
                                    as: "playerObj",
                                    in: {
                                        "name": "$$playerObj.player_name",
                                        "player_id": "$$playerObj.player_id",
                                        //"image": { $concat: [ imageurl, '/player_image/',   "$$playerObj.image" ] },
                                        "role": "$$playerObj.playing_role",
                                        "credits": "$$playerObj.player_credit",
                                        //"points": {$cond: { if: { $gt: [ "$$break.price", 0 ] }, then: "$$break.price", else: 0 }},
                                        "is_local_team": {$cond: { if: { $gt: [ {$size : "$$playerObj.is_local_team"}, 0 ] }, then: true, else: false }},
                                        "in_dream_team": false
                                    }
                                }
                            },
                            createdAt: "$createdAt",
                        }
                    },
                    {
                        $sort : {"team_number": 1}
                    },
                    ], (err, data) => {
                    //console.log("data", data)
                    if (err) {
                        reject(err);
                    }
                    if (!err) {
                        resolve(data);
                    }
                });
            }catch(error){
                console.log("error", error)
            }
        });
    }

    getMyContestList(skip, limit, sort, filter, sport, type){
        return new Promise((resolve, reject) => {
            try{
                var serverTime2 = moment(new Date()).format(config.DateFormat.datetime);
                
                var matchesFilter = []
                let sortTime =  {};
                if(type == 'upcoming') {
                    let currentDate2 = moment().utc().toDate();
                    let oneMonthDateUp =  moment().utc().add('30','days').toDate();

                    matchesFilter = [
                        { $eq: [ "$match_id", "$$matchId" ]},
                        { $eq: [ "$series_id", "$$seriesId" ]},
                        { $eq: [ "$match_status",  "Not Started" ]},
                        { $eq: [ "$sport",  sport ]},
                        { $eq: [ "$status",  1 ]},
                        { $gte: [ "$time",  currentDate2 ]},
                        { $lt: [ "$time",  oneMonthDateUp ]},
                    ]

                    sortTime = {sort_time : 1}
                }else if(type == 'live'){
                    let currentDateLive	 =	moment().utc().toDate();
                    matchesFilter = [
                        { $in: [ "$match_status", [MatchStatus.MATCH_INPROGRESS,MatchStatus.MATCH_DELAYED,MatchStatus.MATCH_NOTSTART,'Finished'] ]},
                        { $eq: [ "$sport",  sport ]},
                        { $eq: [ "$win_flag",  0 ]},
                        { $eq: [ "$status",  1 ]},
                        { $lte: [ "$time",  currentDateLive ]},
                        { $eq: [ "$match_id", "$$matchId" ]},
                        { $eq: [ "$series_id", "$$seriesId" ]},
                    ]
                    sortTime = {sort_time : -1}
                    //console.log('************** Live Match', matchesFilter)
                }else if(type == 'completed_match'){
                    let pastMonthDateCM	=  moment().utc().subtract('30','days').toDate();
                    matchesFilter = [
                        { $or: [ 
                            {$and: [{ $eq: ["$match_status", "Finished"] },{ $eq: [ "$win_flag",  1 ] }]},
                            { $eq: ["$match_status", "Cancelled"] }
                        ]},
                        // { $eq: [ "$match_status", "Finished" ]}, 
                        // { $eq: [ "$win_flag",  1 ]},
                        { $eq: [ "$sport",  sport ]},
                        { $eq: [ "$status",  1 ]},
                        { $gte: [ "$time",  pastMonthDateCM ]},
                        { $eq: [ "$match_id", "$$matchId" ]},
                        { $eq: [ "$series_id", "$$seriesId" ]},
                    ]
                    sortTime = {sort_time : -1}

                    //console.log("matchesFilter", matchesFilter)
                }

               

                this.collection.aggregate([
                    {
                        $match:filter
                    },
                    {
                        $sort: sort
                    },
                    {
                        $lookup: {
                            from: 'series_squad',
                            let: { matchId: "$match_id", seriesId : "$series_id"},
                            pipeline: [
                                {
                                    $match: {
                                        $expr:{ 
                                            $and: matchesFilter
                                        }
                                    }
                                },
                                {$project : {"localteam_id":1, "visitorteam_id" : 1, "series_id":1, "match_status":1, "time":1, "date":1}}
                            ],
                            as: 'matches',
                        }
                    },
                    {
                        $unwind: {
                            path: "$matches",
                            preserveNullAndEmptyArrays: false // optional
                        }
                    },      
                                                  
                    {
                        $lookup: {
                            from: 'mst_teams',
                            let: { locId: "$matches.localteam_id"},
                            pipeline: [
                                {
                                    $match: {
                                        $expr:{
                                            $and: [
                                                { $eq: [ "$team_id", "$$locId" ]},
                                                { $eq: [ "$sport",  1 ]}
                                            ]  
                                        }
                                    }
                                },
                                {$project : {"team_name":1, "team_short_name" : 1}}
                            ],
                            as: 'local_mst_team',
                        }
                    },
                    {
                        $unwind: {
                            path: "$local_mst_team",
                            preserveNullAndEmptyArrays: true // optional
                        }
                    },
                    {
                        $lookup: {
                            from: 'mst_teams',
                            let: { locId: "$matches.visitorteam_id"},
                            pipeline: [
                                {
                                    $match: {
                                        $expr:{
                                            $and: [
                                                { $eq: [ "$team_id", "$$locId" ]},
                                                { $eq: [ "$sport",  1 ]}
                                            ]  
                                        }
                                    }
                                },
                                {$project : {"team_name":1, "team_short_name" : 1}}
                            ],
                            as: 'visitor_mst_team',
                        }
                    },
                    {
                        $unwind: {
                            path: "$visitor_mst_team",
                            preserveNullAndEmptyArrays: true // optional
                        }
                    },                     
                    {
                        $lookup: {
                            from: 'series',
                            let: { seriesId: "$series_id"},
                            pipeline: [
                                {
                                    $match: {
                                        $expr:{
                                            $eq: [ "$id_api", "$$seriesId" ]
                                        }
                                    }
                                },
                                {$project : {"name":1, "short_name" : 1}}
                            ],
                            as: 'series',
                        }
                    },  
                    {
                        $unwind: {
                            path: "$series",
                            preserveNullAndEmptyArrays: true // optional
                        }
                    },  
                    // {
                    //     $project : {
                    //         _id : "$_id",
                    //         match_id : "$match_id",
                    //         matches : "$matches",
                    //         local_mst_team : "$local_mst_team",
                    //         visitor_mst_team : "$visitor_mst_team",
                    //         series : "$series",
                    //     }
                    // },                    
                    {
                        $group : {
                            _id :  {
                                "match_id": "$match_id",
                                "contest_id": "$contest_id"
                            },
                            "p_t_c" :{$first : "$_id"},
                            "match_id": {$first : "$match_id"},
                            "series_id": {$first : "$series_id"},
                            "match_status": {$first : "$matches.match_status"},
                            local_team_id : {$first : "$matches.localteam_id"},
                            local_team_name: {$first : {$cond: { if: { $eq: [ "$local_mst_team.team_short_name", null ] }, then: "$localteam", else: "$local_mst_team.team_short_name" }}},
                            local_team_flag : "$local_mst_team.flag", //{$first : "https://real-11-dev.s3.ap-south-1.amazonaws.com/team_flag/undefined"},
                            visitor_team_id : {$first : "$matches.visitorteam_id"},
                            visitor_team_name : {$first : {$cond: { if: { $eq: [ "$visitor_mst_team.team_short_name", null ] }, then: "$visitorteam", else: "$visitor_mst_team.team_short_name" }}},
                            visitor_team_flag  : "$visitor_mst_team.flag", //{$first : "https://real-11-dev.s3.ap-south-1.amazonaws.com/team_flag/undefined"},
                            series_name : {$first : {$cond: { if: { $eq: [ "$matches.series_name", null ] }, then: "$series.short_name", else: "$matches.series_name" }}},
                            "star_date":{$first :  { $dateToString: {date: "$matches.time", format: "%Y-%m-%d" } }},
                            "star_time": {$first : { $dateToString: {date: "$matches.time", format: "%H:%M" } }},
                            "sort_time": {$first : "$matches.time"},
                            contest_id : {$first : "$contest_id"}
                        }
                    },
                    {
                        $group : {
                            _id :  "$_id.match_id",
                            "p_t_c" :{$first : "$p_t_c"},
                            "match_id": {$first : "$match_id"},
                            "series_id": {$first : "$series_id"},
                            "match_status": {$first : "$match_status"},
                            local_team_id : {$first : "$local_team_id"},
                            local_team_name: {$first : "$local_team_name"},
                            local_team_flag : {$first : "$local_team_flag"},
                            visitor_team_id : {$first : "$visitor_team_id"},
                            visitor_team_name : {$first : "$visitor_team_name"},
                            visitor_team_flag  : {$first : "$visitor_team_flag"},
                            series_name : {$first : "$series_name"},
                            "star_date":{$first : "$star_date"},
                            "star_time": {$first : "$star_time"},
                            total_contest : {$push : "$contest_id"},
                            sort_time : {$first : "$sort_time"}
                        }
                    },
                    {
                        $project : {
                            "_id" : "$_id",
                            "p_t_c": "$p_t_c",
                            "match_id": "$match_id",
                            "series_id": "$series_id",
                            "match_status":"$match_status",
                            local_team_id : "$local_team_id",
                            local_team_name: "$local_team_name",
                            local_team_flag : "$local_team_flag",
                            visitor_team_id : "$visitor_team_id",
                            visitor_team_name : "$visitor_team_name",
                            visitor_team_flag  : "$visitor_team_flag",
                            series_name : "$series_name",
                            "star_date": "$star_date",
                            "star_time":  "$star_time",
                            "server_time": serverTime2,
                            "sort_time" :"$sort_time",
                            total_contest : {$size : "$total_contest"}
                        }
                    },
                    {
                        $sort: sortTime
                    },

                ], (err, data) => {
                    if (err) {
                        reject(err);
                    }
                    if (!err) {
                        resolve(data);
                    }
                });
            }catch(error){
                console.log("error", error)
            }
        });
    }

    myContestModelLastOne(skip, limit, sort, filter, sport, type){
        return new Promise((resolve, reject) => {
            try{
                var serverTime2 = moment(new Date()).format(config.DateFormat.datetime);
                
                var matchesFilter = []
                let sortTime =  {};
                if(type == 'upcoming') {
                    let currentDate2 = moment().utc().toDate();
                    let oneMonthDateUp =  moment().utc().add('30','days').toDate();

                    matchesFilter = [
                        { $eq: [ "$match_id", "$$matchId" ]},
                        { $eq: [ "$series_id", "$$seriesId" ]},
                        { $eq: [ "$match_status",  "Not Started" ]},
                        { $eq: [ "$sport",  sport ]},
                        { $eq: [ "$status",  1 ]},
                        { $gte: [ "$time",  currentDate2 ]},
                        { $lt: [ "$time",  oneMonthDateUp ]},
                    ]
                    sortTime = {sort_time : 1}
                }else if(type == 'live'){
                    let currentDateLive	 =	moment().utc().toDate();
                    matchesFilter = [
                        { $in: [ "$match_status", [MatchStatus.MATCH_INPROGRESS,MatchStatus.MATCH_DELAYED,MatchStatus.MATCH_NOTSTART,'Finished'] ]},
                        { $eq: [ "$sport",  sport ]},
                        { $eq: [ "$win_flag",  0 ]},
                        { $eq: [ "$status",  1 ]},
                        { $lte: [ "$time",  currentDateLive ]},
                        { $eq: [ "$match_id", "$$matchId" ]},
                        { $eq: [ "$series_id", "$$seriesId" ]},
                    ]
                    sortTime = {sort_time : -1}
                }else if(type == 'completed_match'){
                    let pastMonthDateCM	=  moment().utc().subtract('30','days').toDate();
                    matchesFilter = [
                        { $or: [ 
                            {$and: [{ $eq: ["$match_status", "Finished"] },{ $eq: [ "$win_flag",  1 ] }]},
                            { $eq: ["$match_status", "Cancelled"] }
                        ]},
                        { $eq: [ "$sport",  sport ]},
                        { $eq: [ "$status",  1 ]},
                        { $gte: [ "$time",  pastMonthDateCM ]},
                        { $eq: [ "$match_id", "$$matchId" ]},
                        { $eq: [ "$series_id", "$$seriesId" ]},
                    ]
                    sortTime = {sort_time : -1}
                }

                this.collection.aggregate([
                    {
                        $match:filter
                    },
                    { $sort: sort },
                    { $skip: skip },
                    // {
                    //     $limit: limit
                    // },
                    {
                        $lookup: {
                            from: 'series_squad',
                            let: { matchId: "$match_id", seriesId : "$series_id"},
                            pipeline: [
                                {
                                    $match: {
                                        $expr:{ 
                                            $and: matchesFilter
                                        }
                                    }
                                },
                                {$project : {"localteam_id": 1, "visitorteam_id" : 1, "series_id":1, "match_status":1, "time":1, "date":1, "localteam_short_name":1, "visitorteam_short_name":1, "local_flag":1, "visitor_flag":1, "series_name":1, "localteam": 1, "visitorteam": 1, "win_flag" : 1}}
                            ],
                            as: 'matches',
                        }
                    },
                    {
                        $unwind: {
                            path: "$matches",
                            preserveNullAndEmptyArrays: false // optional
                        }
                    },
                    {
                        $project : {
                            "_id" : "$_id",
                            "p_t_c": "$p_t_c",
                            "match_id": "$match_id",
                            "series_id": "$series_id",
                            "match_status": {$cond: { if: { $and:[{ $eq: [ "$matches.match_status", 'Finished' ] },{ $eq: [ "$matches.win_flag", 0 ] }]}, then: "Under Review", else: "$matches.match_status" }}, //"$matches.match_status",
                            "local_team_id" : "$matches.localteam_id",
                            "local_team_name": {$cond: { if: { $eq: [ "$matches.localteam_short_name", null ] }, then: "$matches.localteam", else: "$matches.localteam_short_name" }},
                            "local_team_flag" : {$cond: { if: { $eq: [ "$matches.local_flag", null ] }, then: "", else: { $concat: [ config.imageBaseUrl, "/", "$matches.local_flag" ] }}},

                            "visitor_team_id" : "$matches.visitorteam_id",
                            "visitor_team_name" : {$cond: { if: { $eq: [ "$matches.visitorteam_short_name", null ] }, then: "$matches.visitorteam", else: "$matches.visitorteam_short_name" }},
                            "visitor_team_flag"  : {$cond: { if: { $eq: [ "$matches.visitor_flag", null ] }, then: "", else: { $concat: [ config.imageBaseUrl, "/", "$matches.visitor_flag" ] }}},
                            series_name : {$cond: { if: { $eq: [ "$matches.series_name", null ] }, then: " ", else: "$matches.series_name" }},
                            
                            "star_date":  { $dateToString: {date: "$matches.time", format: "%Y-%m-%d" } },
                            "star_time":  { $dateToString: {date: "$matches.time", format: "%H:%M" } },
                            "server_time": serverTime2,
                            "sort_time" : "$matches.time",
                            total_contest :"$total_contest"
                        }
                    },
                    {
                        $sort: sortTime
                    },

                ], (err, data) => {
                    if (err) {
                        reject(err);
                    }
                    if (!err) {
                        resolve(data);
                    }
                }).option({ allowDiskUse: true });
            }catch(error){
                console.log("error", error)
            }
        });
    }
    myContestModel(skip, limit, sort, filter, sport, type){
        return new Promise(async (resolve, reject) => {
            try{
                console.log("my match call from service*****");
                var serverTime2 = moment(new Date()).format(config.DateFormat.datetime);
                var matchesFilter = []
                let sortTime =  {};
                var queryObj = {};
                if(type == 'upcoming') {
                    let currentDate2 = moment().utc().toDate();
                    let oneMonthDateUp =  moment().utc().add('30','days').toDate();
                    queryObj = {sport:sport,status:1,match_status:"Not Started",time:{$gte:currentDate2,$lt:oneMonthDateUp}}
                    sortTime = {date : 1}
                } else if (type == 'live'){
                    let currentDateLive	 =	moment().utc().toDate();
                    sortTime = {date : -1}
                    queryObj = {win_flag:0,sport:sport,status:1,match_status:{$in:[MatchStatus.MATCH_INPROGRESS,MatchStatus.MATCH_DELAYED,MatchStatus.MATCH_NOTSTART,'Finished']},time:{$lte:currentDateLive}}
    
                } else if (type == 'completed_match'){
                    let pastMonthDateCM	=  moment().utc().subtract('30','days').toDate();
                    queryObj = {sport:sport,status:1,time:{$gte:pastMonthDateCM},$or: [ 
                        {match_status:"Finished", win_flag:1},
                        {match_status:"Cancelled"}
                    ]}
                    sortTime = {date : -1}
                }
               let myJoindMatch = await MyContestModel.find(filter).skip(skip).sort(sort);
    
               let matchIds  = _.map(myJoindMatch,'match_id');
               queryObj['match_id']= {$in:matchIds};
               
               let seriesSqueadData = await SeriesSquadModel.find(queryObj).sort(sortTime);
               let data = [];
                if(seriesSqueadData && seriesSqueadData.length>0){
                    for (const sItem of seriesSqueadData) {
                        let myMatchItem = myJoindMatch.find(element => element.match_id==sItem.match_id && element.series_id==sItem.series_id);
                        if(myMatchItem && myMatchItem._id){
                            let ddItem = {
                                _id : myMatchItem._id,
                                match_id : sItem.match_id,
                                series_id : sItem.series_id,
                                match_status : sItem && sItem.match_status && sItem.match_status== "Finished" && sItem.win_flag == 0 ? "Under Review" : sItem.match_status,
                                local_team_id : sItem.localteam_id,
                                local_team_name : _.isNull(sItem.localteam_short_name) ?sItem.localteam :sItem.localteam_short_name,
                                local_team_flag : _.isNull(sItem.local_flag) ? null :config.imageBaseUrl + "/" + sItem.local_flag,
                                visitor_team_id : sItem.visitorteam_id,
                                visitor_team_name : _.isNull(sItem.visitorteam_short_name) ?sItem.visitorteam :sItem.visitorteam_short_name,
                                visitor_team_flag : _.isNull(sItem.visitor_flag) ? null :config.imageBaseUrl + "/" + sItem.visitor_flag,
                                series_name : _.isNull(sItem.series_name) ? "" :sItem.series_name,
                                star_date:  sItem.date_str || '',
                                star_time: sItem.time_str || '', 
                                server_time : serverTime2,
                                sort_time : sItem.time,
                                total_contest : myMatchItem.total_contest,
                                match_filter : _.has(sItem, "is_parent") ? (sItem.is_parent ? "FULL":(sItem.live_fantasy_parent_id ? "LIVE":"FULL")):(sItem.live_fantasy_parent_id ?"LIVE":"FULL") 
                            }
                            data.push(ddItem);
                            
                        }
                    }
                    if(data && data.length>0){
                        resolve(data);
                    }
                } else {
                    resolve(data);
                }
               
            } catch (error){
                console.log("error in*******", error)
                reject(error);
            }
        });
    }
    getBannerList() {
        return new Promise((resolve, reject) => {
            try{
                
                var serverTime = moment(new Date()).format(config.DateFormat.datetime);
                let currentDate	    =	moment().utc().toDate();

                this.collection.aggregate([
                    {
                        $match: {status:1}
                    },
                    { $sort : { sequence : 1} },
                    {
                        $project : {
                            "_id":"$_id",
                            "sseries_id":{$toInt: "$series_id" },
                            "type":"$banner_type",
                            "image":"$image",
                            "url":"$url",
                            "offer_id":"$offer_id",
                            "sport":"$sport",
                            "match_id":"$match_id"
                        }
                    },
                    {
                        $lookup: {
                            from: 'series_squad',
                            let: { seriesId: "$sseries_id",matchId: "$match_id" },
                            pipeline: [
                                {
                                    $match: {  
                                        $expr: {
                                            $and :[
                                                {$eq: [ "$status", 1 ]},
                                                {$eq: [ "$series_id", "$$seriesId" ]},
                                                {$eq: [ "$match_id", "$$matchId" ]},
                                                {$ne: [ "$visitorteam_id", 0 ]},
                                                {$ne: [ "$localteam_id", 0 ]},
                                                {$gte: [ "$time", currentDate ]},
                                            ]
                                        }
                                    }
                                },
                                { $limit : 1},
                                { $project: { 
                                    _id:1,
                                    localteam_id : 1,
                                    visitorteam_id : 1,
                                    series_id : 1,
                                    match_id : 1,
                                    date:1,
                                    time:1,
                                    match_count:1
                                } },
                            ],
                            as: 'seriesSquad',
                        }
                    },
                    {
                        $unwind: {
                            path: "$seriesSquad",
                            preserveNullAndEmptyArrays: true // optional
                        }
                    },
                    {
                        $lookup: {
                            from: 'mst_teams',
                            let: { locId: "$seriesSquad.localteam_id",seriesId: "$seriesSquad.series_id" },
                            pipeline: [
                                {
                                    $match: {  
                                        $expr: {
                                            $and :[
                                                {$eq: [ "$team_id", "$$locId" ]},
                                                {$eq: [ "$series_id", "$$seriesId" ]}
                                            ]
                                        }
                                    }
                                },     
                                { $project: { _id:1,team_name:1,team_short_name:1} }
                            ],
                            as: 'seriesSquad.localTeam',
                        }
                    },
                    {
                        $unwind: {
                            path: "$seriesSquad.localTeam",
                            preserveNullAndEmptyArrays: true // optional
                        }
                    },                    
                    {
                        $lookup: {
                            from: 'mst_teams',
                            let: { visitId: "$seriesSquad.visitorteam_id",seriesId: "$seriesSquad.series_id" },
                            pipeline: [
                                {
                                    $match: {  
                                        $expr: {
                                            $and :[
                                                {$eq: [ "$team_id", "$$visitId" ]},
                                                {$eq: [ "$series_id", "$$seriesId" ]}
                                            ]
                                        }
                                    }
                                },     
                                { $project: { _id:1,team_name:1,team_short_name:1} },
                            ],
                            as: 'seriesSquad.visitorTeam',
                        }
                    },
                    {
                        $unwind: {
                            path: "$seriesSquad.visitorTeam",
                            preserveNullAndEmptyArrays: true // optional
                        }
                    },
                    {
                        $lookup: {
                            from: 'series',
                            let: { seriesId: "$seriesSquad.series_id" },
                            pipeline: [
                                {
                                    $match: {  
                                        $expr: {
                                            $and :[
                                                {$eq: [ "$id_api", "$$seriesId" ]}
                                            ]
                                        }
                                    }
                                },     
                                { $project: { _id:1,name:1,short_name:1} },
                            ],
                            as: 'seriesSquad.series',
                        }
                    },
                    {
                        $unwind: {
                            path: "$seriesSquad.series",
                            preserveNullAndEmptyArrays: true // optional
                        }
                    },
                    // {
                    //     $lookup: {
                    //         from: 'match_contest',
                    //         let: { matchId: "$seriesSquad.match_id" }, 
                    //         pipeline: [
                    //             {
                    //                 $match: {  
                    //                     $expr:{ 
                    //                         $eq: [ "$match_id", "$$matchId" ]
                    //                     }
                    //                 }
                    //             },     
                    //             { $project: { _id:1} },
                    //         ],
                    //         as: 'seriesSquad.match_contest_count',
                    //     }
                    // },
                    {
                        $lookup: {
                            from: 'coupon_codes',
                            localField: "offer_id",
                            foreignField: "_id",
                            as: 'couponCodes',
                        },
                    },
                    {
                        $unwind: {
                            path: "$couponCodes",
                            preserveNullAndEmptyArrays: true // optional
                        }
                    }, 
                    {
                        $project : {
                            "_id" : "$_id",
                            "image" : {$concat : [`${config.imageBaseUrl}/`,"$image"]},
                            "series_id":"$series_id",
                            "url" : "$url",
                            "type" : "$type",
                            "sport":"$sport",
                            "upcoming" : {
                                "_id":"$seriesSquad._id",
                                "match_id": "$seriesSquad.match_id",
                                "local_team_id":"$seriesSquad.localteam_id",
                                "visitor_team_id": "$seriesSquad.visitorteam_id",
                                "series_id":"$seriesSquad.series_id",
                                "series_name": {$cond: { if: { $ne: [ "$seriesSquad.series.name", null ] }, then: "$seriesSquad.series.short_name", else: "$seriesSquad.series.name" }},
                                "local_team_name": {$cond: { if: { $ne: [ "$seriesSquad.localTeam.team_short_name", "" ] }, then: "$seriesSquad.localTeam.team_short_name", else: "$seriesSquad.localTeam.team_name" }},
                                "visitor_team_name": {$cond: { if: { $ne: [ "$seriesSquad.visitorTeam.team_short_name", "" ] }, then: "$seriesSquad.visitorTeam.team_short_name", else: "$seriesSquad.visitorTeam.team_name" }},
                                "star_date":{ $dateToString: {date: "$seriesSquad.date", format: "%Y-%m-%d" } },
                                "star_time":{ $dateToString: {date: "$seriesSquad.time", format: "%H:%M" } },
                                "total_contest": "$seriesSquad.match_count",
                                "server_time": serverTime,
                                // "playing_11": "$playing_11",
                            },
                            "offer" : {
                                "_id" : "$couponCodes._id",
                                "coupon_code":"$couponCodes.coupon_code"
                            }
                        }
                    }
                ], (err, data) => {
                    if (err) {
                        reject(err);
                    }
                    if (!err) {
                        resolve(data);
                    }
                });
            }
            catch(error) {
                console.log("error", error)
            }
        });
    }
    
    getContestCount(friendUserId, sport) {
        return new Promise((resolve, reject) => {
            try{
                let currentDate	    =	moment().utc().toDate();
                this.collection.aggregate([
                    {
                        $match: {user_id:new ObjectId(friendUserId)}
                    },
                    {
                        $lookup: {
                            from: 'series_squad',
                            let: { seriesId: "$series_id", matchId : "$match_id" },
                            pipeline: [
                                {
                                    $match: {  
                                        $expr: {
                                            $and :[
                                                {$eq: [ "$match_id", "$$matchId" ]},
                                                {$eq: [ "$series_id", "$$seriesId" ]},
                                                {$eq: [ "$status", 1 ]},
                                                {$eq: [ "$sport", sport ]},
                                                {$lt: [ "$time", currentDate ]},
                                                {$eq: [ "$match_status", "Finished" ]}
                                            ]
                                        }
                                    }
                                },
                                { $project: { _id:1 }},
                            ],
                            as: 'seriesSquad',
                        }
                    },
                    {
                        $unwind: {
                            path: "$seriesSquad",
                            preserveNullAndEmptyArrays: true // optional
                        }
                    },
                    {
                        $group: {_id:{match_id:"$match_id", contest_id:"$contest_id"}}
                    },
                    {
                       $count: "player_team_id"
                    }
                ], (err, data) => {
                    if (err) {
                        reject(err);
                    }
                    if (!err) {
                        resolve(data);
                    }
                });
            }
            catch(error) {
                console.log("error", error)
            }  
        });
    }

    getPaidContests(friendUserId, sport) {
        return new Promise((resolve, reject) => {
            try{
                this.collection.aggregate([
                    {
                        $match: {user_id:new ObjectId(friendUserId)}
                    },
                    {
                        $lookup: {
                            from: 'contest',
                            let: { contestId: "$contest_id" },
                            pipeline: [
                                {
                                    $match: {  
                                        $expr: {
                                            $and :[
                                                {$eq: [ "$contest_type", "Paid" ]},
                                                {$eq: [ "$_id", "$$contestId" ]},
                                            ]
                                        }
                                    }
                                },
                                { $project: { _id:1 }},
                            ],
                            as: 'contest',
                        }
                    },
                    {
                        $unwind: {
                            path: "$contest",
                            preserveNullAndEmptyArrays: true // optional
                        }
                    },
                    {
                        $group: {_id:{match_id:"$match_id", contest_id:"$contest_id"}}
                    },
                    {
                       $count: "player_team_id"
                    }
                ], (err, data) => {
                    if (err) {
                        reject(err);
                    }
                    if (!err) {
                        resolve(data);
                    }
                });
            }
            catch(error) {
                console.log("error", error)
            }  
        });
    }

    getTotalMatches(friendUserId, sport) {
        return new Promise((resolve, reject) => {
            try{
                let currentDate	    =	moment().utc().toDate();
                this.collection.aggregate([
                    {
                        $match: {user_id:new ObjectId(friendUserId)}
                    },
                    {
                        $lookup: {
                            from: 'series_squad',
                            let: { seriesId: "$series_id", matchId : "$match_id" },
                            pipeline: [
                                {
                                    $match: {  
                                        $expr: {
                                            $and :[
                                                {$eq: [ "$match_id", "$$matchId" ]},
                                                {$eq: [ "$series_id", "$$seriesId" ]},
                                                {$eq: [ "$status", 1 ]},
                                                {$eq: [ "$sport", sport ]},
                                                {$lt: [ "$time", currentDate ]}
                                            ]
                                        }
                                    }
                                },
                                { $project: { _id:1 }},
                            ],
                            as: 'seriesSquad',
                        }
                    },
                    {
                        $unwind: {
                            path: "$seriesSquad",
                            preserveNullAndEmptyArrays: true // optional
                        }
                    },
                    {
                        $group: {_id:{match_id:"$match_id"}}
                    },
                    {
                       $count: "player_team_id"
                    }
                ], (err, data) => {
                    if (err) {
                        reject(err);
                    }
                    if (!err) {
                        resolve(data);
                    }
                });
            }
            catch(error) {
                console.log("error", error)
            }  
        });
    }

    getTotalSeries(friendUserId, sport) {
        return new Promise((resolve, reject) => {
            try{
                let currentDate	    =	moment().utc().toDate();
                this.collection.aggregate([
                    {
                        $match: {user_id:new ObjectId(friendUserId)}
                    },
                    {
                        $lookup: {
                            from: 'series_squad',
                            let: { seriesId: "$series_id", matchId : "$match_id" },
                            pipeline: [
                                {
                                    $match: {  
                                        $expr: {
                                            $and :[
                                                {$eq: [ "$match_id", "$$matchId" ]},
                                                {$eq: [ "$series_id", "$$seriesId" ]},
                                                {$eq: [ "$status", 1 ]},
                                                {$eq: [ "$sport", sport ]},
                                                {$lt: [ "$time", currentDate ]}
                                            ]
                                        }
                                    }
                                },
                                { $project: { _id:1 }},
                            ],
                            as: 'seriesSquad',
                        }
                    },
                    {
                        $unwind: {
                            path: "$seriesSquad",
                            preserveNullAndEmptyArrays: true // optional
                        }
                    },
                    {
                        $group: {_id:{series_id:"$series_id"}}
                    },
                    {
                       $count: "player_team_id"
                    }
                ], (err, data) => {
                    if (err) {
                        reject(err);
                    }
                    if (!err) {
                        resolve(data);
                    }
                });
            }
            catch(error) {
                console.log("error", error)
            }  
        });
    }

    getTotalMatchWin(friendUserId, sport) {
        return new Promise((resolve, reject) => {
            try{
                let currentDate	    =	moment().utc().toDate();
                this.collection.aggregate([
                    {
                        $match: {
                            $expr: {
                                $and :[
                                    {$eq: [ "$user_id", new ObjectId(friendUserId) ]},
                                    {$gt: [ "$winning_amount", 0 ]}
                                ]
                            }
                        }
                    },
                    {
                        $lookup: {
                            from: 'series_squad',
                            let: { seriesId: "$series_id", matchId : "$match_id" },
                            pipeline: [
                                {
                                    $match: {  
                                        $expr: {
                                            $and :[
                                                {$eq: [ "$match_id", "$$matchId" ]},
                                                {$eq: [ "$series_id", "$$seriesId" ]},
                                                {$eq: [ "$status", 1 ]},
                                                {$eq: [ "$sport", sport ]},
                                                {$lt: [ "$time", currentDate ]}
                                            ]
                                        }
                                    }
                                },
                                { $project: { _id:1 }},
                            ],
                            as: 'seriesSquad',
                        }
                    },
                    {
                        $unwind: {
                            path: "$seriesSquad",
                            preserveNullAndEmptyArrays: true // optional
                        }
                    },
                    {
                       $count: "player_team_id"
                    }
                ], (err, data) => {
                    if (err) {
                        reject(err);
                    }
                    if (!err) {
                        resolve(data);
                    }
                });
            }
            catch(error) {
                console.log("error", error)
            }  
        });
    }
    
    getUserDetail(userId) {
        return new Promise((resolve, reject) => {
            try{
                this.collection.aggregate([
                    {
                        $match: {_id : userId}
                    },
                    {
                        $limit : 1
                    },
                    {
                        $project : {
                            "_id":"$_id",
                        }
                    },
                    {
                        $lookup: {
                            from: 'pen_aadhar_cards',
                            pipeline: [
                                {
                                    $match: { user_id: userId}
                                },
                                { $project: { _id:1 }},
                            ],
                            as: 'pan_detail',
                        }
                    },
                    {
                        $unwind: {
                            path: "$pan_detail",
                            preserveNullAndEmptyArrays: true // optional
                        }
                    },
                    {
                        $lookup: {
                            from: 'bank_details',
                            pipeline: [
                                {
                                    $match: { user_id:userId}
                                },
                                { $project: { _id:1 }},
                            ],
                            as: 'bank_detail',
                        }
                    },
                    {
                        $unwind: {
                            path: "$bank_detail",
                            preserveNullAndEmptyArrays: true // optional
                        }
                    },
                    
                ], (err, data) => {
                    if (err) {
                        reject(err);
                    }
                    if (!err) {
                        resolve(data);
                    }
                });
            }
            catch(error) {
                console.log("error", error)
            }  
        });
    }

    referralUserList(userId,skip, limit) {
        return new Promise((resolve, reject) => {
            try{
                this.collection.aggregate([
                    {
                        $match: {refered_by : userId}
                    },
                    {
                        $skip: skip
                    },
                    {
                        $limit: limit
                    },
                    {
                        $lookup: {
                            from: 'users',
                            localField: "user_id",
                            foreignField: "_id",
                            as: 'user_detail',
                        }
                    },
                    {
                        $unwind: {
                            path: "$user_detail",
                            preserveNullAndEmptyArrays: false // optional
                        }
                    },
                    {
                        $project : {
                            "user_id" : "$user_detail._id",
                            "team_name" : "$user_detail.team_name",
                            "image" : '', //{$concat : [`${config.imageBaseUrl}/`,"$user_detail.image"]},
                            "received_amount" : "$refered_by_amount",
                            "total_amount" : "$user_amount"
                        }
                    }
                ], (err, data) => {
                    if (err) {
                        reject(err);
                    }
                    if (!err) {
                        resolve(data);
                    }
                });
            }
            catch(error) {
                console.log("error", error)
            }  
        });
    }
    referalManageAtVerification(user_id,is_pan_verified,is_email_verified,is_bank_verified){
        return new Promise(async(resolve, reject) => {
            try {
                let referalUser = await ReferralCodeDetails.findOne({ user_id: user_id });
                var data = {};
                if (referalUser) {
                    let referedBy = referalUser.refered_by;
                    let refAmount = referalUser && referalUser.refered_by_amount?parseInt(referalUser.refered_by_amount):0;
                    let forstDepostData = referalUser && referalUser.first_depo_reward_amount?parseInt(referalUser.first_depo_reward_amount):0;
                    if (referedBy) {
                       let referedUser = await Users.findOne({ '_id': referedBy, 'status': 1, 'refer_able': 1 });
                        if(referedUser && (is_pan_verified || is_email_verified || is_bank_verified)) {
                            console.log('email veiferd***********');
                           let bonusAmount = is_bank_verified ? 20 :( is_email_verified ? 10: ( is_pan_verified ? 20 : 0 ));
                            if(bonusAmount>0){
                              let date = new Date();
                                let entity = {
                                    user_id: referedBy,
                                    txn_amount: bonusAmount,
                                    currency: "INR",
                                    txn_date: Date.now(),
                                    local_txn_id: 'CB' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + referedBy,
                                    added_type: TransactionTypes.FRIEND_USED_INVITE
                                };
                                var totalRefAmount = refAmount + bonusAmount;
                                var totalRefAmountUpdated = refAmount + bonusAmoun + forstDepostData;
                                if(totalRefAmount<= 50 ||(totalRefAmountUpdated<= 75 && forstDepostData == 25)){
                                    await Users.updateOne({ _id: referedBy}, { $inc: {bonus_amount: bonusAmount} });
                                    await ReferralCodeDetails.updateOne({ user_id: user_id}, { $inc: {refered_by_amount: bonusAmount} });
                                    data = await Transaction.create(entity); 
                                } 
                            }
                        }
                    }
                }
                resolve(data);
             } catch (error) {
                reject(error);
                console.log("referal amount error >", error)
             }
        });
    }
    referalFirstDespostxCashReward(user_id){
        return new Promise(async(resolve, reject) => {
            try {
                let referalUser = await ReferralCodeDetails.findOne({ user_id: user_id });
                var data = {};
                if (referalUser) {
                    let referedBy = referalUser.refered_by;
                    if (referedBy) {
                        let date = new Date();
                        let bonusAmount = 25;
                        let entity = {
                            user_id: referedBy,
                            txn_amount: bonusAmount,
                            currency: "INR",
                            txn_date: Date.now(),
                            local_txn_id: 'CB' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + referedBy,
                            added_type: TransactionTypes.FRIEND_FIRST_DEPOSIT_REWARD
                        };
                       let referedUser = await Users.findOneAndUpdate({ '_id': referedBy, 'status': 1, 'refer_able': 1 }, { $inc: {extra_amount: bonusAmount} });
                        if(referedUser) {
                            data = await Transaction.create(entity);
                            await ReferralCodeDetails.findOneAndUpdate({ user_id: user_id}, { $inc: {refered_by_amount: bonusAmount,first_depo_reward_amount: bonusAmount} }); 
                        }
                    }
                }
                resolve(data);
             } catch (error) {
                reject(err);
                console.log("referal amount error >", error)
             }
        });
    }
}

module.exports = ModelService;
