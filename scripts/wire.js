class Wire {
  constructor() {
    this.className = "Wire";
    this.selected = false;

    this.nodes = [new Node(), new Node()];
    this.nodes[0].parent = this;
    this.nodes[1].parent = this;

    connectNodes(this.nodes[0], this.nodes[1], "0");
  }
  draw() {
    ctx.save();

    if (this.selected)
        ctx.strokeStyle = "#FF0000";
    else
        ctx.strokeStyle = "#000000";


    if (this.nodes[0].x && this.nodes[0].y && this.nodes[1].y && this.nodes[1].x) {
      ctx.beginPath();
      
      ctx.moveTo(this.nodes[0].x, this.nodes[0].y);
      ctx.lineTo(this.nodes[1].x, this.nodes[1].y);
      
      ctx.stroke();
      ctx.closePath();
      ctx.restore();
    }
  }
  hitTest(x,y, tolerance = 0.5) {
    // thanks https://www.jeffreythompson.org/collision-detection/line-point.php
    
    let distX = this.nodes[0].x - this.nodes[1].x;
    let distY = this.nodes[0].y - this.nodes[1].y;

    let length = Math.sqrt((distX * distX) + (distY * distY));

    let p1 = Math.sqrt(Math.pow(x - this.nodes[0].x, 2) + Math.pow(y - this.nodes[0].y, 2));
    let p2 = Math.sqrt(Math.pow(x - this.nodes[1].x, 2) + Math.pow(y - this.nodes[1].y, 2));

    let sum = p1 + p2;
    
    return (sum >= (length - tolerance)  && sum <= (length + tolerance));
  }

  onDelete() {
    deleteNode(this.nodes[0]);
    deleteNode(this.nodes[1]);
    this.selected = false;
  }

  toJSON() {
    return {
      x1: this.nodes[0].x,
      y1: this.nodes[0].y,
      x2: this.nodes[1].x,
      y2: this.nodes[1].y
    };
  }
}