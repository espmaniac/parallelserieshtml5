class GraphNode {
    constructor() {
        this.parents = [];
        this.children = [];
        this.branches = [];
        this.elementNode = null;
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
        this.visited = [];
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
            else
                addNodes.addCommand(new AddLabelNode(node, `N${i}`));

        }

        scheme.execute(addNodes);


        let pathExist = this.buildPath(start, end);
        

        console.log(printGraphNode(pathExist, [])); // debug
        
        return (pathExist) ? pathExist : undefined; // debug
        
    }

    mergeNodes(startNode, visited) {
        
        if (visited.includes(startNode)) return -1;

        visited.push(startNode);

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

        for (let i = 0; i < startNode.connections.length; ++i) {
            let connection = startNode.connections[i];
            let result = this.mergeNodes(connection.node, visited);
            if (result !== -1) {

                if (result.x !== mergeNode.x || result.y !== mergeNode.y) {

                    let exist = mergeNode.connections.find((n) => { 
                        return n.node.x === result.x && n.node.y === result.y
                    });

                    if (!exist) {
                        mergeNode.connections.push({node: result, value: connection.value});
                    }
                    let resultFind = result.connections.find((n) => { 
                        return n.node.x === mergeNode.x && n.node.y === mergeNode.y});                    
                    
                    if(!resultFind) 
                        result.connections.push({node: mergeNode, value: connection.value});
                }
            }
        }

        return mergeNode;
    }

    buildPath(startNode, destNode) {

        let result = -1;

        this.visited.push(startNode);

        let startGraphNode = new GraphNode();
        startGraphNode.value = startNode.value;
    

        if (startNode === destNode) {
            this.visited.pop();
            return startGraphNode;
        }

        for (let i = 0; i < startNode.connections.length; i++) {
            let node = startNode.connections[i].node;

            let find = this.visited.includes(node);

            if (find) continue;


            let child = this.buildPath(node, destNode);

            if (child !== -1) {
   
                startGraphNode.children.push(child);
                child.parents.push(startGraphNode);

                let branch = new Branch();
                branch.destNode = child;
                branch.value = (typeof startNode.connections[i].value === "string") ? 
                    startNode.connections[i].value : startNode.connections[i].value.value;
                
                startGraphNode.branches.push(branch);

                result = startGraphNode;
            }

        }


        this.visited.pop();

        return result;
    }

}


function printGraphNode(node, visitedPrint=[]) {

    let local_str = `${node.value}:`;

    //if (visitedPrint.includes(node)) return -1;

    //visitedPrint.push(node);
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