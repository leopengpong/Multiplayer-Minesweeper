

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
	
	this.reset();	
}

Game.prototype.reset = function () {
	this.state = 'ready';
	this.revealed = Game.fill([this.width, this.height], false);
	this.flags = Game.fill([this.width, this.height], false);
	this.field = Game.fill([this.width, this.height], 0);

	this.numClicked = 0;
}

Game.prototype.generateField = function (x, y) {
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

// return true if anything changed
Game.prototype.click = function (x, y) {
	var newData = {
		state: this.state,
		flagged: [],
		revealed: []
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

	if (this.width*this.height - this.numMines == this.numClicked)
		this.state = 'won';
	newData.state = this.state;
	return newData;
}

Game.prototype.recursiveClickZero = function (x, y, nr) {
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

Game.prototype.flag = function (x, y) {
	var newData = {
		state: this.state,
		flagged: undefined,
		revealed: []
	};
	if (this.inBounds(x, y) && !this.revealed[x][y] && !this.isOver())
	{
		this.flags[x][y] = !this.flags[x][y];
		newData.flagged = {x:x, y:y, flagged:this.flags[x][y]};
	}
	return newData;
}

Game.prototype.inBounds = function (x, y) {
	return (x < this.width && x >= 0 && y < this.height && y >= 0);
}

Game.prototype.isOver = function () {
	return this.state == 'won' || this.state == 'lost';
}

Game.fill = function (dimensions, val) {
	var array = [];
	for (var i = 0; i < dimensions[0]; ++i) {
		array.push([]);
		for (var j = 0; j < dimensions[1]; ++j)
			array[i].push(val);
	}
	return array;
}

Game.prototype.logBoard = function () {
	console.log(this.state + ', numClicked : ' + this.numClicked);
	var playerView = '';
	for (var y = 0; y < this.height; ++y) {
		for (var x = 0; x < this.width; ++x) {
			playerView += ' | ';
			if (this.flags[x][y])
				playerView += 'F';
			else if (!this.revealed[x][y])
				playerView += ' ';
			else if (this.field[x][y] < 0)
				playerView += '*';
			else
				playerView += this.field[x][y];
		}
		playerView += ' |\n';
	}
	console.log(playerView);
}

