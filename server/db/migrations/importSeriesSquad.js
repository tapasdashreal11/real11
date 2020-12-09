require('dotenv').config();
const shell = require('shelljs');
const config = require("../../config");

(async function() {
    try {
        let importFilePath = `server/db/migrations/data/series_squad.csv`;
        let collectionName = `series_squad`;
        let fields = `
            id.auto(),
            series_id.auto(),
            date.auto(),
            time.auto(),
            type.auto(),
            match_id.auto(),
            localteam.auto(),
            localteam_id.auto(),
            localteam_score.auto(),
            localteam_stat.auto(),
            visitorteam.auto(),
            visitorteam_id.auto(),
            visitorteam_score.auto(),
            visitorteam_stat.auto(),
            sport.auto(),
            status.auto(),
            sort.auto(),
            match_status.auto(),
            guru_url.auto(),
            win_flag.auto(),
            generate_excel.auto(),
            pdf_created.auto()
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