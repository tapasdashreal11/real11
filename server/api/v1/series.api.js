const Series = require('../../models/series');
const ApiUtility = require('../api.utility');

module.exports = {
    seriesList: async (req, res) => {
        try {
            let seriesData = await Series.aggregate([
                {
                    $match: {status:1}
                },
                {
                    $project: {
                        "_id": 0,
                        "series_id": "$id_api",
                        "series_name": "$name"
                    }
                }
            ])
            res.send(ApiUtility.success(seriesData));
        } catch (error){
            res.send(ApiUtility.failed(error.message));
        }
    }
}