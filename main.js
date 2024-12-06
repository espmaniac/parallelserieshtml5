const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

var menu = document.getElementById("contextMenu");

var isDragging = false;
var isPanning = false;
var isMouseHover = false;

var panOffX = 0;
var panOffY = 0;

var cursorOffsetX = 0;
var cursorOffsetY = 0;

var touches = null;

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;

var tool = "SELECT"; // "SELECT", "SELECT_RECT", "WIRE"

var zoom = 1;

var offsetX = -canvas.width / 2;
var offsetY = -canvas.height / 2;

const snapAngle = 45;

var components = [];
var selectedComponents = [];
var wires = [];
var selectedWires = [];
var junctions = [];

const cellSize = 20; // grid size

let gridSize = cellSize;
let gridOffsetX = offsetX % gridSize;
let gridOffsetY = offsetY % gridSize;

var choosenComponent = {name: "", shortName: "", defaultValue: ""};

var count = 1; // component index


menu.addEventListener("click", function(event) {
  let target = event.target;
  
  if (target.children.length <= 0) {
    menu.style.display = "none";
  }

});


window.onload = function() {
  input.style.height = input.offsetHeight + "px";
  textAreaAutoHeight();
  input.oninput = textAreaAutoHeight;

  let chooseComponent = document.getElementById("chooseComponent");
  let chooseResistor = document.getElementById("resistor");
  let chooseCapactitor = document.getElementById("capacitor");
  let chooseInductor = document.getElementById("inductor");
  let addComponentIcon = document.getElementById("addComponent").children[0];

  chooseResistor.addEventListener("click", function() {
    choosenComponent = {name: "Resistor", shortName: "R", defaultValue: "1k"};
    addComponentIcon.src = "icons/res_eu.svg";
    onSeries = function(left, right) {
      return left + right;
    }
    onParallel = function(left, right) {
      return (left != 0 && right != 0) ? (1 / (1/left + 1/right)) : 0;
    }

    Component.prototype.drawComponent = function() {
      ctx.moveTo(this.x, this.y + this.height / 2);
      ctx.lineTo(this.x - this.width, (this.y + this.height / 2));
    
      ctx.moveTo(this.x + this.width, this.y + this.height / 2);
      ctx.lineTo(this.width*2 + this.x, (this.y + this.height / 2));
      ctx.rect(this.x, this.y, this.width, this.height);
    }

    chooseComponent.remove();
  });

  chooseCapactitor.addEventListener("click", function() {
    choosenComponent = {name: "Capacitor", shortName: "C", defaultValue: "1u"};
    addComponentIcon.src = "icons/capacitor.svg";
    onSeries = function(left, right) {
      return (left != 0 && right != 0) ? (1 / (1/left + 1/right)) : ((left > right) ? left : right);
    } 
    onParallel = function(left, right) {
			return (left != 0 && right != 0) ? (left + right) : 0;
    }

    Component.prototype.drawComponent = function() {
      
      ctx.fillRect(this.x + 15, this.y, 3, this.height);
      ctx.fillRect(this.x + this.width - 18, this.y, 3, this.height);

      ctx.moveTo(this.x + 15, this.y + this.height / 2);
      ctx.lineTo(this.x - this.width, (this.y + this.height / 2));
    
      ctx.moveTo(this.x + this.width - 15, this.y + this.height / 2);
      ctx.lineTo(this.width * 2 + this.x, (this.y + this.height / 2));
      
    }

    chooseComponent.remove();

  });
  
chooseInductor.addEventListener("click", function() {
  choosenComponent = {name: "Inductor", shortName: "L", defaultValue: "1u"};
  addComponentIcon.src = "icons/inductor.svg";
  onSeries = function(left, right) {
    return left + right;
  }
  onParallel = function(left, right) {
    return (left != 0 && right != 0) ? (1 / (1/left + 1/right)) : 0;
  }
  Component.prototype.drawComponent = function() {

    
    ctx.arc(this.x + 10, this.y + this.height / 2, 6, -Math.PI,
    0);

    ctx.arc(this.x + 20, this.y + this.height / 2, 6, -Math.PI,
    0);
    ctx.arc(this.x + 30, this.y + this.height / 2, 6, -Math.PI,
    0);



    ctx.moveTo(this.x + 4, this.y + this.height / 2);
    ctx.lineTo(this.x - this.width, (this.y + this.height / 2));
      
    ctx.moveTo(this.x + this.width - 4, this.y + this.height / 2);
    ctx.lineTo(this.width * 2 + this.x, (this.y + this.height / 2));

  }
  chooseComponent.remove();
  });

  let mainTools = document.getElementById("mainTools");
  let nodeTools = document.getElementById("nodeTools");
  let cursorTool = document.getElementById("cursorTool");
  let wireTool = document.getElementById("wireTool");

  function removeActive() {
    for (let i = 0; i < mainTools.children.length; ++i) {
      mainTools.children[i].classList.remove("active");
    }
    for (let i = 0; i < nodeTools.children.length; ++i) {
      nodeTools.children[i].classList.remove("active");
    }
  }

  cursorTool.addEventListener("click", function() {
    removeActive();
    this.classList.add("active");
    tool = "SELECT";
  });

  
  wireTool.addEventListener("click", function() {
    tool = "WIRE";
    removeActive();
    this.classList.add("active");
  });

}

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

