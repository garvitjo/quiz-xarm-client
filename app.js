const beginScreenContainer = document.getElementById("begin-page");
const homeScreenContainer = document.getElementById("home-page");
const waitingScreenContainer = document.getElementById("waiting-page");
const gameScreenContainer = document.getElementById("game-screen");
const endScreenContainer = document.getElementById("endScreen");
const startGameButton = document.getElementById('startGameButton');
const finalScreenContainer = document.getElementById("finalScreen");

let isSinglePlayerGame;
let thisPlayer;
let otherPlayers = new Map();
let socket;

let baseURL = 'https://quiz-xarm-jumbleword.onrender.com'
//only for testing purpose
baseURL = 'http://localhost:8080';
// hidePage(beginScreenContainer);
// unhidePage(finalScreenContainer);

function enterFullscreen() {
    const doc = window.document.documentElement;
    if (doc.requestFullscreen) {
      doc.requestFullscreen();
    } else if (doc.mozRequestFullScreen) {
      doc.mozRequestFullScreen();
    } else if (doc.webkitRequestFullscreen) {
      doc.webkitRequestFullscreen();
    } else if (doc.msRequestFullscreen) {
      doc.msRequestFullscreen();
    }
  }

  function beginGameSinglePlayer(){
    isSinglePlayerGame = true;
    thisPlayer = {
      playerName: "",
      isReady: false,
      score: 0,
      gameFinished: false,
    }
    beginButtonClicked();
  }
  function beginGameDoublePlayer(){
    isSinglePlayerGame = false;
    openWebsocketConnection();
  }

function beginButtonClicked() {
    getQuestion();
    getQuestionSequence();
    hidePage(beginScreenContainer);
    unhidePage(homeScreenContainer);
}

function getName() {
    let name = document.getElementById("playerName").value.trim();
    debugger;
    if(name == ""){
      alert("Please enter your name");
      return;
    }else if(!/^[a-zA-Z ]+$/.test(name)){
      alert("Please enter a valid name");
      return;
    }
    thisPlayer.playerName = name;
    
    if(isSinglePlayerGame){
      hidePage(homeScreenContainer);
      unhidePage(gameScreenContainer);
      startQuiz(questionsData);
      return;
    }

    socket.emit('update-player-details', thisPlayer);
    socket.emit("ready-to-start-game", thisPlayer);
}


function getQuestion() {
    let cachedData = JSON.parse(localStorage?.getItem('questions'));
    if (cachedData) {
        questionsData = cachedData;
    } else {
        // Fetch the data from the server and cache it
        fetch(baseURL + '/questions')
        .then(response => response.json())
        .then(data => {
            questionsData = data;
            localStorage.setItem('questions' , JSON.stringify(data));
        })
        .catch(error => console.error(error));
    }
}

async function getQuestionSequence() {
  try {
    const response = await fetch(baseURL + '/question-sequence'); // Make a request to the server
    const sequence = await response.json(); // Parse the JSON response
    if (Array.isArray(sequence)) {
      questionSequence = sequence; // Store the sequence in the global variable
    } else {
      questionSequence = [2,6,9];
    }
  } catch (error) {
    questionSequence = [1,7,3];
    console.error('Error fetching question sequence:', error);
  }
}

function showEndScreen(){
  thisPlayer.score = timeScore;
  thisPlayer.gameFinished = true;

  if(isSinglePlayerGame){
    hidePage(gameScreenContainer);
    unhidePage(finalScreenContainer);
    resetVariables();
    return;
  }

  socket.emit("update-player-details", thisPlayer);
  socket.emit("show-leaderboard");
  hidePage(gameScreenContainer);
  unhidePage(endScreenContainer);
  createLeaderboard(); 
}

function createLeaderboard(){
  const leaderboardContainer = document.getElementById("player-rows-start");
  
  while(leaderboardContainer.hasChildNodes()){
    leaderboardContainer.removeChild(leaderboardContainer.firstChild);
  }

  const waitingText = document.getElementById("waiting-for-quizEnd");
  unhidePage(waitingText);
}

