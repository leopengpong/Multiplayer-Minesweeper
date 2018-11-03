
// make connection
var socket = io.connect();

// selectors
var handlePrompt = document.querySelector('#handlePrompt');
var handleInput = document.querySelector('#handleInput');
var handleConfirm = document.querySelector('#handleConfirm');

var newWidthInput = document.querySelector('#newWidthInput');
var newHeightInput = document.querySelector('#newHeightInput');
var newDensityInput = document.querySelector('#newDensityInput');
var newGameConfirm = document.querySelector('#newGameConfirm');

var canv = document.querySelector('#canv');
var ctx = canv.getContext('2d');
var spacer = document.querySelector('#spacer');
var numClearedBar = document.querySelector('#numClearedBar');
var numClearedVal = document.querySelector('#numClearedVal');
var numFlaggedBar = document.querySelector('#numFlaggedBar');
var numFlaggedVal = document.querySelector('#numFlaggedVal');

var info = document.querySelector('#info');
var onlinePlayers = document.querySelector('#onlinePlayers');
var bugReport = document.querySelector('#bugReport');
var gameWon = document.querySelector('#gameWon');
var gameLost = document.querySelector('#gameLost');
var triggererDisplay = document.querySelector('#triggerer');
var newGamePrompt = document.querySelector('#newGamePrompt');

var body = document.querySelector('body');
var controlsButton = document.querySelector('#controlsButton');
var controlsPrompt = document.querySelector('#controlsPrompt');
var controlType = document.querySelector('#controlType');
var currentBind = document.querySelector('#currentBind');

var listeningForClick = false;
var listeningForFlag = false;
var keybinds = {
	flag: 'right click',
	click: 'left click'
}
var mouseX = 0;
var mouseY = 0;


// game variables
var gmWidth;
var gmHeight;
var field = [];				// undefined: invisible, -99: mine, else: val
var flags = [];				// true: there is a flag, false: there isn't
var handle = 'Leo Peng';
var state = 'ongoing';
var totalFlagged = 0;
var totalClicked = 0;
var numMines = 0;


// UI variables
var cSize = 20;
var cSpacing = 2;
var cellColor = '#6cb4fc';
var fieldColor = '#dddddd';
var bgColor = '#000000'; 
var flagColor = '#ff7b00';
var fontColor = '#000000';
var mineColor = '#ff0000';
var mTop = 30;
var mLeft = 30;
var font = '16px Arial';

var playing = false;
 
body.style['background-color'] = bgColor;



// canvas init
// width and height are set after server requestx
canv.style['top'] = mTop + 'px';
canv.style['left'] = mLeft + 'px';


// get username
handleConfirm.addEventListener('click', function(e) {
	if (handleInput.value.length <= 15 && handleInput.value.length > 0) {
		handle = handleInput.value;
		handlePrompt.style.display = 'none';
		canv.style.display = 'block';
		info.style.display = 'block';
		gameWon.style.display = 'none';
		gameLost.style.display = 'none';
		newGamePrompt.style.display = 'none';
		socket.emit('init', {handle: handle});
	}
});

window.addEventListener('mousemove', function (e) {
	mouseX = parseInt((e.pageX-mLeft) / (cSize+cSpacing));
	mouseY = parseInt((e.pageY-mTop) / (cSize+cSpacing));
});

window.addEventListener('keydown', function (e) {
	if (playing)
		if (listeningForClick)
			updateKeyBinds('click', e.keyCode);
		else if (listeningForFlag)
			updateKeyBinds('flag', e.keyCode);
		else if (e.keyCode == keybinds.flag)
			handleClick('flag');
		else if (e.keyCode == keybinds.click)
			handleClick('click');
});
window.addEventListener('click', function(e) {
	if (playing)
		if (listeningForClick)
			updateKeyBinds('click', 'left click');
		else if (listeningForFlag)
			updateKeyBinds('flag', 'left click');
		else if (keybinds.click == 'left click')
			handleClick('click');
		else if (keybinds.flag == 'left click')
			handleClick('flag');
});
window.oncontextmenu = function(e) {
	if (playing) {
		e.preventDefault();
		if (listeningForClick)
			updateKeyBinds('click', 'right click');
		else if (listeningForFlag)
			updateKeyBinds('flag', 'right click');
		else if (keybinds.click == 'right click')
			handleClick('click');
		else if (keybinds.flag == 'right click')
			handleClick('flag');
	}
}

// click handling
function handleClick(type) {
	if (state == 'ready' || state == 'ongoing') {
		if (mouseX < gmWidth && mouseY < gmHeight)
			if (type == 'click') {
				socket.emit('click', {handle:handle, x:mouseX, y:mouseY});
			} else if (type == 'flag') {
				socket.emit('flag', {handle:handle, x:mouseX, y:mouseY});
			}
	}
}

// socket listening
socket.on('init', function (data) {
	state = data.gameData.state;
	flags = data.gameData.flagged;
	field = data.gameData.field;
	totalClicked = data.gameData.numClicked;
	totalFlagged = data.gameData.numFlagged;
	numMines = data.gameData.numMines;
	gmWidth = field.length;
	gmHeight = field[0].length;
	updateProgressBars();

	canv.width = (cSize+cSpacing)*gmWidth - cSpacing + 330;
	canv.height = (cSize+cSpacing)*gmHeight - cSpacing + 100;
	draw();
	playing = true;

	// create initial state
	gameLost.style.display = 'none';
	gameWon.style.display = 'none';
	newGamePrompt.style.display = 'none';
});

