const dotenv = require('dotenv').config();

const MongoClient = require('mongodb').MongoClient;
let ObjectID = require('mongodb').ObjectID;

const uri = process.env.MONGO_DB_URI;
let mongoDB=new MongoClient(uri, { useNewUrlParser: true });

class _mongodb{
    constructor(collName){
        mongoDB.connect((err,client) => {
            if(err){
                console.log(err);
                mongoDB.close();
            }
            this.db=mongoDB.db(process.env.MONGO_DB_NAME);
            this.collection = this.db.collection(collName || process.env.MONGO_DB_COLLECTION);
            this.awardColl = this.db.collection(process.env.MONGO_DB_AWARD_COLLECTION);
            console.log("Connected mongodb");
        });
    }

    closeConnection(){
        mongoDB.close();
    }

    objectID(objectId){
        if(objectId) return new ObjectID(objectId);
        else         return null;
    }

    find(query,sort,limit,cb){
        this.collection.find(query).sort(sort).limit(limit).toArray((err,result)=>{
            cb(result);
        });
    }

    async findAsync(query,sort,limit,cb){
        this.collection.find(query).sort(sort).limit(limit).toArray((err,result)=>{
            cb(result);
        });
    }
    
    async updateOneAsync(objectId,data){
        this.collection.updateOne({'_id':objectId},{$set:data,$currentDate: { lastModified: true }}
        ,(err,result)=>{
            console.log(result);
            return result;
        });
      }

    getAggregatedRatings(){
        return new Promise((resolve, reject) => {
            this.collection.aggregate([{$group : {_id : null,totalGains:{ $sum: "$gain" }}}])
            .each((err, result)=> {
                if (err || !result) {
                    reject(err);
                }
                else {
                    resolve(result);
                }
            });
        })
    }

    saveAwards(records,callb){
        this.awardColl.insertMany(records,function(err,res){
            if(err) throw new Error(err);
            if(res.insertedCount>0){
                console.log("Top 100's awards has been shared.");
            }
            callb(res.insertedCount);
        });
    }

}

module.exports = _mongodb;

