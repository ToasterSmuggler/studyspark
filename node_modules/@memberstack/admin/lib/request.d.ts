import { HttpHeaders, HttpMethod } from "./enums/request";
export declare class Request {
    private secretKey;
    private test;
    constructor(secretKey: string, test?: boolean);
    sendRequest<T>(data: {
        method: HttpMethod;
        url: string;
        data?: T;
        headers?: Record<HttpHeaders, string>;
    }): Promise<any>;
}
