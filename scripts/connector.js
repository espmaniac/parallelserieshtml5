function tryConnect(element) {
  let isWire = element.className === "Wire";

  for (let i = 0; i < element.nodes.length; ++i) {
    let n = element.nodes[i];

    // A wire checks both component nodes at once, so one component pass is enough.
    if (!isWire || i === 0) {
      for (let j in scheme.components) {
        let component = scheme.components[j];
        if (element === component) continue;

        if (isWire)
          tryConnectWire(component.nodes, element);
        else
          tryConnectNodes(n, component.nodes);
      }
    }

    // Newly split wire segments are connected by splitWireAtNode().
    let wireCount = scheme.wires.length;
    for (let j = 0; j < wireCount; ++j) {
      let wire = scheme.wires[j];

      if (element === wire) continue;

      let connected = tryConnectNodeToWire(n, wire);

      if (!connected && isWire)
        tryConnectWire(wire.nodes, element);
    }

    if (n.connections.length >= 3) {
      for (let j = 0; j < n.connections.length; ++j) {
        let node = n.connections[j].node;

        // Connection order can change when a wire is split. Exclude the
        // element's own internal edge explicitly and only group co-located
        // nodes into a junction.
        if (element.nodes.includes(node)) continue;
        if (node.x !== n.x || node.y !== n.y) continue;

        junction(n.x, n.y, n, node);
      }
    }
  }
}

function tryConnectWire(nArr, wire) {
  let connected = false;

  for (let i = 0; i < nArr.length; ++i) {
    if (tryConnectNodeToWire(nArr[i], wire))
      connected = true;
  }
  return connected;
}

function tryConnectNodeToWire(n, wire) {
  if (tryConnectNodes(n, wire.nodes))
    return true;

  if (!nodeInWireBounds(n, wire, 0.01))
    return false;

  if (!wire.hitTest(n.x, n.y, 0.01))
    return false;

  if ((n.x === wire.nodes[0].x && n.y === wire.nodes[0].y) ||
      (n.x === wire.nodes[1].x && n.y === wire.nodes[1].y))
    return false;

  splitWireAtNode(wire, n);
  return true;
}

function nodeInWireBounds(n, wire, tolerance) {
  let minX = Math.min(wire.nodes[0].x, wire.nodes[1].x);
  let maxX = Math.max(wire.nodes[0].x, wire.nodes[1].x);
  let minY = Math.min(wire.nodes[0].y, wire.nodes[1].y);
  let maxY = Math.max(wire.nodes[0].y, wire.nodes[1].y);
  let distanceX = Math.max(minX - n.x, 0, n.x - maxX);
  let distanceY = Math.max(minY - n.y, 0, n.y - maxY);
  // Manhattan length keeps the early rejection conservative for diagonal wires.
  let maxLength = (maxX - minX) + (maxY - minY);
  let marginSquared = maxLength * tolerance / 2 + tolerance * tolerance / 4;

  return distanceX * distanceX + distanceY * distanceY <= marginSquared;
}

function tryConnectNodes(n, nArr) {
  let connected = false;
  for (let i = 0; i < nArr.length; ++i) {
    let node = nArr[i];
    let samePosition = n.x === node.x && n.y === node.y;
    if (samePosition || node.hitTest(n.x, n.y)) {
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
    let startNode = wire.nodes[0];
    let endNode = wire.nodes[1];
    let splitNode = new Node();
    let w2 = new Wire();
    let drawW2 = new DrawWire(w2);

    splitNode.x = node.x;
    splitNode.y = node.y;
    splitNode.parent = wire;

    w2.nodes[0].x = node.x;
    w2.nodes[0].y = node.y;

    // Keep the original endpoint object at the original endpoint. Labels and
    // commands can hold references to it, so moving it to the split point
    // would also move StartNode/DestNode there.
    disconnectNodes(startNode, endNode);
    wire.nodes[1] = splitNode;
    connectNodes(startNode, splitNode, "0");

    let generatedEndNode = w2.nodes[1];
    disconnectNodes(w2.nodes[0], generatedEndNode);
    generatedEndNode.parent = null;

    w2.nodes[1] = endNode;
    endNode.parent = w2;
    connectNodes(w2.nodes[0], endNode, "0");

    scheme.execute(drawW2);

    tryConnect(wire);
    tryConnect(w2);
}
