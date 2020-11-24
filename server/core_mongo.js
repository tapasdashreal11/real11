const MongoClient = require('mongodb').MongoClient
const dbConf = require('./config').dbConnection;
const { mongoURI } = dbConf;

//const PROD_URI = "mongodb://real11:real11dev#123@3.6.74.59:27027/real11-data?authSource=admin";
 
 
function connect(url) {
  return MongoClient.connect(url, { useUnifiedTopology: true, poolSize: 100  }).then(client => client.db())
}
 
module.exports = async function() {
//   let databases = await Promise.all([connect(PROD_URI), connect(PROD_URI)])
  console.log("mongoURI***", mongoURI)
  let database = await connect(mongoURI)
  
  return {
    db: database
  }
}