require('dotenv').config();


(async function() {
    const db = require('../db');
    const getMatches = require('../services/get-matches').getMatches;
    try {
        setInterval(
            () => {
                let mongoDb = db.getMongo();
                getMatches(mongoDb);
            },
        10000);
    } catch(e) {
        console.error(e)
    } finally {

    }
})()