const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({ console: console });

vm.runInContext(
    fs.readFileSync(path.join(root, "scripts", "parallelseries.js"), "utf8") +
    "\nthis.ParallelSeries = ParallelSeries;",
    context
);
vm.runInContext(
    "var choosenComponent = { shortName: 'R' };\n" +
    fs.readFileSync(path.join(root, "scripts", "graph.js"), "utf8") +
    "\nthis.Graph = Graph; this.setComponentType = (type) => { choosenComponent.shortName = type; };",
    context
);

class TestNode {
    constructor() {
        this.connections = [];
    }
}

function connect(left, right, value) {
    const edgeValue = value === "0" ? "0" : { value: String(value) };
    left.connections.push({ node: right, value: edgeValue });
    right.connections.push({ node: left, value: edgeValue });
}

function expressionFor(edges, startIndex, endIndex, type = "R") {
    const nodes = Array.from({ length: Math.max(...edges.flatMap((edge) => [edge[0], edge[1]])) + 1 }, () => new TestNode());
    for (const [a, b, value] of edges) connect(nodes[a], nodes[b], value);
    context.setComponentType(type);
    return new context.Graph().toString(nodes[startIndex], nodes[endIndex]);
}

function evaluate(expression, type = "R") {
    const parser = new context.ParallelSeries();
    parser.expr = expression;
    if (type === "C") {
        parser.onSeries = (left, right) => left && right ? 1 / (1 / left + 1 / right) : Math.max(left, right);
        parser.onParallel = (left, right) => left && right ? left + right : 0;
    } else {
        parser.onSeries = (left, right) => left + right;
        parser.onParallel = (left, right) => left && right ? 1 / (1 / left + 1 / right) : 0;
    }
    const result = parser.solve();
    assert.equal(parser.lexer.fail, false, `Failed to parse: ${expression}`);
    return result;
}

function nodalEquivalent(edges, start, end, type = "R") {
    const nodeCount = Math.max(...edges.flatMap((edge) => [edge[0], edge[1]])) + 1;
    const internal = [];
    for (let node = 0; node < nodeCount; ++node) {
        if (node !== start && node !== end) internal.push(node);
    }

    const index = new Map(internal.map((node, i) => [node, i]));
    const matrix = Array.from({ length: internal.length }, () => Array(internal.length).fill(0));
    const rhs = Array(internal.length).fill(0);
    const adjacency = Array.from({ length: nodeCount }, () => new Map());

    for (const [a, b, raw] of edges) {
        const value = Number(raw);
        const admittance = type === "C" ? value : 1 / value;
        adjacency[a].set(b, (adjacency[a].get(b) || 0) + admittance);
        adjacency[b].set(a, (adjacency[b].get(a) || 0) + admittance);
    }

    for (const node of internal) {
        const row = index.get(node);
        for (const [neighbor, admittance] of adjacency[node]) {
            matrix[row][row] += admittance;
            if (neighbor === start) rhs[row] += admittance;
            else if (neighbor !== end) matrix[row][index.get(neighbor)] -= admittance;
        }
    }

    for (let column = 0; column < matrix.length; ++column) {
        let pivot = column;
        for (let row = column + 1; row < matrix.length; ++row) {
            if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column])) pivot = row;
        }
        [matrix[column], matrix[pivot]] = [matrix[pivot], matrix[column]];
        [rhs[column], rhs[pivot]] = [rhs[pivot], rhs[column]];
        const divisor = matrix[column][column];
        for (let c = column; c < matrix.length; ++c) matrix[column][c] /= divisor;
        rhs[column] /= divisor;
        for (let row = 0; row < matrix.length; ++row) {
            if (row === column) continue;
            const factor = matrix[row][column];
            for (let c = column; c < matrix.length; ++c) matrix[row][c] -= factor * matrix[column][c];
            rhs[row] -= factor * rhs[column];
        }
    }

    const voltage = (node) => {
        if (node === start) return 1;
        if (node === end) return 0;
        return rhs[index.get(node)];
    };

    let totalAdmittance = 0;
    for (const [neighbor, admittance] of adjacency[start]) {
        totalAdmittance += admittance * (1 - voltage(neighbor));
    }
    return type === "C" ? totalAdmittance : 1 / totalAdmittance;
}

