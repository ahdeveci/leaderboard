let express = require('express');
let bodyParser = require('body-parser');
let schedule = require('node-schedule');
const async = require('async')
const sch=require('./schedule');
const dotenv = require('dotenv').config();

let app = express();
var port = process.env.PORT || 8080;

let redis = require('./redis-operations');
const redisDb= new redis();

const Mongo= require('./mongodb-oprations');
let mongoDb=new Mongo();

app.use(bodyParser.urlencoded({ extended: false}));

app.listen(port, function () {
    console.log("Running on port " + port);
});

app.post('/userLogin',(req,res)=>{
    let objectId=mongoDb.objectID(req.body.userId);
    let userName=req.body.userName;
    let age = req.body.age;
    userOnlined(objectId,userName,age,function(cb){
        res.send({'status':cb});
    });    
});

app.post('/userLogout',(req,res)=>{
    redisDb.deleteById('online',req.body.userId,function(cb){
        res.send({'status':cb});
    });
});

app.post('/addScore',(req,res)=>{
    if(sch.isGameStarted()){
        let userId=req.body.userId;
        let score=req.body.score;
        let now=new Date();
        redisDb.getById('online',userId,(cb)=>{
            if(cb){
                let gamer=cb;
                let lastUpdate=new Date(gamer.lastModified);
                let timeDiff=(now-lastUpdate)/1000;

                if(1.00 >timeDiff || 1 === gamer['readOnly']){
                    if(1.00 < timeDiff){
                        gamer['readOnly']=0;
                        redisDb.save('online',userId,gamer,(cb)=>{});
                    }
                    res.send({'status':'A little slow buddy!'});
                }
                else{
                    gamer['readOnly']=1;
                    redisDb.save('online',userId,gamer,(cb)=>{});
                    gamer.gain+=parseInt(score);
                    let lastRank=gamer.rank;
                    gamer.lastModified=now.toLocaleString();
                    let query={gain:{$gt:gamer.gain}};
                    let sort={gain:1};
                    let limit=1;
                    mongoDb.findAsync(query,sort,limit,function(cb){
                        if(cb.length>0){
                            prevGamer=cb[0];
                            gamer.rank=prevGamer.rank+1;
                            if( 0 < lastRank )
                                gamer.diff=lastRank-gamer.rank;
                        }
                        else{
                            gamer.rank=1;
                            if( 0 < lastRank )
                                gamer.diff=lastRank-gamer.rank;

                        }
                        setGamerRank(gamer,lastRank,function(cb){
                            
                        });
                    })
                    res.send({'status':'Ok'});
                }
            }
            else{
                res.send({'status':'Please be online first!'});
            }
        })
    }
    else{
        res.send({'status':'Game finished. Please drink a cup of coffee until we prepare the new game'})
    }
});

app.post('/top100',(req,res)=>{
    let userId=req.body.userId ? req.body.userId : null;
    mongoDb.collection.find({rank:{$gt:0}}).sort({rank:1}).limit(100).toArray((err,result)=>{
        result.forEach(o=>{
            redisDb.save('topHundered',o.rank,o,function(cb){});
        });
        listRedisDb('topHundered',function(cb){
            let list=[];
            async.map(cb,(val,callb)=>{
                list.push(JSON.parse(val));
            });
            if(userId){
                let objectId = mongoDb.objectID(userId);
                getUserRankList(objectId,function(userCallBack){
                    if(userCallBack){
                        for(let j=0;j<userCallBack.length;j++){
                            if(userCallBack[j].rank>100){
                                list.push(userCallBack[j]);
                            }
                        }
                    }
                    res.send(list);
                })
            }
            else{
                res.send(list);
            }
        });
    })
})

function userOnlined(objectId,userName,age,callb){
    mongoDb.collection.findOne({'_id':objectId}, (err,result)=>{
        if(err) throw err;
        if(result){
            redisDb.save('online',objectId.toHexString(),result,function(cb){
                callb(cb);
            })
        }
        else{
            // saveGamerToMongo(userName,age,(cb)=>{   // if choised scenario 1 then when gamer first login, gamer must be save to new collection.
            //     callb(cb);
            // });
            callb('user not found!');
        }
    });
}

function listRedisDb(key,callb) {
    redisDb.getByKey(key,function(result){
        callb(result);
    })
}

function getUserRankList(objectId,callb){
    mongoDb.collection.findOne({'_id':objectId},(err,result)=>{
        if(err) throw err;
        if(result){
            let gamer=result;
            if(100<gamer.rank){
                mongoDb.collection.find({ rank: { $gte: gamer.rank-3, $lt: gamer.rank+3 }}).sort({rank:1}).toArray((err,rslt)=>{
                    if(err) throw err;
                    callb(rslt);
                });  
            }
            else{
                callb(null);
            }
            
        }
    })
}

async function setGamerRank(gamer,lastRank,callb){

    objectId=mongoDb.objectID(gamer._id);
    let data={gain:gamer.gain,rank:gamer.rank,diff:gamer.diff};
    mongoDb.updateOneAsync(objectId,data,(err,result)=>{});

    gamer['readonly']=0;
    redisDb.save('online',gamer._id,gamer,(cb)=>{
        let query={'_id':{$ne:objectId},'rank':{$gte:gamer.rank}};

        if(0<lastRank){
            query['rank']['$lte']=lastRank;
        }
        let update={$inc: { 'rank': 1 , 'diff': -1},$currentDate:{'lastModified':true} }
        mongoDb.collection.updateMany(
            query,
            update,
            function(err,doc){
                if(err) throw new Error(err);
                callb(doc);
        }); 
    })
}

function saveGamerToMongo(userName,age,callb){
    let gamer={userName:userName,gain:0,rank:0,diff:0,age:age};
    mongoDb.collection.insertOne(gamer,(err,res)=>{
        if(err) throw new Error(err);
        callb(res.insertedId.toHexString());
    });
}