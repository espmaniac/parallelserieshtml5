

class Junction {
  constructor() {
      this.x = null;
      this.y = null;

      this.nodes = [];
  }

  draw() {
      ctx.save();
      ctx.fillStyle = "#000000";
      ctx.beginPath();

      ctx.arc(this.x, this.y, 
        3, // radius
        0, 2 * Math.PI
      );

      ctx.fill();
      ctx.closePath();
      ctx.restore();
  }

  hitTest(x,y) {
    return (x === this.x && y === this.y) ? true : false;
  }

  onDelete() {
    for (let i = 0; i < this.nodes.length; ++i) {
      let node = this.nodes[i];
      for (let j = 0; j < node.junctions.length; ++j)
        if (node.junctions[j] === this) {
          node.junctions.splice(j, 1);
          break;
        } 
    }

    this.nodes = [];
  }

}