function assertValidExpression(expression) {
    assert.match(expression, /^[0-9a-zA-Z.,+\/()\s]+$/);
    assert.doesNotMatch(expression, /\*|-|\be\b/i);
}

function assertEquivalent(edges, start, end, type = "R", relativeTolerance = 1e-10) {
    const expression = expressionFor(edges, start, end, type);
    assert.ok(expression);
    assertValidExpression(expression);
    const actual = evaluate(expression, type);
    const expected = nodalEquivalent(edges, start, end, type);
    assert.ok(
        Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * relativeTolerance,
        `${expression}: expected ${expected}, received ${actual}`
    );
    return expression;
}

test("preserves a simple series expression", () => {
    assert.equal(expressionFor([[0, 1, 100], [1, 2, 200]], 0, 2), "100 + 200");
});

test("preserves a simple parallel expression", () => {
    const expression = expressionFor([[0, 1, 100], [0, 1, 200]], 0, 1);
    assert.equal(expression, "100 // 200");
    assert.equal(evaluate(expression), 100 * 200 / 300);
});

test("reduces a delta between the terminals", () => {
    const edges = [[0, 1, 300], [0, 2, 100], [2, 1, 200]];
    const expression = assertEquivalent(edges, 0, 1);
    assert.match(expression, /\/\//);
    assert.match(expression, /\+/);
});

test("reduces a Wheatstone bridge that is not series-parallel", () => {
    const edges = [
        [0, 1, 100], [1, 3, 100],
        [0, 2, 120], [2, 3, 180],
        [1, 2, 75]
    ];
    assertEquivalent(edges, 0, 3);
});

test("reduces a mixed network with overlapping deltas", () => {
    const edges = [
        [0, 1, 90], [1, 2, 140], [2, 0, 220],
        [1, 3, 330], [2, 3, 470], [1, 2, 680],
        [2, 4, 150], [3, 4, 270], [0, 4, 560]
    ];
    assertEquivalent(edges, 0, 4);
});

test("uses the same graph reduction for capacitor networks", () => {
    const edges = [
        [0, 1, 2], [1, 3, 5],
        [0, 2, 3], [2, 3, 7],
        [1, 2, 11]
    ];
    assertEquivalent(edges, 0, 3, "C");
});

test("keeps metric-prefixed component values parseable", () => {
    const expression = expressionFor([
        [0, 1, "1k"], [1, 3, "2k"],
        [0, 2, "3k"], [2, 3, "4k"],
        [1, 2, "5k"]
    ], 0, 3);
    const expected = nodalEquivalent([
        [0, 1, 1000], [1, 3, 2000],
        [0, 2, 3000], [2, 3, 4000],
        [1, 2, 5000]
    ], 0, 3);

    assertValidExpression(expression);
    assert.ok(Math.abs(evaluate(expression) - expected) <= expected * 1e-10);
});

test("merges wire-connected nodes before reducing the network", () => {
    const expression = expressionFor([
        [0, 1, "0"], [1, 2, 100], [0, 2, 200]
    ], 0, 2);
    assert.match(expression, /^(100 \/\/ 200|200 \/\/ 100)$/);
    assert.equal(evaluate(expression), 100 * 200 / 300);
});

test("matches nodal analysis for deterministic complex networks", () => {
    let state = 0x5eed1234;
    const random = () => {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 0x100000000;
    };

    for (const type of ["R", "C"]) {
        for (let sample = 0; sample < 60; ++sample) {
            const nodeCount = 4 + Math.floor(random() * 4);
            const edges = [];

            for (let node = 0; node < nodeCount - 1; ++node) {
                edges.push([node, node + 1, 1 + Math.floor(random() * 999)]);
            }

            for (let a = 0; a < nodeCount; ++a) {
                for (let b = a + 1; b < nodeCount; ++b) {
                    if (b === a + 1 || random() >= 0.42) continue;
                    edges.push([a, b, 1 + Math.floor(random() * 999)]);
                }
            }

            assertEquivalent(edges, 0, nodeCount - 1, type, 2e-10);
        }
    }
});
