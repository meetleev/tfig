"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rollupTypes = exports.bundle = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const path_1 = __importDefault(require("path"));
const typescript_1 = __importStar(require("typescript"));
const rConcepts = __importStar(require("./r-concepts"));
const name_resolver_1 = require("./name-resolver");
const distribute_exports_1 = require("./distribute-exports");
const recast_1 = require("./recast");
function bundle(options) {
    if (options.verbose) {
        console.log(`Cwd: ${process.cwd()}`);
        console.log(`Options: ${JSON.stringify(options)}`);
        console.log(`TypeScript version: ${typescript_1.default.version}`);
    }
    // Check the input.
    const inputs = Array.isArray(options.input) ? options.input : [options.input];
    if (!inputs.every(input => fs.existsSync(input))) {
        throw new Error(`Input file ${inputs} not found.`);
    }
    return rollupTypes(options);
}
exports.bundle = bundle;
class SymbolEntityMap {
    constructor() {
        // private _map: Map<ts.Symbol, rConcepts.Entity> = new Map();
        this._entitySymbol = Symbol('[[Entity]]');
    }
    set(symbol, entity) {
        // return this._map.set(symbol, entity);
        symbol[this._entitySymbol] = entity;
    }
    get(symbol) {
        // return this._map.get(symbol);
        return symbol[this._entitySymbol];
    }
}
function rollupTypes(options) {
    var _a;
    const inputs = Array.isArray(options.input) ? options.input : [options.input];
    const rootDir = (_a = options.rootDir) !== null && _a !== void 0 ? _a : path_1.default.dirname(inputs[0]);
    const entries = getEntries();
    const program = createProgram();
    const typeChecker = program.getTypeChecker();
    const groupSources = bundle();
    const groups = groupSources.map(emit);
    return {
        groups,
    };
    function getEntries() {
        if (options.entries) {
            return options.entries;
        }
        else if (options.rootModule && options.name) {
            return {
                [options.name]: options.rootModule,
            };
        }
        throw new Error(`'entries' is not specified.`);
    }
    function createTscOptions() {
        return {
            rootDir,
        };
    }
    function createProgram() {
        const tscOptions = createTscOptions();
        return typescript_1.default.createProgram({
            rootNames: inputs,
            options: tscOptions,
        });
    }
    function bundle() {
        const ambientModules = typeChecker.getAmbientModules();
        const entryModules = Object.entries(entries).map(([entryModuleName, entryModuleId]) => {
            const name = `"${entryModuleId}"`;
            let moduleSymbol = ambientModules.find(m => m.getName() === name);
            if (!moduleSymbol) {
                const sourceFile = program.getSourceFile(entryModuleId);
                if (sourceFile) {
                    moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile);
                }
            }
            if (!moduleSymbol) {
                throw new Error(`Entry ${entryModuleName}: ${entryModuleId} is not found.`);
            }
            const referencingSymbols = getReferencingSymbolsInModule(moduleSymbol);
            return {
                referencingSymbols,
                name: entryModuleName,
                symbol: moduleSymbol,
            };
        });
        const rEntityMap = new SymbolEntityMap();
        const exportDistribution = (0, distribute_exports_1.distributeExports)(entryModules.map((eM) => eM.symbol), typeChecker, options.priority, options.privateJsDocTag);
        const distributionMap = new Map();
        /*const neNamespaceMap = new Map<rConcepts.NamespaceTraits, {
            ns: rConcepts.NamespaceTraits;
            statements: ts.Statement[];
        }>();*/
        const rExternalModules = entryModules.map((entryModule, iEntryModule) => {
            const rModule = rConcepts.createModule(entryModule.name, entryModule.symbol);
            createREntities(exportDistribution[iEntryModule], rModule.namespaceTraits);
            return rModule;
        });
        const visitModules = (moduleMeta, fx) => {
            fx(moduleMeta);
            for (const mainExport of moduleMeta.mainExports) {
                if (mainExport.children) {
                    for (const child of mainExport.children) {
                        visitModules(child, fx);
                    }
                }
            }
        };
        for (const distribution of exportDistribution) {
            visitModules(distribution, addAliasExports);
        }
        const nameResolver = new name_resolver_1.NameResolver();
        const myRecast = (rModule) => (0, recast_1.recastTopLevelModule)({
            program,
            typeChecker,
            rModule,
            nameResolver,
            resolveEntity: (symbol) => rEntityMap.get(symbol),
            registerNonExportedSymbol,
            privateJsDocTag: options.privateJsDocTag,
        });
        const groupSources = new Map();
        for (const rModule of rExternalModules) {
            let groupIndex = -1;
            if (options.groups) {
                const rModuleName = rModule.name;
                const matchedGroup = options.groups.findIndex(groupOption => groupOption.test.test(rModuleName));
                if (matchedGroup >= 0) {
                    groupIndex = matchedGroup;
                }
            }
            let groupSource = groupSources.get(groupIndex);
            if (!groupSource) {
                let outputPath;
                if (groupIndex >= 0) {
                    outputPath = options.groups[groupIndex].path;
                }
                else {
                    if (!options.output) {
                        throw new Error(`You must specify <output> since there is a un-grouped module.`);
                    }
                    else {
                        outputPath = options.output;
                    }
                }
                groupSource = {
                    statements: [],
                    path: outputPath,
                };
                groupSources.set(groupIndex, groupSource);
            }
            groupSource.statements.push(...myRecast(rModule.moduleTraits));
        }
        return Array.from(groupSources.values());
        function getReferencingSymbolsInModule(symbol) {
            const referencingSymbols = new Set();
            const declarations = symbol.getDeclarations();
            if (!declarations || declarations.length === 0) {
                return referencingSymbols;
            }
            for (const declaration of declarations) {
                const scopeSymbols = typeChecker.getSymbolsInScope(declaration, -1);
                for (const scopeSymbol of scopeSymbols) {
                    const declarations = scopeSymbol.getDeclarations();
                    if (!declarations || declarations.length === 0 || declarations.every((declaration) => {
                        const sourceFile = declaration.getSourceFile();
                        return program.isSourceFileDefaultLibrary(sourceFile) ||
                            program.isSourceFileFromExternalLibrary(sourceFile);
                    })) {
                        continue;
                    }
                    referencingSymbols.add(scopeSymbol);
                }
            }
            return referencingSymbols;
        }
        function createREntities(moduleExportDistribution, parent) {
            distributionMap.set(moduleExportDistribution, parent);
            return moduleExportDistribution.mainExports.forEach((mainExport) => {
                const rEntity = new rConcepts.Entity(parent, mainExport.exportSymbol.name, mainExport.originalSymbol);
                if (mainExport.children) {
                    const namespaceTraits = rEntity.addNamespaceTraits();
                    for (const nestedModule of mainExport.children) {
                        createREntities(nestedModule, namespaceTraits);
                    }
                }
                rEntityMap.set(mainExport.originalSymbol, rEntity);
                return rEntity;
            });
        }
        function addAliasExports(moduleDistribution) {
            const rModule = distributionMap.get(moduleDistribution);
            for (const aeDistribution of moduleDistribution.aliasExports) {
                rModule.addAliasExport({
                    module: distributionMap.get(aeDistribution.module),
                    importName: aeDistribution.module.mainExports[aeDistribution.mainExportIndex].exportSymbol.name,
                    exportName: aeDistribution.exportSymbol.name,
                });
            }
        }
        function registerNonExportedSymbol(symbol, referencingNamespace) {
            // TODO: what's this? I forgot.. But just keep unchanged.
            let referencingNamespaceInSource = referencingNamespace;
            while (!referencingNamespaceInSource.entity.symbol) {
                referencingNamespaceInSource = referencingNamespaceInSource.entity.parent.entity.namespaceTraits;
            }
            let rootModuleName = getModuleRootName(symbol);
            const { nonExportedExternalLibs } = options;
            let bNonExportLib = undefined != nonExportedExternalLibs ? -1 != (nonExportedExternalLibs === null || nonExportedExternalLibs === void 0 ? void 0 : nonExportedExternalLibs.indexOf(rootModuleName)) : false;
            const neNamespace = decideNeNamespaceForNonExportedSymbol(symbol, referencingNamespaceInSource);
            const names = generateUniqueName(symbol, bNonExportLib ? '' : '_');
            let name;
            if (1 < names.length) {
                if (bNonExportLib) {
                    let first = names.shift();
                    name = `import('${first}').${names.join('.')}`;
                }
                else
                    name = names.join('_');
            }
            else {
                name = names[0];
                if (bNonExportLib)
                    name = `import('${name}')`;
            }
            // const name = generateUniqueName(symbol, neNamespace.trait, referencingNamespaceInSource);
            const entity = new rConcepts.Entity(neNamespace.trait, name, symbol);
            entity.nonExport = bNonExportLib;
            rEntityMap.set(symbol, entity);
            return {
                entity,
                addStatements: (statements) => {
                    !bNonExportLib && neNamespace.statements.push(...statements);
                },
            };
        }
        function decideNeNamespaceForNonExportedSymbol(symbol, currentNamespaceInSource) {
            const enclosing = getNeNamespaceOfEnclosingModule(symbol);
            if (enclosing) {
                return enclosing;
            }
            return currentNamespaceInSource.entity.ownerModuleOrThis.namespaceTraits.getOrCreateNENamespace();
        }
        function getNeNamespaceOfEnclosingModule(symbol) {
            const { nonExportedSymbolDistribution } = options;
            if (!nonExportedSymbolDistribution) {
                return;
            }
            const enclosingModuleName = getEnclosingModuleName(symbol);
            if (!enclosingModuleName) {
                return null;
            }
            for (const { sourceModule, targetModule } of nonExportedSymbolDistribution) {
                if (!sourceModule.test(enclosingModuleName)) {
                    continue;
                }
                const externalModule = rExternalModules.find(({ name }) => name === targetModule);
                if (!externalModule) {
                    return null;
                }
                return externalModule.namespaceTraits.getOrCreateNENamespace();
            }
            return null;
        }
        function getEnclosingModuleName(symbol) {
            const declarations = symbol.getDeclarations();
            if (!declarations || declarations.length === 0) {
                return null;
            }
            let currentNode = declarations[0];
            const transformModuleName = (fileName) => {
                return fileName.replace(/[\\]/g, '/');
            };
            while (true) {
                if (typescript_1.default.isSourceFile(currentNode)) {
                    return transformModuleName(currentNode.fileName);
                }
                if (typescript_1.default.isModuleDeclaration(currentNode) && !(currentNode.flags & typescript_1.default.NodeFlags.Namespace)) {
                    let symbol = typeChecker.getSymbolAtLocation(currentNode.name);
                    return transformModuleName(symbol ? symbol.getName() : '');
                }
                currentNode = currentNode.parent;
            }
        }
        function getModuleRootName(symbol) {
            var _a;
            const declaration0 = (_a = symbol.getDeclarations()) === null || _a === void 0 ? void 0 : _a[0];
            if (!declaration0) {
                return symbol.getName();
            }
            let current = declaration0;
            if (!typescript_1.default.isSourceFile(declaration0)) {
                // If the input isn't source file,
                // we directly extract its name in symbol,
                // otherwise we handle it further.
                current = current.parent;
            }
            while (current) {
                if (typescript_1.default.isSourceFile(current)) {
                    break;
                }
                else if (typescript_1.default.isModuleDeclaration(current)) {
                    if (typescript_1.default.isSourceFile(current.parent) &&
                        !(current.flags & typescript_1.NodeFlags.Namespace) &&
                        typescript_1.default.isStringLiteral(current.name)) {
                        // is `[declare] module "" {}` under source file
                        break;
                    }
                }
                current = current.parent;
            }
            if (typescript_1.default.isSourceFile(current)) {
                let fileName = current.fileName;
                if (fileName.includes('/'))
                    return fileName.substr(fileName.lastIndexOf('/') + 1).replace('.d.ts', '');
                return fileName;
            }
            return current.name.text;
        }
        function generateUniqueName(symbol, nodePrefixName) {
            var _a;
            const declaration0 = (_a = symbol.getDeclarations()) === null || _a === void 0 ? void 0 : _a[0];
            if (!declaration0) {
                return [symbol.getName()];
            }
            const namespaces = [];
            let current = declaration0;
            if (!typescript_1.default.isSourceFile(declaration0)) {
                // If the input isn't source file,
                // we directly extract its name in symbol,
                // otherwise we handle it further.
                namespaces.push(generateIdFromString(symbol.getName(), nodePrefixName));
                current = current.parent;
            }
            while (current) {
                if (typescript_1.default.isSourceFile(current) && !current.isDeclarationFile) {
                    namespaces.unshift(generateIdFromSourceFileName(current.fileName, nodePrefixName));
                    break;
                }
                else if (typescript_1.default.isModuleDeclaration(current)) {
                    namespaces.unshift(generateIdFromModuleDeclarationName(current.name, nodePrefixName));
                    if (typescript_1.default.isSourceFile(current.parent) &&
                        !(current.flags & typescript_1.NodeFlags.Namespace) &&
                        typescript_1.default.isStringLiteral(current.name)) {
                        // is `[declare] module "" {}` under source file
                        break;
                    }
                }
                current = current.parent;
            }
            return namespaces;
        }
        /*function generateUniqueName(symbol: ts.Symbol, parentModule: rConcepts.NamespaceTraits, referenceNamespaceTraits: rConcepts.NamespaceTraits): string {
            const declaration0 = symbol.getDeclarations()?.[0];
            if (!declaration0) {
                return symbol.getName();
            }

            const namespaces: string[] = [];

            let current: ts.Node = declaration0;

            if (!ts.isSourceFile(declaration0)) {
                // If the input isn't source file,
                // we directly extract its name in symbol,
                // otherwise we handle it further.
                namespaces.push(generateIdFromString(symbol.getName()));
                current = current.parent;
            }

            while (current) {
                if (ts.isSourceFile(current)) {
                    namespaces.unshift(generateIdFromSourceFileName(current.fileName, '_'));
                    break;
                } else if (ts.isModuleDeclaration(current)) {
                    namespaces.unshift(generateIdFromModuleDeclarationName(current.name, '_'));
                    if (ts.isSourceFile(current.parent) &&
                        !(current.flags & NodeFlags.Namespace) &&
                        ts.isStringLiteral(current.name)) {
                        // is `[declare] module "" {}` under source file
                        break;
                    }
                }
                current = current.parent;
            }

            return namespaces.join('_');
        }*/
        function generateIdFromModuleDeclarationName(name, nodePrefixName) {
            if (typescript_1.default.isIdentifier(name)) {
                return name.text;
            }
            else {
                return generateIdFromString(name.text, nodePrefixName);
            }
        }
        function generateIdFromSourceFileName(fileName, nodePrefixName) {
            const relativeFromRoot = path_1.default.relative(rootDir, fileName);
            const extensionStriped = relativeFromRoot.replace(/\.(js|ts|d\.ts)$/, '');
            return generateIdFromString(extensionStriped, nodePrefixName);
        }
        function generateIdFromString(text, nodePrefixName = '_') {
            //  To handle keywords and illegal first letters, we prefix it with a legal letter.
            return nodePrefixName + text.replace(/[\/\\-]/g, '_').replace(/['":\.@]/g, '');
        }
    }
    function emit(groupSource) {
        const printer = typescript_1.default.createPrinter({
            newLine: typescript_1.default.NewLineKind.LineFeed,
        });
        const sourceFile = typescript_1.default.createSourceFile(path.basename(groupSource.path), '', typescript_1.default.ScriptTarget.Latest, false, typescript_1.default.ScriptKind.TS);
        const lines = [];
        const statementsArray = typescript_1.default.factory.createNodeArray(groupSource.statements);
        const result = printer.printList(typescript_1.default.ListFormat.MultiLine, statementsArray, sourceFile);
        lines.push(result);
        const code = lines.join('\n');
        return {
            path: groupSource.path,
            code,
        };
    }
}
exports.rollupTypes = rollupTypes;
//# sourceMappingURL=gift.js.map