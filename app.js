
var express = require('express');
var socket = require('socket.io');

var app = express();
var server = app.listen(process.env.PORT || 4000, function () {
	console.log('listening to port 4000');
});

app.use(express.static('public'));
var io = socket(server);

// mongo stuff
var mongoose = require('mongoose');
var connectionString = 'mongodb://admin:'+encodeURIComponent('Ilikepie2@')+'@test-cluster-2-shard-00-00-owuzi.mongodb.net:27017,test-cluster-2-shard-00-01-owuzi.mongodb.net:27017,test-cluster-2-shard-00-02-owuzi.mongodb.net:27017/minesweeper?ssl=true&replicaSet=test-cluster-2-shard-0&authSource=admin&retryWrites=true';
mongoose.connect(connectionString, { useNewUrlParser: true });

var gameSchema = new mongoose.Schema({
	_id: mongoose.Schema.Types.ObjectId,
	width: Number,
	height: Number,
	density: Number,
});


var GameState = mongoose.model('GameState', gameSchema);


// game info
var players = [];		// {handle, numClicked, numFlagged}
var game = new Game(10, 10, 0.2);
var triggerer;


// socket stuff
io.on('connection', function(socket) {
	console.log('made socket connection');

	socket.on('init', function (data) { // handle
		socket.handle = data.handle;
		var newPlayer = {handle:data.handle, numClicked:0, numFlagged:0};
		players.push(newPlayer);
		console.log(newPlayer.handle + ' connected');

		var gameData = {
			gameData: game.getData(), // state, flagged, field, numClicked/Flagged
									  // field: -99: mine, undefined: not revealed
		}
		socket.emit('init', gameData);
		io.sockets.emit('update players', players);
		if (game.state == 'lost') {
			socket.emit('lost', triggerer);
		} else if (game.state == 'won') {
			socket.emit('won');
		}
	});

	socket.on('disconnect', function () {
		console.log('ended connection:')
		for (var i = 0; i < players.length; ++i) {
			if (players[i].handle == socket.handle) {
				console.log('\t' + socket.handle + ' disconnected');
				players.splice(i, 1);
				break;
			}
		}
		io.sockets.emit('update players', players);
	}); 

	socket.on('click', function (data) { // handle, x, y
		var clickData = game.click(data.x, data.y);
		if (clickData.revealed.length > 0)
			io.sockets.emit('update game', clickData);

		for (var i = 0; i < players.length; ++i)
			if (players[i].handle == data.handle) {
				if (clickData.revealed.length > 1 ||
					(clickData.revealed.length == 1 &&
					clickData.revealed[0].val >= 0))
					players[i].numClicked += clickData.revealed.length;
				break;
			}
		io.sockets.emit('update players', players);
		if (game.state == 'lost') {
			triggerer = socket.handle;
			io.sockets.emit('lost', socket.handle);
		} else if (game.state == 'won') {
			io.sockets.emit('won');
		}
	});

	socket.on('flag', function (data) { // handle, x, y
		var flagData = game.flag(data.x, data.y);
		if (flagData.flagged.length > 0) {
			io.sockets.emit('update game', flagData);
			for (var i = 0; i < players.length; ++i)
				if (players[i].handle == data.handle) {
					players[i].numFlagged += flagData.flagged[0].val ? 1 : -1;
					break;
				}
			io.sockets.emit('update players', players);
		}
	});

	socket.on('restart', function (data) {
		game = new Game(data.width, data.height, data.density/100);
		var newGame = new GameState({
			_id: new mongoose.Types.ObjectId(),
			width: data.width,
			height: data.height,
			density: data.density/100
		});

		newGame.save(function(err, game){
			if(err){
				console.log("SOMETHING WENT WRONG!")
			} else {
				console.log("WE JUST SAVED A CAT TO THE DB:")
				console.log(game);
			}
		});
		for (var i = 0; i < players.length; ++i) {
			players[i].numFlagged = 0;
			players[i].numClicked = 0;
		}
		io.sockets.emit('init', {gameData:game.getData()});
		io.sockets.emit('update players', players);
	});
});




