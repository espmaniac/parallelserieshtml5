class SolutionMethodRegistry {
    constructor() {
        this.methods = new Map();
    }

    register(method) {
        if (!method || !method.id || !method.label || typeof method.solve !== "function") {
            throw new Error("A solution method requires an id, label, and solve function.");
        }
        if (this.methods.has(method.id)) {
            throw new Error(`Solution method "${method.id}" is already registered.`);
        }
        this.methods.set(method.id, method);
    }

    get(methodId) {
        return this.methods.get(methodId) || null;
    }

    list() {
        return Array.from(this.methods.values());
    }

    solve(methodId, startNode, destNode) {
        const method = this.get(methodId);
        if (!method) {
            return {
                expression: null,
                componentExpression: null,
                answer: null,
                steps: [{
                    type: "error",
                    title: "Unknown solution method",
                    description: `The method "${methodId}" is not registered.`,
                    before: null,
                    after: null
                }]
            };
        }
        return method.solve(startNode, destNode);
    }
}

const solutionMethodRegistry = new SolutionMethodRegistry();

solutionMethodRegistry.register({
    id: "series-parallel-star-mesh",
    label: "Series/Parallel + Star-Mesh",
    description: "Reduces direct series and parallel branches first, then uses star-mesh (Kron) elimination for delta, bridge, and mixed networks.",
    solve(startNode, destNode) {
        const graph = new Graph();
        const expression = graph.toString(startNode, destNode);
        return {
            expression: expression || null,
            componentExpression: graph.getComponentExpression(),
            nodeLabels: graph.getNodeLabels(),
            answer: null,
            steps: graph.getSolutionSteps()
        };
    }
});
