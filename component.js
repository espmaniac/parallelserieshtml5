class Component {
  constructor(name, value, x, y) {
    this.className = "Component";
    this.name = new Text(name);
    this.name.parent = this;
    this.value = new Text(value);
    this.value.parent = this;
    this.width = cellSize * 2;
    this.height = cellSize;
    this.angle = 0;
    this.selected = false;

    this.node1 = new Node();
    this.node2 = new Node();

    this.node1.parent = this;
    this.node2.parent = this;


    connectNodes(this.node1, this.node2, this.value);
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

    this.value.x = this.x;
    this.value.y = this.y;

    this.name.x = this.x;
    this.name.y = this.y - 10;

    if (onMove) return;

    /* update onMouseUp */
    this.update();
  }

  update() {
    

    let rotateLeft = rotatePoint(
      {x: this.x - this.width, y: this.y + this.height / 2}, 
      {x: this.rotationPointX(), y: this.rotationPointY()}, 
      this.angle
    );
    this.node1.x = snapToGrid(rotateLeft.x);
    this.node1.y = snapToGrid(rotateLeft.y);

    let rotateRight = rotatePoint(
      {x: this.x + this.width * 2, y: this.y + this.height / 2}, 
      {x: this.rotationPointX(), y: this.rotationPointY()},
      this.angle
    );

    this.node2.x = snapToGrid(rotateRight.x);
    this.node2.y = snapToGrid(rotateRight.y);

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

  hitNode(x, y) {
    return this.node1.hitTest(x,y) ? this.node1 : (this.node2.hitTest(x,y) ? this.node2 : null);
  }

  onDelete() {
    deleteNode(this.node1);
    deleteNode(this.node2);
  }

  }
