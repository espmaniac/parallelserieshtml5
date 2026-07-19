const solutionPlayback = {
    solution: null,
    originalSchemeState: null,
    originalPlaybackState: null,
    stepSchemeStates: new Map(),
    structuredLayoutStartIndex: -1,
    currentStepIndex: -1,

    configure(solution) {
        this._hideContextMenu();
        this._cancelActiveInteraction();
        if (this.originalSchemeState) this._restoreOriginalScheme(false);

        this.solution = solution || null;
        this.originalSchemeState = this.solution ? this._captureSchemeState() : null;
        this.originalPlaybackState = this.originalSchemeState
            ? this._cloneOriginalSchemeState()
            : null;
        this.stepSchemeStates = new Map();
        this.structuredLayoutStartIndex = this._findStructuredLayoutStartIndex(this.solution);
        this.currentStepIndex = -1;
        if (this.originalPlaybackState) this._applySchemeState(this.originalPlaybackState);
        this._updateControls();
        this._updateStepSelection();
        if (this.originalPlaybackState && typeof scheme !== "undefined") scheme.renderAll();
    },

    close() {
        this._hideContextMenu();
        this._cancelActiveInteraction();
        const hadSavedScheme = Boolean(this.originalSchemeState);
        if (hadSavedScheme) this._restoreOriginalScheme(false);

        this.solution = null;
        this.originalSchemeState = null;
        this.originalPlaybackState = null;
        this.stepSchemeStates = new Map();
        this.structuredLayoutStartIndex = -1;
        this.currentStepIndex = -1;
        this._updateControls();
        this._updateStepSelection();
        if (hadSavedScheme && typeof scheme !== "undefined") scheme.renderAll();
    },

    showOriginal() {
        if (!this.originalSchemeState) return;

        this._hideContextMenu();
        this._cancelActiveInteraction();
        this._saveActivePlaybackState();
        if (!this.originalPlaybackState) {
            this.originalPlaybackState = this._cloneOriginalSchemeState();
        }
        this._applySchemeState(this.originalPlaybackState);
        this.currentStepIndex = -1;
        this._updateControls();
        this._updateStepSelection();
        scheme.renderAll();
    },

    showStep(stepIndex) {
        if (!this._stepHasSnapshot(stepIndex) || !this.originalSchemeState) return;

        this._cancelActiveInteraction();
        this._saveActivePlaybackState();
        const step = this.solution.steps[stepIndex];
        let playbackState = this.stepSchemeStates.get(stepIndex);
        if (!playbackState) {
            playbackState = step.type === "analysis"
                ? this._cloneOriginalSchemeState()
                : this._buildSchemeState(
                    step.snapshot,
                    this.structuredLayoutStartIndex >= 0 && stepIndex >= this.structuredLayoutStartIndex
                );
            if (playbackState) this.stepSchemeStates.set(stepIndex, playbackState);
        }
        if (!playbackState) return;

        this._hideContextMenu();
        this._applySchemeState(playbackState);
        this.currentStepIndex = stepIndex;
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

    _saveActivePlaybackState() {
        if (!this.originalSchemeState) return;

        const state = this._captureSchemeState();
        if (this.currentStepIndex < 0) {
            this.originalPlaybackState = state;
            return;
        }
        if (this._stepHasSnapshot(this.currentStepIndex)) {
            this.stepSchemeStates.set(this.currentStepIndex, state);
        }
    },

    _cancelActiveInteraction() {
        if (typeof toolmgr !== "undefined" && toolmgr.activeCmd) {
            const activeCommand = toolmgr.activeCmd;
            if (activeCommand.name === "DrawWire" && activeCommand.wire && typeof scheme !== "undefined") {
                const wireIndex = scheme.wires.indexOf(activeCommand.wire);
                if (wireIndex >= 0) scheme.wires.splice(wireIndex, 1);
                activeCommand.wire.onDelete();
            } else if (activeCommand.name === "DragComponent" && typeof activeCommand.unexecute === "function") {
                activeCommand.unexecute();
            }
            toolmgr.activeCmd = null;
        }
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

    _buildSchemeState(snapshot, useStructuredLayout = false) {
        if (!snapshot || !Array.isArray(snapshot.nodes) || !Array.isArray(snapshot.edges)) return null;

        const worldLayout = useStructuredLayout
            ? this._layoutStructuredNodes(snapshot.nodes)
            : new Map(snapshot.nodes.map((node) => {
                return [node.id, { x: snapToGrid(node.x), y: snapToGrid(node.y) }];
            }));

        const components = {};
        const wires = [];
        const junctions = [];
        const logicalNodes = new Map();
        const edgeGroups = this._edgeGroups(snapshot.edges);

        for (const node of snapshot.nodes) logicalNodes.set(node.id, []);

        if (useStructuredLayout) {
            const routes = this._buildStructuredRoutes(snapshot, worldLayout, edgeGroups);
            for (const route of routes) {
                this._addStructuredPlaybackBranch(
                    route.edge,
                    route.laneY,
                    worldLayout,
                    components,
                    wires,
                    logicalNodes
                );
            }
        } else {
            for (const group of edgeGroups) {
                for (let index = 0; index < group.length; ++index) {
                    const edge = group[index];
                    const offset = (index - (group.length - 1) / 2) * cellSize * 2;
                    this._addPlaybackBranch(
                        edge,
                        offset,
                        worldLayout,
                        components,
                        wires,
                        logicalNodes
                    );
                }
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

    _findStructuredLayoutStartIndex(solution) {
        const steps = solution && Array.isArray(solution.steps) ? solution.steps : [];
        for (let index = 0; index < steps.length; ++index) {
            const step = steps[index];
            if (step && step.type !== "analysis" && this._needsStructuredLayout(step.snapshot)) {
                return index;
            }
        }
        return -1;
    },

    _needsStructuredLayout(snapshot) {
        if (!snapshot || !Array.isArray(snapshot.nodes) || !Array.isArray(snapshot.edges)) return false;
        if (snapshot.nodes.length < 2) return false;

        const columnIndexes = this._snapshotColumnIndexes(snapshot.nodes);
        const positions = new Map(snapshot.nodes.map((node) => [node.id, node]));
        const edgeGroups = this._edgeGroups(snapshot.edges);

        const hasGeneratedLongBranch = snapshot.edges.some((edge) => {
            if (!edge.generated) return false;
            const left = columnIndexes.get(edge.a);
            const right = columnIndexes.get(edge.b);
            return Number.isInteger(left) && Number.isInteger(right) && Math.abs(left - right) > 1;
        });
        // Keep the recognizable source geometry while it remains readable.
        // Small reduced graphs need a new layout once generated branches skip columns.
        if (snapshot.nodes.length <= 4 && hasGeneratedLongBranch) return true;

        const hasGeneratedDiagonalParallelGroup = edgeGroups.some((group) => {
            if (group.length < 2 || !group.some((edge) => edge.generated)) return false;
            const start = positions.get(group[0].a);
            const end = positions.get(group[0].b);
            return start && end && start.x !== end.x && start.y !== end.y;
        });
        if (hasGeneratedDiagonalParallelGroup) return true;

        return snapshot.nodes.length <= 4 && snapshot.edges.length > snapshot.nodes.length;
    },

    _snapshotColumnIndexes(nodes) {
        const ordered = this._orderedSnapshotNodes(nodes);
        const start = ordered[0];
        const end = ordered[ordered.length - 1];
        const useX = !start || !end || Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
        const coordinate = (node) => snapToGrid(useX ? node.x : node.y);
        const columns = Array.from(new Set(nodes.map(coordinate))).sort((left, right) => left - right);
        const indexes = new Map();
        for (const node of nodes) indexes.set(node.id, columns.indexOf(coordinate(node)));
        return indexes;
    },

    _orderedSnapshotNodes(nodes) {
        if (!Array.isArray(nodes) || nodes.length <= 1) return (nodes || []).slice();

        const start = nodes.find((node) => node.terminal === "start" || node.name === "StartNode") || nodes[0];
        const end = nodes.find((node) => node.terminal === "end" || node.name === "DestNode") || nodes[nodes.length - 1];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const lengthSquared = dx * dx + dy * dy;
        const projection = (node) => {
            if (lengthSquared <= 0) return node.x * 100000 + node.y;
            return (node.x - start.x) * dx + (node.y - start.y) * dy;
        };
        const internal = nodes.filter((node) => node !== start && node !== end);
        internal.sort((left, right) => {
            return projection(left) - projection(right) ||
                left.x - right.x ||
                left.y - right.y ||
                String(left.name).localeCompare(String(right.name));
        });
        return start === end ? [start].concat(internal) : [start].concat(internal, [end]);
    },

    _layoutStructuredNodes(nodes) {
        const layout = new Map();
        const ordered = this._orderedSnapshotNodes(nodes);
        if (ordered.length === 0) return layout;
        if (ordered.length === 1) {
            layout.set(ordered[0].id, { x: snapToGrid(ordered[0].x), y: snapToGrid(ordered[0].y) });
            return layout;
        }

        const start = ordered[0];
        const end = ordered[ordered.length - 1];
        const centerX = snapToGrid((start.x + end.x) / 2);
        const baselineY = snapToGrid((start.y + end.y) / 2);
        const sourceSpan = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y));
        const intervalCount = ordered.length - 1;
        const minimumSpan = intervalCount * cellSize * 12;
        const maximumSpan = intervalCount * cellSize * 20;
        const span = snapToGrid(Math.max(minimumSpan, Math.min(maximumSpan, sourceSpan)));
        const leftX = centerX - span / 2;

        for (let index = 0; index < ordered.length; ++index) {
            layout.set(ordered[index].id, {
                x: snapToGrid(leftX + span * index / intervalCount),
                y: baselineY
            });
        }
        return layout;
    },

    _buildStructuredRoutes(snapshot, worldLayout, edgeGroups) {
        const orderedIds = Array.from(worldLayout.entries())
            .sort((left, right) => left[1].x - right[1].x || String(left[0]).localeCompare(String(right[0])))
            .map((entry) => entry[0]);
        const nodeIndexes = new Map(orderedIds.map((id, index) => [id, index]));
        const baselineY = worldLayout.size > 0 ? Array.from(worldLayout.values())[0].y : 0;
        const laneSpacing = cellSize * 5;
        const maximumParallelCount = edgeGroups.reduce((maximum, group) => Math.max(maximum, group.length), 1);
        const localExtent = (maximumParallelCount - 1) * laneSpacing / 2;
        const outerLaneStart = Math.max(cellSize * 10, localExtent + laneSpacing);
        const routes = [];
        const longGroups = [];

        for (const group of edgeGroups) {
            const first = group[0];
            const leftIndex = Math.min(nodeIndexes.get(first.a), nodeIndexes.get(first.b));
            const rightIndex = Math.max(nodeIndexes.get(first.a), nodeIndexes.get(first.b));
            if (rightIndex - leftIndex <= 1) {
                // Adjacent parallel branches fan out symmetrically around the node baseline.
                for (let index = 0; index < group.length; ++index) {
                    const offset = (index - (group.length - 1) / 2) * laneSpacing;
                    routes.push({ edge: group[index], laneY: snapToGrid(baselineY + offset) });
                }
            } else {
                longGroups.push({ group: group, left: leftIndex, right: rightIndex });
            }
        }

        longGroups.sort((left, right) => {
            return (left.right - left.left) - (right.right - right.left) || left.left - right.left;
        });
        // Non-local branches use independent outer channels. Shorter nested
        // intervals are placed first so their endpoint risers do not cross wider routes.
        const occupied = { above: [], below: [] };
        const firstFreeLevel = (levels, interval) => {
            for (let level = 0; level < levels.length; ++level) {
                const overlaps = levels[level].some((used) => {
                    return interval.left <= used.right && interval.right >= used.left;
                });
                if (!overlaps) return level;
            }
            return levels.length;
        };
        const occupy = (levels, level, interval) => {
            if (!levels[level]) levels[level] = [];
            levels[level].push(interval);
        };

        for (const longGroup of longGroups) {
            for (const edge of longGroup.group) {
                const aboveLevel = firstFreeLevel(occupied.above, longGroup);
                const belowLevel = firstFreeLevel(occupied.below, longGroup);
                const useAbove = aboveLevel <= belowLevel;
                const level = useAbove ? aboveLevel : belowLevel;
                const levels = useAbove ? occupied.above : occupied.below;
                occupy(levels, level, longGroup);
                const direction = useAbove ? -1 : 1;
                routes.push({
                    edge: edge,
                    laneY: snapToGrid(baselineY + direction * (outerLaneStart + level * laneSpacing))
                });
            }
        }
        return routes;
    },

    _cloneOriginalSchemeState() {
        if (!this.originalSchemeState) return null;

        const components = {};
        const wires = [];
        const junctions = [];
        const nodeMap = new Map();
        const componentMap = new Map();

        for (const key in this.originalSchemeState.components) {
            const original = this.originalSchemeState.components[key];
            const component = new Component(
                original.name.value,
                original.value.value,
                original.x,
                original.y,
                original.angle
            );
            component.select(original.selected);
            components[key] = component;
            componentMap.set(original, component);
            nodeMap.set(original.nodes[0], component.nodes[0]);
            nodeMap.set(original.nodes[1], component.nodes[1]);
        }

        for (const original of this.originalSchemeState.wires) {
            const wire = new Wire();
            wire.nodes[0].x = original.nodes[0].x;
            wire.nodes[0].y = original.nodes[0].y;
            wire.nodes[1].x = original.nodes[1].x;
            wire.nodes[1].y = original.nodes[1].y;
            wire.selected = original.selected;
            wires.push(wire);
            nodeMap.set(original.nodes[0], wire.nodes[0]);
            nodeMap.set(original.nodes[1], wire.nodes[1]);
        }

        for (const [originalNode, clonedNode] of nodeMap.entries()) {
            for (const connection of originalNode.connections) {
                const connectedNode = nodeMap.get(connection.node);
                if (!connectedNode) continue;

                let value = connection.value;
                if (value && typeof value === "object" && value.parent) {
                    const clonedParent = componentMap.get(value.parent);
                    if (clonedParent) value = clonedParent.value;
                }
                connectNodes(clonedNode, connectedNode, value);
            }
        }

        for (const original of this.originalSchemeState.junctions) {
            const junction = new Junction();
            junction.x = original.x;
            junction.y = original.y;
            for (const originalNode of original.nodes) {
                const clonedNode = nodeMap.get(originalNode);
                if (clonedNode) connectJunctionNode(junction, clonedNode);
            }
            junctions.push(junction);
        }

        const labels = this.originalSchemeState.labels.map((original) => {
            const label = new LabelNode(original.label.value);
            label.className = original.className;
            label.node = nodeMap.get(original.node) || null;
            label.offX = original.offX;
            label.offY = original.offY;
            label.radius = original.radius;
            label.label.rotate(original.label.angle);
            label.select(original.selected);
            return label;
        });

        return {
            components: components,
            selectedComponents: this.originalSchemeState.selectedComponents
                .map((component) => componentMap.get(component))
                .filter(Boolean),
            wires: wires,
            selectedWires: this.originalSchemeState.selectedWires.slice(),
            junctions: junctions,
            labels: labels,
            undoStack: [],
            redoStack: [],
            componentNameCount: this.originalSchemeState.componentNameCount
        };
    },

    _addPlaybackBranch(edge, offset, worldLayout, components, wires, logicalNodes) {
        let startId = edge.a;
        let endId = edge.b;
        let start = worldLayout.get(startId);
        let end = worldLayout.get(endId);
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
        const center = {
            x: snapToGrid((start.x + end.x) / 2 + normalX * offset),
            y: snapToGrid((start.y + end.y) / 2 + normalY * offset)
        };
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        const componentType = typeof choosenComponent !== "undefined" && choosenComponent.shortName
            ? choosenComponent.shortName
            : "R";
        const name = this._uniqueComponentName(edge.name || `${componentType}eq`, components);
        const component = new Component(
            name,
            String(edge.value || "0"),
            snapToGrid(center.x - cellSize),
            snapToGrid(center.y - cellSize / 2),
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

    _addStructuredPlaybackBranch(edge, laneY, worldLayout, components, wires, logicalNodes) {
        let startId = edge.a;
        let endId = edge.b;
        let start = worldLayout.get(startId);
        let end = worldLayout.get(endId);
        if (!start || !end) return;

        if (end.x < start.x) {
            const savedId = startId;
            const savedPosition = start;
            startId = endId;
            start = end;
            endId = savedId;
            end = savedPosition;
        }

        const centerX = snapToGrid((start.x + end.x) / 2);
        const componentType = typeof choosenComponent !== "undefined" && choosenComponent.shortName
            ? choosenComponent.shortName
            : "R";
        const name = this._uniqueComponentName(edge.name || `${componentType}eq`, components);
        const component = new Component(
            name,
            String(edge.value || "0"),
            snapToGrid(centerX - cellSize),
            snapToGrid(laneY - cellSize / 2),
            0
        );
        component.name.y = snapToGrid(laneY - cellSize);
        component.value.y = snapToGrid(laneY + cellSize);
        components[name] = component;

        this._wireOrthogonalPath(
            component.nodes[0],
            worldLayout.get(startId),
            logicalNodes.get(startId),
            wires
        );
        this._wireOrthogonalPath(
            component.nodes[1],
            worldLayout.get(endId),
            logicalNodes.get(endId),
            wires
        );
    },

    _wireOrthogonalPath(componentNode, logicalPosition, connectedNodes, wires) {
        if (!componentNode || !logicalPosition || !connectedNodes || !wires) return;

        const points = [{ x: componentNode.x, y: componentNode.y }];
        if (componentNode.y !== logicalPosition.y) {
            points.push({ x: logicalPosition.x, y: componentNode.y });
        }
        points.push({ x: logicalPosition.x, y: logicalPosition.y });

        const compactPoints = points.filter((point, index) => {
            return index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y;
        });
        let previousNode = componentNode;
        for (let index = 1; index < compactPoints.length; ++index) {
            const start = compactPoints[index - 1];
            const end = compactPoints[index];
            const wire = new Wire();
            wire.nodes[0].x = snapToGrid(start.x);
            wire.nodes[0].y = snapToGrid(start.y);
            wire.nodes[1].x = snapToGrid(end.x);
            wire.nodes[1].y = snapToGrid(end.y);
            connectNodes(previousNode, wire.nodes[0], "0");
            wires.push(wire);
            previousNode = wire.nodes[1];
        }

        connectedNodes.push(previousNode);
    },

    _wireFromComponentToNode(componentNode, logicalPosition, connectedNodes) {
        if (!componentNode || !logicalPosition || !connectedNodes) return null;
        if (componentNode.x === logicalPosition.x && componentNode.y === logicalPosition.y) {
            connectedNodes.push(componentNode);
            return null;
        }

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
