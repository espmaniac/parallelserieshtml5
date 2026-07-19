const solutionPlayback = {
    solution: null,
    originalHistory: null,
    stepCommandCounts: new Map(),
    playbackCommand: null,
    structuredLayoutStartIndex: -1,
    currentStepIndex: -1,

    configure(solution) {
        this._hideContextMenu();
        this._cancelActiveInteraction();
        if (this.playbackCommand) this.close();

        this.solution = solution || null;
        this.originalHistory = this.solution ? {
            undoStack: scheme.undoStack,
            redoStack: scheme.redoStack
        } : null;
        this.stepCommandCounts = new Map();
        this.playbackCommand = this.solution ? new MacroCommand("Circuit solution") : null;
        this.structuredLayoutStartIndex = this._findStructuredLayoutStartIndex(this.solution);
        this.currentStepIndex = -1;

        if (this.playbackCommand) {
            this.playbackCommand.solutionSteps = [];
            let currentModel = this._capturePlaybackModel();
            const steps = this.solution && Array.isArray(this.solution.steps)
                ? this.solution.steps
                : [];

            for (let stepIndex = 0; stepIndex < steps.length; ++stepIndex) {
                const step = steps[stepIndex];
                if (!step || !step.snapshot) continue;

                let plan = null;
                if (step.type !== "analysis") {
                    plan = this._buildPlaybackPlan(
                        step.snapshot,
                        this.structuredLayoutStartIndex >= 0 && stepIndex >= this.structuredLayoutStartIndex
                    );
                    if (!plan) continue;
                    currentModel = this._appendPlaybackTransition(currentModel, plan);
                }

                this.stepCommandCounts.set(stepIndex, this.playbackCommand.cmds.length);
                this.playbackCommand.solutionSteps.push({
                    stepIndex: stepIndex,
                    commandCount: this.playbackCommand.cmds.length,
                    title: step.title || "Circuit reduction"
                });
            }
            this._resetPreviewHistory();
        }

        this._updateControls();
        this._updateStepSelection();
        if (this.playbackCommand && typeof scheme !== "undefined") scheme.renderAll();
    },

    close() {
        this._hideContextMenu();
        this._cancelActiveInteraction();
        const hadPlayback = Boolean(this.playbackCommand);
        this._discardPreviewEdits();
        if (this.playbackCommand) this.playbackCommand.seek(0);
        this._restoreOriginalHistory(true);
        this._resetSession();
        this._updateControls();
        this._updateStepSelection();
        if (hadPlayback && typeof scheme !== "undefined") scheme.renderAll();
    },

    keepCurrent() {
        if (!this.playbackCommand || !this.originalHistory || this.currentStepIndex < 0) return false;

        this._hideContextMenu();
        this._cancelActiveInteraction();
        this._adoptPreviewEdits();

        const committedCommand = this.playbackCommand;
        committedCommand.committedStepIndex = this.currentStepIndex;
        committedCommand.setExecutionLimit(committedCommand.appliedCount);

        this._restoreOriginalHistory(true);
        scheme.execute(committedCommand);
        this._resetSession();
        this._updateControls();
        this._updateStepSelection();
        return true;
    },

    showOriginal() {
        if (!this.playbackCommand) return;

        this._hideContextMenu();
        this._cancelActiveInteraction();
        this._discardPreviewEdits();
        this.playbackCommand.seek(0);
        this._resetPreviewHistory();
        this.currentStepIndex = -1;
        this._updateControls();
        this._updateStepSelection();
        scheme.renderAll();
    },

    showStep(stepIndex) {
        if (!this._stepHasSnapshot(stepIndex) || !this.playbackCommand) return;
        if (!this.stepCommandCounts.has(stepIndex)) return;

        this._cancelActiveInteraction();
        this._discardPreviewEdits();
        this._hideContextMenu();
        this.playbackCommand.seek(this.stepCommandCounts.get(stepIndex));
        this._resetPreviewHistory();
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

    _capturePlaybackModel() {
        const components = new Map();
        for (const name in scheme.components) {
            const component = scheme.components[name];
            components.set(name, {
                component: component,
                x: component.x,
                y: component.y,
                angle: component.angle,
                value: component.value.value
            });
        }
        return {
            components: components,
            wires: scheme.wires.slice(),
            labels: scheme.labels.slice()
        };
    },

    _resetPreviewHistory() {
        if (typeof scheme === "undefined") return;
        scheme.undoStack = [];
        scheme.redoStack = [];
    },

    _discardPreviewEdits() {
        if (!this.playbackCommand || typeof scheme === "undefined") return;
        while (scheme.undoStack.length > 0) {
            const command = scheme.undoStack.pop();
            command.unexecute();
        }
        scheme.redoStack = [];
    },

    _adoptPreviewEdits() {
        if (!this.playbackCommand || typeof scheme === "undefined") return;
        const commands = scheme.undoStack.slice();
        if (commands.length > 0) this.playbackCommand.insertExecutedCommands(commands);
        scheme.undoStack = [];
        scheme.redoStack = [];
    },

    _restoreOriginalHistory(restoreRedo) {
        if (!this.originalHistory || typeof scheme === "undefined") return;
        scheme.undoStack = this.originalHistory.undoStack;
        scheme.redoStack = restoreRedo ? this.originalHistory.redoStack : [];
    },

    _resetSession() {
        this.solution = null;
        this.originalHistory = null;
        this.stepCommandCounts = new Map();
        this.playbackCommand = null;
        this.structuredLayoutStartIndex = -1;
        this.currentStepIndex = -1;
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

    _buildPlaybackPlan(snapshot, useStructuredLayout = false) {
        if (!snapshot || !Array.isArray(snapshot.nodes) || !Array.isArray(snapshot.edges)) return null;

        const worldLayout = useStructuredLayout
            ? this._layoutStructuredNodes(snapshot.nodes)
            : new Map(snapshot.nodes.map((node) => {
                return [node.id, { x: snapToGrid(node.x), y: snapToGrid(node.y) }];
            }));

        const components = {};
        const wires = [];
        const componentCommands = new Map();
        const wireCommands = [];
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
                    logicalNodes,
                    componentCommands,
                    wireCommands
                );
            }
        } else {
            const branchAnchors = this._playbackBranchAnchors(edgeGroups, worldLayout);
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
                        logicalNodes,
                        componentCommands,
                        wireCommands,
                        branchAnchors.get(edge) || null
                    );
                }
            }
        }

        this._coalescePlaybackWireOverlaps(wires, logicalNodes, wireCommands);
        if (!useStructuredLayout && this._playbackLayoutHasCollisions(components, wires)) {
            return this._buildPlaybackPlan(snapshot, true);
        }

        const labelTargets = this._buildPlaybackLabelTargets(snapshot.nodes, logicalNodes);
        return {
            components: components,
            wires: wires,
            componentCommands: componentCommands,
            wireCommands: wireCommands,
            labelTargets: labelTargets
        };
    },

    _appendPlaybackTransition(currentModel, plan) {
        const nextComponents = new Map();
        const nodeMap = new Map();

        for (const wire of currentModel.wires) {
            this.playbackCommand.addCommand(new DeleteElement(wire));
        }

        for (const [name, current] of currentModel.components.entries()) {
            if (!Object.prototype.hasOwnProperty.call(plan.components, name)) {
                this.playbackCommand.addCommand(new DeleteElement(current.component));
            }
        }

        for (const name in plan.components) {
            const target = plan.components[name];
            const current = currentModel.components.get(name);
            let component;

            if (current) {
                component = current.component;
                if (String(current.value) !== String(target.value.value)) {
                    this.playbackCommand.addCommand(new ChangeComponentValue(component, target.value.value));
                }

                const angleChange = this._playbackAngleDifference(current.angle, target.angle);
                if (angleChange !== 0) {
                    this.playbackCommand.addCommand(new RotateComponent(component, angleChange));
                }
                if (current.x !== target.x || current.y !== target.y) {
                    const drag = new DragComponent(component, { x: current.x, y: current.y });
                    drag.toWorld(target.x, target.y);
                    this.playbackCommand.addCommand(drag);
                }
            } else {
                const add = plan.componentCommands.get(name);
                component = add.component;
                this.playbackCommand.addCommand(add);
            }

            nodeMap.set(target.nodes[0], component.nodes[0]);
            nodeMap.set(target.nodes[1], component.nodes[1]);
            nextComponents.set(name, {
                component: component,
                x: target.x,
                y: target.y,
                angle: target.angle,
                value: target.value.value
            });
        }

        for (const draw of plan.wireCommands) {
            this.playbackCommand.addCommand(draw);
            nodeMap.set(draw.wire.nodes[0], draw.wire.nodes[0]);
            nodeMap.set(draw.wire.nodes[1], draw.wire.nodes[1]);
        }

        const nextLabels = this._appendPlaybackLabelCommands(
            currentModel.labels,
            plan.labelTargets,
            nodeMap
        );

        return {
            components: nextComponents,
            wires: plan.wireCommands.map((draw) => draw.wire),
            labels: nextLabels
        };
    },

    _appendPlaybackLabelCommands(currentLabels, labelTargets, nodeMap) {
        const currentByName = new Map();
        for (const label of currentLabels) currentByName.set(label.label.value, label);

        for (const label of currentLabels) {
            if (label.className !== "GraphLabelNode") continue;
            if (!labelTargets.has(label.label.value)) {
                this.playbackCommand.addCommand(new DeleteElement(label));
            }
        }

        const nextLabels = currentLabels.filter((label) => {
            return label.className !== "GraphLabelNode" || labelTargets.has(label.label.value);
        });
        for (const [name, plannedNode] of labelTargets.entries()) {
            const targetNode = nodeMap.get(plannedNode);
            if (!targetNode) continue;

            let label = currentByName.get(name);
            if (!label) {
                const className = name === "StartNode" || name === "DestNode"
                    ? "LabelNode"
                    : "GraphLabelNode";
                const addLabel = new AddLabelNode(name, className);
                label = addLabel.label;
                this.playbackCommand.addCommand(addLabel);
                nextLabels.push(label);
            }
            if (label.node !== targetNode) {
                this.playbackCommand.addCommand(new SetLabelNode(label, targetNode));
            }
        }
        return nextLabels;
    },

    _playbackAngleDifference(from, to) {
        let difference = (to - from) % 360;
        if (difference > 180) difference -= 360;
        if (difference < -180) difference += 360;
        return difference;
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

    _playbackBranchAnchors(edgeGroups, worldLayout) {
        const incident = new Map();
        const descriptors = new Map();
        const candidates = [];
        const starts = new Map();
        const ends = new Map();

        for (const group of edgeGroups) {
            for (const edge of group) {
                const a = worldLayout.get(edge.a);
                const b = worldLayout.get(edge.b);
                if (!a || !b) continue;
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const descriptor = {
                    edge: edge,
                    groupSize: group.length,
                    axis: Math.abs(dx) >= Math.abs(dy) ? "horizontal" : "vertical",
                    cardinal: dx === 0 || dy === 0
                };
                descriptors.set(edge, descriptor);
                for (const nodeId of [edge.a, edge.b]) {
                    if (!incident.has(nodeId)) incident.set(nodeId, []);
                    incident.get(nodeId).push(descriptor);
                }
            }
        }

        for (const descriptor of descriptors.values()) {
            if (descriptor.groupSize !== 1) continue;
            const edge = descriptor.edge;
            let startId = edge.a;
            let endId = edge.b;
            let start = worldLayout.get(startId);
            let end = worldLayout.get(endId);

            if (end.x < start.x || (end.x === start.x && end.y < start.y)) {
                [startId, endId] = [endId, startId];
                [start, end] = [end, start];
            }

            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const distance = Math.hypot(dx, dy);
            const rawAngle = Math.atan2(dy, dx) * 180 / Math.PI;
            const angle = Math.round(rawAngle / snapAngle) * snapAngle;
            if (Math.abs(angle % 90) !== 45 || distance > cellSize * 8) continue;

            candidates.push({
                edge: edge,
                axis: descriptor.axis,
                startId: startId,
                endId: endId
            });
            starts.set(startId, (starts.get(startId) || 0) + 1);
            ends.set(endId, (ends.get(endId) || 0) + 1);
        }

        const anchors = new Map();
        for (const candidate of candidates) {
            const trunkScore = (nodeId) => (incident.get(nodeId) || []).reduce((score, descriptor) => {
                if (descriptor.edge === candidate.edge) return score;
                return score + (descriptor.cardinal && descriptor.axis === candidate.axis ? 1 : 0);
            }, 0);
            const startTrunks = trunkScore(candidate.startId);
            const endTrunks = trunkScore(candidate.endId);
            if (startTrunks !== endTrunks) {
                anchors.set(candidate.edge, startTrunks > endTrunks ? "start" : "end");
                continue;
            }

            const fanOut = starts.get(candidate.startId) || 0;
            const fanIn = ends.get(candidate.endId) || 0;
            if (fanOut < 2 && fanIn < 2) continue;
            anchors.set(candidate.edge, fanIn > fanOut ? "end" : "start");
        }
        return anchors;
    },

    _addPlaybackBranch(
        edge,
        offset,
        worldLayout,
        components,
        wires,
        logicalNodes,
        componentCommands,
        wireCommands,
        anchor = null
    ) {
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
        const rawAngle = Math.atan2(dy, dx) * 180 / Math.PI;
        const angle = Math.round(rawAngle / snapAngle) * snapAngle;
        const componentType = typeof choosenComponent !== "undefined" && choosenComponent.shortName
            ? choosenComponent.shortName
            : "R";
        const name = this._uniqueComponentName(edge.name || `${componentType}eq`, components);
        const value = String(edge.value || "0");
        const candidates = [];
        const candidateKeys = new Set();
        const addCandidate = (candidateCenter, candidateAngle, preference) => {
            const snappedCenter = {
                x: snapToGrid(candidateCenter.x),
                y: snapToGrid(candidateCenter.y)
            };
            const key = `${snappedCenter.x}:${snappedCenter.y}:${candidateAngle}`;
            if (candidateKeys.has(key)) return;
            candidateKeys.add(key);
            const command = AddComponent.fromWorld(
                name,
                value,
                snappedCenter.x - cellSize,
                snappedCenter.y - cellSize / 2,
                candidateAngle
            );
            candidates.push({
                command: command,
                component: command.component,
                preference: preference
            });
        };

        addCandidate(center, angle, anchor ? 3 : 0);

        // Short diagonal fans look cleanest when every component terminal meets
        // the shared node directly. Anchor at the common fan-in/fan-out node;
        // anchoring every branch at the same spatial side can overlap the bodies.
        if (anchor && offset === 0 && distance <= cellSize * 8) {
            const anchorPosition = anchor === "start" ? start : end;
            const radians = angle * Math.PI / 180;
            const terminalReach = cellSize * 3;
            const anchoredCenter = {
                x: anchorPosition.x + (anchor === "start" ? 1 : -1) * Math.cos(radians) * terminalReach,
                y: anchorPosition.y + (anchor === "start" ? 1 : -1) * Math.sin(radians) * terminalReach
            };
            addCandidate(anchoredCenter, angle, 0);
        }

        const cardinalAngle = Math.abs(dx) >= Math.abs(dy) ? 0 : 90;
        addCandidate(center, cardinalAngle, angle === cardinalAngle ? 0 : 7);
        addCandidate(center, cardinalAngle === 0 ? 90 : 0, 13);
        if (offset === 0) {
            for (const direction of [-1, 1]) {
                const shiftedCenter = {
                    x: center.x + normalX * cellSize * 2 * direction,
                    y: center.y + normalY * cellSize * 2 * direction
                };
                addCandidate(shiftedCenter, angle, 10);
                addCandidate(shiftedCenter, cardinalAngle, 12);
            }
        }

        const selectedCandidate = candidates.map((candidate) => ({
            candidate: candidate,
            score: this._scorePlaybackComponentCandidate(
                candidate,
                start,
                end,
                components,
                wires
            )
        })).sort((left, right) => left.score - right.score)[0].candidate;
        const component = selectedCandidate.component;
        components[name] = component;
        componentCommands.set(name, selectedCandidate.command);

        this._wireSnappedPath(
            component.nodes[0],
            worldLayout.get(startId),
            logicalNodes.get(startId),
            wires,
            wireCommands,
            component.angle,
            components,
            component,
            startId
        );
        this._wireSnappedPath(
            component.nodes[1],
            worldLayout.get(endId),
            logicalNodes.get(endId),
            wires,
            wireCommands,
            component.angle,
            components,
            component,
            endId
        );
    },

    _scorePlaybackComponentCandidate(candidate, start, end, components, wires) {
        const component = candidate.component;
        let score = candidate.preference;
        score += (
            Math.hypot(component.nodes[0].x - start.x, component.nodes[0].y - start.y) +
            Math.hypot(component.nodes[1].x - end.x, component.nodes[1].y - end.y)
        ) / (cellSize * 8);

        for (const name in (components || {})) {
            const other = components[name];
            if (this._playbackPolygonsOverlap(
                this._playbackComponentPolygon(component, 5),
                this._playbackComponentPolygon(other, 5)
            )) score += 1000000;
            if (this._segmentsProperlyCross(
                component.nodes[0],
                component.nodes[1],
                other.nodes[0],
                other.nodes[1]
            )) score += 500000;
            if (this._segmentsCollinearlyOverlap(
                component.nodes[0],
                component.nodes[1],
                other.nodes[0],
                other.nodes[1]
            )) score += 750000;
            if (this._segmentIntersectsComponentBody(
                component.nodes[0],
                component.nodes[1],
                other,
                3
            )) score += 300000;
            if (this._segmentIntersectsComponentBody(
                other.nodes[0],
                other.nodes[1],
                component,
                3
            )) score += 300000;
        }
        for (const wire of (wires || [])) {
            if (this._segmentsProperlyCross(
                component.nodes[0],
                component.nodes[1],
                wire.nodes[0],
                wire.nodes[1]
            )) score += 200000;
            if (this._segmentsCollinearlyOverlap(
                component.nodes[0],
                component.nodes[1],
                wire.nodes[0],
                wire.nodes[1]
            )) score += 400000;
            if (this._segmentIntersectsComponentBody(
                wire.nodes[0],
                wire.nodes[1],
                component,
                3
            )) score += 200000;
        }
        return score;
    },

    _addStructuredPlaybackBranch(
        edge,
        laneY,
        worldLayout,
        components,
        wires,
        logicalNodes,
        componentCommands,
        wireCommands
    ) {
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

        const centerX = this._structuredComponentCenterX(
            start,
            end,
            laneY,
            worldLayout,
            components
        );
        const componentType = typeof choosenComponent !== "undefined" && choosenComponent.shortName
            ? choosenComponent.shortName
            : "R";
        const name = this._uniqueComponentName(edge.name || `${componentType}eq`, components);
        const addComponent = AddComponent.fromWorld(
            name,
            String(edge.value || "0"),
            snapToGrid(centerX - cellSize),
            snapToGrid(laneY - cellSize / 2),
            0
        );
        const component = addComponent.component;
        components[name] = component;
        componentCommands.set(name, addComponent);

        this._wireSnappedPath(
            component.nodes[0],
            worldLayout.get(startId),
            logicalNodes.get(startId),
            wires,
            wireCommands,
            component.angle,
            components,
            component,
            startId,
            true
        );
        this._wireSnappedPath(
            component.nodes[1],
            worldLayout.get(endId),
            logicalNodes.get(endId),
            wires,
            wireCommands,
            component.angle,
            components,
            component,
            endId,
            true
        );
    },

    _structuredComponentCenterX(start, end, laneY, worldLayout, components) {
        const leftX = Math.min(start.x, end.x);
        const rightX = Math.max(start.x, end.x);
        const columns = Array.from(new Set(
            Array.from(worldLayout.values())
                .map((position) => position.x)
                .filter((x) => x >= leftX && x <= rightX)
        )).sort((left, right) => left - right);
        const candidates = [];
        for (let index = 1; index < columns.length; ++index) {
            candidates.push(snapToGrid((columns[index - 1] + columns[index]) / 2));
        }
        if (candidates.length === 0) return snapToGrid((leftX + rightX) / 2);

        const midpoint = (leftX + rightX) / 2;
        candidates.sort((left, right) => {
            const score = (x) => {
                let value = Math.abs(x - midpoint) / cellSize;
                for (const name in components) {
                    const component = components[name];
                    if (Math.abs(component.rotationPointY() - laneY) > cellSize) continue;
                    const separation = Math.abs(component.rotationPointX() - x);
                    if (separation < cellSize * 6) value += 1000;
                }
                return value;
            };
            return score(left) - score(right) || left - right;
        });
        return candidates[0];
    },

    _wireSnappedPath(
        componentNode,
        logicalPosition,
        connectedNodes,
        wires,
        wireCommands,
        componentAngle,
        components,
        ownComponent,
        logicalNodeId,
        usePortFanout = false
    ) {
        if (!componentNode || !logicalPosition || !connectedNodes || !wires) return;
        componentNode.playbackNodeId = logicalNodeId;
        if (componentNode.x === logicalPosition.x && componentNode.y === logicalPosition.y) {
            connectedNodes.push(componentNode);
            return;
        }

        const candidates = this._snappedPathCandidates(
            componentNode,
            logicalPosition,
            componentAngle,
            usePortFanout
        );
        const compactPoints = candidates.map((points) => ({
            points: points,
            score: this._scorePlaybackPath(points, components, wires, ownComponent)
        })).sort((left, right) => left.score - right.score)[0].points;
        let terminalNode = componentNode;
        for (let index = 1; index < compactPoints.length; ++index) {
            const start = compactPoints[index - 1];
            const end = compactPoints[index];
            const drawWire = DrawWire.between(start.x, start.y, end.x, end.y);
            const wire = drawWire.wire;
            wire.playbackNodeId = logicalNodeId;
            wire.nodes[0].playbackNodeId = logicalNodeId;
            wire.nodes[1].playbackNodeId = logicalNodeId;
            wires.push(wire);
            wireCommands.push(drawWire);
            terminalNode = wire.nodes[1];
        }
        connectedNodes.push(terminalNode);
    },

    _coalescePlaybackWireOverlaps(wires, logicalNodes, wireCommands) {
        if (!Array.isArray(wires) || wires.length < 2) return;

        let changed = true;
        let pass = 0;
        const maximumPasses = wires.length * wires.length;
        while (changed && pass++ < maximumPasses) {
            changed = false;
            overlapSearch:
            for (let leftIndex = 0; leftIndex < wires.length; ++leftIndex) {
                const left = wires[leftIndex];
                if (left.playbackNodeId === undefined || left.playbackNodeId === null) continue;

                for (let rightIndex = leftIndex + 1; rightIndex < wires.length; ++rightIndex) {
                    const right = wires[rightIndex];
                    if (left.playbackNodeId !== right.playbackNodeId) continue;
                    if (!this._segmentsCollinearlyOverlap(
                        left.nodes[0],
                        left.nodes[1],
                        right.nodes[0],
                        right.nodes[1]
                    )) continue;

                    const sharedEndpoints = [];
                    for (let leftNodeIndex = 0; leftNodeIndex < 2; ++leftNodeIndex) {
                        for (let rightNodeIndex = 0; rightNodeIndex < 2; ++rightNodeIndex) {
                            if (this._playbackNodesSharePosition(
                                left.nodes[leftNodeIndex],
                                right.nodes[rightNodeIndex]
                            )) sharedEndpoints.push({ left: leftNodeIndex, right: rightNodeIndex });
                        }
                    }

                    if (sharedEndpoints.length >= 2) {
                        this._removeDuplicatePlaybackWire(
                            wires,
                            rightIndex,
                            left,
                            right,
                            logicalNodes,
                            wireCommands
                        );
                        changed = true;
                        break overlapSearch;
                    }
                    if (sharedEndpoints.length !== 1) continue;

                    const shared = sharedEndpoints[0];
                    const leftLength = Math.hypot(
                        left.nodes[1].x - left.nodes[0].x,
                        left.nodes[1].y - left.nodes[0].y
                    );
                    const rightLength = Math.hypot(
                        right.nodes[1].x - right.nodes[0].x,
                        right.nodes[1].y - right.nodes[0].y
                    );
                    const outer = leftLength > rightLength ? left : right;
                    const inner = outer === left ? right : left;
                    const outerSharedIndex = outer === left ? shared.left : shared.right;
                    const innerSharedIndex = inner === left ? shared.left : shared.right;
                    const innerTapNode = inner.nodes[1 - innerSharedIndex];
                    if (!this._playbackPointOnSegment(
                        innerTapNode,
                        outer.nodes[0],
                        outer.nodes[1]
                    )) continue;

                    this._trimPlaybackWireAtTap(
                        outer,
                        outerSharedIndex,
                        inner,
                        innerSharedIndex,
                        logicalNodes,
                        wireCommands
                    );
                    changed = true;
                    break overlapSearch;
                }
            }
        }
        for (const connectedNodes of logicalNodes.values()) {
            const uniqueNodes = Array.from(new Set(connectedNodes));
            connectedNodes.splice(0, connectedNodes.length, ...uniqueNodes);
        }
    },

    _removeDuplicatePlaybackWire(
        wires,
        duplicateIndex,
        keeper,
        duplicate,
        logicalNodes,
        wireCommands
    ) {
        for (let index = 0; index < 2; ++index) {
            const source = duplicate.nodes[index];
            const target = keeper.nodes.find((node) => {
                return this._playbackNodesSharePosition(node, source);
            });
            if (!target) continue;
            this._replacePlaybackLogicalNode(logicalNodes, source, target);
        }
        const commandIndex = wireCommands.findIndex((command) => command.wire === duplicate);
        if (commandIndex >= 0) wireCommands.splice(commandIndex, 1);
        wires.splice(duplicateIndex, 1);
    },

    _trimPlaybackWireAtTap(
        outer,
        outerSharedIndex,
        inner,
        innerSharedIndex,
        logicalNodes,
        wireCommands
    ) {
        const outerSharedNode = outer.nodes[outerSharedIndex];
        const innerSharedNode = inner.nodes[innerSharedIndex];
        const innerTapNode = inner.nodes[1 - innerSharedIndex];

        this._replacePlaybackLogicalNode(logicalNodes, outerSharedNode, innerSharedNode);
        outerSharedNode.x = innerTapNode.x;
        outerSharedNode.y = innerTapNode.y;

        const command = wireCommands.find((item) => item.wire === outer);
        if (!command) return;
        if (outerSharedIndex === 0) {
            command.x1 = outerSharedNode.x;
            command.y1 = outerSharedNode.y;
        } else {
            command.x2 = outerSharedNode.x;
            command.y2 = outerSharedNode.y;
        }
    },

    _replacePlaybackLogicalNode(logicalNodes, source, target) {
        for (const connectedNodes of logicalNodes.values()) {
            for (let index = 0; index < connectedNodes.length; ++index) {
                if (connectedNodes[index] === source) connectedNodes[index] = target;
            }
        }
    },

    _playbackNodesSharePosition(left, right) {
        return left && right && left.x === right.x && left.y === right.y;
    },

    _playbackPointOnSegment(point, start, end) {
        const cross = (end.x - start.x) * (point.y - start.y) -
            (end.y - start.y) * (point.x - start.x);
        if (Math.abs(cross) > 0.000001) return false;
        return point.x >= Math.min(start.x, end.x) && point.x <= Math.max(start.x, end.x) &&
            point.y >= Math.min(start.y, end.y) && point.y <= Math.max(start.y, end.y);
    },

    _snappedPathCandidates(start, end, componentAngle, usePortFanout = false) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const diagonalDistance = Math.min(Math.abs(dx), Math.abs(dy));
        const directIsSnapped = dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy);
        const paths = [];
        const addPath = (points) => {
            const compact = points
                .map((point) => ({ x: snapToGrid(point.x), y: snapToGrid(point.y) }))
                .filter((point, index, all) => {
                    return index === 0 || point.x !== all[index - 1].x || point.y !== all[index - 1].y;
                });
            if (compact.length < 2) return;
            const key = compact.map((point) => `${point.x},${point.y}`).join(";");
            if (!paths.some((path) => path.key === key)) paths.push({ key: key, points: compact });
        };

        if (directIsSnapped) addPath([start, end]);

        const horizontalFirst = [start, { x: end.x, y: start.y }, end];
        const verticalFirst = [start, { x: start.x, y: end.y }, end];
        const diagonalFirst = [
            start,
            {
                x: start.x + Math.sign(dx) * diagonalDistance,
                y: start.y + Math.sign(dy) * diagonalDistance
            },
            end
        ];
        const diagonalLast = [
            start,
            {
                x: end.x - Math.sign(dx) * diagonalDistance,
                y: end.y - Math.sign(dy) * diagonalDistance
            },
            end
        ];
        const normalizedAngle = ((componentAngle % 180) + 180) % 180;
        if (normalizedAngle === 0) addPath(horizontalFirst);
        else if (normalizedAngle === 90) addPath(verticalFirst);
        else addPath(diagonalFirst);
        addPath(horizontalFirst);
        addPath(verticalFirst);
        addPath(diagonalFirst);
        addPath(diagonalLast);

        for (const distance of [cellSize * 2, cellSize * 4]) {
            for (const direction of [-1, 1]) {
                const laneY = snapToGrid((start.y + end.y) / 2 + distance * direction);
                addPath([
                    start,
                    { x: start.x, y: laneY },
                    { x: end.x, y: laneY },
                    end
                ]);
                const laneX = snapToGrid((start.x + end.x) / 2 + distance * direction);
                addPath([
                    start,
                    { x: laneX, y: start.y },
                    { x: laneX, y: end.y },
                    end
                ]);
            }
        }

        if (usePortFanout) {
            // Give every structured branch several independent ways to approach
            // a busy node. Eight snapped port directions prevent incident
            // branches from sharing the same final wire segment.
            const portDirections = [
                { x: 1, y: 0 },
                { x: -1, y: 0 },
                { x: 0, y: 1 },
                { x: 0, y: -1 },
                { x: 1, y: 1 },
                { x: 1, y: -1 },
                { x: -1, y: 1 },
                { x: -1, y: -1 }
            ];
            const addApproachPaths = (approach) => {
                const approachDx = approach.x - start.x;
                const approachDy = approach.y - start.y;
                const approachDiagonal = Math.min(Math.abs(approachDx), Math.abs(approachDy));
                const prefixes = [
                    [start, { x: approach.x, y: start.y }, approach],
                    [start, { x: start.x, y: approach.y }, approach],
                    [
                        start,
                        {
                            x: start.x + Math.sign(approachDx) * approachDiagonal,
                            y: start.y + Math.sign(approachDy) * approachDiagonal
                        },
                        approach
                    ],
                    [
                        start,
                        {
                            x: approach.x - Math.sign(approachDx) * approachDiagonal,
                            y: approach.y - Math.sign(approachDy) * approachDiagonal
                        },
                        approach
                    ]
                ];
                if (approachDx === 0 || approachDy === 0 || Math.abs(approachDx) === Math.abs(approachDy)) {
                    prefixes.unshift([start, approach]);
                }
                for (const prefix of prefixes) addPath(prefix.concat([end]));
            };
            for (const reach of [cellSize * 2, cellSize * 4, cellSize * 6, cellSize * 8]) {
                for (const direction of portDirections) {
                    addApproachPaths({
                        x: snapToGrid(end.x - direction.x * reach),
                        y: snapToGrid(end.y - direction.y * reach)
                    });
                }
            }
        }

        return paths.map((path) => path.points);
    },

    _scorePlaybackPath(points, components, wires, ownComponent) {
        let score = Math.max(0, points.length - 2) * 8;
        const pathSegments = [];
        for (let index = 1; index < points.length; ++index) {
            const start = points[index - 1];
            const end = points[index];
            pathSegments.push({ start: start, end: end });
            score += Math.hypot(end.x - start.x, end.y - start.y) / cellSize;

            for (const name in (components || {})) {
                const component = components[name];
                if (component === ownComponent) continue;
                if (this._segmentIntersectsComponentBody(start, end, component, 3)) score += 100000;
                if (this._segmentsProperlyCross(start, end, component.nodes[0], component.nodes[1])) {
                    score += 50000;
                }
                if (this._segmentsCollinearlyOverlap(
                    start,
                    end,
                    component.nodes[0],
                    component.nodes[1]
                )) score += 150000;
            }
            for (const wire of (wires || [])) {
                if (this._segmentsProperlyCross(start, end, wire.nodes[0], wire.nodes[1])) score += 20000;
                if (this._segmentsCollinearlyOverlap(start, end, wire.nodes[0], wire.nodes[1])) {
                    score += 250000;
                }
            }
        }
        for (let left = 0; left < pathSegments.length; ++left) {
            for (let right = left + 1; right < pathSegments.length; ++right) {
                if (this._segmentsProperlyCross(
                    pathSegments[left].start,
                    pathSegments[left].end,
                    pathSegments[right].start,
                    pathSegments[right].end
                )) score += 300000;
                if (this._segmentsCollinearlyOverlap(
                    pathSegments[left].start,
                    pathSegments[left].end,
                    pathSegments[right].start,
                    pathSegments[right].end
                )) score += 350000;
            }
        }
        return score;
    },

    _segmentIntersectsComponentBody(start, end, component, margin = 0) {
        const center = { x: component.rotationPointX(), y: component.rotationPointY() };
        const localStart = rotatePoint(start, center, -component.angle);
        const localEnd = rotatePoint(end, center, -component.angle);
        const left = component.x - margin;
        const right = component.x + component.width + margin;
        const top = component.y - margin;
        const bottom = component.y + component.height + margin;
        const inside = (point) => {
            return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
        };
        if (inside(localStart) || inside(localEnd)) return true;

        const corners = [
            { x: left, y: top },
            { x: right, y: top },
            { x: right, y: bottom },
            { x: left, y: bottom }
        ];
        for (let index = 0; index < corners.length; ++index) {
            if (this._segmentsIntersect(
                localStart,
                localEnd,
                corners[index],
                corners[(index + 1) % corners.length]
            )) return true;
        }
        return false;
    },

    _segmentsProperlyCross(a, b, c, d) {
        const cross = (left, middle, right) => {
            return (middle.x - left.x) * (right.y - left.y) -
                (middle.y - left.y) * (right.x - left.x);
        };
        const firstA = cross(a, b, c);
        const firstB = cross(a, b, d);
        const secondA = cross(c, d, a);
        const secondB = cross(c, d, b);
        return firstA * firstB < 0 && secondA * secondB < 0;
    },

    _segmentsCollinearlyOverlap(a, b, c, d) {
        const abX = b.x - a.x;
        const abY = b.y - a.y;
        const length = Math.hypot(abX, abY);
        if (length <= 0.000001) return false;

        const cross = (point) => abX * (point.y - a.y) - abY * (point.x - a.x);
        if (Math.abs(cross(c)) > 0.000001 || Math.abs(cross(d)) > 0.000001) return false;

        const projection = (point) => {
            return ((point.x - a.x) * abX + (point.y - a.y) * abY) / length;
        };
        const cProjection = projection(c);
        const dProjection = projection(d);
        const overlapStart = Math.max(0, Math.min(cProjection, dProjection));
        const overlapEnd = Math.min(length, Math.max(cProjection, dProjection));
        return overlapEnd - overlapStart > 0.000001;
    },

    _segmentsIntersect(a, b, c, d) {
        const orientation = (left, middle, right) => {
            const value = (middle.y - left.y) * (right.x - middle.x) -
                (middle.x - left.x) * (right.y - middle.y);
            if (Math.abs(value) < 0.000001) return 0;
            return value > 0 ? 1 : 2;
        };
        const onSegment = (left, middle, right) => {
            return middle.x <= Math.max(left.x, right.x) && middle.x >= Math.min(left.x, right.x) &&
                middle.y <= Math.max(left.y, right.y) && middle.y >= Math.min(left.y, right.y);
        };
        const first = orientation(a, b, c);
        const second = orientation(a, b, d);
        const third = orientation(c, d, a);
        const fourth = orientation(c, d, b);
        if (first !== second && third !== fourth) return true;
        if (first === 0 && onSegment(a, c, b)) return true;
        if (second === 0 && onSegment(a, d, b)) return true;
        if (third === 0 && onSegment(c, a, d)) return true;
        return fourth === 0 && onSegment(c, b, d);
    },

    _playbackTextRectangle(text, position) {
        const value = text.displayValue === undefined ? text.value : text.displayValue;
        const width = Math.max(8, String(value).length * 7.2);
        const left = position.align === "left" ? position.x :
            position.align === "right" ? position.x - width : position.x - width / 2;
        return {
            left: left,
            right: left + width,
            top: position.y - 11,
            bottom: position.y + 3
        };
    },

    _playbackComponentPolygon(component, margin = 0) {
        const center = { x: component.rotationPointX(), y: component.rotationPointY() };
        return [
            { x: component.x - margin, y: component.y - margin },
            { x: component.x + component.width + margin, y: component.y - margin },
            { x: component.x + component.width + margin, y: component.y + component.height + margin },
            { x: component.x - margin, y: component.y + component.height + margin }
        ].map((point) => rotatePoint(point, center, component.angle));
    },

    _playbackRectanglePolygon(rectangle) {
        return [
            { x: rectangle.left, y: rectangle.top },
            { x: rectangle.right, y: rectangle.top },
            { x: rectangle.right, y: rectangle.bottom },
            { x: rectangle.left, y: rectangle.bottom }
        ];
    },

    _playbackPolygonsOverlap(left, right) {
        const axes = (polygon) => polygon.map((point, index) => {
            const next = polygon[(index + 1) % polygon.length];
            const dx = next.x - point.x;
            const dy = next.y - point.y;
            const length = Math.hypot(dx, dy) || 1;
            return { x: -dy / length, y: dx / length };
        });
        for (const axis of axes(left).concat(axes(right))) {
            const leftProjection = left.map((point) => point.x * axis.x + point.y * axis.y);
            const rightProjection = right.map((point) => point.x * axis.x + point.y * axis.y);
            if (Math.max(...leftProjection) <= Math.min(...rightProjection) ||
                Math.max(...rightProjection) <= Math.min(...leftProjection)) return false;
        }
        return true;
    },

    _playbackRectanglesOverlap(left, right) {
        return left.left < right.right && left.right > right.left &&
            left.top < right.bottom && left.bottom > right.top;
    },

    _segmentIntersectsRectangle(start, end, rectangle) {
        const inside = (point) => {
            return point.x >= rectangle.left && point.x <= rectangle.right &&
                point.y >= rectangle.top && point.y <= rectangle.bottom;
        };
        if (inside(start) || inside(end)) return true;
        const polygon = this._playbackRectanglePolygon(rectangle);
        for (let index = 0; index < polygon.length; ++index) {
            if (this._segmentsIntersect(start, end, polygon[index], polygon[(index + 1) % polygon.length])) {
                return true;
            }
        }
        return false;
    },

    _playbackLayoutHasCollisions(components, wires) {
        const allComponents = Object.values(components || {});
        const segments = allComponents.map((component) => ({
            owner: component,
            start: component.nodes[0],
            end: component.nodes[1]
        })).concat((wires || []).map((wire) => ({
            owner: wire,
            start: wire.nodes[0],
            end: wire.nodes[1]
        })));

        for (let left = 0; left < allComponents.length; ++left) {
            const component = allComponents[left];
            for (let right = left + 1; right < allComponents.length; ++right) {
                const other = allComponents[right];
                if (this._playbackPolygonsOverlap(
                    this._playbackComponentPolygon(component, 5),
                    this._playbackComponentPolygon(other, 5)
                )) return true;
            }
            for (const segment of segments) {
                if (segment.owner === component) continue;
                if (this._segmentIntersectsComponentBody(
                    segment.start,
                    segment.end,
                    component,
                    2
                )) return true;
            }
        }

        for (let left = 0; left < segments.length; ++left) {
            for (let right = left + 1; right < segments.length; ++right) {
                if (this._segmentsProperlyCross(
                    segments[left].start,
                    segments[left].end,
                    segments[right].start,
                    segments[right].end
                )) return true;
                if (this._segmentsCollinearlyOverlap(
                    segments[left].start,
                    segments[left].end,
                    segments[right].start,
                    segments[right].end
                )) return true;
            }
        }

        const textRectangles = [];
        for (const component of allComponents) {
            for (const text of [component.name, component.value]) {
                const rectangle = this._playbackTextRectangle(text, text);
                for (const other of allComponents) {
                    if (other === component) continue;
                    if (this._playbackPolygonsOverlap(
                        this._playbackRectanglePolygon(rectangle),
                        this._playbackComponentPolygon(other, 2)
                    )) return true;
                }
                for (const segment of segments) {
                    if (segment.owner === component) continue;
                    if (this._segmentIntersectsRectangle(segment.start, segment.end, rectangle)) return true;
                }
                if (textRectangles.some((placed) => {
                    return this._playbackRectanglesOverlap(rectangle, placed);
                })) return true;
                textRectangles.push(rectangle);
            }
        }
        return false;
    },

    _buildPlaybackLabelTargets(nodes, logicalNodes) {
        const labelTargets = new Map();
        let sharedTerminalNode = null;

        for (const node of nodes) {
            const connectedNodes = logicalNodes.get(node.id) || [];
            const labelNode = connectedNodes[0] || null;
            if (!labelNode) continue;

            if (node.terminal === "start" || node.name === "StartNode") {
                labelTargets.set("StartNode", labelNode);
                sharedTerminalNode = labelNode;
                continue;
            }
            if (node.terminal === "end" || node.name === "DestNode") {
                labelTargets.set("DestNode", labelNode);
                continue;
            }

            labelTargets.set(node.name, labelNode);
        }

        if (!labelTargets.has("DestNode") && nodes.length === 1 && sharedTerminalNode) {
            labelTargets.set("DestNode", sharedTerminalNode);
        }
        return labelTargets;
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
            if (steps[i] && steps[i].snapshot && this.stepCommandCounts.has(i)) indexes.push(i);
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
        const keep = document.getElementById("solutionPlaybackKeep");
        if (!status || !original || !previous || !next || !keep) return;

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
        keep.disabled = this.currentStepIndex < 0;
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
