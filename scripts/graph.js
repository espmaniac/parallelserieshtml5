class GraphUnionFind {
    constructor() {
        this.parent = new Map();
        this.rank = new Map();
    }

    add(value) {
        if (!this.parent.has(value)) {
            this.parent.set(value, value);
            this.rank.set(value, 0);
        }
    }

    find(value) {
        const parent = this.parent.get(value);
        if (parent !== value) {
            const root = this.find(parent);
            this.parent.set(value, root);
            return root;
        }
        return parent;
    }

    union(left, right) {
        const leftRoot = this.find(left);
        const rightRoot = this.find(right);
        if (leftRoot === rightRoot) return;

        const leftRank = this.rank.get(leftRoot);
        const rightRank = this.rank.get(rightRoot);
        if (leftRank < rightRank) {
            this.parent.set(leftRoot, rightRoot);
        } else if (leftRank > rightRank) {
            this.parent.set(rightRoot, leftRoot);
        } else {
            this.parent.set(rightRoot, leftRoot);
            this.rank.set(leftRoot, leftRank + 1);
        }
    }
}

class Graph {
    toString(startNode, destNode) {
        if (!startNode || !destNode) return undefined;

        const collected = this._collectNetwork(startNode);
        if (!collected.nodes.has(destNode)) return undefined;

        const network = this._createReducedNetwork(collected, startNode, destNode);
        if (!network) return undefined;
        if (network.start === network.end) return "0";

        while (true) {
            this._reduceSeriesParallel(network);

            const internalNodes = Array.from(network.nodes).filter((node) => {
                return node !== network.start && node !== network.end;
            });

            if (internalNodes.length === 0) break;

            const candidate = this._chooseEliminationNode(network, internalNodes);
            if (!candidate || !this._eliminateNode(network, candidate)) {
                return undefined;
            }
        }

        this._combineParallelEdges(network);
        const terminalEdges = network.edges.filter((edge) => {
            return this._connects(edge, network.start, network.end);
        });

        if (terminalEdges.length === 0) return undefined;

        const result = this._parallelAst(terminalEdges.map((edge) => edge.ast));
        return this._astToString(result, true);
    }

    _collectNetwork(startNode) {
        const nodes = new Set([startNode]);
        const edges = [];
        const stack = [startNode];
        const nodeIds = new Map();
        const seenObjects = new Set();
        const seenPrimitiveEdges = new Set();
        let nextNodeId = 0;

        const nodeId = (node) => {
            if (!nodeIds.has(node)) nodeIds.set(node, nextNodeId++);
            return nodeIds.get(node);
        };

        while (stack.length > 0) {
            const node = stack.pop();
            nodeId(node);

            for (const connection of (node.connections || [])) {
                const other = connection.node;
                if (!nodes.has(other)) {
                    nodes.add(other);
                    stack.push(other);
                }

                const value = connection.value;
                if (value && typeof value === "object") {
                    if (seenObjects.has(value)) continue;
                    seenObjects.add(value);
                } else {
                    const leftId = nodeId(node);
                    const rightId = nodeId(other);
                    const key = `${Math.min(leftId, rightId)}:${Math.max(leftId, rightId)}:${String(value)}`;
                    if (seenPrimitiveEdges.has(key)) continue;
                    seenPrimitiveEdges.add(key);
                }

                edges.push({ a: node, b: other, value: value });
            }
        }

        return { nodes: nodes, edges: edges };
    }

    _createReducedNetwork(collected, startNode, destNode) {
        const unionFind = new GraphUnionFind();
        for (const node of collected.nodes) unionFind.add(node);

        for (const edge of collected.edges) {
            if (this._isZeroValue(edge.value)) unionFind.union(edge.a, edge.b);
        }

        const start = unionFind.find(startNode);
        const end = unionFind.find(destNode);
        const nodes = new Set();
        for (const node of collected.nodes) nodes.add(unionFind.find(node));

        const edges = [];
        for (const edge of collected.edges) {
            if (this._isZeroValue(edge.value)) continue;

            const a = unionFind.find(edge.a);
            const b = unionFind.find(edge.b);
            if (a === b) continue;

            const text = this._valueText(edge.value);
            const value = this._parseValue(text);
            if (!(value > 0) || !Number.isFinite(value)) return null;

            edges.push({
                a: a,
                b: b,
                admittance: this._toAdmittance(value),
                ast: { type: "value", value: text }
            });
        }

        return {
            nodes: nodes,
            edges: edges,
            start: start,
            end: end
        };
    }

