class GraphNode {
    constructor() {
        this.parents = [];
        this.children = [];
        this.branches = new Map(); // Map<GraphNode, string> - branch label for child
        this.value = null;
    }
}

class Graph {
    constructor() {
        this.nodes = []; // merged nodes
    }

    toString(startNode, destNode) {
        let start = this.mergeNodes(startNode, []);
        let end = null;
        start.value = "start";

        let addNodes = new MacroCommand();

        for (let i = 1; i < this.nodes.length; ++i) {
            let node = this.nodes[i];
            node.value = i;
            if (node.x === destNode.x && node.y === destNode.y) {
                end = node;
                node.value = "end";
            } else {
                let newLabel = new LabelNode(`N${i}`);
                newLabel.node = node;
                newLabel.className = "GraphLabelNode";
                addNodes.addCommand(new AddLabelNode(newLabel));
            }
        }

        let graphNodes = new Map();
        let pathExist = this.buildPath(start, end, [], graphNodes);

        if (pathExist !== -1) {
            try { scheme.execute(addNodes); } catch (e) { /* ignore */ }

            // Build AST, simplify and render
            const rawAst = this._buildAST(pathExist, null, new Map());
            const rawStr = this._astToString(rawAst);

            const simpAst = this._simplifyAST(rawAst);
            const cleanStr = this._astToString(simpAst);

            console.log(printGraphNode(pathExist));
            try { console.log("raw expression:", rawStr); } catch (e) {}
            try { console.log("cleaned expression:", cleanStr); } catch (e) {}

            return cleanStr;
        } else {
            return undefined;
        }
    }

    // mergeNodes kept as before (adds nodes from wires as "0" connections)
    mergeNodes(startNode, visited = []) {
        let mergeNode = new Node();
        mergeNode.x = startNode.x;
        mergeNode.y = startNode.y;

        let find = this.nodes.find((n) => {
            return n.x === mergeNode.x && n.y === mergeNode.y;
        });

        if (!find) this.nodes.push(mergeNode);
        else mergeNode = find;

        if (visited.includes(startNode)) return mergeNode;

        visited.push(startNode);

        let connections = startNode.connections.slice();

        for (let i = 0; i < connections.length; ++i) {
            let connection = connections[i];

            let result = this.mergeNodes(connection.node, visited);
            
            if (result !== -1) {
                if (result.x !== mergeNode.x || result.y !== mergeNode.y) {
                    let exist = mergeNode.connections.find((n) => {
                        return n.node.x === result.x && n.node.y === result.y;
                    });

                    if (!exist) {
                        mergeNode.connections.push({ node: result, value: connection.value });
                    }
                    let resultFind = result.connections.find((n) => {
                        return n.node.x === mergeNode.x && n.node.y === mergeNode.y;
                    });
                    if (!resultFind) result.connections.push({ node: mergeNode, value: connection.value });
                }
            }
        }

        return mergeNode;
    }

    // buildPath: create GraphNode graph; store branch label keyed by child object (not by child.value)
    buildPath(startNode, destNode, visited, graphNodes = new Map()) {
        let result = -1;
        visited.push(startNode);

        let startGraphNode = new GraphNode();
        startGraphNode.value = startNode.value;

        if (graphNodes.has(startNode.value)) startGraphNode = graphNodes.get(startNode.value);
        else graphNodes.set(startNode.value, startGraphNode);

        if (startNode === destNode) {
            visited.pop();
            return startGraphNode;
        }

        for (let i = 0; i < startNode.connections.length; i++) {
            let node = startNode.connections[i].node;
            if (visited.includes(node)) continue;

            let child = this.buildPath(node, destNode, visited, graphNodes);

            if (child !== -1) {
                result = startGraphNode;
                if (startGraphNode.children.includes(child)) continue;

                startGraphNode.children.push(child);
                child.parents.push(startGraphNode);

                // store branch label with child object as key
                let label = (typeof startNode.connections[i].value === "string")
                    ? startNode.connections[i].value
                    : startNode.connections[i].value.value;

                startGraphNode.branches.set(child, String(label));
            }
        }

        visited.pop();
        return result;
    }

