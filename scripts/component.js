class Component {
  constructor(name, value, x, y) {
    this.className = "Component";
    this.name = new Text(name);
    this.name.parent = this;
    this.value = new Text(value);
    this.value.parent = this;

    this.value.rotationPointX = this.name.rotationPointX = function() { return this.parent.rotationPointX(); };
    this.value.rotationPointY = this.name.rotationPointY = function() { return this.parent.rotationPointY(); };

    this.width = cellSize * 2;
    this.height = cellSize;
    this.angle = 0;
    this.selected = false;

    this.nodes = [new Node(), new Node()];
    this.nodes[0].parent = this;
    this.nodes[1].parent = this;

    connectNodes(this.nodes[0], this.nodes[1], this.value);

    this.move(x, y);
      
  }

  rotationPointX() {
    return this.x + this.width/2; 
  }

  rotationPointY() { 
    return this.y + this.height/2; 
  }

  drawComponent() {}

  select(s) {
    this.selected = s;
    this.name.selected = s;
    this.value.selected = s;
  }

  draw() {
    ctx.save();

    ctx.translate(this.rotationPointX(), this.rotationPointY());
    ctx.rotate(this.angle * (Math.PI / 180));
    ctx.translate(-this.rotationPointX(), -this.rotationPointY());

    if (this.selected) {
        ctx.strokeStyle = "#FF0000";
        ctx.fillStyle = "#FF0000";
    }
    else {
        ctx.strokeStyle = "#000000";
        ctx.fillStyle = "#000000";
    }

    ctx.beginPath();

    this.drawComponent();

    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    
    
    this.name.draw();
    this.value.draw();
    
  }

  move(x, y, onMove) {
    this.x = x;
    this.y = y;

    this.value.x = this.x + this.width / 2;
    this.value.y = this.y;

    this.name.x = this.x + this.width / 2;
    this.name.y = this.y - 10;

    this.nodePosUpdate(onMove);

    if (onMove) return;

    this.update();
  }

  nodePosUpdate(onMove) {
    let rotateLeft = rotatePoint(
      {x: this.x - this.width, y: this.y + this.height / 2}, 
      {x: this.rotationPointX(), y: this.rotationPointY()}, 
      this.angle
    );
    this.nodes[0].x = (onMove) ? rotateLeft.x : snapToGrid(rotateLeft.x);
    this.nodes[0].y = (onMove) ? rotateLeft.y : snapToGrid(rotateLeft.y);

    let rotateRight = rotatePoint(
      {x: this.x + this.width * 2, y: this.y + this.height / 2}, 
      {x: this.rotationPointX(), y: this.rotationPointY()},
      this.angle
    );

    this.nodes[1].x = (onMove) ? rotateRight.x : snapToGrid(rotateRight.x);
    this.nodes[1].y = (onMove) ? rotateRight.y : snapToGrid(rotateRight.y);
  }

  update() {
    this.nodePosUpdate(false);
  }

  updateConnections() {
    deleteNode(this.nodes[0]);
    deleteNode(this.nodes[1]);
    connectNodes(this.nodes[0], this.nodes[1], this.value);
  }

  rotate(angle) {
    this.angle += angle;
    this.angle %= 360;

    this.name.rotate(angle);
    this.value.rotate(angle);
    
  }

  hitTest(x, y) {
    let rotatedPoint = rotatePoint(
      {x: x, y: y}, 
      {x: this.rotationPointX(), y: this.rotationPointY()}, 
      -this.angle
    );
    
    if ((rotatedPoint.x >= this.x && rotatedPoint.x <= (this.x + this.width)) &&
        (rotatedPoint.y >= this.y && rotatedPoint.y <= (this.y + this.height)))
        return true;

    return false;
  }

  onDelete() {
    deleteNode(this.nodes[0]);
    deleteNode(this.nodes[1]);
    this.select(false);
  }

  }
