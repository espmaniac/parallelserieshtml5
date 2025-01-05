class Command {
    constructor() {
        this.name = "";
    }

    execute() {}
};


class DeleteElement extends Command {
    constructor(elem) {
        super();
        this.name = "DeleteElement";
        this.element = elem;
        this.deletedIndex = -1;
    }
    execute() {
        this.element.onDelete();
        switch(this.element.className) {
            case "Component":
                delete scheme.components[this.element.name.value];
                break;
            case "Wire":
                let wire = this.element;
                for (let i = 0; i < scheme.wires.length; ++i) {
                    let w = scheme.wires[i];
                    if (wire === w) {
                      scheme.wires.splice(i, 1);
                      this.deletedIndex = i;
                      break;
                    }
                  }
                break;
        }

        scheme.selectedComponents = [];
        scheme.selectedWires = [];

    }
    unexecute() {
        switch(this.element.className) {
            case "Component":
                let component = this.element;
                component.update();
                component.updateConnections();
                scheme.components[this.element.name.value] = component;
                tryConnect(component);
                break;

            case "Wire":
                let wire = this.element;
                connectNodes(wire.nodes[0], wire.nodes[1], "0");
                scheme.wires.splice(this.deletedIndex, 0, wire);
                tryConnect(wire);
                break;
        }
    }
}

class AddComponent extends Command {
    constructor(x,y) {
        super();
        this.name = "AddComponent";
        this.x = x;
        this.y = y;

        let pos = scheme.screenToWorldSpace(this.x, this.y);
        this.component = new Component(
            choosenComponent.shortName + count.toString(), 
            choosenComponent.defaultValue, 
            snapToGrid(pos.x), 
            snapToGrid(pos.y)
        );

        this.delete = null;
    }
    execute() {

        if (this.delete) {
            this.delete.unexecute();
        }
        else {
            scheme.components[choosenComponent.shortName + count.toString()] = this.component;
            tryConnect(this.component);
        }
        count++;
    }
    unexecute() {
        this.delete = new DeleteElement(this.component);
        this.delete.execute();
        --count;
    }
}

class ChangeComponentValue extends Command {
    constructor(component, value) {
        super();
        this.name = "ChangeComponentValue";
        this.newValue = value;
        this.oldValue = null;
        this.component = component;
    }

    execute() {
        this.oldValue = this.component.value.value;    
        
        this.component.value.value = this.newValue;
    }

    unexecute() {
        this.component.value.value = this.oldValue;
    }

}

class RotateComponent extends Command {
    constructor(component, value) {
        super();
        this.name = "RotateComponent";
        this.value = value;
        this.component = component;
    }
    execute() {
        this.component.rotate(this.value);
        this.component.update();
        this.component.updateConnections();
        tryConnect(this.component);
    }
    unexecute() {
        this.component.rotate(-this.value);
        this.component.update();
        this.component.updateConnections();
        tryConnect(this.component);
    }
}

class DragComponent extends Command {
    constructor(component) {
        super();
        this.name = "DragComponent";
        this.component = component;
        this.oldPosX = this.component.x;
        this.oldPosY = this.component.y;
        this.posX = null;
        this.posY = null;
    }
    move(cursorX,cursorY, onMove) {
        this.posX = (cursorX / scheme.zoom) - cursor.offsetX;
        this.posY = (cursorY / scheme.zoom) - cursor.offsetY;
      
        if (!onMove) {
          this.posX = snapToGrid(this.posX);
          this.posY = snapToGrid(this.posY);
        }
      
        this.component.move(this.posX,this.posY, onMove);
    }
    execute() {
        this.component.move(this.posX,this.posY,false);
        this.component.updateConnections();
        tryConnect(this.component);
    }
    unexecute() {
        this.component.move(this.oldPosX, this.oldPosY, false);
        this.component.updateConnections();
        tryConnect(this.component);
    }
};

class DrawWire extends Command {
    constructor(wire) {
        super();
        this.name = "DrawWire";
        this.wire = wire;
        this.x1= null;
        this.y1 = null;
        this.x2 = null;
        this.y2 = null;
        this.delete = null;
    }
    from(x,y) {
        const virtualPos = scheme.screenToWorldSpace(x, y);
        this.x1 = snapToGrid(virtualPos.x);
        this.y1 = snapToGrid(virtualPos.y);
        this.wire.nodes[0].x = this.x1;
        this.wire.nodes[0].y = this.y1;

    }
    to(x,y) {
        const virtualPos = scheme.screenToWorldSpace(x, y);
        let wire = this.wire;
        let cursorTo = snapToAngle(
          {x: wire.nodes[0].x, y: wire.nodes[0].y}, 
          {x: virtualPos.x, y: virtualPos.y}
        );
        
        this.x2 = snapToGrid(cursorTo.x);
        this.y2 = snapToGrid(cursorTo.y);

        wire.nodes[1].x = this.x2;
        wire.nodes[1].y = this.y2;

    }

    execute() {
        if (this.delete) {
            this.delete.unexecute();
            this.delete = null;
        }

        tryConnect(this.wire);

    }

    unexecute() {
        this.delete = new DeleteElement(this.wire);
        this.delete.execute();
    }
}