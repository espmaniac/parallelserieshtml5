class Node {
  constructor() {
    //this.x = 0;
    //this.y = 0;

    this.parent = null;
    this.connections = [];
    this.junctions = [];
  }
}

function connectNodes(node1, node2, value="0") {
  for (let i = 0; i < node1.connections.length; ++i) {
    let c = node1.connections[i];
    if (c.node == node2) return;
  }

  node1.connections.push({node: node2, value: value});
  node2.connections.push({node: node1, value: value});
}

function findNode(node1, node2) {
  for (let i = 0; i < node1.connections.length; ++i) {
      if (node1.connections[i].node === node2) {
        return i;
      }
  }
  return -1;
}

function checkJunctionConnection(node1, node2) {
  for (let i = 0; i < node1.junctions.length; ++i) {
    for (let n = 0; n < node1.junctions[i].nodes.length; ++n) {
      if (node1.junctions[i].nodes[n] === node2)  {
        return {jInd: i, nInd: n};
      }
    }
  }
  return {jInd: -1, nInd: -1};
}

function disconnectNodes(node1, node2) {
  let ind1 = findNode(node1, node2);
  let ind2 = findNode(node2, node1);

  if (ind1 != -1 && ind2 != -1) {
    node1.connections.splice(ind1, 1);
    node2.connections.splice(ind2, 1);
  }

}

function deleteNode(node) {
  for (let i = 0; i < node.connections.length; ++i) {
    let goodNode = node.connections[i];
    let ind = findNode(goodNode.node, node);

    if (ind < 0) continue;

    goodNode.node.connections.splice(ind, 1);

    if (goodNode.node.parent.className === "Wire") {
      let nodeOnLine = goodNode.node.parent.nodesOnLine.findIndex(function(n) {
        return n === node;
      });
      if (nodeOnLine >= 0) {
        goodNode.node.parent.nodesOnLine.splice(nodeOnLine, 1);
      }
      
    }

  }

  for (let i = 0; i < node.junctions.length; ++i) {
    let junction = node.junctions[i];
    let ind = junction.nodes.findIndex(function(n) {
      return n === node;
    });
    if (ind >= 0 && ((junction.nodes.length - 1) >= 3)) 
      junction.nodes.splice(ind, 1);
    else deleteJunction(junction);
  }

  node.connections.length = 0; // clear
  node.junctions = [];
}
