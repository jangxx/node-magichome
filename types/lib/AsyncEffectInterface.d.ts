export class AsyncEffectInterface {
    constructor(address: string, port: number, parent: any, color_ack: boolean, apply_masks: boolean);
    userData: {};
    get connected(): boolean;
    connect(): Promise<void>;
    start(interval_function: any): any;
    stop(): void;
    end(): void;
    delay(milliseconds: number): Promise<void>;
    setColorAndWarmWhite(red: number, green: number, blue: number, warm_white: number): Promise<void>;
    setColorAndWhites(red: number, green: number, blue: number, warm_white: number, cold_white: number): Promise<void>;
    setColor(red: number, green: number, blue: number): Promise<void>;
    setWarmWhite(warm_white: number): Promise<void>;
    setWhites(warm_white: number, cold_white: number): Promise<void>;
}
/**
 * A class that helps with timing an effect where each of the commands are asynchronous
 */
export class EffectTimingHelper {
    constructor(parent: any);
    isStarted(): boolean;
    start(): void;
    delayRemaining(milliseconds: any): Promise<void>;
}
