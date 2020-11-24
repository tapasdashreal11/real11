const User = require('../../../models/user');
const UserContestBreakup = require('../../../models/user-contest-breakup');
const ApiUtility = require('../../api.utility');
const ObjectId = require('mongoose').Types.ObjectId;
const moment = require('moment');
const _ = require("lodash");
const redis = require('../../../../lib/redis');
const mqtt = require('../../../../lib/mqtt');

module.exports = {
    
    contestPrizeBreakup: async (req, res) => {
        try {
            const user_id = req.userId;
            let { contest_size } = req.params;
            contest_size = parseInt(contest_size);
            let decoded = {
                contest_size,
                user_id
            }
            if (decoded) {

                if (decoded['user_id'] && decoded['contest_size']) {
                    let authUser = await User.findOne({ '_id': decoded['user_id'] });

                    if (authUser) {
                        let breakup = await UserContestBreakup.aggregate([
                            {
                                $match: {
                                    'contest_size_start': { $lte: decoded['contest_size'] },
                                    'contest_size_end': { $gte: decoded['contest_size'] }
                                }
                            },
                            {
                                $group: {
                                    _id: "$winner",
                                    "winner": { $first: "$winner" },
                                }
                            },
                            {
                                $sort: { winner: 1 }
                            }
                        ]);

                        let prizeArray = [];

                        if (breakup) {
                            // let key = 0
                            for (const key in breakup) {
                                prizeArray[key] = {};
                                let winnerPrice = await UserContestBreakup.find({ "contest_size_start": { $lte: decoded['contest_size'] }, "contest_size_end": { $gte: decoded['contest_size'] }, winner: breakup[key].winner }).sort({ winner: 1 });

                                prizeArray[key]['title'] = breakup[key].winner;
                                if (winnerPrice) {
                                    let winnerKey = 0;
                                    prizeArray[key]['info'] = [];
                                    for (const winnerValue of winnerPrice) {
                                        prizeArray[key]['info'][winnerKey] = {};
                                        prizeArray[key]['info'][winnerKey]['rank_size'] = winnerValue.rank;
                                        prizeArray[key]['info'][winnerKey]['percent'] = winnerValue.percent_prize;
                                        winnerKey++;
                                    }
                                }
                            }
                        }

                        return res.send(ApiUtility.success(prizeArray));
                    } else {
                        return res.send(ApiUtility.failed("Security check failed."));
                    }
                } else {
                    return res.send(ApiUtility.failed('Invalid user id.'));
                }
            } else {
                return res.send(ApiUtility.failed("match id or series id are empty."));
            }
        } catch (error) {
            return res.send(ApiUtility.failed(error.message));
        }
    },
}