function worldToScreen(worldX, worldY) {
  let screenX = (worldX - offsetX) * zoom;
  let screenY = (worldY - offsetY) * zoom;
  return {x: screenX, y: screenY};
}

function screenToWorldSpace(screenX, screenY) {
  let worldX = (screenX / zoom) - offsetX;
  let worldY = (screenY / zoom) - offsetY;
  return {x: worldX, y: worldY};
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

var btnAdd = document.getElementById("addComponent");
btnAdd.addEventListener("click", function() {
  let countStr = count.toString();
  components[choosenComponent.shortName + countStr] = (
    new Component(choosenComponent.shortName + countStr, choosenComponent.defaultValue, 
      snapToGrid(screenToWorldSpace(canvas.width / 2,0).x), 
      snapToGrid(screenToWorldSpace(0,canvas.height / 2).y)
    )
  );
  count += 1;
  renderAll();
});



function drawGrid() {
  gridSize = cellSize * zoom;

  // Calculate the number of cells that fit in the visible area
  const numCellsX = Math.ceil(canvas.width / gridSize);
  const numCellsY = Math.ceil(canvas.height / gridSize);

  gridOffsetX = offsetX * zoom % gridSize;
  gridOffsetY = offsetY * zoom % gridSize;

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
}



function renderAll() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0,0, canvas.width, canvas.height);
  drawGrid(); 

  ctx.scale(zoom, zoom);
  ctx.translate(offsetX, offsetY);   

  for (var i in components)
    components[i].draw();


  for (let i = 0; i < wires.length; ++i)
    wires[i].draw();


  for (let i = 0; i < junctions.length; ++i)
    junctions[i].draw();
      
}

document.addEventListener('keypress', function(e) { // rotate
  if (e.key === 'r' && selectedComponents.length > 0) {

    selectedComponents[0].rotate(45);

    if (!isDragging) {
      selectedComponents[0].update();
      updateComponentConnections(selectedComponents[0]);
    }
 
    renderAll();
  } 

  if (e.key === 'e' && selectedComponents.length > 0) {
    let newValue = prompt(`new ${selectedComponents[0].name} value`);
    selectedComponents[0].value.value = newValue;

    renderAll();
  }
});

function deleteSelected() {
  if (selectedComponents.length > 0) {
    selectedComponents[0].select(false);
    selectedComponents[0].onDelete();
    delete components[selectedComponents[0].name.value];
    selectedComponents.length = 0;
  }


  for (let i = 0, j = 0; i < selectedWires.length; ++i) {
    let index = selectedWires[i] - j;		
    wires[index].onDelete();
    wires.splice(index, 1);

    ++j;
  }

  selectedWires.length = 0;
}

document.addEventListener("keyup", function(e) { // delete
  if (((e.keyCode === 46) || (e.keyCode === 8)) && isMouseHover) {

    deleteSelected();

    renderAll();
  }
});


canvas.addEventListener("mouseleave", function (event) {
  isMouseHover = false;
}, false);

canvas.addEventListener("mouseover", function (event) {
  isMouseHover = true;
}, false);

