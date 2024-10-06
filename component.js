
class Component {
  constructor(name, value, x, y) {
    this.className = "Component";
    this.name = name;
    this.value = value;
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

  move(x, y, onMove) {
    this.x = x;
    this.y = y;

    if (onMove) return;

    /* update onMouseUp */
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
    let r = 5;

    let dx1 = x - this.node1.x;
    let dx2 = x - this.node2.x;

    let dy1 = y - this.node1.y;
    let dy2 = y - this.node2.y;

    let dist1 = Math.sqrt((dx1 * dx1) + (dy1 * dy1));
    let dist2 = Math.sqrt((dx2 * dx2) + (dy2 * dy2));


    if (dist1 <= r) return this.node1;

    if (dist2 <= r) return this.node2;

    return null;
  }

  onDelete() {
    deleteNode(this.node1);
    deleteNode(this.node2);
  }

  }
