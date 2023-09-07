"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stringifyNode = exports.stringifySymbolFlags = exports.hasJsDocTag = exports.printSymbol = exports.createAccessLink = exports.createEntityName = exports.splitLeftmost = void 0;
const typescript_1 = __importDefault(require("typescript"));
const nodeFactory = typescript_1.default.factory;
function splitLeftmost(entityName) {
    let rights = [];
    let leftmost = entityName;
    while (true) {
        if (typescript_1.default.isIdentifier(leftmost)) {
            break;
        }
        rights.unshift(leftmost.right);
        leftmost = leftmost.left;
    }
    return {
        leftmost,
        rights,
    };
}
exports.splitLeftmost = splitLeftmost;
function createEntityName(identifiers, leftmost = null) {
    let result = leftmost;
    for (const id of identifiers) {
        const newID = nodeFactory.createIdentifier(id);
        if (!result) {
            result = newID;
        }
        else {
            result = nodeFactory.createQualifiedName(result, newID);
        }
    }
    return result;
}
exports.createEntityName = createEntityName;
function createAccessLink(identifiers, leftmost = null) {
    let result = leftmost;
    for (const id of identifiers) {
        const newID = nodeFactory.createIdentifier(id);
        if (!result) {
            result = newID;
        }
        else {
            result = nodeFactory.createPropertyAccessExpression(result, newID);
        }
    }
    return result;
}
exports.createAccessLink = createAccessLink;
function printSymbol(symbol) {
    const declaration = symbol.valueDeclaration || ((symbol.declarations !== undefined && symbol.declarations.length !== 0) ? symbol.declarations[0] : null);
    console.log(`[[${symbol.name}]], \n` +
        `  ${declaration ? stringifyNode(declaration) : '!!NO-DECLARATION!!'}, \n` +
        `  ${stringifySymbolFlags(symbol.flags)}`);
}
exports.printSymbol = printSymbol;
function hasJsDocTag(tagInfos, tagName) {
    for (let tagInfo of tagInfos) {
        if (tagInfo.name === tagName) {
            return true;
        }
    }
    return false;
}
exports.hasJsDocTag = hasJsDocTag;
function stringifySymbolFlags(flags) {
    const satisfies = [];
    for (const key of Object.keys(typescript_1.default.SymbolFlags)) {
        const value = typescript_1.default.SymbolFlags[key];
        if (flags & value) {
            satisfies.push(key);
        }
    }
    return satisfies.join(',');
}
exports.stringifySymbolFlags = stringifySymbolFlags;
function stringifyNode(node) {
    return `Syntax Kind: ${typescript_1.default.SyntaxKind[node.kind]}`;
}
exports.stringifyNode = stringifyNode;
//# sourceMappingURL=ts-utils.js.map