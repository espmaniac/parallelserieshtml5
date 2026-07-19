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
    constructor() {
        this.solutionSteps = [];
        this.nodeNames = new Map();
        this.nodeLabels = [];
        this.nextNodeNumber = 1;
        this.nextTransformedBranchNumber = 1;
        this.nextVisualEdgeNumber = 1;
        this.componentExpression = null;
    }

    getSolutionSteps() {
        return this.solutionSteps.map((step) => {
            const copy = Object.assign({}, step);
            if (step.snapshot) {
                copy.snapshot = {
                    componentType: step.snapshot.componentType,
                    nodes: step.snapshot.nodes.map((node) => Object.assign({}, node)),
                    edges: step.snapshot.edges.map((edge) => Object.assign({}, edge))
                };
            }
            return copy;
        });
    }

    getComponentExpression() {
        return this.componentExpression;
    }

    getNodeLabels() {
        return this.nodeLabels.map((label) => {
            return { name: label.name, node: label.node };
        });
    }

    toString(startNode, destNode) {
        this._resetSolution();

        if (!startNode || !destNode) {
            this._addStep(
                "error",
                "Missing terminals",
                "Assign both StartNode and DestNode before solving the circuit."
            );
            return undefined;
        }

        const collected = this._collectNetwork(startNode);
        if (!collected.nodes.has(destNode)) {
            this._addStep(
                "error",
                "No path between terminals",
                "DestNode is not electrically connected to StartNode."
            );
            return undefined;
        }

        const network = this._createReducedNetwork(collected, startNode, destNode);
        if (!network) return undefined;

        this._assignNodeNames(network);
        const componentCount = collected.edges.filter((edge) => !this._isZeroValue(edge.value)).length;
        const wireCount = collected.edges.length - componentCount;
        this._addStep(
            "analysis",
            "Build the electrical graph",
            `Found ${componentCount} component ${componentCount === 1 ? "branch" : "branches"}. ` +
                `${wireCount} wire ${wireCount === 1 ? "connection was" : "connections were"} merged into ` +
                `${network.nodes.size} electrical ${network.nodes.size === 1 ? "node" : "nodes"}.`,
            null,
            null,
            this._captureNetwork(network)
        );

        if (network.start === network.end) {
            this.componentExpression = "0";
            this._addStep(
                "result",
                "Final expression",
                "StartNode and DestNode are connected by an ideal wire.",
                null,
                "0",
                this._captureNetwork(network)
            );
            return "0";
        }

        while (true) {
            this._reduceSeriesParallel(network);

            const internalNodes = Array.from(network.nodes).filter((node) => {
                return node !== network.start && node !== network.end;
            });

            if (internalNodes.length === 0) break;

            const candidate = this._chooseEliminationNode(network, internalNodes);
            if (!candidate || !this._eliminateNode(network, candidate)) {
                this._addStep(
                    "error",
                    "Reduction failed",
                    "The remaining network could not be transformed into a finite equivalent branch."
                );
                return undefined;
            }
        }

        this._combineParallelEdges(network);
        const terminalEdges = network.edges.filter((edge) => {
            return this._connects(edge, network.start, network.end);
        });

        if (terminalEdges.length === 0) {
            this._addStep(
                "error",
                "No terminal branch",
                "The transformed network does not contain a branch between StartNode and DestNode."
            );
            return undefined;
        }

        const result = this._parallelAst(terminalEdges.map((edge) => edge.ast));
        const expression = this._astToString(result, true);
        this.componentExpression = this._astToComponentString(result, false, true);
        this._addStep(
            "result",
            "Final expression",
            "All internal electrical nodes have been eliminated.",
            this.componentExpression,
            expression,
            this._captureNetwork(network, terminalEdges)
        );
        return expression;
    }

    _resetSolution() {
        this.solutionSteps = [];
        this.nodeNames = new Map();
        this.nodeLabels = [];
        this.nextNodeNumber = 1;
        this.nextTransformedBranchNumber = 1;
        this.nextVisualEdgeNumber = 1;
        this.componentExpression = null;
    }

    _addStep(type, title, description, before = null, after = null, snapshot = null) {
        this.solutionSteps.push({
            type: type,
            title: title,
            description: description,
            before: before,
            after: after,
            snapshot: snapshot
        });
    }

    _assignNodeNames(network) {
        this.nodeNames.set(network.start, "StartNode");
        if (network.end !== network.start) this.nodeNames.set(network.end, "DestNode");

        for (const node of network.nodes) {
            if (!this.nodeNames.has(node)) {
                const name = `N${this.nextNodeNumber++}`;
                this.nodeNames.set(node, name);
                this.nodeLabels.push({ name: name, node: node });
            }
        }
    }

    _nodeName(node) {
        if (!this.nodeNames.has(node)) {
            this.nodeNames.set(node, `N${this.nextNodeNumber++}`);
        }
        return this.nodeNames.get(node);
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
            if (!(value > 0) || !Number.isFinite(value)) {
                this._addStep(
                    "error",
                    "Invalid component value",
                    `The value "${text}" is not a supported positive component value.`
                );
                return null;
            }

            const componentName = this._componentName(edge.value);
            edges.push({
                a: a,
                b: b,
                admittance: this._toAdmittance(value),
                displayValue: text,
                visualId: this._nextVisualEdgeId(),
                generated: false,
                generatedBy: null,
                sourceNames: componentName ? [componentName] : [],
                ast: {
                    type: "value",
                    value: text,
                    name: componentName
                }
            });
        }

        const positions = new Map();
        const groupedNodes = new Map();
        for (const node of collected.nodes) {
            const root = unionFind.find(node);
            if (!groupedNodes.has(root)) groupedNodes.set(root, []);
            groupedNodes.get(root).push(node);
        }

        for (const [root, grouped] of groupedNodes.entries()) {
            const positioned = grouped.filter((node) => {
                return Number.isFinite(node.x) && Number.isFinite(node.y);
            });
            const x = positioned.length > 0
                ? positioned.reduce((sum, node) => sum + node.x, 0) / positioned.length
                : 0;
            const y = positioned.length > 0
                ? positioned.reduce((sum, node) => sum + node.y, 0) / positioned.length
                : 0;
            positions.set(root, { x: x, y: y });
        }

        if (Number.isFinite(startNode.x) && Number.isFinite(startNode.y)) {
            positions.set(start, { x: startNode.x, y: startNode.y });
        }
        if (Number.isFinite(destNode.x) && Number.isFinite(destNode.y)) {
            positions.set(end, { x: destNode.x, y: destNode.y });
        }

        return {
            nodes: nodes,
            edges: edges,
            start: start,
            end: end,
            positions: positions
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

        for (const group of groups.values()) {
            if (group.length === 1) continue;

            const combinedAst = this._parallelAst(group.map((edge) => edge.ast));
            const combinedAdmittance = group.reduce((sum, edge) => sum + edge.admittance, 0);
            const combinedEdge = {
                a: group[0].a,
                b: group[0].b,
                admittance: combinedAdmittance,
                displayValue: this._formatNumber(this._fromAdmittance(combinedAdmittance)),
                visualId: this._nextVisualEdgeId(),
                generated: true,
                generatedBy: "parallel",
                sourceNames: this._sourceNamesForEdges(group),
                ast: combinedAst
            };
            network.edges = network.edges.filter((edge) => !group.includes(edge));
            network.edges.push(combinedEdge);

            this._addStep(
                "parallel",
                "Parallel reduction",
                `${group.length} branches share the same endpoints, ` +
                    `${this._nodeName(group[0].a)} and ${this._nodeName(group[0].b)}.`,
                this._astToComponentString(combinedAst, true, true),
                `${this._componentNameFromSources(combinedEdge.sourceNames, combinedAst)} = ` +
                    this._formatNumber(this._fromAdmittance(combinedAdmittance)),
                this._captureNetwork(network, [combinedEdge])
            );

            return true;
        }

        return false;
    }

    _removeDanglingNodes(network) {
        const degree = this._degreeMap(network);
        const removable = Array.from(network.nodes).filter((node) => {
            return node !== network.start &&
                node !== network.end &&
                (degree.get(node) || 0) <= 1;
        });

        if (removable.length === 0) return false;

        const removedNames = removable.map((node) => this._nodeName(node));

        const removeSet = new Set(removable);
        network.edges = network.edges.filter((edge) => {
            return !removeSet.has(edge.a) && !removeSet.has(edge.b);
        });
        for (const node of removable) network.nodes.delete(node);

        this._addStep(
            "inactive",
            "Remove inactive branches",
            `${removedNames.join(", ")} ${removedNames.length === 1 ? "is" : "are"} connected at only one point ` +
                "and cannot carry current between StartNode and DestNode.",
            null,
            null,
            this._captureNetwork(network)
        );
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

            const combinedAst = this._seriesAst([left.ast, right.ast]);
            const combinedAdmittance = (left.admittance * right.admittance) / denominator;
            const combinedEdge = {
                a: leftNode,
                b: rightNode,
                admittance: combinedAdmittance,
                displayValue: this._formatNumber(this._fromAdmittance(combinedAdmittance)),
                visualId: this._nextVisualEdgeId(),
                generated: true,
                generatedBy: "series",
                sourceNames: this._sourceNamesForEdges([left, right]),
                ast: combinedAst
            };
            network.edges.push(combinedEdge);

            this._addStep(
                "series",
                "Series reduction",
                `${this._nodeName(node)} connects exactly two branches, so the branches are in series.`,
                this._astToComponentString(combinedAst, true, true),
                `${this._componentNameFromSources(combinedEdge.sourceNames, combinedAst)} = ` +
                    this._formatNumber(this._fromAdmittance(combinedAdmittance)),
                this._captureNetwork(network, [combinedEdge])
            );
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

        const before = incident.map((edge) => {
            return `${this._nodeName(this._otherEnd(edge, node))}: ` +
                this._astToComponentString(edge.ast, true, true);
        }).join("; ");
        const generated = [];
        const generatedEdges = [];

        for (let i = 0; i < incident.length; ++i) {
            for (let j = i + 1; j < incident.length; ++j) {
                const a = this._otherEnd(incident[i], node);
                const b = this._otherEnd(incident[j], node);
                if (a === b) continue;

                const admittance = (incident[i].admittance * incident[j].admittance) / totalAdmittance;
                if (!(admittance > 0) || !Number.isFinite(admittance)) continue;

                const transformedValue = this._fromAdmittance(admittance);
                const formattedValue = this._formatNumber(transformedValue);
                const transformedName = `SM${this.nextTransformedBranchNumber++}`;
                const generatedEdge = {
                    a: a,
                    b: b,
                    admittance: admittance,
                    displayValue: formattedValue,
                    visualId: this._nextVisualEdgeId(),
                    generated: true,
                    generatedBy: "star-mesh",
                    sourceNames: this._sourceNamesForEdges(incident),
                    ast: {
                        type: "value",
                        value: formattedValue,
                        name: transformedName
                    }
                };
                network.edges.push(generatedEdge);
                generatedEdges.push(generatedEdge);
                generated.push(
                    `${transformedName} (${this._nodeName(a)} ↔ ${this._nodeName(b)}) = ${formattedValue}`
                );
            }
        }

        this._addStep(
            "transform",
            "Star–mesh transformation",
            `${this._nodeName(node)} has ${incident.length} connected branches and cannot be removed by direct ` +
                "series/parallel reduction. It is eliminated with Yij = Yi × Yj / ΣY.",
            before,
            generated.join("; "),
            this._captureNetwork(network, generatedEdges)
        );

        return true;
    }

    _nextVisualEdgeId() {
        return `E${this.nextVisualEdgeNumber++}`;
    }

    _captureNetwork(network, highlightedEdges = []) {
        if (!network) return null;

        const nodes = Array.from(network.nodes);
        const nodeIds = new Map();
        const highlighted = new Set(highlightedEdges);
        for (let i = 0; i < nodes.length; ++i) nodeIds.set(nodes[i], `N${i}`);

        return {
            componentType: this._componentType(),
            nodes: nodes.map((node, index) => {
                const position = network.positions && network.positions.get(node);
                return {
                    id: nodeIds.get(node),
                    name: this._nodeName(node),
                    terminal: node === network.start
                        ? "start"
                        : (node === network.end ? "end" : null),
                    x: position && Number.isFinite(position.x) ? position.x : index * 120,
                    y: position && Number.isFinite(position.y) ? position.y : 0
                };
            }),
            edges: network.edges.map((edge) => {
                return {
                    id: edge.visualId || this._nextVisualEdgeId(),
                    a: nodeIds.get(edge.a),
                    b: nodeIds.get(edge.b),
                    name: edge.generatedBy === "star-mesh"
                        ? this._equivalentComponentName(edge.ast)
                        : this._componentNameFromSources(edge.sourceNames, edge.ast),
                    value: edge.displayValue || this._formatNumber(this._fromAdmittance(edge.admittance)),
                    expression: this._astToComponentString(edge.ast, false, true),
                    generated: edge.generated === true,
                    highlighted: highlighted.has(edge)
                };
            })
        };
    }

    _equivalentComponentName(ast) {
        const names = [];
        const collectNames = (part) => {
            if (!part) return;
            if (part.type === "value") {
                if (part.name && !names.includes(part.name)) names.push(part.name);
                return;
            }

            const children = part.type === "series" ? part.parts : part.branches;
            for (const child of (children || [])) collectNames(child);
        };
        collectNames(ast);

        if (names.length === 0) return `${this._componentType()}eq`;
        if (names.length === 1) return names[0];

        const parsed = names.map((name) => String(name).match(/^([A-Za-z]+)(\d+)$/));
        const samePrefix = parsed.every((match) => {
            return match && match[1] === parsed[0][1];
        });
        if (samePrefix) {
            const suffixes = parsed
                .map((match) => Number(match[2]))
                .filter((number, index, values) => values.indexOf(number) === index)
                .sort((left, right) => left - right);
            return parsed[0][1] + suffixes.join(",");
        }

        return names.join(",");
    }

    _sourceNamesForEdges(edges) {
        const names = [];
        for (const edge of edges) {
            for (const name of (edge.sourceNames || [])) {
                if (name && !names.includes(name)) names.push(name);
            }
        }
        return names;
    }

    _componentNameFromSources(sourceNames, fallbackAst) {
        const names = Array.isArray(sourceNames) ? sourceNames.filter(Boolean) : [];
        if (names.length === 0) return this._equivalentComponentName(fallbackAst);
        if (names.length === 1) return names[0];

        const syntheticAst = {
            type: "series",
            parts: names.map((name) => {
                return { type: "value", value: "", name: name };
            })
        };
        return this._equivalentComponentName(syntheticAst);
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

    _astToComponentString(ast, includeValues = false, topLevel = false) {
        if (ast.type === "value") {
            if (!ast.name) return ast.value;
            return includeValues ? `${ast.name} (${ast.value})` : ast.name;
        }

        if (ast.type === "series") {
            return ast.parts.map((part) => {
                const text = this._astToComponentString(part, includeValues, false);
                return part.type === "parallel" ? `(${this._stripOuterParentheses(text)})` : text;
            }).join(" + ");
        }

        const text = ast.branches.map((branch) => {
            const branchText = this._astToComponentString(branch, includeValues, false);
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

    _componentName(value) {
        if (!value || typeof value !== "object") return null;

        if (value.parent && value.parent.name && value.parent.name.value !== undefined) {
            return String(value.parent.name.value).trim() || null;
        }
        if (value.componentName !== undefined) {
            return String(value.componentName).trim() || null;
        }
        return null;
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
