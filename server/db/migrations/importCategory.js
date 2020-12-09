require('dotenv').config();
const shell = require('shelljs');
const config = require("../../config");

(async function() {
    try {
        let importFilePath = `server/db/migrations/data/category.csv`;
        let dbName = config.dbConnection.dbName;
        let collectionName = `category`;
        let fields = `
            id.auto(),
            category_name.string(),
            description.string(),
            image.string(),
            status.auto(),
            sport.auto(),
            sequence.auto(),
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