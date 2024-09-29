
class Component {
  constructor(name, value, x, y) {
    this.className = "Component";
    this.name = name;
    this.value = value;
    this.x = x;
    this.y = y;
    this.width = cellSize * 2;
    this.height = cellSize;
    this.angle = 0;
    this.selected = false;

    this.node1 = new Node();
    this.node2 = new Node();

    this.node1.parent = this;
    this.node2.parent = this;

    connectNodes(this.node1, this.node2, this.value);
      
  }

  rotationPointX() {
    return this.x + this.width/2; 
  }

  rotationPointY() { 
    return this.y + this.height/2; 
  }

  drawComponent() {}

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

    ctx.font = "bold 12px sans-serif";
    
    let nameMetric = ctx.measureText(this.name);
    let valueMetric = ctx.measureText(this.value);

    /* ALIGN text left */
    //ctx.fillText(this.value, this.x, this.y - (valueMetric.actualBoundingBoxAscent + valueMetric.actualBoundingBoxDescent) / 2);
    //ctx.fillText(this.name, this.x, this.y - (nameMetric.actualBoundingBoxAscent + nameMetric.actualBoundingBoxDescent) * 2);
    /* ALIGN text left*/


    ctx.fillText(this.value, this.x + (this.width - valueMetric.width) / 2, this.y - (valueMetric.actualBoundingBoxAscent + valueMetric.actualBoundingBoxDescent) / 2);
    ctx.fillText(this.name, this.x + (this.width - nameMetric.width) / 2, this.y - (nameMetric.actualBoundingBoxAscent + nameMetric.actualBoundingBoxDescent) * 2);

    ctx.restore();

    //drawCirc(this.rotationPointX(), this.rotationPointY()); // rotation point
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

    let rotateLeftNode = this.getNodeLeft();

    let rotateRightNode = this.getNodeRight();

    let r = 5;

    let dx1 = x - rotateLeftNode.x;
    let dx2 = x - rotateRightNode.x;

    let dy1 = y - rotateLeftNode.y;
    let dy2 = y - rotateRightNode.y;

    let dist1 = Math.sqrt((dx1 * dx1) + (dy1 * dy1));
    let dist2 = Math.sqrt((dx2 * dx2) + (dy2 * dy2));


    if (dist1 <= r) return this.node1;

    if (dist2 <= r) return this.node2;

    return null;
  }

  getNodeLeft() {
    let pos = rotatePoint(
      {x: this.x - this.width, y: this.y + this.height / 2}, 
      {x: this.rotationPointX(), y: this.rotationPointY()}, 
      this.angle
    );
    pos.x = snapToGrid(pos.x);
    pos.y = snapToGrid(pos.y);
    return pos;
  }

  getNodeRight() {
    let pos = rotatePoint(
      {x: this.x + this.width * 2, y: this.y + this.height / 2}, 
      {x: this.rotationPointX(), y: this.rotationPointY()},
      this.angle
    );
    pos.x = snapToGrid(pos.x);
    pos.y = snapToGrid(pos.y);
    return pos;
  }

  onDelete() {
    deleteNode(this.node1);
    deleteNode(this.node2);
  }

  }