function trySelectComponent(cursorX, cursorY) {
  if (isDragging) return;


  const virtualPos = screenToWorldSpace(cursorX, cursorY);

  if (selectedComponents.length)
    selectedComponents[0].select(false);
  selectedComponents.length = 0;
  selectedWires.length = 0;

  for (let i in components) {
    let component = components[i];
    if (component.hitTest(virtualPos.x, virtualPos.y))
    { 
      isDragging = true;
      selectedComponents.push(component);
      component.select(true);
      cursorOffsetX = cursorX / zoom - component.x;
      cursorOffsetY = cursorY / zoom - component.y;
      break;
    } else {
      component.select(false);
    }
  }
}

function trySelectWires(cursorX, cursorY) {
  const virtualPos = screenToWorldSpace(cursorX, cursorY);

  for (let i = 0;  i < wires.length; ++i) {
    let wire = wires[i];

    if (!isDragging) {
      wire.selected = wire.hitTest(virtualPos.x, virtualPos.y);
      if (wire.selected && selectedWires.length <= 0) {selectedWires.push(i);}
      else
        wire.selected = false; // multiple selection at the same point
    }
    else
      wire.selected = false;
  }
}

function tryDrawWireFrom(cursorX, cursorY) {
  if (isDragging) return;

  const virtualPos = screenToWorldSpace(cursorX, cursorY);

  if (tool === "WIRE" && selectedComponents.length <= 0) {
    let wire = new Wire();
    wire.node1.x = snapToGrid(virtualPos.x); 
    wire.node1.y = snapToGrid(virtualPos.y);
    wires.push(wire);
    isDragging = true;
  }
}

function tryDrawWireTo(cursorX, cursorY, finish) {
  const virtualPos = screenToWorldSpace(cursorX, cursorY);
  let wire = wires[wires.length - 1];
  let cursorTo = snapToAngle(
    {x: wire.node1.x, y: wire.node1.y}, 
    {x: virtualPos.x, y: virtualPos.y}
  );
    
  wire.node2.x = snapToGrid(cursorTo.x);
  wire.node2.y = snapToGrid(cursorTo.y);

  if (!finish) return;


  if (wire.node1.x === wire.node2.x && wire.node1.y === wire.node2.y) {
    wires.pop();
  }
  else {
    for (let i in components) {
      let component = components[i];
      connectComponentLine(component, wire);
    }

    for (let i = 0; i < wires.length - 1; ++i) { // last wire == current
      let w = wires[i];
      connectWireWire(wire, w);
      connectWireWire(w, wire);
      // one wire can be T-connected to another wire
    }
  }
}

canvas.addEventListener("contextmenu", function(event) {
  event.preventDefault();
  menu.style.display = "block";
  menu.style.left = event.clientX + "px";
  menu.style.top = event.clientY + "px";
});

canvas.addEventListener('mousedown', function(event) {
  const mouseX = event.clientX - canvas.getBoundingClientRect().left;
  const mouseY = event.clientY - canvas.getBoundingClientRect().top;

  menu.style.display = "none";

  if (event.button === 0) { // left btn

    if (tool === "SELECT") {
      trySelectComponent(mouseX, mouseY);
      trySelectWires(mouseX, mouseY);
    }

    tryDrawWireFrom(mouseX, mouseY);

  } 
  if (event.button === 1) { // wheel button
    isPanning = true;
    panOffX = mouseX;
    panOffY = mouseY;
    event.preventDefault();
  }


  renderAll();
    
});


canvas.addEventListener('mousemove', function(event) {
  let mouseX = event.clientX - canvas.getBoundingClientRect().left;
  let mouseY = event.clientY - canvas.getBoundingClientRect().top;
  
  if (isPanning) {
    let prev = screenToWorldSpace(mouseX, mouseY);

    offsetX -= (panOffX - mouseX) / zoom;
    offsetY -= (panOffY - mouseY) / zoom;
    panOffX = mouseX;
    panOffY = mouseY;

    let current = screenToWorldSpace(mouseX, mouseY);
    cursorOffsetX -= current.x - prev.x;
    cursorOffsetY -= current.y - prev.y;
    
  }

  else if (isDragging) {
    if (selectedComponents.length > 0) {
      dragComponent(mouseX, mouseY, true);
    } else {
      tryDrawWireTo(mouseX, mouseY, false);
    }
  }


  renderAll();
});

