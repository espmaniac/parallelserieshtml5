class GraphNode {
    constructor() {
        this.parents = [];
        this.children = [];
        this.branches = [];
        this.value = null;
    }
}

class Branch {
    constructor() {
        this.destNode = null;
        this.value = null;
    }
}

class Graph {
    constructor() {
        this.nodes = [];// circuit merged nodes
    }

    toString(startNode, destNode) {

        let start = this.mergeNodes(startNode, []);
        let end = null;
        start.value = "start";

        let addNodes = new MacroCommand();

        for (let i = 1; i < this.nodes.length;++i) {
            let node = this.nodes[i];
            node.value = i;
            if (node.x === destNode.x && node.y === destNode.y) {
                end = node;
                node.value = "end";
            }
            else {
                let newLabel = new LabelNode(`N${i}`);
                newLabel.node = node;
                newLabel.className = "GraphLabelNode";
                addNodes.addCommand(new AddLabelNode(newLabel));
            }
        }


        let pathExist = this.buildPath(start, end, []);
        if (pathExist !== -1) {
            scheme.execute(addNodes);
            console.log(pathExist);
            console.log(printGraphNode(pathExist, [])); // debug
            return pathExist;
        }
        else {
            return undefined;
        }
    }

    mergeNodes(startNode, visited = []) {
        let mergeNode = new Node();
        mergeNode.x = startNode.x;
        mergeNode.y = startNode.y;

        let find = this.nodes.find((n) => { 
            return n.x === mergeNode.x && n.y === mergeNode.y 
        });

        if (!find)
            this.nodes.push(mergeNode);
        else {
            mergeNode = find;
        }

        
        if (visited.includes(startNode)) return mergeNode;

        visited.push(startNode);

        let connections = startNode.connections.slice();


        for (let i = 0; i < connections.length; ++i) {
            let connection = connections[i];

            let result = this.mergeNodes(connection.node, visited);


            if (connection.node.parent.className === "Wire") {
                let nodesOnLine = connection.node.parent.nodesOnLine;

                for(let j = 0; j < nodesOnLine.length; ++j) {

                    let nodeOnLine = nodesOnLine[j];

                    if (!connections.find(function(n) {
                        return n.x === nodeOnLine.x && n.y === nodeOnLine.y;
                    })) {
                        connections.push({node: nodeOnLine, value: "0"});
                    }
                }

            }

            if (result !== -1) {

                if (result.x !== mergeNode.x || result.y !== mergeNode.y) {

                    let exist = mergeNode.connections.find((n) => { 
                        return n.node.x === result.x && n.node.y === result.y
                    });

                    if (!exist) {
                        mergeNode.connections.push({node: result, value: connection.value});
                    }
                    let resultFind = result.connections.find((n) => { 
                        return n.node.x === mergeNode.x && n.node.y === mergeNode.y
                    });                    
                    
                    if(!resultFind) 
                        result.connections.push({node: mergeNode, value: connection.value});
                }
            }
        }

        return mergeNode;
    }

    buildPath(startNode, destNode, visited, graphNodes = new Map()) {

        let result = -1;

        visited.push(startNode);

        let startGraphNode = new GraphNode();
        startGraphNode.value = startNode.value;

        if (graphNodes.has(startNode.value)) {
            startGraphNode = graphNodes.get(startNode.value);
        } else {
            graphNodes.set(startNode.value, startGraphNode);
        }
    

        if (startNode === destNode) {
            visited.pop();
            return startGraphNode;
        }

        for (let i = 0; i < startNode.connections.length; i++) {
            let node = startNode.connections[i].node;

            let find = visited.includes(node);

            if (find) continue;


            let child = this.buildPath(node, destNode, visited, graphNodes);

            if (child !== -1) {
                result = startGraphNode;
                if (startGraphNode.children.includes(child)) continue;
                
                startGraphNode.children.push(child);
                child.parents.push(startGraphNode);

                let branch = new Branch();
                branch.destNode = child;
                branch.value = (typeof startNode.connections[i].value === "string") ? 
                    startNode.connections[i].value : startNode.connections[i].value.value;
                
                startGraphNode.branches.push(branch);

            }

        }


        visited.pop();

        return result;
    }

}


function printGraphNode(node, visitedPrint=[]) {
    if (visitedPrint.includes(node)) return -1;

    visitedPrint.push(node);

    let local_str = `${node.value}:`;
    let strs = [];

    for (let i = 0; i < node.children.length; ++i) {
        let child = node.children[i];
        local_str += ` ${child.value}`;

        let res = printGraphNode(child, visitedPrint);
        
        if (typeof res === "string") {
            strs.push(res);
        }
    }

    for (let s in strs) {
        local_str += `\n` + strs[s];
    }

    return local_str;
}
