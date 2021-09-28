export = EffectInterface;
declare class EffectInterface {
    constructor(address: any, port: any, options: any, connection_callback: any);
    get connected(): boolean;
    start(interval_function: any): void;
    stop(): void;
    delay(time: any): void;
    setColor(red: any, green: any, blue: any): void;
}
