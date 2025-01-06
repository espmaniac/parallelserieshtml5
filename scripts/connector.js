
function tryConnect(element) {
  for (let i in element.nodes) {
    n = element.nodes[i];

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

    if(element.className === "Wire")
      nConnectionsLength -= element.nodesOnLine.length;

    if (nConnectionsLength >= 3)
    for (let j = 1; j < n.connections.length; ++j) {
      let node = n.connections[j].node;
      let add = true;
      if (element.className === "Wire") {
        for (let k = 0; k < element.nodesOnLine.length; ++k) {
          if (element.nodesOnLine[k] === node) {
            add = false;
            break;
          }
        }
      }
      if (add)
        junction(n.x,n.y, n, node);
    }
  }
}

function tryConnectWire(nArr, wire) {
  let connected = false;

  for (let i = 0; i < nArr.length; ++i) {
    let n = nArr[i];

    let tLikeconnection = wire.hitTest(n.x, n.y, 0.1);

    let onLine = wire.nodesOnLine.find(
      function(node) {
        return (node === n);
    });

    let nodes = tryConnectNodes(n, wire.nodes);

    if (nodes)
      connected = true;

    else if (tLikeconnection && !onLine) {
      connectNodes(n, wire.nodes[0]);
      connectNodes(n, wire.nodes[1]);
      junction(n.x, n.y, n, wire.nodes[0]);
      junction(n.x, n.y, n, wire.nodes[1]);
      wire.nodesOnLine.push(n);
      connected = true;
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
