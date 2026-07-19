const solutionPlayback = {
    solution: null,
    currentStepIndex: -1,

    configure(solution) {
        this.solution = solution || null;
        this.currentStepIndex = -1;
        if (document.body) document.body.classList.toggle("solution-playback-mode", Boolean(this.solution));
        this._updateControls();
        this._updateStepSelection();
    },

    close() {
        const needsRender = this.isActive();
        this.solution = null;
        this.currentStepIndex = -1;
        if (document.body) document.body.classList.remove("solution-playback-mode");
        this._updateControls();
        this._updateStepSelection();
        if (needsRender && typeof scheme !== "undefined") scheme.renderAll();
    },

    showOriginal() {
        this.currentStepIndex = -1;
        this._updateControls();
        this._updateStepSelection();
        if (typeof scheme !== "undefined") scheme.renderAll();
    },

    showStep(stepIndex) {
        if (!this._stepHasSnapshot(stepIndex)) return;

        this.currentStepIndex = stepIndex;
        if (typeof context_menu !== "undefined" && context_menu.element && !context_menu.hidden()) {
            context_menu.hide();
        }
        if (typeof scheme !== "undefined") {
            scheme.renderAll();
        }
        this._updateControls();
        this._updateStepSelection();

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
        return this._stepHasSnapshot(this.currentStepIndex);
    },

    isInteractionLocked() {
        const inspector = document.getElementById("solutionInspector");
        return Boolean(this.solution && inspector && !inspector.hidden);
    },

    render() {
        if (!this.isActive()) return;

        const step = this.solution.steps[this.currentStepIndex];
        const snapshot = step.snapshot;
        const width = getCanvasWidth();
        const height = getCanvasHeight();
        const layout = this._layoutNodes(snapshot.nodes, width, height);
        const edgeGroups = this._edgeGroups(snapshot.edges);
        const accent = this._stepAccent(step.type);

        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        for (const group of edgeGroups) {
            for (let index = 0; index < group.length; ++index) {
                const edge = group[index];
                const offset = (index - (group.length - 1) / 2) * 42;
                this._drawEdge(edge, layout, offset, accent);
            }
        }

        for (const node of snapshot.nodes) this._drawNode(node, layout.get(node.id));
        this._drawPreviewBadge(step, width);
        ctx.restore();
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

        const paddingX = Math.min(110, Math.max(64, width * 0.12));
        const paddingY = Math.min(100, Math.max(72, height * 0.14));
        const availableWidth = Math.max(120, width - paddingX * 2);
        const availableHeight = Math.max(120, height - paddingY * 2);
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
            if (distance < 260) {
                const angle = distance > 0 ? Math.atan2(dy, dx) : 0;
                const centerX = (left.x + right.x) / 2;
                const centerY = (left.y + right.y) / 2;
                const cosine = Math.abs(Math.cos(angle));
                const sine = Math.abs(Math.sin(angle));
                const horizontalCapacity = cosine > 0.001 ? availableWidth / cosine : Infinity;
                const verticalCapacity = sine > 0.001 ? availableHeight / sine : Infinity;
                const half = Math.max(50, Math.min(180, horizontalCapacity / 2, verticalCapacity / 2));
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
    },

    _drawEdge(edge, layout, offset, accent) {
        let start = layout.get(edge.a);
        let end = layout.get(edge.b);
        if (!start || !end) return;

        if (end.x < start.x || (end.x === start.x && end.y < start.y)) {
            const savedStart = start;
            start = end;
            end = savedStart;
        }

        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const normalX = -dy / distance;
        const normalY = dx / distance;
        const branchStart = {
            x: start.x + normalX * offset,
            y: start.y + normalY * offset
        };
        const branchEnd = {
            x: end.x + normalX * offset,
            y: end.y + normalY * offset
        };
        const middle = {
            x: (branchStart.x + branchEnd.x) / 2,
            y: (branchStart.y + branchEnd.y) / 2
        };
        const color = edge.highlighted ? accent : (edge.generated ? "#505050" : "#222222");

        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = edge.highlighted ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(branchStart.x, branchStart.y);
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(branchEnd.x, branchEnd.y);
        ctx.stroke();

        ctx.translate(middle.x, middle.y);
        ctx.rotate(Math.atan2(dy, dx));
        this._drawComponentSymbol(edge, distance);
        ctx.restore();

        ctx.save();
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "600 15px Arial, sans-serif";
        ctx.fillText(edge.name || "Req", middle.x - normalX * 25, middle.y - normalY * 25);
        ctx.font = "13px Arial, sans-serif";
        ctx.fillText(edge.value || "", middle.x + normalX * 25, middle.y + normalY * 25);
        ctx.restore();
    },

    _drawComponentSymbol(edge, branchLength) {
        const type = this.solution.steps[this.currentStepIndex].snapshot.componentType || "R";
        const symbolHalf = 24;
        const halfLength = Math.max(symbolHalf + 12, branchLength / 2);

        ctx.beginPath();
        if (type === "C") {
            ctx.moveTo(-halfLength, 0);
            ctx.lineTo(-7, 0);
            ctx.moveTo(-7, -12);
            ctx.lineTo(-7, 12);
            ctx.moveTo(7, -12);
            ctx.lineTo(7, 12);
            ctx.moveTo(7, 0);
            ctx.lineTo(halfLength, 0);
        } else if (type === "L") {
            ctx.moveTo(-halfLength, 0);
            ctx.lineTo(-24, 0);
            for (let index = 0; index < 4; ++index) {
                ctx.arc(-18 + index * 12, 0, 6, Math.PI, 0);
            }
            ctx.moveTo(24, 0);
            ctx.lineTo(halfLength, 0);
        } else {
            ctx.moveTo(-halfLength, 0);
            ctx.lineTo(-symbolHalf, 0);
            ctx.rect(-symbolHalf, -9, symbolHalf * 2, 18);
            ctx.moveTo(symbolHalf, 0);
            ctx.lineTo(halfLength, 0);
        }
        ctx.stroke();
    },

    _drawNode(node, position) {
        if (!position) return;

        const terminal = node.terminal === "start" || node.terminal === "end";
        ctx.save();
        ctx.fillStyle = terminal ? "#00aaff" : "#5d5d5d";
        ctx.beginPath();
        ctx.arc(position.x, position.y, terminal ? 8 : 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#202020";
        ctx.font = terminal ? "600 15px Arial, sans-serif" : "600 13px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(node.name, position.x, position.y - 13);
        ctx.restore();
    },

    _drawPreviewBadge(step, width) {
        const text = `Solution preview · Step ${this.currentStepIndex + 1}: ${step.title}`;
        ctx.save();
        ctx.font = "600 13px Arial, sans-serif";
        const badgeWidth = Math.min(width - 32, ctx.measureText(text).width + 28);
        ctx.fillStyle = "rgba(55, 55, 55, 0.9)";
        ctx.beginPath();
        ctx.roundRect(16, 16, badgeWidth, 34, 17);
        ctx.fill();
        ctx.fillStyle = "#f2f2f2";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(text, 30, 33, Math.max(0, badgeWidth - 28));
        ctx.restore();
    },

    _stepAccent(type) {
        if (type === "series") return "#4299e1";
        if (type === "parallel") return "#2fa872";
        if (type === "transform") return "#9a63c7";
        if (type === "result") return "#c18b12";
        return "#4f8fcf";
    }
};
