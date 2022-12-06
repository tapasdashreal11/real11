const ApiUtility = require('../api.utility');
const request = require('request');

module.exports = {

    exportTransactionHistory: async (req, res) => {
        let { user_id, start_date, end_date } = req.params;
        let email = req.user.email;
        if (!user_id) {
            user_id = req.userId;
        }

        if (!user_id || !start_date || !end_date) {
            return res.send(ApiUtility.failed('user id, start date or end date are empty.'));
        }
        
        downloadTransactionDetailsPdf(user_id, start_date, end_date, email);
        return res.send(ApiUtility.success({},"Transaction details mailed to you."));
    }

}

function downloadTransactionDetailsPdf(user_id, start_date, end_date, email) {
    var options = {
        'method': 'GET',
        'url': process.env.EXPORT_TRANSACTION_HISTORY_URL + 'user_id='+user_id+'&start_date='+start_date+'&end_date='+end_date+'&email='+email,
        'headers': {
        }
    };
    request(options, function (error, response) {
        // if (error) throw new Error(error);
        // cb(response.body);
        return true;
    });
}

