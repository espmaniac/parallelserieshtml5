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
      scheme.junctions.push(junction);
    }
}


function updateComponentConnections(component) {
    deleteNode(component.node1); // delete all connection
    deleteNode(component.node2); // delete all connection
    connectNodes(component.node1, component.node2);
  
    for (let i = 0; i < scheme.wires.length; ++i) {
      connectComponentLine(component, scheme.wires[i]);
    }
  
    for (let i in scheme.components) {
      connectComponentComponent(component, scheme.components[i]);
  
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
    for (let i = 0; i < scheme.junctions.length; ++i) {
      if (scheme.junctions[i] === j) {
        j.onDelete();
        scheme.junctions.splice(i, 1);
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