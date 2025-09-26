class Equivalent {
  constructor() {}
  computeEquivalent(startNode, endNode) {
    if (!startNode || !endNode) return null;
    const { reachable, edges } = this._collectReachable(startNode);
    if (!reachable.has(endNode)) return null;
    const uf = new EqUnionFind();
    for (const node of reachable) uf.makeSet(node);
    for (const e of edges) {
      if (this._isZeroEdge(e)) uf.union(e.a, e.b);
    }
    const repMap = new Map();
    const groups = new Map();
    let nextId = 0;
    for (const node of reachable) {
      const rep = uf.find(node);
      repMap.set(node, rep);
      if (!groups.has(rep)) groups.set(rep, { id: nextId++, nodes: new Set() });
      groups.get(rep).nodes.add(node);
    }
    const startRep = repMap.get(startNode);
    const endRep = repMap.get(endNode);
    if (startRep === endRep) return 0.0;
    const adjacency = new Map();
    for (const g of groups.values()) adjacency.set(g.id, new Map());
    const seen = new Set();
    for (const e of edges) {
      if (this._isZeroEdge(e)) continue;
      const ra = repMap.get(e.a);
      const rb = repMap.get(e.b);
      if (ra === rb) continue;
      const idA = groups.get(ra).id;
      const idB = groups.get(rb).id;
      const isObj = (typeof e.value === "object" && e.value && e.value.value !== undefined);
      if (isObj) {
        if (seen.has(e.value)) continue;
        seen.add(e.value);
      }
      const G = this._edgeConductance(e);
      if (!(G > 0) || !isFinite(G)) continue;
      if (!adjacency.get(idA).has(idB)) adjacency.get(idA).set(idB, 0);
      if (!adjacency.get(idB).has(idA)) adjacency.get(idB).set(idA, 0);
      adjacency.get(idA).set(idB, adjacency.get(idA).get(idB) + G);
      adjacency.get(idB).set(idA, adjacency.get(idB).get(idA) + G);
    }
    const startId = groups.get(startRep).id;
    const endId = groups.get(endRep).id;
    const allIds = Array.from(adjacency.keys());
    const internal = allIds.filter(id => id !== startId && id !== endId);
    if (internal.length === 0) {
      const directG = adjacency.get(startId).get(endId) || 0;
      if (!(directG > 0)) return 0;
      return this._equivalentFromTotalCurrent(directG);
    }
    const idx = new Map();
    internal.forEach((id, i) => idx.set(id, i));
    const n = internal.length;
    const A = Array.from({ length: n }, () => new Array(n).fill(0));
    const b = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      const id = internal[i];
      const neigh = adjacency.get(id);
      let diag = 0;
      for (const [nid, G] of neigh.entries()) {
        diag += G;
        if (nid === startId) {
          b[i] += G;
        } else if (nid === endId) {
        } else {
          const j = idx.get(nid);
          if (j !== undefined) A[i][j] -= G;
        }
      }
      A[i][i] += diag;
    }
    const Vint = this._solveLinear(A, b);
    if (!Vint) return 0;
    const V = {};
    V[startId] = 1;
    V[endId] = 0;
    for (let i = 0; i < n; i++) V[internal[i]] = Vint[i];
    let I_total = 0;
    for (const [nid, G] of adjacency.get(startId).entries()) {
      I_total += G * (1 - V[nid]);
    }
    if (!(I_total > 0)) return 0;
    return this._equivalentFromTotalCurrent(I_total);
  }
  toString(startNode, endNode) {
    const eq = this.computeEquivalent(startNode, endNode);
    if (eq == null) return "";
    if (eq === Infinity) return "Infinity";
    return String(eq);
  }
  _componentType() {
    if (!window.choosenComponent || !choosenComponent.shortName) return "R";
    return choosenComponent.shortName;
  }
  _collectReachable(startNode) {
    const visited = new Set();
    const edges = [];
    const stack = [startNode];
    visited.add(startNode);
    while (stack.length) {
      const cur = stack.pop();
      const conns = cur.connections || [];
      for (let i = 0; i < conns.length; i++) {
        const edge = conns[i];
        edges.push({ a: cur, b: edge.node, value: edge.value });
        if (!visited.has(edge.node)) {
          visited.add(edge.node);
          stack.push(edge.node);
        }
      }
    }
    return { reachable: visited, edges };
  }
  _isZeroEdge(e) {
    if (!e || e.value == null) return false;
    if (typeof e.value === "string") return e.value.trim() === "0";
    if (typeof e.value === "object" && e.value.value !== undefined) {
      return String(e.value.value).trim() === "0";
    }
    return false;
  }
  _edgeConductance(e) {
    const type = this._componentType();
    const raw = this._extractValue(e.value);
    if (!(raw > 0)) return 0;
    if (type === "C") return raw;
    return 1.0 / raw;
  }
  _extractValue(v) {
    let s;
    if (typeof v === "string") s = v;
    else if (typeof v === "object" && v && v.value !== undefined) s = v.value;
    else return null;
    s = String(s).trim();
    if (!s) return null;
    if (s === "0") return 0;
    return eqParseComponentValue(s);
  }
  _equivalentFromTotalCurrent(I_total) {
    const type = this._componentType();
    if (type === "C") return I_total;
    if (!(I_total > 0)) return 0;
    return 1.0 / I_total;
  }
  _solveLinear(A, b) {
    const n = A.length;
    if (n === 0) return [];
    for (let i = 0; i < n; i++) A[i] = A[i].slice();
    b = b.slice();
    for (let col = 0; col < n; col++) {
      let pivot = col;
      let maxAbs = Math.abs(A[col][col]);
      for (let r = col + 1; r < n; r++) {
        const val = Math.abs(A[r][col]);
        if (val > maxAbs) { maxAbs = val; pivot = r; }
      }
      if (maxAbs < 1e-14) return null;
      if (pivot !== col) {
        [A[pivot], A[col]] = [A[col], A[pivot]];
        [b[pivot], b[col]] = [b[col], b[pivot]];
      }
      const pivVal = A[col][col];
      for (let c = col; c < n; c++) A[col][c] /= pivVal;
      b[col] /= pivVal;
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const factor = A[r][col];
        if (Math.abs(factor) < 1e-18) continue;
        for (let c = col; c < n; c++) A[r][c] -= factor * A[col][c];
        b[r] -= factor * b[col];
      }
    }
    return b;
  }
}
class EqUnionFind {
  constructor() {
    this.parent = new Map();
    this.rank = new Map();
  }
  makeSet(x) {
    if (!this.parent.has(x)) { this.parent.set(x, x); this.rank.set(x, 0); }
  }
  find(x) {
    let p = this.parent.get(x);
    if (p !== x) { p = this.find(p); this.parent.set(x, p); }
    return p;
  }
  union(a, b) {
    const ra = this.find(a), rb = this.find(b);
    if (ra === rb) return;
    const rA = this.rank.get(ra), rB = this.rank.get(rb);
    if (rA < rB) this.parent.set(ra, rb);
    else if (rA > rB) this.parent.set(rb, ra);
    else { this.parent.set(rb, ra); this.rank.set(ra, rA + 1); }
  }
}
function eqParseComponentValue(str) {
  str = str.trim();
  str = str.replace(',', '.');
  const m = str.match(/^([0-9]*\.?[0-9]+)([a-zA-Z]+)?$/);
  if (!m) {
    const v = Number(str);
    return isFinite(v) ? v : null;
  }
  let num = parseFloat(m[1]);
  const suf = m[2];
  if (!suf) return num;
  const lower = suf.toLowerCase();
  let found = false;
  if (typeof PREFIXES !== "undefined" && Array.isArray(PREFIXES)) {
    for (const p of PREFIXES) {
      if (!p) continue;
      const sym = p.symbol ? String(p.symbol).toLowerCase() : "";
      const name = p.name ? String(p.name).toLowerCase() : "";
      if (lower === sym || lower === name) {
        num *= Math.pow(10, p.exponent);
        found = true;
        break;
      }
    }
  }
  if (!found) {
    console.error("Equivalent ERROR: unknown prefix: " + suf);
    return null;
  }
  return num;
}
