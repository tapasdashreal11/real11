require('dotenv').config();
const shell = require('shelljs');
const config = require("../../config");

(async function() {
    try {
        let importFilePath = `server/db/migrations/data/series.csv`;
        let dbName = config.dbConnection.dbName;
        let collectionName = `series`;
        let fields = `
            id.auto(),
            file_path.string(),
            id_api.string(),
            name.string(),
            squads_file.string(),
            short_name.string(),
            status.auto(),
            sport.auto(),
            winning_breakup.auto(),
            elite_winning_breakup.auto(),
            winners.auto(),
            winners_amount.auto(),
            elite_winners.auto(),
            elite_winners_amount.auto(),
            leaderboard_status.auto(),
            is_leaderboard.auto(),
            is_elite.auto(),
            start_date.auto(),
            end_date.auto()
            `;
        fields = fields.replace( /[\r\n]+/gm, "" );
        fields = fields.split(" ").join("")
        if (shell.exec(`mongoimport  --uri=${config.dbConnection.string} --collection=${collectionName} --type=csv \
        --columnsHaveTypes \
        --fields="${fields}" \
        --file=${importFilePath}`).code !== 0) {
            shell.echo(`Error: ${collectionName} import failed`);
            shell.exit(1);
        }
    } catch(e) {
        console.error(e)
    } finally {

    }
})()