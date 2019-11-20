var port = process.env.PORT || 3000,
	express = require('express'),
	app = express(),
    server = require('http').Server(app), 
    io = require('socket.io')(server),
    session = require('express-session'),
    bodyParser = require('body-parser');

var currentGameID_Tacenda = "tacenda";
var gameLobbyQueue = [];
var Semaphore = require("node-semaphore");
var pool = Semaphore(1);

var SECRET_I_SHOULD_KEEP = "***_NEEDS_CONFIGURED_***";

var sessionMiddleware = session({
    secret: SECRET_I_SHOULD_KEEP,
    resave: true,
    saveUninitialized: true,
    autoSave: true
});
    
app.use(sessionMiddleware);

//support parsing of application/json type post data
app.use(bodyParser.json());
//support parsing of application/x-www-form-urlencoded post data
app.use(bodyParser.urlencoded({ extended: true }));

app.get('*', (req, res) => {
    res.sendStatus(200)
});

 // socket.io middleware
io.use(function(socket, next) {
    sessionMiddleware(socket.handshake,{},next);
});
 
var numberOfPlayers = 0;
var temp_GAME = [];
var temp_GAME_iv = {};
var dict = {};

io.on('connection', function (socket) {
   clientConnected(socket);
   emitTheSauce()

   socket.on('cookieCheck', function(data){
          socket.handshake.session.gameID = getGameID();
          socket.handshake.session.game_SPOT = data.user_joined;

          if(temp_GAME.indexOf(socket.handshake.session.gameID) == -1){
            temp_GAME.push(socket.handshake.session.gameID);
            temp_GAME_iv[socket.handshake.session.gameID] = [(Math.random() * (2) - 1)*4, (Math.random() * (2) - 1)*4, (Math.random() * (2) - 1)*4];
            temp_GAME_iv[socket.handshake.session.gameID + "SEVER_HOST"] = socket.handshake.sessionID;
          }

          if(dict[temp_GAME[temp_GAME.indexOf(socket.handshake.session.gameID)]]){
              while(dict[temp_GAME[temp_GAME.indexOf(socket.handshake.session.gameID)]].indexOf(socket.handshake.session.game_SPOT) != -1){
                    socket.handshake.session.game_SPOT = (Math.floor(Math.random() * (32)) + 1);
              }
            dict[temp_GAME[temp_GAME.indexOf(socket.handshake.session.gameID)]].push(socket.handshake.session.game_SPOT);
            numberOfPlayers = numberOfPlayers + 1;
            emitTheSauce()
            io.emit(socket.handshake.session.gameID + "start_the_game", {dank: 'Sauce'});
          }else{
            dict[temp_GAME[temp_GAME.indexOf(socket.handshake.session.gameID)]] = [socket.handshake.session.game_SPOT];
            numberOfPlayers = numberOfPlayers + 1;
            emitTheSauce()
          }

         socket.emit("confirm_player", { spot: socket.handshake.session.game_SPOT, gameID: socket.handshake.session.gameID});
         io.emit(socket.handshake.session.gameID, {players: dict[temp_GAME[temp_GAME.indexOf(socket.handshake.session.gameID)]]});

         var host = false;
         if(temp_GAME_iv[socket.handshake.session.gameID + "SEVER_HOST"] === socket.handshake.sessionID){
            host = true;
         }

         io.emit(socket.handshake.session.gameID + "gameball", {server_host: host, 
                                                                IV_0: temp_GAME_iv[socket.handshake.session.gameID][0],
                                                                IV_1: temp_GAME_iv[socket.handshake.session.gameID][1],
                                                                IV_2: temp_GAME_iv[socket.handshake.session.gameID][2]});

         socket.on('from_client_heartbeat', function(data){
            io.emit(socket.handshake.session.gameID + "gameball_ball", {x: data.ball_x, y: data.ball_y, z: data.ball_z, vx: data.vel_x, vy: data.vel_y, vz: data.vel_z});
         });

         socket.on('from_client_endgame', function(data){
           if(temp_GAME.indexOf(socket.handshake.session.gameID) !== -1){
                numberOfPlayers = numberOfPlayers - dict[temp_GAME[temp_GAME.indexOf(socket.handshake.session.gameID)]].length;
                dict[temp_GAME[temp_GAME.indexOf(socket.handshake.session.gameID)]] = null;
                temp_GAME_iv[socket.handshake.session.gameID] = null;
                temp_GAME_iv[socket.handshake.session.gameID + "SEVER_HOST"] = null;
                temp_GAME.splice(temp_GAME.indexOf(socket.handshake.session.gameID), 1);
            }
            emitTheSauce()
            io.emit(socket.handshake.session.gameID + "end_game", {msg: data.gameMessage});
         });
   });

   socket.on('update_spot', function(data){
       if(dict[temp_GAME[temp_GAME.indexOf(socket.handshake.session.gameID)]] != undefined && dict[temp_GAME[temp_GAME.indexOf(socket.handshake.session.gameID)]].indexOf(data.new_spot) == -1){
            var index = dict[temp_GAME[temp_GAME.indexOf(socket.handshake.session.gameID)]].indexOf(socket.handshake.session.game_SPOT);
            socket.handshake.session.game_SPOT = data.new_spot;
            dict[temp_GAME[temp_GAME.indexOf(socket.handshake.session.gameID)]][index] = socket.handshake.session.game_SPOT;
            io.emit(socket.handshake.session.gameID, {players: dict[temp_GAME[temp_GAME.indexOf(socket.handshake.session.gameID)]]});
       }
   });

   socket.on('update_score', function(data){
       io.emit(socket.handshake.session.gameID + "update_score", {score: data.new_score});
   });

   socket.on('submit_highscore', function(data){
   });

   socket.on('disconnect', function(){
        if(temp_GAME.indexOf(socket.handshake.session.gameID) !== -1){
            numberOfPlayers = numberOfPlayers - dict[temp_GAME[temp_GAME.indexOf(socket.handshake.session.gameID)]].length;
            dict[temp_GAME[temp_GAME.indexOf(socket.handshake.session.gameID)]] = null;
            temp_GAME_iv[socket.handshake.session.gameID] = null;
            temp_GAME_iv[socket.handshake.session.gameID + "SEVER_HOST"] = null;
            temp_GAME.splice(temp_GAME.indexOf(socket.handshake.session.gameID), 1);

            io.emit(socket.handshake.session.gameID, {players: dict[temp_GAME[temp_GAME.indexOf(socket.handshake.session.gameID)]]});
            io.emit(socket.handshake.session.gameID + 'restart_Game', {dank: 'Sauce'});
            emitTheSauce()
        }
        if(gameLobbyQueue.length != 0 && socket.handshake.session.gameID == gameLobbyQueue[0]){
            gameLobbyQueue.pop();
        }
   });
});

