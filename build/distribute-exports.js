"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.distributeExports = void 0;
const typescript_1 = __importDefault(require("typescript"));
const ts_utils_1 = require("./ts-utils");
function distributeExports(moduleSymbols, typeChecker, priorityList = [], privateJsDocTag) {
    const parsedPriorityList = priorityList.map((id) => `"${id.replace(/\\/g, '/').replace(/\.(js|ts|d\.ts)$/, '')}"`);
    const exportMap = new Map();
    const moduleMetaList = moduleSymbols.map((moduleSymbol) => {
        const moduleMeta = {
            symbol: moduleSymbol,
            mainExports: [],
            aliasExports: [],
            [prioritySymbol]: getExportPriority(moduleSymbol, parsedPriorityList),
        };
        iterateModuleExports(moduleSymbol, moduleMeta);
        return moduleMeta;
    });
    exportMap.forEach((symbolInfo, originalSymbol) => {
        const { exportPorts } = symbolInfo;
        const iMainExportPort = findBestExportMeta(originalSymbol, exportPorts);
        const mainExportPort = exportPorts[iMainExportPort];
        const mainExportModule = mainExportPort.module;
        const mainExportIndex = mainExportModule.mainExports.length;
        mainExportModule.mainExports.push({
            originalSymbol,
            exportSymbol: mainExportPort.through,
            children: symbolInfo.children,
        });
        exportPorts.forEach((aliasingExportPort, iAliasingExportPort) => {
            if (iAliasingExportPort === iMainExportPort) {
                return;
            }
            aliasingExportPort.module.aliasExports.push({
                module: mainExportModule,
                mainExportIndex: mainExportIndex,
                exportSymbol: aliasingExportPort.through,
            });
        });
    });
    return moduleMetaList;
    function iterateModuleExports(moduleSymbol, moduleMeta) {
        var _a, _b, _c;
        const exportSymbols = typeChecker.getExportsOfModule(moduleSymbol);
        for (const exportedSymbol of exportSymbols) {
            let originalSymbol = exportedSymbol;
            if (exportedSymbol.flags & typescript_1.default.SymbolFlags.Alias) {
                originalSymbol = typeChecker.getAliasedSymbol(exportedSymbol);
            }
            if (privateJsDocTag) {
                // TODO: to add a Set to keep the internal originalSymbol, if it's referenced, we put it into the NE namespace. 
                if ((exportedSymbol.flags & typescript_1.default.SymbolFlags.Alias) && (originalSymbol.flags & typescript_1.default.SymbolFlags.Module)) {
                    // We need to detect tag on exported symbol with alias flag.
                    const parentNode = (_c = (_b = (_a = exportedSymbol.declarations) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.parent) === null || _c === void 0 ? void 0 : _c.parent;
                    if (parentNode) {
                        const tags = typescript_1.default.getJSDocTags(parentNode).map(tag => {
                            return { name: tag.tagName.escapedText };
                        });
                        if ((0, ts_utils_1.hasJsDocTag)(tags, privateJsDocTag)) {
                            continue;
                        }
                    }
                }
                else {
                    if ((0, ts_utils_1.hasJsDocTag)(originalSymbol.getJsDocTags(), privateJsDocTag)) {
                        continue;
                    }
                }
            }
            if ((exportedSymbol.getFlags() & typescript_1.default.SymbolFlags.Prototype) &&
                (exportedSymbol.getFlags() & typescript_1.default.SymbolFlags.Property)) {
                // A symbol with both class and namespace declaration
                // might have a prototype exported symbol, which associates no declarations.
                continue;
            }
            let symbolInfo = exportMap.get(originalSymbol);
            if (symbolInfo === undefined) {
                symbolInfo = {
                    exportPorts: [],
                };
                if (originalSymbol.getFlags() & typescript_1.default.SymbolFlags.Module) {
                    symbolInfo.children = [];
                    const nestedModule = {
                        symbol: moduleSymbol,
                        mainExports: [],
                        aliasExports: [],
                        [prioritySymbol]: moduleMeta[prioritySymbol],
                    };
                    symbolInfo.children.push(nestedModule);
                    iterateModuleExports(originalSymbol, nestedModule);
                }
                exportMap.set(originalSymbol, symbolInfo);
            }
            symbolInfo.exportPorts.push({
                through: exportedSymbol,
                module: moduleMeta,
            });
        }
    }
    function findBestExportMeta(originalSymbol, exportPorts) {
        // If there is only one export port, that's it.
        if (exportPorts.length === 1) {
            return 0;
        }
        // If any of the ports is specified with priority, we take the hightest specified one.
        const iHighestPriorityPort = exportPorts
            .map((_, index) => index)
            .sort((a, b) => exportPorts[a].module[prioritySymbol] - exportPorts[b].module[prioritySymbol])[0];
        if (!isNonSpecifiedPriority(exportPorts[iHighestPriorityPort].module[prioritySymbol], parsedPriorityList)) {
            return iHighestPriorityPort;
        }
        // Otherwise, We first search if there is an export is specified as 'main' by user.
        const iMatched = exportPorts.findIndex((exportPort) => matchExportPort(exportPort));
        if (iMatched >= 0) {
            return iMatched;
        }
        // If not, we prefer the module which exports the original.
        const iOriginal = exportPorts.findIndex((exportPort) => exportPort.through === originalSymbol);
        if (iOriginal >= 0) {
            return iOriginal;
        }
        // If no module exports original, we use the first we met.
        return 0;
    }
    function matchExportPort(exportPort) {
        return false; // TODO
    }
}
exports.distributeExports = distributeExports;
const prioritySymbol = Symbol('Priority');
function getExportPriority(moduleSymbol, parsedPriorityList) {
    const index = parsedPriorityList.indexOf(moduleSymbol.getName());
    return index >= 0 ? index : parsedPriorityList.length;
}
function isNonSpecifiedPriority(priority, parsedPriorityList) {
    return priority === parsedPriorityList.length;
}
//# sourceMappingURL=distribute-exports.js.map