require('dotenv').config();
const shell = require('shelljs');
const config = require("../../config");

(async function() {
    try {
        let importFilePath = `server/db/migrations/data/mst_teams.csv`;
        let dbName = config.dbConnection.dbName;
        let collectionName = `team`;
        let fields = `
            id.auto(),
            team_id.string(),
            team_name.string(),
            team_short_name.string(),
            flag.auto(),
            status.auto(),
            sport.auto(),
            created.auto(),
            modified.auto()
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