function Game (width, height, density) {
	if (density < 0 || density >= 1)
		throw 'invalid density';
	this.width = width;
	this.height = height;
	this.density = density;
	this.numMines = parseInt(width*height*density);
	
	this.state;			// ready, ongoing, lost, won
	this.revealed;		// 2d array; true: revealed, false: nope
	this.flags;			// 2d array; true: flagged
	this.field;			// 2d array; -99: mine
	this.numClicked;
	this.numFlagged;
	
	this.resetGame = function () {
		this.state = 'ready';
		this.revealed = fill([this.width, this.height], false);
		this.flags = fill([this.width, this.height], false);
		this.field = fill([this.width, this.height], 0);

		this.numClicked = 0;
		this.numFlagged = 0;
	}
	this.resetGame();

	this.generateField = function (x, y) {
		var mines = [];
		while (mines.length < this.numMines) {
			var newx = parseInt(Math.random()*this.width);
			var newy = parseInt(Math.random()*this.height);

			if (Math.abs(x - newx) <= 1 && Math.abs(y - newy) <= 1)
				continue;

			var yep = true;
			for (var i = 0; i < mines.length; ++i)
				if (mines[i].x == newx && mines[i].y == newy)
				{
					yep = false;
					break;
				}
			if (yep)
				mines.push({x:newx, y:newy});
		}
		for (var k = 0; k < mines.length; ++k) {
			this.field[mines[k].x][mines[k].y] = -99;
			for (var i = -1; i < 2; ++i)
				for (var j = -1; j < 2; ++j)
					if (this.inBounds(mines[k].x + i, mines[k].y + j)) {
						this.field[mines[k].x + i][mines[k].y + j] += 1;
					}
		}
	}

	this.recursiveClickZero = function (x, y, nr) {
		var newRevealed = nr;
		if (this.inBounds(x, y) && !this.revealed[x][y] &&
			!this.flags[x][y])
		{
			this.revealed[x][y] = true;
			newRevealed.push({x:x, y:y, val:this.field[x][y]});
			++this.numClicked;
			if (this.field[x][y] == 0)
				for (var i = -1; i < 2; ++i)
					for (var j = -1; j < 2; ++j) {
						newRevealed.concat(this.recursiveClickZero(x+i, y+j, newRevealed));
					}
		}
		return newRevealed;
	}

	this.click = function (x, y) {
		var newData = {
			revealed: [],
			flagged: [],
			numClicked: this.numClicked,
			numFlagged: this.numFlagged
		};
		if (this.revealed[x][y] || this.flags[x][y] || this.isOver())
			return newData;
		else if (this.state == 'ready') {
			this.generateField(x, y);
			this.state = 'ongoing';
		}
		if (this.field[x][y] == 0) {
			newData.revealed = this.recursiveClickZero(x, y, []);
		}
		else if (this.field[x][y] > 0) {
			++this.numClicked;
			this.revealed[x][y] = true;
			newData.revealed.push({x:x, y:y, val:this.field[x][y]});
		}
		else {
			this.revealed[x][y] = true;
			newData.revealed.push({x:x, y:y, val:this.field[x][y]});
			this.state = 'lost';
		}

		if (this.width*this.height-this.numMines == this.numClicked)
			this.state = 'won';
		return newData;
	}
	this.flag = function (x, y) {
		var newData = {
			revealed: [],
			flagged: [],
			numClicked: this.numClicked,
			numFlagged: 0,
		};
		if (this.inBounds(x, y) && !this.revealed[x][y] && !this.isOver())
		{
			this.flags[x][y] = !this.flags[x][y];
			this.numFlagged += this.flags[x][y] ? 1 : -1;
			newData.flagged.push({x:x, y:y, val:this.flags[x][y]});
		}
		newData.numFlagged = this.numFlagged;
		return newData;
	}

	this.inBounds = function (x, y) {
		return (x < this.width && x >= 0 && y < this.height && y >= 0);
	}

	this.isOver = function () {
		return this.state == 'won' || this.state == 'lost';
	}

	this.getData = function () {
		var field = copy2dArray(this.field);
		for (var x = 0; x < this.width; ++x)
			for (var y = 0; y < this.height; ++y)
				if (!this.revealed[x][y])
					field[x][y] = undefined;
		var data = {
			state: this.state,
			flagged: this.flags,
			field: field,
			numClicked: this.numClicked,
			numFlagged: this.numFlagged,
			numMines: this.numMines
		};
		return data;
	}
}

function copy2dArray(toCopy) {
	var result = [];
	for (var x = 0; x < toCopy.length; ++x) {
		result.push([]);
		for (var y = 0; y < toCopy[0].length; ++y)
			result[x].push(toCopy[x][y]);
	}
	return result;

}

function fill(dimensions, val) {
	var array = [];
	for (var i = 0; i < dimensions[0]; ++i) {
		array.push([]);
		for (var j = 0; j < dimensions[1]; ++j)
			array[i].push(val);
	}
	return array;
}

