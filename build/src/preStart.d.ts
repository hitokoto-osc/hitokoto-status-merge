export interface PreStart {
    printCopyright(): void;
    initWinston(logFile: string, configFile: string): void;
    registerNconf(configFile: string): void;
    load(params?: LoadParams): void;
}
export interface LoadParams {
    configFile?: string;
    logFile?: string;
}
export declare class PreStart implements PreStart {
    static registerNconf(configFile: string): void;
    static initWinston(logFile: string, configFile: string): void;
    static printCopyright(): void;
    static load(config?: LoadParams): void;
}
