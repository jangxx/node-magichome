export = Discovery;
declare class Discovery {
    /**
     * Convenience method which shortens the discovery operation to a single line
     */
    static scan(timeout: any): any;
    get clients(): any[];
    get scanned(): boolean;
    /**
     * Send a scan packet into the network
     * @param {Number} timeout number of milliseconds to wait before the clients are returned
     * @param {function} callback Called with (err, clients)
     * @returns A Promise resolving to the found clients
     */
    scan(timeout?: number, callback?: Function): any;
}
