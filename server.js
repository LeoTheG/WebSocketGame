'use strict';

const express = require('express');
const SocketServer = require('ws').Server;
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const stream = require('stream');

// for username generation
var names = [];
var adjectives = [];
var usernames = [];

// reads names and adjectives files and stores in arrays
(function(){
  let instream = fs.createReadStream('./names.txt');
  const outstream = new stream;
  let rl = readline.createInterface(instream, outstream);


  rl.on('line',function(line){
    names.push(line);
  });

  instream = fs.createReadStream('./adjectives.txt');
  rl = readline.createInterface(instream, outstream);

  rl.on('line',function(line){
    adjectives.push(line);
  });
})();

const PORT = process.env.PORT || 3000;

const server = express()
  .use(express.static(__dirname))
  .use(express.static('public'))
  .listen(PORT, () => console.log(`Listening on ${ PORT }`));

const wss = new SocketServer({ server });

var clients = [];
const MSG_TYPE_POSITION = "player position";
const MSG_TYPE_POSITION_ALL = "all player position";
const MSG_TYPE_NEW_CONNECTION = "new player connection";
const MSG_TYPE_REQUEST_PLAYERS = "request all players";
const MSG_TYPE_SEND_PLAYERS = "send all players";
const MSG_TYPE_REQUEST_NAME = "request player name";
const MSG_TYPE_SEND_NAME = "send player name";
let lastTime = Date.now();
let cooldown = false;

wss.on('connection', function connection(ws) {
  ws.id = makeUsername();
  ws.position={};
  ws.position.x=100,ws.position.y=100;
  console.log("%s Connected to server",ws.id);
  // for pinging connection
  ws.isAlive = true;
  ws.on('pong', ()=>{ws.isAlive=true});

  clients.push(ws);

  // send message to clients informing new client
  sendAll(MSG_TYPE_NEW_CONNECTION,ws.id);

  // message from client
  ws.on('message',function(msg){
    const userMsg = JSON.parse(msg);
    // player position update
    if(userMsg.type==MSG_TYPE_POSITION){
      ws.position.x = userMsg.position.x;
      ws.position.y = userMsg.position.y;
    }
    else if(userMsg.type==MSG_TYPE_REQUEST_PLAYERS){
      let jsonObj = {
          type: MSG_TYPE_SEND_PLAYERS,
          msg: []
      };
      wss.clients.forEach((client)=>{
        jsonObj["msg"].push(client.id);
        jsonObj["msg"][client.id] = {
          x: client.position.x,
          y: client.position.y
        }
      });

      ws.send(JSON.stringify(jsonObj));
    }
    else if(userMsg.type==MSG_TYPE_REQUEST_NAME){
      const msg = {
        type: MSG_TYPE_SEND_NAME,
        text: ws.id
      }
      ws.send(JSON.stringify(msg));
    }
  });

});
// creates JSON of all clients and x,y positions
function allClientPositionJSON(){
  let jsonObj = {
    type: MSG_TYPE_POSITION_ALL,
    msg: []
  };
  wss.clients.forEach((client)=>{
    let obj = {
      id: client.id,
      x: client.position.x,
      y: client.position.y
    }
    jsonObj["msg"].push(obj);
  });
  return jsonObj;
}

// message to client
// update player positions on client
setInterval(() => {
  wss.clients.forEach((client) => {
    try{
    client.send(JSON.stringify(allClientPositionJSON()));
    }catch(e){console.log(e)};
  });
}, 20);


function msgClientPosition(ws){
  const msg = {
    type : MSG_TYPE_POSITION,
    id : ws.id,
    x : ws.position.x,
    y : ws.position.y
  };
  return JSON.stringify(msg);
}

function createMsg(msgType,msgText){
  let msg = {
    type: msgType,
    text: msgText
  }
  return msg;
}

const ping = setInterval(()=>{
  clients.forEach((ws)=>{
    // check if open
    if(ws.readyState==ws.OPEN) ws.ping();
    else ws.isAlive = false;
    if(ws.isAlive === false){
      sendAll("server-message",ws.id +" has disconnected");
      removeClient(ws);
      return;
    }
    ws.isAlive = false;
  });
}, 1000);

/*
// send time to clients
setInterval(() => {
  wss.clients.forEach((client) => {
    var msg = {
      type: "server-time",
      text: new Date().toTimeString()
    }
    client.send(JSON.stringify(msg));
  });
}, 1000);
*/

function makeid() {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < 5; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

// called when user connects for first time
function makeUsername(){
  let numTries = 0;
  const maxTries = 50;
  let cont = true;
  let newUsername = null;
  // check taken usernames
  while((usernames.includes(newUsername) || cont ) && numTries < maxTries){
    if(usernames.includes(newUsername)){
    }
    numTries++;
    if(cont==true) cont=false;

    const randNameNum = Math.floor(Math.random() * names.length);
    const randAdjectiveNum = Math.floor(Math.random() * adjectives.length);
    newUsername = adjectives[randAdjectiveNum] + " " + names[randNameNum];
  }
  if(numTries < maxTries){
    usernames.push(newUsername);
  }
  else ws.close();
  return newUsername;
}

function sendAll(msgType, msgText){
  const msg = {
    type: msgType,
    text: msgText
  };
  wss.clients.forEach((client)=>{
    client.send(JSON.stringify(msg));
  });
}
function sendAllExcept(msgType, msgText, id){
  const msg = {
    type: msgType,
    text: msgText
  };
  wss.clients.forEach((client)=>{
    if(client.id != id)
      client.send(JSON.stringify(msg));
  });
}

function replaceUsername(originalName, replacement){
  console.log("removing name:" + originalName);
  const indexToRemove = usernames.indexOf(originalName);
  if(indexToRemove > -1){
    usernames.splice(indexToRemove,1);
  }
  usernames.push(replacement);

}

function removeClient(ws){
  const indexToRemove = clients.indexOf(ws);
  if(indexToRemove > -1){
    clients.splice(indexToRemove,1);
  }
}

function log(ws,msg){
  ws.send(JSON.stringify(createMsg("server-message",msg)));
}
