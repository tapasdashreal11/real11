
const { setRedis, getRedis, setRedisMyTeams, getRedisMyTeams } = require('../../../lib/redis');
const redisKyes = require('../../constants/redis-keys');

class UserService {
    static setRedisUserData(user_id, obj, match_id) {
        UserService.getRedisUserData(user_id, (err, data) => {
            if (!data) data = {};
            if (match_id) {
                if(!data['match_data_'+match_id]) data['match_data_'+match_id] = {};
                data['match_data_'+match_id] = {...data['match_data_'+match_id], ...obj};
            } else {
                data = {...data, ...obj};
            }
            setRedisMyTeams(redisKyes.getUserDataKey(user_id), data)
        })
    }

    static getRedisUserData(user_id, callback, match_id, key="") {
        getRedisMyTeams(redisKyes.getUserDataKey(user_id), (err, data) => {
            if (data) {
                if (match_id && data['match_data_'+match_id]) {
                    data = data['match_data_'+match_id]
                } else {
                    return callback(null, null)
                }
                if (key) {
                    return callback(null, data[key])
                }
                return callback(null, data)
            }
            return callback(err, data)
        })
    }
}
module.exports = UserService;