    _reduceSeriesParallel(network) {
        let changed = true;

        while (changed) {
            changed = this._combineParallelEdges(network);
            if (this._removeDanglingNodes(network)) {
                changed = true;
                continue;
            }
            if (this._reduceOneSeriesNode(network)) changed = true;
        }
    }

    _combineParallelEdges(network) {
        const nodeIds = new Map();
        let nextNodeId = 0;
        for (const node of network.nodes) nodeIds.set(node, nextNodeId++);

        const groups = new Map();
        for (const edge of network.edges) {
            if (edge.a === edge.b) continue;
            const aId = nodeIds.get(edge.a);
            const bId = nodeIds.get(edge.b);
            const key = `${Math.min(aId, bId)}:${Math.max(aId, bId)}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(edge);
        }

        let changed = false;
        const edges = [];
        for (const group of groups.values()) {
            if (group.length === 1) {
                edges.push(group[0]);
                continue;
            }

            changed = true;
            edges.push({
                a: group[0].a,
                b: group[0].b,
                admittance: group.reduce((sum, edge) => sum + edge.admittance, 0),
                ast: this._parallelAst(group.map((edge) => edge.ast))
            });
        }

        network.edges = edges;
        return changed;
    }

    _removeDanglingNodes(network) {
        const degree = this._degreeMap(network);
        const removable = Array.from(network.nodes).filter((node) => {
            return node !== network.start &&
                node !== network.end &&
                (degree.get(node) || 0) <= 1;
        });

        if (removable.length === 0) return false;

        const removeSet = new Set(removable);
        network.edges = network.edges.filter((edge) => {
            return !removeSet.has(edge.a) && !removeSet.has(edge.b);
        });
        for (const node of removable) network.nodes.delete(node);
        return true;
    }

    _reduceOneSeriesNode(network) {
        const degree = this._degreeMap(network);
        const node = Array.from(network.nodes).find((candidate) => {
            return candidate !== network.start &&
                candidate !== network.end &&
                degree.get(candidate) === 2;
        });

        if (!node) return false;

        const incident = network.edges.filter((edge) => edge.a === node || edge.b === node);
        const left = incident[0];
        const right = incident[1];
        const leftNode = this._otherEnd(left, node);
        const rightNode = this._otherEnd(right, node);

        network.edges = network.edges.filter((edge) => edge !== left && edge !== right);
        network.nodes.delete(node);

        if (leftNode !== rightNode) {
            const denominator = left.admittance + right.admittance;
            if (!(denominator > 0) || !Number.isFinite(denominator)) return false;

            network.edges.push({
                a: leftNode,
                b: rightNode,
                admittance: (left.admittance * right.admittance) / denominator,
                ast: this._seriesAst([left.ast, right.ast])
            });
        }

        return true;
    }

    _chooseEliminationNode(network, internalNodes) {
        const degree = this._degreeMap(network);
        let best = null;
        let bestDegree = Infinity;

        for (const node of internalNodes) {
            const nodeDegree = degree.get(node) || 0;
            if (nodeDegree < bestDegree) {
                best = node;
                bestDegree = nodeDegree;
            }
        }

        return best;
    }

    _eliminateNode(network, node) {
        const incident = network.edges.filter((edge) => edge.a === node || edge.b === node);
        if (incident.length === 0) {
            network.nodes.delete(node);
            return true;
        }

        const totalAdmittance = incident.reduce((sum, edge) => sum + edge.admittance, 0);
        if (!(totalAdmittance > 0) || !Number.isFinite(totalAdmittance)) return false;

        network.edges = network.edges.filter((edge) => !incident.includes(edge));
        network.nodes.delete(node);

        for (let i = 0; i < incident.length; ++i) {
            for (let j = i + 1; j < incident.length; ++j) {
                const a = this._otherEnd(incident[i], node);
                const b = this._otherEnd(incident[j], node);
                if (a === b) continue;

                const admittance = (incident[i].admittance * incident[j].admittance) / totalAdmittance;
                if (!(admittance > 0) || !Number.isFinite(admittance)) continue;

                const transformedValue = this._fromAdmittance(admittance);
                network.edges.push({
                    a: a,
                    b: b,
                    admittance: admittance,
                    ast: { type: "value", value: this._formatNumber(transformedValue) }
                });
            }
        }

        return true;
    }

    _degreeMap(network) {
        const degree = new Map();
        for (const node of network.nodes) degree.set(node, 0);
        for (const edge of network.edges) {
            degree.set(edge.a, (degree.get(edge.a) || 0) + 1);
            degree.set(edge.b, (degree.get(edge.b) || 0) + 1);
        }
        return degree;
    }

    _seriesAst(parts) {
        const flattened = [];
        for (const part of parts) {
            if (part.type === "series") flattened.push(...part.parts);
            else flattened.push(part);
        }
        if (flattened.length === 1) return flattened[0];
        return { type: "series", parts: flattened };
    }

    _parallelAst(branches) {
        const flattened = [];
        for (const branch of branches) {
            if (branch.type === "parallel") flattened.push(...branch.branches);
            else flattened.push(branch);
        }
        if (flattened.length === 1) return flattened[0];
        return { type: "parallel", branches: flattened };
    }

    _astToString(ast, topLevel = false) {
        if (ast.type === "value") return ast.value;

        if (ast.type === "series") {
            return ast.parts.map((part) => {
                const text = this._astToString(part, false);
                return part.type === "parallel" ? `(${this._stripOuterParentheses(text)})` : text;
            }).join(" + ");
        }

        const text = ast.branches.map((branch) => {
            const branchText = this._astToString(branch, false);
            return branch.type === "series" ? `(${branchText})` : branchText;
        }).join(" // ");

        return topLevel ? text : `(${text})`;
    }

    _stripOuterParentheses(text) {
        const trimmed = text.trim();
        if (trimmed[0] === "(" && trimmed[trimmed.length - 1] === ")") {
            return trimmed.substring(1, trimmed.length - 1);
        }
        return trimmed;
    }

    _otherEnd(edge, node) {
        return edge.a === node ? edge.b : edge.a;
    }

    _connects(edge, left, right) {
        return (edge.a === left && edge.b === right) ||
            (edge.a === right && edge.b === left);
    }

    _isZeroValue(value) {
        return this._valueText(value).trim() === "0";
    }

    _valueText(value) {
        if (value && typeof value === "object" && value.value !== undefined) {
            return String(value.value).trim();
        }
        return String(value).trim();
    }

    _componentType() {
        if (typeof choosenComponent !== "undefined" && choosenComponent.shortName) {
            return choosenComponent.shortName;
        }
        return "R";
    }

    _toAdmittance(value) {
        return this._componentType() === "C" ? value : 1 / value;
    }

    _fromAdmittance(admittance) {
        return this._componentType() === "C" ? admittance : 1 / admittance;
    }

    _parseValue(text) {
        const normalized = String(text).trim().replace(",", ".");
        const match = normalized.match(/^([0-9]*\.?[0-9]+)([a-zA-Z]+)?$/);
        if (!match) return null;

        let value = Number(match[1]);
        const suffix = match[2];
        if (!suffix) return value;

        const prefixes = (typeof PREFIXES !== "undefined" && Array.isArray(PREFIXES))
            ? PREFIXES
            : [];
        const prefix = prefixes.find((item) => {
            return item.symbol === suffix || item.name === suffix;
        });

        if (!prefix) return null;
        value *= Math.pow(10, prefix.exponent);
        return value;
    }

    _formatNumber(value) {
        if (value === 0) return "0";

        const rounded = Number(value.toPrecision(15));
        const text = String(rounded);
        if (!/[eE]/.test(text)) return text;

        const sign = text[0] === "-" ? "-" : "";
        const unsigned = sign ? text.substring(1) : text;
        const parts = unsigned.toLowerCase().split("e");
        const exponent = Number(parts[1]);
        const coefficient = parts[0].split(".");
        const digits = coefficient.join("");
        const decimalPosition = coefficient[0].length + exponent;

        if (decimalPosition <= 0) {
            return sign + "0." + "0".repeat(-decimalPosition) + digits;
        }
        if (decimalPosition >= digits.length) {
            return sign + digits + "0".repeat(decimalPosition - digits.length);
        }
        return sign + digits.substring(0, decimalPosition) + "." + digits.substring(decimalPosition);
    }
}
