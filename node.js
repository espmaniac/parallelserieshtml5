class Node {
    constructor() {
        //this.parent = null;
        //this.x = 0;
        //this.y = 0;

        this.parent = null;
        this.connections = []; // {.value}
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
        goodNode.node.connections.splice(ind, 1);

    }
    node.connections.length = 0; // clear
}
