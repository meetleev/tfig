"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveRelativePath = exports.NameResolver = void 0;
class NameResolver {
    constructor() {
        this._contextStack = [];
    }
    resolve(entity) {
        return resolveRelativePath(this.current(), entity);
    }
    enter(ns) {
        this._contextStack.push(ns);
    }
    leave() {
        if (this._contextStack.length === 0) {
            throw new Error(`Bad NameResolver.leave() call`);
        }
        else {
            this._contextStack.pop();
        }
    }
    current() {
        if (this._contextStack.length === 0) {
            // Shall not happen
            debugger;
        }
        return this._contextStack[this._contextStack.length - 1];
    }
}
exports.NameResolver = NameResolver;
function printNamespace(trait) {
    const fullPath = trait.entity.fullPath;
    return `"${fullPath[0].name}"${fullPath.length === 0 ? '' : `.${fullPath.slice(1).map(e => e.name).join('.')}`}`;
}
function resolveRelativePath(from, to) {
    const fromFullPath = from.entity.fullPath;
    const toFullPath = to.fullPath;
    let iUnmatchedNamespace = 0;
    for (; iUnmatchedNamespace < fromFullPath.length &&
        iUnmatchedNamespace < toFullPath.length; ++iUnmatchedNamespace) {
        if (fromFullPath[iUnmatchedNamespace] !== toFullPath[iUnmatchedNamespace]) {
            break;
        }
    }
    // assert(toFullPath.length >= 2);
    const result = {
        name: toFullPath[toFullPath.length - 1].name,
    };
    // We should consider an edge case:
    // an inner namespace 'A' reference outer namespace 'B', for example,
    // the shortest path is "a.b....".
    // However the 'A' may also has a (nested) namespace named "a.b....".
    // So the conflict occurs.
    // In such case, we have to prefer the longest path to avoid conflict.
    // Known issue: when resolve "A B ..." from "A C ..."
    // And C has member named B, the result is wrong.
    let iNoConflict = iUnmatchedNamespace;
    if (iNoConflict < toFullPath.length) {
        while (iNoConflict > 0) {
            const entity = toFullPath[iNoConflict];
            if (!mayUnambiguousReferenceTo(entity, from, entity.name)) {
                --iNoConflict;
            }
            else {
                break;
            }
        }
    }
    if (iNoConflict === 0) {
        // Module mismatch
        result.module = toFullPath[0];
        ++iNoConflict;
    }
    const sliceSize = toFullPath.length - iNoConflict - 1;
    if (sliceSize > 0) {
        if (!to.nonExport)
            result.namespaces = toFullPath.slice(iNoConflict, iNoConflict + sliceSize).map(n => n.name);
    }
    return result;
}
exports.resolveRelativePath = resolveRelativePath;
function mayUnambiguousReferenceTo(ref, from, name) {
    let ns = from;
    while (true) {
        for (const bro of ns.children) {
            if (bro === ref) {
                return true;
            }
            else if (bro.name === name) {
                return false;
            }
        }
        if (ns.entity.isModule()) {
            break;
        }
        else {
            ns = ns.entity.parent;
        }
    }
    return true;
}
//# sourceMappingURL=name-resolver.js.map