    /**********************
     * Reconvergence helpers
     **********************/
    _reachableSet(start, limit = null) {
        const visited = new Set();
        const stack = [start];
        while (stack.length) {
            const cur = stack.pop();
            if (visited.has(cur)) continue;
            visited.add(cur);
            if (limit && cur === limit) continue;
            for (const c of cur.children) stack.push(c);
        }
        return visited;
    }

    _bfsDistance(start, target, limit = null) {
        if (start === target) return 0;
        const q = [{ node: start, dist: 0 }];
        const seen = new Set([start]);
        while (q.length) {
            const { node, dist } = q.shift();
            if (limit && node === limit) continue;
            for (const c of node.children) {
                if (seen.has(c)) continue;
                if (c === target) return dist + 1;
                seen.add(c);
                q.push({ node: c, dist: dist + 1 });
            }
        }
        return Infinity;
    }

    _findReconverge(children, limit = null) {
        if (!children || children.length === 0) return null;
        const sets = children.map(ch => this._reachableSet(ch, limit));
        let intersection = null;
        for (const s of sets) {
            if (intersection === null) intersection = new Set(s);
            else {
                for (const x of Array.from(intersection)) {
                    if (!s.has(x)) intersection.delete(x);
                }
            }
        }
        if (!intersection || intersection.size === 0) return null;

        let best = null;
        let bestScore = Infinity;
        for (const cand of intersection) {
            let total = 0;
            let unreachable = false;
            for (const ch of children) {
                const d = this._bfsDistance(ch, cand, limit);
                if (d === Infinity) { unreachable = true; break; }
                total += d;
            }
            if (unreachable) continue;
            if (total < bestScore) { bestScore = total; best = cand; }
        }
        return best;
    }

    /* ===================
       AST builder + simplify + render
       =================== */

    // _buildAST(node, stopNode, memo)
    // AST types:
    //  - { type: "value", val: string }
    //  - { type: "series", parts: [AST...] }
    //  - { type: "parallel", branches: [AST...] }
    _buildAST(node, stopNode = null, memo = new Map()) {
        if (!node) return null;

        // memoization per (node, stopNode)
        let stopMap = memo.get(node);
        if (!stopMap) { stopMap = new Map(); memo.set(node, stopMap); }
        if (stopMap.has(stopNode)) return stopMap.get(stopNode);

        // placeholder to prevent recursion loops
        stopMap.set(stopNode, null);

        if (stopNode && node === stopNode) {
            stopMap.set(stopNode, null);
            return null;
        }

        if (node.children.length === 0) {
            stopMap.set(stopNode, null);
            return null;
        }

        // parallel
        if (node.children.length > 1) {
            const reconverge = this._findReconverge(node.children, stopNode);

            const branches = [];
            for (let i = 0; i < node.children.length; ++i) {
                const child = node.children[i];
                // get label from branches Map using child object as key
                const branchLabel = node.branches.has(child) ? String(node.branches.get(child)) : "";

                const childAst = this._buildAST(child, reconverge ? reconverge : stopNode, memo);

                const parts = [];
                if (branchLabel !== "") parts.push({ type: "value", val: branchLabel });
                if (childAst) {
                    if (childAst.type === "series") for (const p of childAst.parts) parts.push(p);
                    else parts.push(childAst);
                }

                if (parts.length === 0) parts.push({ type: "value", val: "0" });
                const branchNode = (parts.length === 1) ? parts[0] : { type: "series", parts: parts };
                branches.push(branchNode);
            }

            const parallelNode = { type: "parallel", branches: branches };

            if (reconverge && reconverge !== stopNode) {
                const rest = this._buildAST(reconverge, stopNode, memo);
                if (rest) {
                    const out = { type: "series", parts: [parallelNode, rest] };
                    stopMap.set(stopNode, out);
                    return out;
                }
            }

            stopMap.set(stopNode, parallelNode);
            return parallelNode;
        }

        // single child -> series
        const child = node.children[0];
        const branchLabel = node.branches.has(child) ? String(node.branches.get(child)) : "";
        if (stopNode && child === stopNode) {
            if (!branchLabel || branchLabel === "") {
                stopMap.set(stopNode, null);
                return null;
            }
            const valNode = { type: "value", val: branchLabel };
            stopMap.set(stopNode, valNode);
            return valNode;
        }

        const childAst = this._buildAST(child, stopNode, memo);

        const parts = [];
        if (branchLabel !== "") parts.push({ type: "value", val: branchLabel });
        if (childAst) {
            if (childAst.type === "series") for (const p of childAst.parts) parts.push(p);
            else parts.push(childAst);
        }

        if (parts.length === 0) {
            const zero = { type: "value", val: "0" };
            stopMap.set(stopNode, zero);
            return zero;
        }

        const out = (parts.length === 1) ? parts[0] : { type: "series", parts: parts };
        stopMap.set(stopNode, out);
        return out;
    }

