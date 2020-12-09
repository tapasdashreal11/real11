require('dotenv').config();
const shell = require('shelljs');
const config = require("../../config");

(async function() {
    try {
        let importFilePath = `server/db/migrations/data/match_contest.csv`;
        let dbName = config.dbConnection.dbName;
        let collectionName = `match_contest`;
        let fields = `
            id.auto(),
            match_id.auto(),
            contest_id.auto(),
            invite_code.auto(),
            joined_users.auto(),
            isCanceled.auto(),
            is_full.auto(),
            created.auto()
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