function populateLeaderboard(players){
  let arr = calculateScore(players);
  const waitingText = document.getElementById("waiting-for-quizEnd");
  hidePage(waitingText);

  const leaderboardContainer = document.getElementById("player-rows-start");
  for(let i = 0 ; i < arr.length ; i++){
    const tempRow = document.createElement('div');
    const tempName = document.createElement('h1');
    const tempPos = document.createElement('h1');
    tempName.innerText = arr[i][1].playerName;

    let positionText="well";
    switch(i){
      case 0: {positionText = "First"; break;}
      case 1: {positionText = "Second"; break;}
    }
    tempPos.innerText = positionText;

    tempRow.appendChild(tempName);
    tempRow.appendChild(tempPos);
    tempRow.classList.add("row");
    leaderboardContainer.appendChild(tempRow);
  }
}

function calculateScore(players){
  let arr = Array.from(players);
  arr.sort((a,b) => a[1].score - b[1].score);
  return arr;
}

function startTheGame(){
  hidePage(waitingScreenContainer);
  unhidePage(gameScreenContainer);
  startQuiz(questionsData);
}

function continueFromLeaderboard(){
  hidePage(endScreenContainer);
  unhidePage(finalScreenContainer);
  resetVariables();
}

function restartQuiz(){
  hidePage(finalScreenContainer);
  unhidePage(beginScreenContainer);
}

function resetVariables(){
  fetch(baseURL + '/resetServerVariables')
  .then(response => {
  })
  .catch(error => {
    console.log(error);
  });

  thisPlayer = null;
  otherPlayers.clear();
  isSinglePlayerGame = false;
  document.getElementById("playerName").value = "";
  if(socket){
    socket.disconnect(true);
  }
}

function hidePage(page){
  if(page.classList.contains("hidden")){
    return;
  }
  else{page.classList.add("hidden");}
}

function unhidePage(page){
  if(page.classList.contains("hidden")){
    page.classList.remove("hidden");
  }
}

//------------websocket------------

function openWebsocketConnection(){

  socket = io(baseURL);

  socket.on('connect', () => {
  });
  
  socket.on('cannot-connect-now',()=>{
    alert("Some Other multiplayer game is going on, please wait for it to finish");
  });
  
  socket.on('disconnect', () => {
  });
  
  socket.on("this-player",(tempPlayer)=>{
    beginButtonClicked();
    thisPlayer = tempPlayer;
  });

  socket.on('existing-players',(players)=>{
    const tempMap = new Map(JSON.parse(players));
    const iterator = tempMap.entries();
    for (const entry of iterator){
      if(entry[0] != thisPlayer.clientId){
        otherPlayers.set(entry[0], entry[1]);
      }
    }
  });
  
  socket.on('update-player-details', player =>{
    if(thisPlayer.clientId == player.clientId){
      thisPlayer = player;
    }
    else{
      otherPlayers.set(player.clientId,player);
    }
  });

  socket.on("ok-marked-you-ready",()=>{
    hidePage(homeScreenContainer);
    unhidePage(waitingScreenContainer);  
  });

  socket.on("start-the-game",()=>{
    startTheGame();
  });

  socket.on("only-one-player",()=>{
    alert("You are the only player in the game currently, wait of another player to join multiplayer game, or play single player instead");
  });

  socket.on("show-leaderboard", (players)=>{
    //based on this data of all the players, identify the winner and send to leaderboard like that only
    const tempMap = new Map(JSON.parse(players));
    populateLeaderboard(tempMap);
  });

  socket.on("player-disconnected" , (id) =>{
    otherPlayers.delete(id);
  })

  window.addEventListener('beforeunload', function(event) {
    e.preventDefault();
    e.returnValue = 'Are you sure you want to quit?';

    if(socket){socket.disconnect = true;}
    return e.returnValue;
  });
}