let dotenv= require('dotenv');
const async=require('async');
const Mongo= require('./mongodb-oprations');
let redis = require('./redis-operations');
let index=require('./server');

let mongoDb=new Mongo();
const redisDb= new redis(); 

let schedule = require('node-schedule');

let gameStarted=true; //It is the control used to ensure that no new points are added to the players while the new game is created and the end of the week is calculated.


let j = schedule.scheduleJob('1 0 0 * * *', function () {
    if(gameStarted){
        mongoDb.collection.updateMany(
            {},
            {$set:{diff:0}},
            function(err,doc){
                if(err) throw new Error(err);
                console.log(new Date().toLocaleString()+" | Gamers' Ranking Difference Resetted!"); //All Gamers' Ranking Difference Resetted End of Day!
            }
        )
    }
});

let th=schedule.scheduleJob('*/'+process.env.TOP100_CALLING_PERIOD+' * * * * *',function(){ //The top 100 registered in redis updated every 5 seconds 
    if(gameStarted){
        redisDb.deleteByKey('topHundered',(cb)=>{
            mongoDb.collection.find({rank:{$gt:0}}).sort({rank:1}).limit(100).toArray((err,result)=>{
            if(err) throw new Error(err);
                if(result){
                    if(0 < result.length){
                        result.forEach(o=>{
                            redisDb.save('topHundered',o.rank,o,function(cb){
                            });
                        });
                        console.log(new Date().toLocaleString()+" | Top 100 updated!");  
                    }  
                }
            });     
        })  
    }
})

let mdb=schedule.scheduleJob('0 55 23 * * 1',function(){ //End of week jobs
    gameStarted=false;
    let today = new Date();
    let nextDay = new Date(today);
    nextDay.setDate(today.getDate()+1);
    let gameDate=new Date(today);
    gameDate.setDate(today.getDate()-7);
    let gameName=gameDate.getFullYear().toString()+(gameDate.getMonth+1).toString()+gameDate.getDate().toString();

    
    mongoDb.getAggregatedRatings()
    .then(function(cb){
        console.log(cb);
        if(cb){
            let totalGains=cb.totalGains;
            if(0<totalGains){
                totalGains=totalGains * 0.02;
                redisDb.getByKey('topHundered',function(doc){
                    shareAwards(doc,totalGains,gameName,
                        list=>{
                            mongoDb.saveAwards(list,function(cb){
                                // Alternative 1: every week created new collection. 
                                // collectionCreate(getUnifiedToday(nextDay)+'_leaderboard',(cb)=>{
                                //     console.log(new Date().toLocaleString()+' | Created new collection: '+cb);
                                //     gameStarted=true;
                                // });
                              //  Alternative 2: every week resetted all records from only one collection.
                                 mongoDb.collection.updateMany({},{$set:{gain:0,diff:0,rank:0}},(err,res)=>{
                                     if(err) throw new Error(err);
                                     gameStarted=true;
                                 })   

                            });
                        }
                    );                
                });
            }
        }
    })
    .then(function(){
       redisDb.deleteByKey('online',function(cb){
            console.log('Online List Cleared!');
        });
        redisDb.deleteByKey('topHundered',function(cb){
            console.log('Top100 List Clered!');
        });
    })
    .then(function(){
        console.log(new Date().toLocaleString()+" | New game started! Let's Enjoy it!");
    });
});


function isGameStarted() {  
    return gameStarted;
}
exports.isGameStarted = isGameStarted;

function shareAwards(doc,totalGains,gameName,callb){
    awardList=[];
    if(doc){
        let keys=Object.keys(doc);    
        let len =keys.length; // expected length =100
        test=0.00;
        let topThree=0.00;
        
        for(let i=0;i<len;i++){
            let gained=0.00;
            if("1"===keys[i]){
                gained = totalGains * 0.20;
                topThree += gained;
            }
            else if("2"===keys[i]){
                gained = totalGains * 0.15;
                topThree += gained;
            }
            else if("3"===keys[i]){
                gained = totalGains * 0.10;
                totalGains = totalGains - topThree - gained;
            }
            else{
                gained = (((len+1)-i)*totalGains)/ ((len-3)*(len-2)/2); // for remaining 97 gamer: n(n+1)/2
            }
            let gamer=JSON.parse(doc[keys[i]]);
            awardList.push({
                userName : gamer.userName,
                gained : gained,
                rank : i,
                score : gamer.gain,
                gameName : gameName
            })
        }
    }
    
    callb(awardList);
}

function getUnifiedToday(_date){
    let day=_date.getDate();
    let month=_date.getMonth()+1;
    if(day<10){
        day='0'+day.toString();
    }
    if(month<10){
        month='0'+month.toString();
    }
    return _date.getFullYear().toString()+month+day;
}

function collectionCreate(name,callb){
    mongoDb.db.createCollection(name,(err,res)=>{
        if(err) throw Error(err);
        mongoDb.closeConnection();

        delete mongoDb;
        delete index.mongoDb;

        mongoDb= new Mongo(name);
        index.mongoDb=new Mongo(name);
        
        callb(name);
    });
}

exports.collectionCreate=collectionCreate;
