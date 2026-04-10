import axios, { AxiosError, AxiosRequestConfig, AxiosResponse, Method } from 'axios';
import FormData from 'form-data';

type Headers = Record<string, string | string[] | undefined>;

type RequestBody = Buffer | Record<string, any> | string | undefined;

type RequestCallback = (error: Error | null, response: RequestResponse, body: any) => void;

interface RequestResponse {
    statusCode: number;
    headers: Headers;
}

interface RequestOptions {
    body?: RequestBody;
    form?: Record<string, string>;
    headers?: Record<string, string>;
    json?: boolean;
    url: string;
}

function mapResponse(response: AxiosResponse): RequestResponse {
    const headers: Headers = {};
    Object.entries(response.headers || {}).forEach(([key, value]) => {
        headers[key.toLowerCase()] = value as string | string[] | undefined;
    });

    return {
        headers,
        statusCode: response.status
    };
}

function getBody(response: AxiosResponse): any {
    return response.data;
}

function buildConfig(method: Method, options: RequestOptions): AxiosRequestConfig {
    const headers: Record<string, string> = options.headers ? { ...options.headers } : {};
    headers.Connection = headers.Connection || 'close';
    let data: RequestBody | URLSearchParams = options.body;

    if (options.form) {
        const formParams = new URLSearchParams();
        Object.entries(options.form).forEach(([key, value]) => {
            formParams.append(key, value);
        });
        data = formParams;
    }

    if (options.json) {
        headers['content-type'] = headers['content-type'] || 'application/json';
    }

    return {
        data,
        headers,
        maxRedirects: 0,
        method,
        transformResponse: [(value) => value],
        url: options.url,
        validateStatus: () => true
    };
}

function executeRequest(method: Method, options: RequestOptions, callback?: RequestCallback): void {
    axios(buildConfig(method, options)).then(
        (response) => {
            if (callback) {
                callback(null, mapResponse(response), getBody(response));
            }
        },
        (error: Error) => {
            if (callback) {
                const axiosError = error as AxiosError;
                if (axiosError.response) {
                    callback(null, mapResponse(axiosError.response), getBody(axiosError.response));
                    return;
                }
                callback(error, { headers: {}, statusCode: 0 }, undefined);
            }
        }
    );
}

function executeMultipartRequest(url: string, formData: FormData, callback: RequestCallback): void {
    axios({
        data: formData,
        headers: formData.getHeaders(),
        maxBodyLength: Infinity,
        maxRedirects: 0,
        method: 'post',
        transformResponse: [(value) => value],
        url,
        validateStatus: () => true
    }).then(
        (response) => {
            callback(null, mapResponse(response), getBody(response));
        },
        (error: Error) => {
            if (callback) {
                const axiosError = error as AxiosError;
                if (axiosError.response) {
                    callback(null, mapResponse(axiosError.response), getBody(axiosError.response));
                    return;
                }
                callback(error, { headers: {}, statusCode: 0 }, undefined);
            }
        }
    );
}

class DeferredMultipartRequest {
    private readonly formData: FormData;
    private pendingSubmission: NodeJS.Timeout | null;

    constructor(
        private readonly url: string,
        private readonly callback: RequestCallback
    ) {
        this.formData = new FormData();
        this.pendingSubmission = null;
    }

    public form() {
        return {
            append: (name: string, value: any, options?: string | FormData.AppendOptions) => {
                this.formData.append(name, value, options as any);
                this.queueSubmission();
            }
        };
    }

    private queueSubmission(): void {
        if (this.pendingSubmission) {
            clearTimeout(this.pendingSubmission);
        }

        this.pendingSubmission = setTimeout(() => {
            this.pendingSubmission = null;
            executeMultipartRequest(this.url, this.formData, this.callback);
        }, 0);
    }
}

function toOptions(urlOrOptions: string | RequestOptions): RequestOptions {
    if (typeof urlOrOptions === 'string') {
        return { url: urlOrOptions };
    }

    return urlOrOptions;
}

function request(urlOrOptions: string | RequestOptions, callback?: RequestCallback): any {
    executeRequest('get', toOptions(urlOrOptions), callback);
    return null;
}

namespace request {
    export function get(urlOrOptions: string | RequestOptions, callback?: RequestCallback): any {
        executeRequest('get', toOptions(urlOrOptions), callback);
        return null;
    }

    export function post(urlOrOptions: string | RequestOptions, callback?: RequestCallback): any {
        if (typeof urlOrOptions === 'string' && callback) {
            return new DeferredMultipartRequest(urlOrOptions, callback);
        }

        executeRequest('post', toOptions(urlOrOptions), callback);
        return null;
    }

    export function put(urlOrOptions: string | RequestOptions, callback?: RequestCallback): any {
        executeRequest('put', toOptions(urlOrOptions), callback);
        return null;
    }
}

export default request;
