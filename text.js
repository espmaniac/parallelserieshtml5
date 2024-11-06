class Text {
    constructor(value) {
        this.value = value;
        this.x = null;
        this.y = null;
        this.parent = null;
        this.angle = 0;
        this.flipY = 1;
        this.flipX = 1;
        this.font = "bold 12px sans-serif";

        this.selected = false;
    }

    width() {
        ctx.save();
        ctx.font = this.font;
        let w = ctx.measureText(this.value).width; 
        ctx.restore();
        return w;
    }


    height() {
        ctx.save();
        ctx.font = this.font;
        let t = ctx.measureText(this.value);
        let h = t.actualBoundingBoxAscent + t.actualBoundingBoxDescent; 
        ctx.restore();
        return h;
    }

    rotationPointX() {
        return this.x + this.width()/2;
    }

    rotationPointY() {
        return this.y + this.height()/2;
    }

    draw() {
        ctx.save();
        
        ctx.fillStyle = "#FF0000";
        ctx.textAlign = "left";
        
        ctx.font = this.font;

        let drawX = this.x + Math.abs(this.width() - this.parent.width)/2;
        let drawY = this.y;

        ctx.translate(this.parent.rotationPointX(), this.parent.rotationPointY());
        ctx.rotate(this.angle * (Math.PI / 180));
        ctx.translate(-this.parent.rotationPointX(), -this.parent.rotationPointY());
        
        
        ctx.scale(this.flipX, this.flipY);

        drawX = this.x + Math.abs(this.width() - this.parent.width)/2;
        drawY = this.y;

        if (this.selected) {
            ctx.strokeStyle = "#FF0000";
            ctx.fillStyle = "#FF0000";
        }
        else {
            ctx.strokeStyle = "#000000";
            ctx.fillStyle = "#000000";
        }
    

        if (this.flipX === -1) {
            drawX *= -1;
            drawX -= this.width();
        }
        
        if (this.flipY === -1) {
            drawY *= -1;
            drawY += this.height();
        }

        
        
        ctx.fillText(this.value, drawX, drawY);

        
        ctx.restore();
        
    }

    rotate(angle) {

        this.angle += angle;

        this.angle %= 360;

        let absAngle = Math.abs(this.angle);

        if (absAngle >= 135 && absAngle < 270) {
            this.flipX = -1;
            this.flipY = -1;
            
        }
        else {
            this.flipX = 1;
            this.flipY = 1;
        }

    }
}