server.listen(port); 

function getGameID(){
    pool.acquire(function() {
        if(gameLobbyQueue.length == 0){
            //create a new gameID
            var rs = '';
            rs += Math.random().toString(16).slice(2);
            currentGameID_Tacenda = rs;
            while(temp_GAME.indexOf(currentGameID_Tacenda) != -1){
                for(i = 0; i < 2; i++) {
                    rs += Math.random().toString(16).slice(2);
                }
                currentGameID_Tacenda = rs;
            }
            gameLobbyQueue.push(currentGameID_Tacenda);
        }else{
            currentGameID_Tacenda = gameLobbyQueue[0];
            gameLobbyQueue.pop();
        }
    });
    setTimeout(function(){
        pool.release();
    }, 144);
    return currentGameID_Tacenda;
}

//catches ctrl+c event
process.on("SIGINT", cleanUp.bind(this));
// catches "kill pid" (for example: nodemon restart)
process.on("SIGUSR1", cleanUp.bind(this));
process.on("SIGUSR2", cleanUp.bind(this));
//catches uncaught exceptions
process.on("uncaughtException", cleanUp.bind(this));
function cleanUp() {
  //closeTheDB();
  console.log("\nGOTTA BLAST!");
  process.exit();
}

function clientConnected(socket){

    var tempString = "716Forever<3";
    socket.emit("client_connect", { dank:  JSON.stringify({
        single_highscore: tempString,
        playerCount: numberOfPlayers
    })});
}

function emitTheSauce(){

    var tempString = "716Forever<3";
    io.emit("player_joined", { dank:  JSON.stringify({
        single_highscore: tempString,
        playerCount: numberOfPlayers
    })});
}