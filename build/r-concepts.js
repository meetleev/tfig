"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createModule = exports.NamespaceTraits = exports.ModuleTraits = exports.BaseTraits = exports.Entity = void 0;
const name_resolver_1 = require("./name-resolver");
const noParent = null;
class Entity {
    constructor(parent, name, symbol) {
        this._nonExport = false;
        this._ownerModule = undefined;
        this._fullPath = [];
        this.symbol = symbol;
        this._name = name;
        if (parent === noParent) {
            this._fullPath = [];
        }
        else {
            if (parent.entity.isModule()) {
                this._ownerModule = parent.entity;
            }
            else {
                this._ownerModule = parent.entity.ownerModule;
            }
            this._fullPath = parent.entity.fullPath.slice();
            parent.children.push(this);
        }
        this._fullPath.push(this);
    }
    get nonExport() {
        return this._nonExport;
    }
    set nonExport(value) {
        this._nonExport = value;
    }
    get name() {
        return this._name;
    }
    set name(value) {
        this._name = value;
    }
    get parent() {
        return this._fullPath[this._fullPath.length - 2].namespaceTraits;
    }
    get fullPath() {
        return this._fullPath;
    }
    get ownerModule() {
        return this._ownerModule;
    }
    get ownerModuleOrThis() {
        var _a;
        return (_a = this._ownerModule) !== null && _a !== void 0 ? _a : this;
    }
    get namespaceTraits() {
        return this._namespaceTraits;
    }
    isModule() {
        return !!this.moduleTraits && !!this.namespaceTraits;
    }
    addNamespaceTraits() {
        this._namespaceTraits = new NamespaceTraits(this);
        return this._namespaceTraits;
    }
}
exports.Entity = Entity;
class BaseTraits {
    constructor(entity) {
        this.entity = entity;
    }
}
exports.BaseTraits = BaseTraits;
class ModuleTraits extends BaseTraits {
    constructor() {
        super(...arguments);
        this._imports = {};
        /**
         *
         */
        this._interopRecord = new Map();
    }
    get imports() {
        return this._imports;
    }
    get interopRecord() {
        return this._interopRecord;
    }
    /**
     * @param from
     * @param importName
     * @param asName
     */
    addNamedImport(from, importName, asName) {
        const interop = this._getInterop(from);
        if (!asName) {
            const sameImport = interop.imports.find((namedImportRecord) => namedImportRecord.importName === importName);
            if (sameImport) {
                return sameImport.asName;
            }
            else {
                asName = this._generateUniqueImportName(importName);
            }
        }
        if (!interop.imports.some((namedImportRecord) => namedImportRecord.asName === asName && namedImportRecord.importName === importName)) {
            interop.imports.push({ importName, asName });
        }
        return asName;
    }
    addNamedExportFrom(from, importName, asName) {
        const interop = this._getInterop(from);
        if (!interop.exports.some((namedExportRecord) => namedExportRecord.asName === asName && namedExportRecord.importName === importName)) {
            interop.exports.push({ importName, asName });
        }
    }
    _generateUniqueImportName(preferredName) {
        let tryingName = preferredName;
        while (tryingName === '__private' || this._hasName(tryingName)) {
            tryingName = `_${tryingName}`;
        }
        return tryingName;
    }
    _hasName(name) {
        return this.entity.namespaceTraits.children.some((childEntity) => childEntity.name === name) ||
            this._hasNameInInterop(name);
    }
    _hasNameInInterop(name) {
        for (const [, { imports, exports }] of this._interopRecord) {
            if (imports.some(({ asName }) => asName === name)) {
                return true;
            }
            if (exports.some(({ asName }) => asName === name)) {
                return true;
            }
        }
        return false;
    }
    _getInterop(from) {
        let interop = this._interopRecord.get(from);
        if (!interop) {
            const specifier = this._optimizeModuleSpecifierTo(from);
            interop = {
                specifier,
                imports: [],
                exports: [],
            };
            this._interopRecord.set(from, interop);
        }
        return interop;
    }
    _optimizeModuleSpecifierTo(to) {
        return to;
    }
}
exports.ModuleTraits = ModuleTraits;
class NamespaceTraits extends BaseTraits {
    constructor() {
        super(...arguments);
        this._children = [];
        this._aliasExports = [];
        /**
         * namespace N { export { xx, yy as zz }; }
         */
        this._selfExports = [];
        /**
         * namespace N { export import x = X.Y.Z.y; }
         */
        this._selfExportsFromNamespaces = [];
    }
    get children() {
        return this._children;
    }
    get selfExports() {
        return this._selfExports;
    }
    get selfExportsFromNamespaces() {
        return this._selfExportsFromNamespaces;
    }
    get neNamespace() {
        return this._neNamespace;
    }
    addChild(entity) {
        this._children.push(entity);
    }
    addAliasExport(aliasExport) {
        this._aliasExports.push(aliasExport);
    }
    getOrCreateNENamespace() {
        if (this._neNamespace) {
            return this._neNamespace;
        }
        const neNs = new Entity(this, '__private', null);
        const trait = neNs.addNamespaceTraits();
        const neNamespace = {
            trait,
            statements: [],
        };
        return this._neNamespace = neNamespace;
    }
    transformAliasExports() {
        const targetEntity = this.entity;
        const targetModule = targetEntity.ownerModuleOrThis;
        const targetModuleTraits = targetModule.moduleTraits;
        const isTargetInternal = !targetEntity.isModule();
        const addNamespaceReference = (to) => {
            const resolved = (0, name_resolver_1.resolveRelativePath)(this, to.entity);
            const ids = [];
            if (!resolved.module) {
                ids.push(...(resolved.namespaces ? resolved.namespaces.slice() : []), resolved.name);
            }
            else {
                const namespaces = resolved.namespaces;
                const leftmost = namespaces ? namespaces[0] : resolved.name;
                const leftMostImportName = targetModuleTraits.addNamedImport(resolved.module.name, leftmost);
                ids.push(leftMostImportName);
                if (namespaces) {
                    ids.push(...namespaces.slice(1), resolved.name);
                }
            }
            return ids;
        };
        for (const aliasExport of this._aliasExports) {
            const { importName, exportName, module: sourcePlace, } = aliasExport;
            const isSourceInternal = !sourcePlace.entity.isModule();
            switch (true) {
                case !isTargetInternal && !isSourceInternal:
                    targetModuleTraits.addNamedExportFrom(sourcePlace.entity.moduleTraits.entity.name, importName, exportName);
                    break;
                case isSourceInternal:
                    // import from namespace, export into either module or namespace
                    {
                        const namespaceReference = addNamespaceReference(sourcePlace);
                        this._addSelfExportFromNamespace(namespaceReference, importName, exportName);
                    }
                    break;
                case isTargetInternal && !isSourceInternal:
                    // import from module, export into namespace
                    {
                        let asName = exportName;
                        if (sourcePlace.entity !== targetModule) {
                            asName = targetModuleTraits.addNamedImport(sourcePlace.entity.moduleTraits.entity.name, exportName);
                        }
                        this._addSelfExport(exportName, asName);
                    }
                    break;
            }
        }
    }
    _addSelfExport(importName, asName) {
        this._selfExports.push({ importName, asName });
    }
    _addSelfExportFromNamespace(where, importName, asName) {
        this._selfExportsFromNamespaces.push({ where, importName, asName });
    }
}
exports.NamespaceTraits = NamespaceTraits;
function createModule(name, symbol) {
    const entity = new Entity(noParent, name, symbol);
    entity.addNamespaceTraits();
    entity.moduleTraits = new ModuleTraits(entity);
    return entity;
}
exports.createModule = createModule;
//# sourceMappingURL=r-concepts.js.map