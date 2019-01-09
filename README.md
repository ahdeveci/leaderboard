# leaderboard
Restfull Leaderboard - NodeJS + MongoDb + Redis

First of all you must install MongoDb and Redis server then run.

Create .env file

Sample .env file:

PORT = 8080

MONGO_DB_URI = <MONGO DB SERVER URI>
  
MONGO_DB_NAME = <DB NAME>
  
MONGO_DB_COLLECTION = <COLLECTION NAME>
  
MONGO_DB_AWARD_COLLECTION = <AWARD COLLECTION NAME>
  
TOP100_CALLING_PERIOD = 10

Run this lines on terminal:

  npm install

  node server.js

And call methods with a tool like postman.
