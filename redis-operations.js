let redis = require('redis');

class _redis{
    constructor(){
        this.client = redis.createClient();
        this.client.on('connect', function() {
            console.log('connected redis server');
        });
    }

    save(key,id,val,callb) {
        let today = new Date().toLocaleString();
        val['lastModified']=today;
        let json = JSON.stringify(val);
        this.client.hset(key, `${id}`, `${json}`,function(err,cb){
            if(err) throw new Error(err);
            callb(cb);
        });
    }

    deleteById(key,id,callb){
        this.client.hdel(key,id,function(err,res){
            if(err) throw new Error(err);
            callb(res);
        })
    };

    deleteByKey(key,callb){
        this.client.del(key,function(err,res){
            if(err) throw new Error(err);
            callb(res);
        });
    }

    getByKey(key,callb){
         this.client.hgetall(key,function(err,result){
             if(err) throw err;
             callb(result);
         })
    }

    getById(key,gamerId,callb){
        this.client.hget(key,gamerId,function(err,result){
            if(err) throw err;
            callb(JSON.parse(result));
        })
    }
}

module.exports = _redis;