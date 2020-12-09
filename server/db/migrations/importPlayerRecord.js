require('dotenv').config();
const shell = require('shelljs');
const config = require("../../config");

(async function() {
    try {
        let importFilePath = `server/db/migrations/data/player_record.csv`;
        let dbName = config.dbConnection.dbName;
        let collectionName = `player_record`;
        let fields = `
            id.auto(),
            player_id.auto(),
            player_name.auto(),
            image.auto(),
            age.auto(),
            born.auto(),
            playing_role.auto(),
            batting_style.auto(),
            bowling_style.auto(),
            country.auto(),
            batting_odiStrikeRate.auto(),
            batting_odiAverage.auto(),
            bowling_odiAverage.auto(),
            bowling_odiStrikeRate.auto(),
            batting_firstClassStrikeRate.auto(),
            batting_firstClassAverage.auto(),
            bowling_firstClassStrikeRate.auto(),
            bowling_firstClassAverage.auto(),
            batting_t20iStrikeRate.auto(),
            batting_t20iAverage.auto(),
            bowling_t20iStrikeRate.auto(),
            bowling_t20iAverage.auto(),
            batting_testStrikeRate.auto(),
            batting_testAverage.auto(),
            bowling_testStrikeRate.auto(),
            bowling_testAverage.auto(),
            batting_listAStrikeRate.auto(),
            batting_listAAverage.auto(),
            bowling_listAStrikeRate.auto(),
            bowling_listAAverage.auto(),
            batting_t20sStrikeRate.auto(),
            batting_t20sAverage.auto(),
            bowling_t20sStrikeRate.auto(),
            bowling_t20sAverage.auto(),
            teams.auto(),
            sport.auto(),
            player_credit.auto()
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