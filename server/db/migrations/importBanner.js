require('dotenv').config();
const shell = require('shelljs');
const config = require("../../config");

(async function() {
    try {
        let importFilePath = `server/db/migrations/data/banners.csv`;
        let dbName = config.dbConnection.dbName;
        let collectionName = `banner`;
        let fields = `
            id.auto(),
            sequence.auto(),
            banner_type.auto(),
            image.string(),
            offer_id.auto(),
            series_id.auto(),
            match_id.auto(),
            status.auto(),
            sport.auto()
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