socket.on('update players', function (players) {
	var newInnerHTML = '';
	for (var i = 0; i < players.length; ++i) {
		newInnerHTML += '<tr><td>';
		if (players[i].handle == handle) {
			newInnerHTML += '<strong>' + players[i].handle + '</strong>';
		} else {
			newInnerHTML += players[i].handle;
		}
		newInnerHTML += '</td><td>'+ players[i].numFlagged +
				'</td><td>'+ players[i].numClicked +'</td></tr>';
		onlinePlayers.innerHTML = newInnerHTML;
	}
});

socket.on('update game', function (data) {
	for (var i = 0; i < data.revealed.length; ++i) {
		var click = data.revealed[i];
		field[click.x][click.y] = click.val;
		totalClicked += click.val >= 0 ? 1 : 0;
	}
	for (var i = 0; i < data.flagged.length; ++i) {
		var flag = data.flagged[i];
		flags[flag.x][flag.y] = flag.val;
		totalFlagged += flag.val ? 1 : -1;
	}
	draw();
	updateProgressBars();
});

socket.on('won', function () {
	gameWon.style.display = 'block';
	newGamePrompt.style.display = 'block';
});

socket.on('lost', function (triggerer) {
	gameLost.style.display = 'block';
	triggererDisplay.innerHTML = '<strong>' + triggerer + '</strong>';
	newGamePrompt.style.display = 'block';
});

// handle new game prompt input
newGameConfirm.addEventListener('click', function (e) {
	newWidth = parseInt(newWidthInput.value);
	newHeight = parseInt(newHeightInput.value);
	newDensity = parseInt(newDensityInput.value);

	if (newWidth >= 3 && newWidth<= 200 &&
		newHeight >= 3 && newHeight<= 200 &&
		newDensity >= 1 && newDensity<= 50)
	{
		var newGameData = {
			width: newWidth,
			height: newHeight,
			density: newDensity
		}
		socket.emit('restart', newGameData);
	}
});

// update progress bars
function updateProgressBars() {
	numClearedVal.innerHTML = numClearedBar.style.width = parseInt(totalClicked*100/(gmWidth*gmHeight - numMines)) + '%';
	numFlaggedVal.innerHTML = numFlaggedBar.style.width = parseInt(totalFlagged*100/numMines) + '%';
}

// bug reporter
bugReport.addEventListener('click', function() {
	if (prompt('Please describe your issue.\nThis app is in beta, so your feedback is appreciated!'))
		alert('Report submitted.\nThank you!');
});

// change controls
controlsButton.addEventListener('click', function() {
	controlsPrompt.style.display = 'block';
	controlType.innerHTML = 'click';
	currentBind.innerHTML = typeof(keybinds.click) == 'number' ? String.fromCharCode(keybinds.click) : keybinds.click;
	setTimeout(function() {listeningForClick = true}, 10);
});
function updateKeyBinds(type, val) {
	console.log(type, val);
	if (type == 'click') {
		keybinds.click = val;
		listeningForClick = false;
		listeningForFlag = true;
		controlType.innerHTML = 'flag';
		currentBind.innerHTML = typeof(keybinds.flag) == 'number' ? String.fromCharCode(keybinds.flag) : keybinds.flag;
	}
	else if (type == 'flag') {
		console.log('ok');
		keybinds.flag = val;
		listeningForFlag = false;
		controlsPrompt.style.display = 'none';
	}
}




// update canvas
function draw() {
	ctx.fillStyle = bgColor;
	ctx.font = font;
	ctx.textAlign = 'start';
	ctx.fillRect(0, 0, canv.width, canv.height);
	
	for (var y = 0; y < gmHeight; ++y)
		for (var x = 0; x < gmWidth; ++x) {
			if (field[x][y] == undefined) {
				ctx.fillStyle = cellColor;
				ctx.fillRect(x*(cSize+cSpacing), y*(cSize+cSpacing),
					cSize, cSize);
				if (flags[x][y]) {
					ctx.fillStyle = flagColor;
					ctx.beginPath();
					ctx.arc(x*(cSize+cSpacing)+cSize/2, y*(cSize+cSpacing)+cSize/2,
						cSize/2.5, 0, Math.PI*2);
					ctx.fill();
					ctx.closePath();
				}
			} else {
				ctx.fillStyle = fieldColor;
				ctx.fillRect(x*(cSize+cSpacing), y*(cSize+cSpacing),
					cSize, cSize);
				if (field[x][y] > 0) {
					ctx.fillStyle = fontColor;
					ctx.fillText(field[x][y],
						(x+0.25)*(cSize+cSpacing), (y+0.7)*(cSize+cSpacing));
				}
				else if (field[x][y] < -1) {
					ctx.fillStyle = mineColor;
					ctx.beginPath();
					ctx.arc(x*(cSize+cSpacing)+cSize/2, y*(cSize+cSpacing)+cSize/2,
						cSize/2, 0, Math.PI*2);
					ctx.fill();
					ctx.closePath();
				}
			}
		}	
}