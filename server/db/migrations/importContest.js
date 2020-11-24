require('dotenv').config();
const shell = require('shelljs');
const config = require("../../config");

(async function() {
    try {
        let importFilePath = `server/db/migrations/data/contest.csv`;
        let collectionName = `contest`;
        let fields = `
            id.auto(),
            category_id.auto(),C
            contest_name.auto(),
            admin_comission.auto(),
            winning_amount.auto(),
            contest_size.auto(),
            min_contest_size.auto(),
            contest_type.auto(),
            entry_fee.auto(),
            used_bonus.auto(),
            confirmed_winning.auto(),
            multiple_team.auto(),
            auto_create.auto(),
            status.auto(),
            sport.auto(),
            price_breakup.auto(),
            invite_code.auto(),
            is_auto_create.auto(),
            parent_id.auto(),
            created.auto(),
            infinite_contest_size.auto(),
            winner_percent.auto(),
            winning_amount_times.auto(),
            amount_gadget.auto(),
            set_breakup.auto()
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