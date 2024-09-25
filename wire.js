class Wire {
  constructor() {
    this.className = "Wire";
    this.x1 = 0;
    this.y1 = 0;
    this.x2 = NaN;
    this.y2 = NaN;
    this.selected = false;

    this.node1 = new Node(); // x1 y1
    this.node2 = new Node(); // x2 y2

    this.node1.parent = this;
    this.node2.parent = this;

    this.nodesOnLine = [];

    connectNodes(this.node1, this.node2, "0");
  }
  draw() {
    ctx.save();

    if (this.selected)
        ctx.strokeStyle = "#FF0000";
    else
        ctx.strokeStyle = "#000000";


    ctx.beginPath();
    ctx.moveTo(this.x1, this.y1);
    ctx.lineTo(this.x2, this.y2);
    
    ctx.stroke();
    ctx.closePath();
    ctx.restore();
  }
  hitTest(x,y) {
    // thanks https://www.jeffreythompson.org/collision-detection/line-point.php
    // 
    const TOLERANCE = 0.5;
    
    let distX = this.x1 - this.x2;
    let distY = this.y1 - this.y2;

    let length = Math.sqrt((distX * distX) + (distY * distY));

    let p1 = Math.sqrt(Math.pow(x - this.x1, 2) + Math.pow(y - this.y1, 2));
    let p2 = Math.sqrt(Math.pow(x - this.x2, 2) + Math.pow(y - this.y2, 2));

    let sum = p1 + p2;
    
    return (sum >= (length - TOLERANCE)  && sum <= (length + TOLERANCE));
  }

  hitNode(x,y) {
    if (x === this.x1 && y === this.y1) return this.node1;
    if (x === this.x2 && y === this.y2) return this.node2;
    return null;
  }

  onDelete() {
    deleteNode(this.node1);
    deleteNode(this.node2);
  }
}
