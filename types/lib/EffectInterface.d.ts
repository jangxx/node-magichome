// no attempt at proper typing was made here, since this whole class is deprecated anyway
export = EffectInterface;
/**
 * @deprecated This interface is deprecated, use the AsyncEffectInterface instead
 */
declare class EffectInterface {
    constructor(address: any, port: any, options: any, connection_callback: any);
    get connected(): boolean;
    start(interval_function: any): void;
    stop(): void;
    delay(time: any): void;
    setColor(red: any, green: any, blue: any): void;
}