    _isZeroAST(ast) {
        return ast && ast.type === "value" && String(ast.val).trim() === "0";
    }

    _simplifyAST(node) {
        if (!node) return null;

        if (node.type === "value") {
            const v = (node.val === null || node.val === undefined || String(node.val).trim() === "") ? "0" : String(node.val).trim();
            return { type: "value", val: v };
        }

        if (node.type === "series") {
            const parts = [];
            for (const p of node.parts) {
                const sp = this._simplifyAST(p);
                if (!sp) continue;
                if (sp.type === "series") for (const sub of sp.parts) parts.push(sub);
                else parts.push(sp);
            }

            const nonZero = [];
            let zeros = 0;
            for (const p of parts) {
                if (this._isZeroAST(p)) zeros++;
                else nonZero.push(p);
            }

            if (nonZero.length === 0) return { type: "value", val: "0" };
            if (zeros > 0) nonZero.push({ type: "value", val: "0" });
            if (nonZero.length === 1) return nonZero[0];
            return { type: "series", parts: nonZero };
        }

        if (node.type === "parallel") {
            let branches = [];
            for (const b of node.branches) {
                const sb = this._simplifyAST(b);
                if (!sb) continue;
                if (sb.type === "parallel") for (const sub of sb.branches) branches.push(sub);
                else branches.push(sb);
            }

            if (branches.length === 0) return { type: "value", val: "0" };
            if (branches.length === 1) return branches[0];
            return { type: "parallel", branches: branches };
        }

        return null;
    }

    _astToString(node, opts = { topLevel: true }) {
        if (!node) return "";

        const render = (n) => {
            if (!n) return "";
            if (n.type === "value") return String(n.val);
            if (n.type === "series") {
                const parts = n.parts.map(p => render(p));
                return parts.join(" + ");
            }
            if (n.type === "parallel") {
                const branches = n.branches.map(b => {
                    const s = render(b);
                    if (s.indexOf(" + ") >= 0) return "(" + s + ")";
                    return s;
                });
                return "(" + branches.join(" // ") + ")";
            }
            return "";
        };

        let out = render(node);
        if (opts.topLevel) out = this._stripOuterParensText(out);
        return out;
    }

    _stripOuterParensText(s) {
        if (!s) return s;
        s = s.trim();
        while (s.length >= 2 && s[0] === '(' && s[s.length - 1] === ')') {
            let depth = 0;
            let valid = true;
            for (let i = 0; i < s.length; ++i) {
                let ch = s[i];
                if (ch === '(') depth++;
                else if (ch === ')') depth--;
                if (depth === 0 && i < s.length - 1) { valid = false; break; }
            }
            if (!valid) break;
            s = s.substring(1, s.length - 1).trim();
        }
        return s;
    }

    // public entry kept for compatibility
    buildString(startNode, visited = []) {
        if (!startNode) return "";
        const rawAst = this._buildAST(startNode, null, new Map());
        const simp = this._simplifyAST(rawAst);
        return this._astToString(simp, { topLevel: true });
    }
}


// helper for debugging
function printGraphNode(node, visitedPrint = []) {
    if (visitedPrint.includes(node)) return -1;
    visitedPrint.push(node);

    let local_str = `${node.value}:`;
    let strs = [];

    for (let i = 0; i < node.children.length; ++i) {
        let child = node.children[i];
        local_str += ` ${child.value}`;

        let res = printGraphNode(child, visitedPrint);
        if (typeof res === "string") strs.push(res);
    }

    for (let s in strs) {
        local_str += `\n` + strs[s];
    }

    return local_str;
}