function connectComponentLine(component, wire) {
  let leftWireHit = component.hitNode(wire.node1.x,wire.node1.y);
  let rightWireHit = component.hitNode(wire.node2.x,wire.node2.y);

  if (leftWireHit) {  
    connectNodes(wire.node1, leftWireHit);
    if (leftWireHit.connections.length >= 3)
      junction(wire.node1.x, wire.node1.y, wire.node1, leftWireHit);
  }
  else if (rightWireHit) {
    connectNodes(wire.node2, rightWireHit);
    if (rightWireHit.connections.length >= 3)
      junction(wire.node2.x, wire.node2.y, wire.node2, rightWireHit);

  } else { // junction // T like connection
    let node1Intersect = wire.hitTest(component.node1.x, component.node1.y); // does the component point lie on the line?
    let node2Intersect = wire.hitTest(component.node2.x, component.node2.y);

    if (node1Intersect) {
      connectNodes(component.node1, wire.node1);
      connectNodes(component.node1, wire.node2);
      junction(component.node1.x, component.node1.y, component.node1, wire.node1);
      junction(component.node1.x, component.node1.y, component.node1, wire.node2);

      if(!wire.nodesOnLine.find(
        function(n) {
          n === component.node1;
      })) wire.nodesOnLine.push(component.node1);
      
    }
    if (node2Intersect) {
      connectNodes(component.node2, wire.node1);
      connectNodes(component.node2, wire.node2);
      junction(component.node2.x, component.node2.y, component.node2, wire.node1);
      junction(component.node2.x, component.node2.y, component.node2, wire.node2);

      if(!wire.nodesOnLine.find(
        function(n) {
          n === component.node1;
      })) wire.nodesOnLine.push(component.node2);
    }
  }
}

function connectComponentComponent(compn1, compn2) {
  if (compn1 === compn2) return;
  
  let hitNodeLeft = compn1.hitNode(compn2.node1.x, compn2.node1.y);

  if (hitNodeLeft != null){
    connectNodes(hitNodeLeft, compn2.node1);

    if (hitNodeLeft.connections.length >= 3)
      junction(compn2.node1.x, compn2.node1.y, hitNodeLeft, compn2.node1);
  } 

  let hitNodeRight = compn1.hitNode(compn2.node2.x, compn2.node2.y);

  if (hitNodeRight != null) {
    connectNodes(hitNodeRight, compn2.node2);

    if (hitNodeRight.connections.length >= 3)
      junction(compn2.node2.x, compn2.node2.y, hitNodeRight, compn2.node2);
  }

}

function connectJunctionNode(j, n) {
  for (let i = 0; i < n.junctions.length; ++i) {
    if (n.junctions[i] === j) return;
  }
  n.junctions.push(j);
  for (let i = 0; i < j.nodes.length; ++i) {
      if (j.nodes[i] === n) return;
  }
  j.nodes.push(n);
}

function junction(x,y, node1,node2) {
  let hitJunctionLeft = junctionAt(x, y, node1.junctions);
  let hitJunctionRight = junctionAt(x, y, node2.junctions);
  
  if (hitJunctionLeft) {
    connectJunctionNode(hitJunctionLeft, node2);
  }
  else if (hitJunctionRight) {
    connectJunctionNode(hitJunctionRight, node1);
  }
  else {
    let junction = new Junction();
    junction.x = x;
    junction.y = y;
    connectJunctionNode(junction, node2);
    connectJunctionNode(junction, node1);
    junctions.push(junction);
  }
}

function updateComponentConnections(component) {
  deleteNode(component.node1); // delete all connection
  deleteNode(component.node2); // delete all connection
  connectNodes(component.node1, component.node2);

  for (let i = 0; i < wires.length; ++i) {
    connectComponentLine(component, wires[i]);
  }

  for (let i in components) {
    connectComponentComponent(component, components[i]);

  }

  // Some connected nodes may have more than or equal to 3 connections and no junction
  // this solution seems to fix that problem
  if (component.node1.connections.length >= 3) {
    let pos = component.node1;
    junction(pos.x, pos.y, component.node1, component.node1.connections[1].node);
  }

  if (component.node2.connections.length >= 3) {
    let pos = component.node2;
    junction(pos.x, pos.y, component.node2, component.node2.connections[1].node);
  }
}

function deleteJunction(j) {
  if (!j) return;
  for (let i = 0; i < junctions.length; ++i) {
    if (junctions[i] === j) {
      j.onDelete();
      junctions.splice(i, 1);
      return;
    }
  }
}

