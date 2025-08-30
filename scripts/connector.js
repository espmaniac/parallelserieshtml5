function tryConnect(element) {
  for (let i in element.nodes) {
    let n = element.nodes[i];

    for (let j in scheme.components) {
      let component = scheme.components[j];
      if (element === component) continue;

      if (element.className === "Wire")
        tryConnectWire(component.nodes, element);
      else 
        tryConnectNodes(n, component.nodes);
    }

    for (let j in scheme.wires) {
      let wire = scheme.wires[j];
      
      if (element === wire) continue;

      let connected = tryConnectWire([n], wire);

      if (!connected && element.className === "Wire")
        tryConnectWire(wire.nodes, element);

    }

    let nConnectionsLength = n.connections.length;

    if (nConnectionsLength >= 3)
      for (let j = element.nodes.length - 1; j < n.connections.length; ++j) {
        let node = n.connections[j].node;
        junction(n.x,n.y, n, node);
      }
  }
}

function tryConnectWire(nArr, wire) {
  let connected = false;

  for (let i = 0; i < nArr.length; ++i) {
    let n = nArr[i];

    // Use stricter hitTest tolerance
    let tLikeconnection = wire.hitTest(n.x, n.y, 0.01);

    let nodes = tryConnectNodes(n, wire.nodes);

    if (nodes)
      connected = true;

    else if (tLikeconnection) {
      // prevent cutting at wire endpoints
      if (!(n.x === wire.nodes[0].x && n.y === wire.nodes[0].y) &&
          !(n.x === wire.nodes[1].x && n.y === wire.nodes[1].y)) {
        // Split the wire into two segments when a node lies on it
        splitWireAtNode(wire, n);
        connected = true;
      }
    }
  }
  return connected;
}

function tryConnectNodes(n, nArr) {
  let connected = false;
  for (let i in nArr) {
    let node = nArr[i];
    let connect =  node.hitTest(n.x, n.y);
    if (connect) { 
      connectNodes(n, node);
      connected = true;
    }
  }
  return connected;
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

function splitWireAtNode(wire, node) {
  let w2 = new Wire();
  let drawW2 = new DrawWire(w2);

  let n2 = wire.nodes[1];


  w2.nodes[0].x = wire.nodes[1].x;
  w2.nodes[0].y = wire.nodes[1].y;

  wire.nodes[1].x = node.x;
  wire.nodes[1].y = node.y;

  w2.nodes[1].x = n2.x;
  w2.nodes[1].y = n2.y;

  deleteNode(wire.nodes[0]);
  deleteNode(wire.nodes[1]);

  connectNodes(wire.nodes[0], wire.nodes[1], "0");
  connectNodes(wire.nodes[1], node, "0");

  scheme.execute(drawW2);

  scheme.wires.push(w2);
}
