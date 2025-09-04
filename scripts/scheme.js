
const snapAngle = 45;
const cellSize = 20; // grid size


const MIN_SCALE = 0.5;
const MAX_SCALE = 3;


var scheme = {
    zoom: 1.0,
    offsetX: -canvas.width / 2,
    offsetY: -canvas.height / 2,

    tool: "SELECT", // "SELECT", "WIRE"

    panOffX: 0,
    panOffY: 0,

    components: {},
    selectedComponents: [],
    wires: [],
    selectedWires: [],
    junctions: [],
    labels: [new LabelNode("StartNode"), new LabelNode("DestNode")],

    undoStack: [],
    redoStack: [],

    isDragging: false,
    isPanning: false,
    isMouseHover: false,


    _drawGrid() {
        let gridSize = cellSize * this.zoom;

        // Calculate the number of cells that fit in the visible area
        const numCellsX = Math.ceil(canvas.width / gridSize);
        const numCellsY = Math.ceil(canvas.height / gridSize);
      
        let gridOffsetX = this.offsetX * this.zoom % gridSize;
        let gridOffsetY = this.offsetY * this.zoom % gridSize;
      
        // infinite grid illusion
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = "#cecece";
        ctx.lineWidth = 1;
      
        // draw vectical lines
        for (let i = 0; i <= numCellsX; i++) {
          let x = gridOffsetX + i * gridSize;
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
        }
      
        // draw horizontal lines
        for (let i = 0; i <= numCellsY; i++) {
          let y = gridOffsetY + i * gridSize;
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
        }
      
        ctx.stroke();
        ctx.closePath();
        ctx.restore();
    },


    renderAll() {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0,0, canvas.width, canvas.height);
        this._drawGrid(); 
        
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(this.offsetX, this.offsetY);   
        
        for (var i in this.components)
            this.components[i].draw();

        for (let i = 0; i < this.wires.length; ++i)
            this.wires[i].draw();
        
        
        for (let i = 0; i < this.junctions.length; ++i)
            this.junctions[i].draw();

        for (let i = 0; i < this.labels.length; ++i)
          this.labels[i].draw();



        let drawNodes = function(nodes) {
          for (let i = 0; i < nodes.length; ++i) {
            let labelNode = new LabelNode("N" + i);
            labelNode.node = nodes[i];
            labelNode.offX = 0;
            labelNode.offY = labelNode.label.height()/2;
            labelNode.radius = labelNode.label.width();
            labelNode.draw();
          }

        }

        if (!context_menu.hidden()) {
          for (let i in this.selectedWires) {
            drawNodes(this.wires[this.selectedWires[i]].nodes);
          }
          for (let i in this.selectedComponents) {
            drawNodes(this.selectedComponents[i].nodes);
          }
        }
    },

    worldToScreen(worldX, worldY) {
        let screenX = (worldX - this.offsetX) * this.zoom;
        let screenY = (worldY - this.offsetY) * this.zoom;
        return {x: screenX, y: screenY};
    },

    screenToWorldSpace(screenX, screenY) {
        let worldX = (screenX / this.zoom) - this.offsetX;
        let worldY = (screenY / this.zoom) - this.offsetY;
        return {x: worldX, y: worldY};
    },

    Zoom(value, posX, posY) {

        let prevX = (cursor.touches) ? ((cursor.touches[0].clientX + cursor.touches[1].clientX) / 2) : posX;
        let prevY = (cursor.touches) ? ((cursor.touches[0].clientY + cursor.touches[1].clientY) / 2) : posY;
            
        let previousPos = this.screenToWorldSpace(prevX, prevY);
    
        this.zoom = Math.max(MIN_SCALE, Math.min(value, MAX_SCALE));
    
        let currentPos = this.screenToWorldSpace(posX, posY);
    
        
        cursor.offsetX += currentPos.x - previousPos.x;
        cursor.offsetY += currentPos.y - previousPos.y;
    
        this.offsetX += currentPos.x - previousPos.x;
        this.offsetY += currentPos.y - previousPos.y;
  
        this.renderAll();
    },
    
    Pan(posX, posY) {
        let prev = this.screenToWorldSpace(posX, posY);
            
        this.offsetX -= (this.panOffX - posX) / this.zoom;
        this.offsetY -= (this.panOffY - posY) / this.zoom;
        
        let current = this.screenToWorldSpace(posX, posY);
        cursor.offsetX -= current.x - prev.x;
        cursor.offsetY -= current.y - prev.y;
    },


    trySelectComponent(cursorX, cursorY) {
        if (this.isDragging) return;
      
      
        const virtualPos = this.screenToWorldSpace(cursorX, cursorY);
      
        if (this.selectedComponents.length)
         this.selectedComponents[0].select(false);

        this.selectedComponents.length = 0;
        this.selectedWires.length = 0;
      
        for (let i in this.components) {
          let component = this.components[i];
          if (component.hitTest(virtualPos.x, virtualPos.y))
          { 
            this.isDragging = true;
            this.selectedComponents.push(component);
            component.select(true);
            cursor.offsetX = cursorX / this.zoom - component.x;
            cursor.offsetY = cursorY / this.zoom - component.y;
            toolmgr.activeCmd = new DragComponent(component);
            break;
          } else {
            component.select(false);
          }
        }
    
    },

    trySelectWires(cursorX, cursorY) {
    
        const virtualPos = this.screenToWorldSpace(cursorX, cursorY);
      
        for (let i = 0;  i < this.wires.length; ++i) {
          let wire = this.wires[i];
      
          if (!this.isDragging) {
            wire.selected = wire.hitTest(virtualPos.x, virtualPos.y);
            if (wire.selected && this.selectedWires.length <= 0) {this.selectedWires.push(i);}
            else
              wire.selected = false; // multiple selection at the same point
          }
          else
            wire.selected = false;
        }
    
    },

    trySelectLabel(cursorX, cursorY) {
      const virtualPos = this.screenToWorldSpace(cursorX, cursorY);
      for (let i in this.labels) {
        let label = this.labels[i];
        if (label.hitTest(virtualPos.x, virtualPos.y)) {
          label.select(true);
        } else
          label.select(false);
      }
    },

    execute(cmd) {
      if(!cmd) return;
      
      cmd.execute();

      this.undoStack.push(cmd);

      if (this.redoStack.length > 0) {
        this.redoStack = [];
      }
  
      this.renderAll();
    },

    undo() {
      if ((this.undoStack.length - 1) < 0) return;
      let cmd = this.undoStack[this.undoStack.length - 1];
      this.undoStack.pop();
      cmd.unexecute();
      this.redoStack.push(cmd);

      this.renderAll();
    },

    redo() {
      if ((this.redoStack.length - 1) < 0) return;

      let cmd = this.redoStack[this.redoStack.length - 1];
      cmd.execute();
      this.redoStack.pop();
      this.undoStack.push(cmd);

      this.renderAll();
    },

    serialize() {

      let labels = [];

      for (let i = 0; i < this.labels.length; ++i) {
        let l = this.labels[i];
        if (l.className === "LabelNode") {
          let label = {
            text: l.label.value,
            angle: l.label.angle,
            nodeX: null,
            nodeY: null,
            nodeParent: null,
            offX: l.offX,
            offY: l.offY,
            radius: l.radius
          };
          if (l.node) {
            label.nodeX = l.node.x,
            label.nodeY = l.node.y,
            label.nodeParent = (l.node.parent.className === "Component") ? 
              {type: "Component", value: l.node.parent.name.value}  : 
              {type: "Wire", value: this.wires.findIndex((n) => {
                return (n === l.node.parent);
              })};
          
          }
          labels.push(label);
        }
      }

      let save = {
        component: choosenComponent.shortName,
        ComponentNameCount: Component.nameCount,
        zoom: this.zoom,
        offsetX: Math.round(this.offsetX),
        offsetY: Math.round(this.offsetY),
        components: this.components,
        wires: this.wires,
        labels: labels
      };

      let json = JSON.stringify(save);
      
      
      return json;
    },

    deserialize(jsn) {
      let json = JSON.parse(jsn);

      if (!json) return;

      this.clear();

      Component.nameCount = json.ComponentNameCount;
      this.zoom = json.zoom;
      this.offsetX = json.offsetX;
      this.offsetY = json.offsetY;

      selectComponent(json.component);

      for (let c in json.components) {
        let component = json.components[c];
        this.components[c] = new Component(
          c.toString(), 
          component.value, 
          component.x, 
          component.y,
          component.angle
        );
      }

      for (let w in json.wires) {
        let wire = json.wires[w];
        let newWire = new Wire();
        newWire.nodes[0].x = wire.x1;
        newWire.nodes[0].y = wire.y1;
        newWire.nodes[1].x = wire.x2;
        newWire.nodes[1].y = wire.y2;
        this.wires.push(newWire);
      }

      for (let c in this.components) tryConnect(this.components[c]);
      for (let w in this.wires) tryConnect(this.wires[w]);

      this.labels = [];

      for (let jl in json.labels) {
        let l = json.labels[jl];
        let label = new LabelNode(l.text);
        label.label.rotate(l.angle);
        label.offX = l.offX;
        label.offY = l.offY;
        label.radius = l.radius;

        if (l.nodeParent) {
          let nodes = (l.nodeParent.type === "Component") ? 
            this.components[l.nodeParent.value].nodes :
            this.wires[l.nodeParent.value].nodes;

          new SetLabelNode(label, nodes.find((n) => {
            return n.hitTest(l.nodeX, l.nodeY);
          })).execute();

        }
        this.labels.push(label);

        
      }

      this.renderAll();
    },

    clear() {
        this.components = {};
        this.wires = [];
        this.selectedWires = [];
        this.selectedComponents = [];
        this.junctions = [];
        this.undoStack = [];
        this.redoStack = [];
        this.labels[0].node = null;
        this.labels[1].node = null;
        this.labels.splice(2);

        Component.nameCount = 1;
    }

};


function snapToGrid(point) {
    return Math.round(point / (cellSize / 2)) * (cellSize / 2);
}
  
function snapToAngle(startPoint, endPoint) {
    const deltaX = endPoint.x - startPoint.x;
    const deltaY = endPoint.y - startPoint.y;
    const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
    const snappedAngle = Math.round(angle / snapAngle) * snapAngle;
    const radians = snappedAngle * Math.PI / 180;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  
    endPoint = { // snap to angle and snap to grid
      x: startPoint.x + snapToGrid(Math.cos(radians) * distance),
      y: startPoint.y + snapToGrid(Math.sin(radians) * distance)
    };
  
    return endPoint;
}

function rotatePoint(point, center, angle) {
    let angleRad = angle * Math.PI / 180;
    
    let sinAngle = Math.sin(angleRad);
    let cosAngle = Math.cos(angleRad);
    
    let translatedX = point.x - center.x;
    let translatedY = point.y - center.y;
    
    let rotatedX = translatedX * cosAngle - translatedY * sinAngle;
    let rotatedY = translatedX * sinAngle + translatedY * cosAngle;
    
    return { x: rotatedX + center.x, y: rotatedY + center.y };
}
