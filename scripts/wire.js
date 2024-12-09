class Wire {
  constructor() {
    this.className = "Wire";
    this.selected = false;

    this.node1 = new Node(); // x y
    this.node2 = new Node(); // x y

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


    if (this.node1.x && this.node1.y && this.node2.y && this.node2.x) {
      ctx.beginPath();
      
      ctx.moveTo(this.node1.x, this.node1.y);
      ctx.lineTo(this.node2.x, this.node2.y);
      
      ctx.stroke();
      ctx.closePath();
      ctx.restore();
    }
  }
  hitTest(x,y) {
    // thanks https://www.jeffreythompson.org/collision-detection/line-point.php
    // 
    const TOLERANCE = 0.5;
    
    let distX = this.node1.x - this.node2.x;
    let distY = this.node1.y - this.node2.y;

    let length = Math.sqrt((distX * distX) + (distY * distY));

    let p1 = Math.sqrt(Math.pow(x - this.node1.x, 2) + Math.pow(y - this.node1.y, 2));
    let p2 = Math.sqrt(Math.pow(x - this.node2.x, 2) + Math.pow(y - this.node2.y, 2));

    let sum = p1 + p2;
    
    return (sum >= (length - TOLERANCE)  && sum <= (length + TOLERANCE));
  }

  hitNode(x,y) {
    return this.node1.hitTest(x,y) ? this.node1 : this.node2.hitTest(x,y) ? this.node2 : null;
  }

  onDelete() {
    deleteNode(this.node1);
    deleteNode(this.node2);
  }
}