function junctionAt(x,y, jArr) {
  for (let i = 0; i < jArr.length; ++i) {
    if (jArr[i].hitTest(x,y)) return jArr[i];
  }

  return null;
}

function connectWireWire(wire, w) {
  if (wire === w) return; 

  // Do the points wire.node1.x wire.node1.y && wire.node2.x wire.node2.y lie on the line w?

  let hitRight = w.hitTest(wire.node2.x, wire.node2.y);
  let hitLeft = w.hitTest(wire.node1.x, wire.node1.y);


  if (hitRight) {
    let node = w.hitNode(wire.node2.x, wire.node2.y); // whether the point wire.node2.x wire.node2.y lies on (w.x1 w.y1) || (w.x2 w.y2)
    if (node != null) {
      connectNodes(wire.node2, node);
      
      if ((node.connections.length - w.nodesOnLine.length) >= 3) { // junction
        junction(wire.node2.x, wire.node2.y, node, wire.node2);
      }
    }
    else { // junction // T like connection
      connectNodes(wire.node2, w.node1);
      connectNodes(wire.node2, w.node2);

      junction(wire.node2.x, wire.node2.y, w.node1, wire.node2);
      junction(wire.node2.x, wire.node2.y, w.node2, wire.node2);

      w.nodesOnLine.push(wire.node2);
    }
  } 
  else if (hitLeft) {
    let node = w.hitNode(wire.node1.x, wire.node1.y); // whether the point wire.node1.x wire.node1.y lies on (w.x1 w.y1) || (w.x2 w.y2)
    if (node != null) {
      connectNodes(wire.node1, node);
      if ((node.connections.length - w.nodesOnLine.length) >= 3) { // junction
        junction(wire.node1.x, wire.node1.y, node, wire.node1);
      }
    }
    else { // junction // T like connection
      connectNodes(wire.node1, w.node1);
      connectNodes(wire.node1, w.node2);

      
      junction(wire.node1.x, wire.node1.y, w.node1, wire.node1);
      junction(wire.node1.x, wire.node1.y, w.node2, wire.node1);


      w.nodesOnLine.push(wire.node1);
    }
  }
}

function dragComponent(cursorX, cursorY, onMove) {
  let component = selectedComponents[0];

  let posX = (cursorX / zoom) - cursorOffsetX;
  let posY = (cursorY / zoom) - cursorOffsetY;

  if (!onMove) {
    posX = snapToGrid(posX);
    posY = snapToGrid(posY);
  }

  component.move(posX, posY, onMove);

  if (!onMove)
    updateComponentConnections(component);
}

canvas.addEventListener('mouseup', function(event) {
    let mouseX = event.clientX - canvas.getBoundingClientRect().left;
    let mouseY = event.clientY - canvas.getBoundingClientRect().top;

    if (event.button === 0 && isDragging) {
      if (selectedComponents.length > 0) {
        dragComponent(mouseX, mouseY, false);

      } 
      else {
        tryDrawWireTo(mouseX, mouseY, true);
      }
      isDragging = false;
    }

    if (event.button === 1 && isPanning) {
      isPanning = false;
    }

    renderAll();
});

canvas.addEventListener('wheel', (event) => { // ZOOM
  let mouseX = event.clientX - canvas.getBoundingClientRect().left;
  let mouseY = event.clientY - canvas.getBoundingClientRect().top;

  const mousePosBefore = screenToWorldSpace(mouseX, mouseY);

  event.preventDefault();
  const oldZoom = zoom;
  
  const delta = Math.sign(event.deltaY);
  zoom -= delta * 0.25;

  zoom = Math.max(MIN_SCALE, Math.min(zoom, MAX_SCALE));

  const mousePosAfter = screenToWorldSpace(mouseX, mouseY);

  //offsetX = ((offsetX - mouseX) * (zoom / oldZoom)) + mouseX;
  //offsetY = ((offsetY - mouseY) * (zoom / oldZoom)) + mouseY;

  
  cursorOffsetX -= (mouseX / oldZoom);
  cursorOffsetX += (mouseX / zoom);
  cursorOffsetY -= (mouseY / oldZoom);
  cursorOffsetY += (mouseY / zoom);

  offsetX -= mousePosBefore.x - mousePosAfter.x;
  offsetY -= mousePosBefore.y - mousePosAfter.y;

  renderAll();

});

