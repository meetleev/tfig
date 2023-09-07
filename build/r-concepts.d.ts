import ts from 'typescript';
export declare class Entity {
    /**
     * `null` indicates this entity is created by us.
     */
    symbol: ts.Symbol | null;
    moduleTraits?: ModuleTraits;
    constructor(parent: NamespaceTraits, name: string, symbol: ts.Symbol | null);
    private _nonExport;
    get nonExport(): boolean;
    set nonExport(value: boolean);
    get name(): string;
    set name(value: string);
    get parent(): NamespaceTraits;
    get fullPath(): Entity[];
    get ownerModule(): ModuleEntity | undefined;
    get ownerModuleOrThis(): ModuleEntity;
    get namespaceTraits(): NamespaceTraits | undefined;
    isModule(): this is ModuleEntity;
    addNamespaceTraits(): NamespaceTraits;
    private _name;
    private _ownerModule;
    private _namespaceTraits?;
    private _fullPath;
}
type ModuleEntity = Entity & {
    readonly namespaceTraits: NamespaceTraits;
    readonly moduleTraits: ModuleTraits;
    readonly ownerModule: undefined;
};
export declare class BaseTraits {
    readonly entity: Entity;
    constructor(entity: Entity);
}
export declare class ModuleTraits extends BaseTraits {
    private _imports;
    /**
     *
     */
    private _interopRecord;
    get imports(): Record<string, ImportDetail>;
    get interopRecord(): Map<string, {
        specifier: string;
        /**
         * import { xx, yy as zz } from 'ww';
         */
        imports: {
            asName: string;
            importName: string;
        }[];
        /**
         * export { xx, yy as zz } from 'ww';
         */
        exports: {
            asName: string;
            importName: string;
        }[];
    }>;
    /**
     * @param from
     * @param importName
     * @param asName
     */
    addNamedImport(from: string, importName: string, asName?: string): string;
    addNamedExportFrom(from: string, importName: string, asName: string): void;
    private _generateUniqueImportName;
    private _hasName;
    private _hasNameInInterop;
    private _getInterop;
    private _optimizeModuleSpecifierTo;
}
export interface ImportDetail {
    namedImports: Record<string, string>;
}
export declare class NamespaceTraits extends BaseTraits {
    private _children;
    private _aliasExports;
    /**
     * namespace N { export { xx, yy as zz }; }
     */
    private _selfExports;
    /**
     * namespace N { export import x = X.Y.Z.y; }
     */
    private _selfExportsFromNamespaces;
    /**
     * ne Means "non-exporting"
     */
    private _neNamespace?;
    get children(): Entity[];
    get selfExports(): {
        asName: string;
        importName: string;
    }[];
    get selfExportsFromNamespaces(): {
        asName: string;
        importName: string;
        where: string[];
    }[];
    get neNamespace(): {
        trait: NamespaceTraits;
        statements: ts.Statement[];
    } | undefined;
    addChild(entity: Entity): void;
    addAliasExport(aliasExport: NamespaceTraits['_aliasExports'][0]): void;
    getOrCreateNENamespace(): {
        trait: NamespaceTraits;
        statements: ts.Statement[];
    };
    transformAliasExports(): void;
    private _addSelfExport;
    private _addSelfExportFromNamespace;
}
export declare function createModule(name: string, symbol: ts.Symbol): ModuleEntity;
export {};
