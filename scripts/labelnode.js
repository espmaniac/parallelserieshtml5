class LabelNode {
    constructor(value) {
        this.className = "LabelNode";
        this.label = new Text(value);
        this.label.value = value;
        this.label.parent = this;
        this.node = null;
        this.label.rotationPointX = function() { return this.parent.rotationPointX(); };
        this.label.rotationPointY = function() { return this.parent.rotationPointY(); };

        this.selected = false;

        this.offX = 0;
        this.offY = - 15;
        this.radius = 5;
    }

    rotationPointX() {
        return this.node.x; 
    }
    
    rotationPointY() { 
        return this.node.y; 
    }

    select(s) {
        this.selected = s;
        this.label.selected = s;
    }

    draw() {
        if (!this.node) return;
        ctx.save();
        if (this.selected) {
            ctx.fillStyle = "#FF0000";
        }
        else {
            if (this.node.connections.length <= 0) { // bad node
                ctx.fillStyle = "#000000";
             }
            else
                ctx.fillStyle = "#00AAFF";
        }
        ctx.beginPath();
        ctx.arc(this.node.x, this.node.y, this.radius, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.fill();

        ctx.restore();

        this.label.x = this.node.x + this.offX;
        this.label.y = this.node.y + this.offY;
        this.label.draw();
    }

    rotate(angle) {
        this.label.rotate(angle);
    }

    onDelete() {
        this.select(false);
        this.node = null;
    }

    hitTest(x,y) {
        return (!this.node) ? false : (this.label.hitTest(x,y) || this.node.hitTest(x,y));
    }

}