canvas.addEventListener("touchstart", function(event){
  event.preventDefault();


  touches = event.touches;

  let pointerX = event.touches[0].clientX - canvas.getBoundingClientRect().left;
  let pointerY = event.touches[0].clientY - canvas.getBoundingClientRect().top;

  if (tool === "SELECT") {

    trySelectComponent(pointerX, pointerY);
    trySelectWires(pointerX, pointerY);

    if (!selectedComponents.length && !selectedWires.length) {
      isPanning = true;
    }

  }

  panOffX = pointerX;
  panOffY = pointerY;

  tryDrawWireFrom(pointerX, pointerY);
});

canvas.addEventListener("touchmove", function(event) {
  event.preventDefault();

  let pointerX = event.touches[0].clientX - canvas.getBoundingClientRect().left;
  let pointerY = event.touches[0].clientY - canvas.getBoundingClientRect().top;

  if (touches.length !== event.touches.length) {
    panOffX = pointerX;
    panOffY = pointerY;

  }

  if (event.touches.length > 1) { // ZOOM
    
    let calcDistance = function(x1,y1, x2, y2) {
      return Math.sqrt(
        Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2)
      );
    }


    let distancePreviousTouches = calcDistance(touches[0].clientX, touches[0].clientY, 
      touches[1].clientX, touches[1].clientY);
    let distanceCurrentTouches = calcDistance(event.touches[0].clientX, event.touches[0].clientY, 
      event.touches[1].clientX, event.touches[1].clientY);

    let prevMidX = (touches[0].clientX + touches[1].clientX) / 2;
    let prevMidY = (touches[0].clientY + touches[1].clientY) / 2;

    let prev = screenToWorldSpace(prevMidX, prevMidY);

    zoom *= (distanceCurrentTouches / distancePreviousTouches);
    zoom = Math.max(MIN_SCALE, Math.min(zoom, MAX_SCALE));


    let midX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
    let midY = (event.touches[0].clientY + event.touches[1].clientY) / 2;

    let current = screenToWorldSpace(midX, midY);

    cursorOffsetX += current.x - prev.x;
    cursorOffsetY += current.y - prev.y;

    offsetX += current.x - prev.x;
    offsetY += current.y - prev.y;

      
  } 

  if (isPanning  && event.touches.length <= 1) {
    let prev = screenToWorldSpace(pointerX, pointerY);

    offsetX -= (panOffX - pointerX) / zoom;
    offsetY -= (panOffY - pointerY) / zoom;
    
    let current = screenToWorldSpace(pointerX, pointerY);
    cursorOffsetX -= current.x - prev.x;
    cursorOffsetY -= current.y - prev.y;
  }

  else if (isDragging) {
    if (selectedComponents.length > 0) {
      dragComponent(pointerX, pointerY, true);
    }
    else {
      tryDrawWireTo(pointerX, pointerY, false);
    }
  }

  panOffX = pointerX;
  panOffY = pointerY;

  touches = event.touches;

  renderAll();

});

canvas.addEventListener("touchend", function(event) {
  event.preventDefault();

  let pointerX = event.changedTouches[0].clientX - canvas.getBoundingClientRect().left;
  let pointerY = event.changedTouches[0].clientY - canvas.getBoundingClientRect().top;

  // don't stop panning, dragging, drawing if there are fingers on the screen
  if (touches.length !== event.changedTouches.length) return;


  if (isDragging) {
    if (selectedComponents.length > 0) {
      dragComponent(pointerX, pointerY, false);
    } 
    else {
      tryDrawWireTo(pointerX, pointerY, true);
    }

    isDragging = false;
  }
  if (isPanning) {
    isPanning = false;
  }

  renderAll();
});

window.onresize = function() {
  offsetX += (window.innerWidth - canvas.width) / 2 / zoom;
  offsetY += (window.innerHeight - canvas.height) / 2 / zoom;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  renderAll();
};

var btnClear = document.getElementById("clear");
btnClear.addEventListener("click", function() {
  let del = confirm("Do you want to clear the circuit?");
  if (del) {
    count = 1;
    components = [];
    wires = [];
    selectedWires = [];
    selectedComponents = [];
    junctions = [];
  }
  renderAll();
});

renderAll();