const solutionPlayback = {
    solution: null,
    originalSchemeState: null,
    currentStepIndex: -1,

    configure(solution) {
        this._hideContextMenu();
        this._cancelActiveInteraction();
        if (this.originalSchemeState) this._restoreOriginalScheme(false);

        this.solution = solution || null;
        this.originalSchemeState = this.solution ? this._captureSchemeState() : null;
        this.currentStepIndex = -1;
        if (document.body) {
            document.body.classList.toggle("solution-playback-mode", Boolean(this.solution));
            document.body.classList.remove("solution-playback-step");
        }
        this._updateControls();
        this._updateStepSelection();
    },

    close() {
        this._hideContextMenu();
        this._cancelActiveInteraction();
        const hadSavedScheme = Boolean(this.originalSchemeState);
        if (hadSavedScheme) this._restoreOriginalScheme(false);

        this.solution = null;
        this.originalSchemeState = null;
        this.currentStepIndex = -1;
        if (document.body) {
            document.body.classList.remove("solution-playback-mode");
            document.body.classList.remove("solution-playback-step");
        }
        this._updateControls();
        this._updateStepSelection();
        if (hadSavedScheme && typeof scheme !== "undefined") scheme.renderAll();
    },

    showOriginal() {
        if (!this.originalSchemeState) return;

        this._hideContextMenu();
        this._cancelActiveInteraction();
        this._restoreOriginalScheme(false);
        this.currentStepIndex = -1;
        if (document.body) document.body.classList.remove("solution-playback-step");
        this._updateControls();
        this._updateStepSelection();
        scheme.renderAll();
    },

    showStep(stepIndex) {
        if (!this._stepHasSnapshot(stepIndex) || !this.originalSchemeState) return;

        this._cancelActiveInteraction();
        const step = this.solution.steps[stepIndex];
        const playbackState = this._buildSchemeState(step.snapshot);
        if (!playbackState) return;

        this._hideContextMenu();
        this._applySchemeState(playbackState);
        this.currentStepIndex = stepIndex;
        if (document.body) document.body.classList.add("solution-playback-step");
        this._updateControls();
        this._updateStepSelection();
        scheme.renderAll();

        const item = document.querySelector(`#solutionSteps .solutionStep[data-step-index="${stepIndex}"]`);
        if (item) item.scrollIntoView({ block: "nearest", behavior: "smooth" });
    },

    previous() {
        const indexes = this._snapshotStepIndexes();
        const position = indexes.indexOf(this.currentStepIndex);
        if (position <= 0) {
            this.showOriginal();
            return;
        }
        this.showStep(indexes[position - 1]);
    },

    next() {
        const indexes = this._snapshotStepIndexes();
        if (indexes.length === 0) return;

        const position = indexes.indexOf(this.currentStepIndex);
        if (this.currentStepIndex < 0 || position < 0) {
            this.showStep(indexes[0]);
            return;
        }
        if (position < indexes.length - 1) this.showStep(indexes[position + 1]);
    },

    isActive() {
        return Boolean(this.originalSchemeState && this._stepHasSnapshot(this.currentStepIndex));
    },

    isInteractionLocked() {
        const inspector = document.getElementById("solutionInspector");
        return Boolean(this.solution && inspector && !inspector.hidden && !this.isActive());
    },

    _captureSchemeState() {
        return {
            components: scheme.components,
            selectedComponents: scheme.selectedComponents,
            wires: scheme.wires,
            selectedWires: scheme.selectedWires,
            junctions: scheme.junctions,
            labels: scheme.labels,
            undoStack: scheme.undoStack,
            redoStack: scheme.redoStack,
            componentNameCount: Component.nameCount
        };
    },

    _applySchemeState(state) {
        scheme.components = state.components;
        scheme.selectedComponents = state.selectedComponents;
        scheme.wires = state.wires;
        scheme.selectedWires = state.selectedWires;
        scheme.junctions = state.junctions;
        scheme.labels = state.labels;
        scheme.undoStack = state.undoStack;
        scheme.redoStack = state.redoStack;
        Component.nameCount = state.componentNameCount;
    },

    _restoreOriginalScheme(render = true) {
        if (!this.originalSchemeState) return;
        this._applySchemeState(this.originalSchemeState);
        if (render) scheme.renderAll();
    },

    _cancelActiveInteraction() {
        if (typeof toolmgr !== "undefined") toolmgr.activeCmd = null;
        if (typeof scheme !== "undefined") {
            scheme.isDragging = false;
            scheme.isPanning = false;
        }
    },

    _hideContextMenu() {
        if (typeof context_menu !== "undefined" && context_menu.element && !context_menu.hidden()) {
            context_menu.hide();
        }
    },

    _buildSchemeState(snapshot) {
        if (!snapshot || !Array.isArray(snapshot.nodes) || !Array.isArray(snapshot.edges)) return null;

        const screenLayout = this._layoutNodes(snapshot.nodes, getCanvasWidth(), getCanvasHeight());
        const worldLayout = new Map();
        for (const [nodeId, position] of screenLayout.entries()) {
            worldLayout.set(nodeId, scheme.screenToWorldSpace(position.x, position.y));
        }

        const components = {};
        const wires = [];
        const junctions = [];
        const logicalNodes = new Map();
        const edgeGroups = this._edgeGroups(snapshot.edges);

        for (const node of snapshot.nodes) logicalNodes.set(node.id, []);

        for (const group of edgeGroups) {
            for (let index = 0; index < group.length; ++index) {
                const edge = group[index];
                const offset = (index - (group.length - 1) / 2) * 48;
                this._addPlaybackBranch(
                    edge,
                    offset,
                    screenLayout,
                    worldLayout,
                    components,
                    wires,
                    logicalNodes
                );
            }
        }

        for (const node of snapshot.nodes) {
            const connectedNodes = logicalNodes.get(node.id) || [];
            const position = worldLayout.get(node.id);
            if (connectedNodes.length === 0 && position) {
                const standalone = new Node();
                standalone.x = position.x;
                standalone.y = position.y;
                connectedNodes.push(standalone);
            }

            for (let index = 1; index < connectedNodes.length; ++index) {
                connectNodes(connectedNodes[0], connectedNodes[index], "0");
            }

            if (connectedNodes.length >= 3 && position) {
                const junction = new Junction();
                junction.x = position.x;
                junction.y = position.y;
                for (const connectedNode of connectedNodes) connectJunctionNode(junction, connectedNode);
                junctions.push(junction);
            }
        }

        const labels = this._buildPlaybackLabels(snapshot.nodes, logicalNodes);
        return {
            components: components,
            selectedComponents: [],
            wires: wires,
            selectedWires: [],
            junctions: junctions,
            labels: labels,
            undoStack: [],
            redoStack: [],
            componentNameCount: Object.keys(components).length + 1
        };
    },

    _addPlaybackBranch(edge, offset, screenLayout, worldLayout, components, wires, logicalNodes) {
        let startId = edge.a;
        let endId = edge.b;
        let start = screenLayout.get(startId);
        let end = screenLayout.get(endId);
        if (!start || !end) return;

        if (end.x < start.x || (end.x === start.x && end.y < start.y)) {
            const savedId = startId;
            const savedPosition = start;
            startId = endId;
            start = end;
            endId = savedId;
            end = savedPosition;
        }

        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const normalX = -dy / distance;
        const normalY = dx / distance;
        const centerScreen = {
            x: (start.x + end.x) / 2 + normalX * offset,
            y: (start.y + end.y) / 2 + normalY * offset
        };
        const center = scheme.screenToWorldSpace(centerScreen.x, centerScreen.y);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        const componentType = typeof choosenComponent !== "undefined" && choosenComponent.shortName
            ? choosenComponent.shortName
            : "R";
        const name = this._uniqueComponentName(edge.name || `${componentType}eq`, components);
        const component = new Component(
            name,
            String(edge.value || "0"),
            center.x - cellSize,
            center.y - cellSize / 2,
            angle
        );
        components[name] = component;

        const startWire = this._wireFromComponentToNode(
            component.nodes[0],
            worldLayout.get(startId),
            logicalNodes.get(startId)
        );
        const endWire = this._wireFromComponentToNode(
            component.nodes[1],
            worldLayout.get(endId),
            logicalNodes.get(endId)
        );
        if (startWire) wires.push(startWire);
        if (endWire) wires.push(endWire);
    },

    _wireFromComponentToNode(componentNode, logicalPosition, connectedNodes) {
        if (!componentNode || !logicalPosition || !connectedNodes) return null;

        const wire = new Wire();
        wire.nodes[0].x = componentNode.x;
        wire.nodes[0].y = componentNode.y;
        wire.nodes[1].x = logicalPosition.x;
        wire.nodes[1].y = logicalPosition.y;
        connectNodes(componentNode, wire.nodes[0], "0");
        connectedNodes.push(wire.nodes[1]);
        return wire;
    },

    _buildPlaybackLabels(nodes, logicalNodes) {
        const startLabel = new LabelNode("StartNode");
        const destLabel = new LabelNode("DestNode");
        const labels = [startLabel, destLabel];
        let sharedTerminalNode = null;

        for (const node of nodes) {
            const connectedNodes = logicalNodes.get(node.id) || [];
            const labelNode = connectedNodes[0] || null;
            if (!labelNode) continue;

            if (node.terminal === "start" || node.name === "StartNode") {
                startLabel.node = labelNode;
                sharedTerminalNode = labelNode;
                continue;
            }
            if (node.terminal === "end" || node.name === "DestNode") {
                destLabel.node = labelNode;
                continue;
            }

            const label = new LabelNode(node.name);
            label.className = "GraphLabelNode";
            label.node = labelNode;
            labels.push(label);
        }

        if (!destLabel.node && nodes.length === 1) destLabel.node = sharedTerminalNode;
        return labels;
    },

    _uniqueComponentName(preferredName, components) {
        if (!Object.prototype.hasOwnProperty.call(components, preferredName)) return preferredName;

        let suffix = 2;
        while (Object.prototype.hasOwnProperty.call(components, `${preferredName}.${suffix}`)) suffix++;
        return `${preferredName}.${suffix}`;
    },

    _snapshotStepIndexes() {
        const steps = this.solution && Array.isArray(this.solution.steps)
            ? this.solution.steps
            : [];
        const indexes = [];
        for (let i = 0; i < steps.length; ++i) {
            if (steps[i] && steps[i].snapshot) indexes.push(i);
        }
        return indexes;
    },

    _stepHasSnapshot(stepIndex) {
        return Boolean(
            this.solution &&
            Array.isArray(this.solution.steps) &&
            stepIndex >= 0 &&
            this.solution.steps[stepIndex] &&
            this.solution.steps[stepIndex].snapshot
        );
    },

    _updateControls() {
        const status = document.getElementById("solutionPlaybackStatus");
        const original = document.getElementById("solutionPlaybackOriginal");
        const previous = document.getElementById("solutionPlaybackPrevious");
        const next = document.getElementById("solutionPlaybackNext");
        if (!status || !original || !previous || !next) return;

        const indexes = this._snapshotStepIndexes();
        const position = indexes.indexOf(this.currentStepIndex);
        if (position < 0) {
            status.textContent = "Original circuit";
        } else {
            const step = this.solution.steps[this.currentStepIndex];
            status.textContent = `Step ${this.currentStepIndex + 1}: ${step.title}`;
        }

        original.disabled = this.currentStepIndex < 0;
        previous.disabled = this.currentStepIndex < 0;
        next.disabled = indexes.length === 0 || position === indexes.length - 1;
    },

    _updateStepSelection() {
        const items = document.querySelectorAll("#solutionSteps .solutionStep");
        for (const item of items) {
            const selected = Number(item.dataset.stepIndex) === this.currentStepIndex;
            item.classList.toggle("active", selected);
            if (selected) item.setAttribute("aria-current", "step");
            else item.removeAttribute("aria-current");
        }
    },

    _layoutNodes(nodes, width, height) {
        const positions = new Map();
        if (!Array.isArray(nodes) || nodes.length === 0) return positions;

        const paddingX = Math.min(130, Math.max(82, width * 0.15));
        const paddingY = Math.min(115, Math.max(88, height * 0.17));
        const availableWidth = Math.max(160, width - paddingX * 2);
        const availableHeight = Math.max(160, height - paddingY * 2);
        const minX = Math.min(...nodes.map((node) => node.x));
        const maxX = Math.max(...nodes.map((node) => node.x));
        const minY = Math.min(...nodes.map((node) => node.y));
        const maxY = Math.max(...nodes.map((node) => node.y));
        const sourceWidth = maxX - minX;
        const sourceHeight = maxY - minY;

        if (nodes.length === 1) {
            positions.set(nodes[0].id, { x: width / 2, y: height / 2 });
            return positions;
        }

        let scale = Math.min(
            sourceWidth > 0 ? availableWidth / sourceWidth : Infinity,
            sourceHeight > 0 ? availableHeight / sourceHeight : Infinity
        );
        if (!Number.isFinite(scale)) scale = 1;
        scale = Math.min(2, scale);

        const renderedWidth = sourceWidth * scale;
        const renderedHeight = sourceHeight * scale;
        const startX = (width - renderedWidth) / 2;
        const startY = (height - renderedHeight) / 2;

        for (let index = 0; index < nodes.length; ++index) {
            const node = nodes[index];
            let x = startX + (node.x - minX) * scale;
            let y = startY + (node.y - minY) * scale;
            if (sourceWidth === 0) x = width / 2;
            if (sourceHeight === 0) y = height / 2;
            positions.set(node.id, { x: x, y: y });
        }

        if (nodes.length === 2) {
            const left = positions.get(nodes[0].id);
            const right = positions.get(nodes[1].id);
            const dx = right.x - left.x;
            const dy = right.y - left.y;
            const distance = Math.hypot(dx, dy);
            if (distance < 320) {
                const angle = distance > 0 ? Math.atan2(dy, dx) : 0;
                const centerX = (left.x + right.x) / 2;
                const centerY = (left.y + right.y) / 2;
                const cosine = Math.abs(Math.cos(angle));
                const sine = Math.abs(Math.sin(angle));
                const horizontalCapacity = cosine > 0.001 ? availableWidth / cosine : Infinity;
                const verticalCapacity = sine > 0.001 ? availableHeight / sine : Infinity;
                const half = Math.max(90, Math.min(210, horizontalCapacity / 2, verticalCapacity / 2));
                positions.set(nodes[0].id, {
                    x: centerX - Math.cos(angle) * half,
                    y: centerY - Math.sin(angle) * half
                });
                positions.set(nodes[1].id, {
                    x: centerX + Math.cos(angle) * half,
                    y: centerY + Math.sin(angle) * half
                });
            }
        }

        return positions;
    },

    _edgeGroups(edges) {
        const groups = new Map();
        for (const edge of (edges || [])) {
            const key = [edge.a, edge.b].sort().join(":");
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(edge);
        }
        return Array.from(groups.values());
    }
};
