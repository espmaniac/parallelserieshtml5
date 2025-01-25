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
        this.align = "center";
        this.selected = false;
        this.color = "#000000";
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
        
        ctx.textAlign = this.align;
        
        ctx.font = this.font;

        let drawX = this.x;
        let drawY = this.y;
        let width = this.width();
        let height = this.height();

        ctx.translate(this.rotationPointX(), this.rotationPointY());
        ctx.rotate(this.angle * (Math.PI / 180));
        ctx.translate(-this.rotationPointX(), -this.rotationPointY());
        
        
        ctx.scale(this.flipX, this.flipY);

        if (this.selected) {
            ctx.strokeStyle = "#FF0000";
            ctx.fillStyle = "#FF0000";
        }
        else {
            ctx.strokeStyle = this.color;
            ctx.fillStyle = this.color;
        }
    

        if (this.flipX === -1) {
            drawX *= -1;
        }
        
        if (this.flipY === -1) {
            drawY *= -1;
            drawY += height;
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

    hitTest(x,y) {

        let rotatedPoint = rotatePoint(
            {x: x, y: y}, 
            {x: this.rotationPointX(), y: this.rotationPointY()}, 
            -this.angle
        );

        let width = this.width();
        let height = this.height();

        let difX = 0;

        switch(this.align) {
            case "right":
                difX = (this.flipX === -1) ? 0 : width;
                break;

            case "left":
                difX = (this.flipX === -1) ? width : 0;
                break;

            case "center" :
                difX = width/2;
                break;

            default: break;
        }


        if ((rotatedPoint.x >= (this.x - difX) && rotatedPoint.x <= (this.x + width - difX)) &&
            (rotatedPoint.y >= (this.y - height) && rotatedPoint.y <= (this.y)))
            return true;

      
        return false;
    }

}