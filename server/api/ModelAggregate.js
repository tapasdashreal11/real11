/****************************
 COMMON MODEL
 ****************************/
let _ = require("lodash");

class Model {

    constructor(collection) {
        this.collection = collection;
    }

    // Find all data
    find(filter = {}, project = {}, paginate = {}, sort={}) {

        return new Promise((resolve, reject) => {

            this.collection.find(filter, project).sort(sort).exec((err, data) => {

                if (err) { return reject({message: err, status: 0 }); }

                return resolve(data);
            });

        });

    }

    // Find single data
    findOne(filter = {}, project = {}) {

        return new Promise((resolve, reject) => {

            this.collection.find(filter, project).exec((err, data) => {

                if (err) { return reject({message: err, status: 0 }); }

                return resolve(data);
            });

        });
    }

    // Update Data
    update(filter, data) {

        return new Promise((resolve, reject) => {

            this.collection.findOneAndUpdate(filter, {$set: data}, { upsert: true, new: true }, (err, data)  => {

                if (err) { return reject({message: err, status: 0 }); }

                return resolve(data);

            });

        });

    }

    // Soft Delete
    softDelete(id) {
        return new Promise((resolve, reject) => {
            this.collection.findByIdAndUpdate(id, {deleteStatus:true}).exec((err, data)=>{
               if(err){
                   return reject(err);
               }
               return resolve(data);
            });
        });
    }

    // Soft Delete
    deleteMany(filter) {
        return new Promise((resolve, reject) => {
            this.collection.deleteMany(filter).exec((err, data)=>{
               if(err){
                   return reject(err);
               }
               return resolve(data);
            });
        });
    }

    // Store Data
    store(data, options = {}) {

        return new Promise((resolve, reject) => {

            const collectionObject = new this.collection(data)

            collectionObject.save((err, createdObject) => {

                if (err) { return reject({message: err, status: 0 }); }

                return resolve(createdObject);
            });

        });
    }

    // Delete Data
    destroy(filter) {

        return new Promise((resolve, reject) => {

            this.collection.remove(filter).exec((err, data) => {

                if (err) { return reject({message: err, status: 0 }); }

                return resolve(data);
            });

        });
    }

    // Setting the Sort Params
    stages(params) {

        let stages = [];

        if (typeof params.sortBy !== 'undefined'
            && params.sortBy !== ''
            && typeof params.order !== 'undefined'
            && params.order !== ''
        ) {
            let sort = {};
            sort[params.sortBy] = (params.order === 'asc') ? 1 : -1;
            stages.push({$sort: sort});
        }

        return stages;
    }

    // Aggregration
    aggregate(stages, query) {
        return new Promise(async (resolve, reject) => {

            let aggregationStages = _.clone(stages);

            aggregationStages = aggregationStages.concat(this.stages(query));

            try {
                const data = await this.collection.aggregate(aggregationStages);

                let result = {data};
                return resolve(result);

            } catch (err) {
                //console.log("Aggregration error", err);
                return reject({message: err, status: 0 });
            }

        });
    }

    pagination(filter, page, sort={}, limit){
        return new Promise(async (resolve, reject)=>{
           try{
               if(!sort){
                   sort = { createdAt:-1}
               }
               let skip = limit*(page-1)
               this.collection.find(filter).sort(sort).skip(skip).limit(limit).exec((err, data)=>{
                   if(err){
                    return reject(err);
                   }
                   return resolve(data);
               });
           } catch(error){
               //console.log("pagination error = ", error);
               return reject({message: error, status: 0 });
           }
        });
    }

    count(filter={}){
        return new Promise(async (resolve,reject)=>{
            try{
                this.collection.countDocuments((err, count)=>{
                    if(err){
                        return reject(err);
                    }
                    return resolve(count);
                }) ;
            }
            catch(error){
                //console.log("count error = ", error);
                return reject({message: error, status: 0 });
            }

        });

    }

    incrementValue(filter) {

        return new Promise((resolve, reject) => {

            this.collection.findOneAndUpdate(filter, {$inc: { badge: 1 }}, { new: true }, (err, data)  => {

                if (err) { return reject({message: err, status: 0 }); }

                return resolve(data);

            });

        });

    }

    bulkInsert(data){

        return new Promise((resolve, reject)=>{
           this.collection.collection.insert(data, (err, data)=>{
              if(err){
                  reject("Find duplicate Users");
              }
              if(!err){
                resolve(data);
              }
           });
        });
    }

    newUpdate(filter, data){
        return new Promise((resolve, reject)=>{
            this.collection.collection.updateOne(filter, data, { multi: true, upsert: true}, (err, data)=>{
                if(err){
                    reject( err);
                }
                if(!err){
                    resolve(data);
                }
            });
        });
    }
}

module.exports = Model;