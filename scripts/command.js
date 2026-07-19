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
        this.save = null; // wire index, label node
    }
    execute() {
        
        switch(this.element.className) {
            case "Component":
                delete scheme.components[this.element.name.value];
                break;
            case "Wire":
                  this.save = scheme.wires.findIndex((w) => { return w == this.element});
                  scheme.wires.splice(this.save,1);
                break;

            case "LabelNode":

                this.save = this.element.node;
                break;

            case "GraphLabelNode":
                this.save = {
                    index: scheme.labels.findIndex((l) => { return l == this.element; }), 
                    node: this.element.node
                };
                scheme.labels.splice(this.save.index,1);
                break;

            default: return;
        }

        this.element.onDelete();
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
                scheme.wires.splice(this.save, 0, wire);
                tryConnect(wire);
                break;

            case "LabelNode":
                this.element.node = this.save;
                break;

            case "GraphLabelNode":
                this.element.node = this.save.node;
                scheme.labels.splice(this.save.index, 0, this.element);
                break;    

            default: break;
        }
    }
}

class AddComponent extends Command {
    constructor(x, y, options = null) {
        super();
        this.name = "AddComponent";
        this.x = x;
        this.y = y;

        const settings = options || {};
        const pos = settings.worldSpace
            ? { x: settings.x, y: settings.y }
            : scheme.screenToWorldSpace(this.x, this.y);
        const componentName = settings.name ||
            choosenComponent.shortName + Component.nameCount.toString();
        const componentValue = settings.value === undefined
            ? choosenComponent.defaultValue
            : settings.value;
        this.component = new Component(
            componentName,
            componentValue,
            snapToGrid(pos.x),
            snapToGrid(pos.y),
            settings.angle || 0
        );
        this.componentKey = componentName;

        this.delete = null;
    }

    static fromWorld(name, value, x, y, angle = 0) {
        return new AddComponent(0, 0, {
            worldSpace: true,
            name: name,
            value: value,
            x: x,
            y: y,
            angle: angle
        });
    }

    execute() {

        if (this.delete) {
            this.delete.unexecute();
            this.delete = null;
        }
        else {
            scheme.components[this.componentKey] = this.component;
            tryConnect(this.component);
        }
        Component.nameCount++;
    }
    unexecute() {
        this.delete = new DeleteElement(this.component);
        this.delete.execute();
        --Component.nameCount;
    }
}

class ChangeComponentValue extends Command {
    constructor(component, value) {
        super();
        this.name = "ChangeComponentValue";
        this.newValue = value;
        this.oldValue = null;
        this.oldDisplayValue = undefined;
        this.component = component;
    }

    execute() {
        this.oldValue = this.component.value.value;
        this.oldDisplayValue = this.component.value.displayValue;
        this.component.value.value = this.newValue;
        this.component.value.displayValue = undefined;
    }

    unexecute() {
        this.component.value.value = this.oldValue;
        this.component.value.displayValue = this.oldDisplayValue;
    }

}

class RotateComponent extends Command {
    constructor(component, value) {
        super();
        this.name = "RotateComponent";
        this.value = value;
        this.component = component;
    }

    ifComponent() {
        if (this.component.className === "Component") {
            this.component.update();
            this.component.updateConnections();
            tryConnect(this.component);
        }
    }

    execute() {
        this.component.rotate(this.value);
        this.ifComponent();
    }
    unexecute() {
        this.component.rotate(-this.value);
        this.ifComponent();
    }
}

class DragComponent extends Command {
    constructor(component, oldPosition = null) {
        super();
        this.name = "DragComponent";
        this.component = component;
        this.oldPosX = oldPosition ? oldPosition.x : this.component.x;
        this.oldPosY = oldPosition ? oldPosition.y : this.component.y;
        this.posX = null;
        this.posY = null;
    }

    toWorld(x, y) {
        this.posX = snapToGrid(x);
        this.posY = snapToGrid(y);
        return this;
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
    constructor(wire = null) {
        super();
        this.name = "DrawWire";
        this.wire = wire || new Wire();
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

    fromWorld(x, y) {
        this.x1 = snapToGrid(x);
        this.y1 = snapToGrid(y);
        this.wire.nodes[0].x = this.x1;
        this.wire.nodes[0].y = this.y1;
        return this;
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

    toWorld(x, y) {
        this.x2 = snapToGrid(x);
        this.y2 = snapToGrid(y);
        this.wire.nodes[1].x = this.x2;
        this.wire.nodes[1].y = this.y2;
        return this;
    }

    static between(x1, y1, x2, y2) {
        return new DrawWire().fromWorld(x1, y1).toWorld(x2, y2);
    }

    execute() {
        if (this.delete) {
            this.delete.unexecute();
            this.delete = null;
        }
        else if (!scheme.wires.includes(this.wire)) {
            scheme.wires.push(this.wire);
        }

        tryConnect(this.wire);

    }

    unexecute() {
        this.delete = new DeleteElement(this.wire);
        this.delete.execute();
    }
}

class SetLabelNode extends Command {
    constructor(label, node) {
        super();
        this.name = "SetLabelNode";
        this.label = label;
        this.node = node;
    }


    setNode() {
        let node = this.label.node;
        this.label.node = this.node;
        this.node = node;
    }

    execute() {
        this.setNode();
    }

    unexecute() {
        this.setNode();
    }
}

class AddLabelNode extends Command {
    constructor(label, className = null) {
        super();
        this.label = typeof label === "string" ? new LabelNode(label) : label;
        if (className) this.label.className = className;
        this.name = "AddLabelNode";
        this.index = null;
    }

    execute() {
        if (scheme.labels.includes(this.label)) return;
        this.index = scheme.labels.length;
        scheme.labels.push(this.label);
    }

    unexecute() {
        const index = scheme.labels.indexOf(this.label);
        if (index >= 0) scheme.labels.splice(index, 1);
    }

}

class MacroCommand extends Command {
    constructor(label = "Grouped changes") {
        super();
        this.cmds = [];
        this.name = "MacroCommand";
        this.label = label;
        this.appliedCount = 0;
        this.executionLimit = null;
    }

    addCommand(cmd) {
        this.cmds.push(cmd);
    }

    insertExecutedCommands(commands) {
        if (!Array.isArray(commands) || commands.length === 0) return;

        this.cmds.splice(this.appliedCount, 0, ...commands);
        this.appliedCount += commands.length;
        if (this.executionLimit !== null) {
            this.executionLimit += commands.length;
        }
    }

    setExecutionLimit(count) {
        if (count === null || count === undefined) {
            this.executionLimit = null;
            return;
        }

        this.executionLimit = Math.max(0, Math.min(this.cmds.length, count));
    }

    seek(count) {
        const target = Math.max(0, Math.min(this.cmds.length, count));

        while (this.appliedCount < target) {
            this.cmds[this.appliedCount].execute();
            this.appliedCount++;
        }

        while (this.appliedCount > target) {
            this.appliedCount--;
            this.cmds[this.appliedCount].unexecute();
        }

        return this.appliedCount;
    }

    execute() {
        const target = this.executionLimit === null
            ? this.cmds.length
            : this.executionLimit;
        this.seek(target);
    }

    unexecute() {
        this.seek(0);
    }

}
