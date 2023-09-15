export interface IOptions {
    input: string | string[];
    rootDir?: string;
    output?: string;
    name?: string;
    rootModule?: string;
    entries?: Record<string, string>;
    exportPrivates?: string;
    shelterName?: string;
    verbose?: boolean;
    priority?: string[];
    /**
     * The name of js doc tag, the interface which is marked with this tag, should be recast into the non export namespace called '__private'.
     */
    privateJsDocTag?: string;
    groups?: Array<{
        test: RegExp;
        path: string;
    }>;
    /**
     * Specifies where to distribute non exported symbols.
     * If not specified, the non exported symbols are distributed to the module which firstly encountered them.
     */
    nonExportedSymbolDistribution?: Array<{
        /**
         * Regex to match the module name, where the symbol is originally declared.
         */
        sourceModule: RegExp;
        /**
         * Target module, should be in `entries`.
         */
        targetModule: string;
    }>;
    nonExportedExternalLibs?: Array<string>;
}
export interface IBundleResult {
    groups: GroupResult[];
}
export interface GroupResult {
    path: string;
    typeReferencePaths?: string[];
    code: string;
}
export declare function bundle(options: IOptions): IBundleResult;
export declare function rollupTypes(options: IOptions): {
    groups: GroupResult[];
};
