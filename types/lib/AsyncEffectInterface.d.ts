export class AsyncEffectInterface {
    constructor(address: any, port: any, parent: any, color_ack: any, apply_masks: any);
    userData: {};
    get connected(): boolean;
    connect(): any;
    start(interval_function: any): any;
    stop(): void;
    end(): void;
    delay(milliseconds: any): any;
    setColorAndWarmWhite(red: any, green: any, blue: any, warm_white: any): any;
    setColorAndWhites(red: any, green: any, blue: any, warm_white: any, cold_white: any): any;
    setColor(red: any, green: any, blue: any): any;
    setWarmWhite(warm_white: any): any;
    setWhites(warm_white: any, cold_white: any): any;
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
