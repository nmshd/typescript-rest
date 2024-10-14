import { Container, Inject, OnlyInstantiableByContainer } from '@nmshd/typescript-ioc';
import * as debug from 'debug';
import * as express from 'express';
import * as _ from 'lodash';
import * as request from 'request';
import { DefaultServiceFactory, GET, Path, Server } from '../../src/typescript-rest';

const serverDebugger = debug('typescript-rest-ioc');

const factory = {
    create: (serviceClass: any) => {
        return Container.get(serviceClass);
    },

    getTargetClass: (serviceClass: Function) => {
        if (_.isArray(serviceClass)) return null;

        let typeConstructor: any = serviceClass;
        if (typeConstructor['name'] && typeConstructor['name'] !== 'ioc_wrapper') {
            return typeConstructor as FunctionConstructor;
        }
        typeConstructor = typeConstructor['__parent'];
        while (typeConstructor) {
            if (typeConstructor['name'] && typeConstructor['name'] !== 'ioc_wrapper') {
                return typeConstructor as FunctionConstructor;
            }
            typeConstructor = typeConstructor['__parent'];
        }

        serverDebugger('Can not identify the base Type for requested target: %o', serviceClass);
        throw new TypeError('Can not identify the base Type for requested target');
    }
};

Server.registerServiceFactory(factory);

@OnlyInstantiableByContainer
export class InjectableObject {}

@OnlyInstantiableByContainer
@Path('ioctest')
export class IoCService {
    @Inject
    private injectedObject: InjectableObject;

    @GET
    public test(): string {
        return this.injectedObject ? 'OK' : 'NOT OK';
    }
}

@Path('ioctest2')
@OnlyInstantiableByContainer
export class IoCService2 {
    @Inject
    private injectedObject: InjectableObject;

    @GET
    public test(): string {
        return this.injectedObject ? 'OK' : 'NOT OK';
    }
}

@Path('ioctest3')
@OnlyInstantiableByContainer
export class IoCService3 {
    private injectedObject: InjectableObject;

    constructor(@Inject injectedObject: InjectableObject) {
        this.injectedObject = injectedObject;
    }

    @GET
    public test(): string {
        return this.injectedObject ? 'OK' : 'NOT OK';
    }
}

@Path('ioctest4')
@OnlyInstantiableByContainer
export class IoCService4 extends IoCService2 {}

describe('IoC Tests', () => {
    beforeAll(() => {
        return startApi();
    });

    afterAll(() => {
        stopApi();
    });

    describe('Server integrated with typescript-ioc', () => {
        it('should use IoC container to instantiate the services', (done) => {
            request('http://localhost:5674/ioctest', (error, response, body) => {
                expect(body).toEqual('OK');
                done();
            });
        });
        it('should use IoC container to instantiate the services, does not carrying about the decorators order', (done) => {
            request('http://localhost:5674/ioctest2', (error, response, body) => {
                expect(body).toEqual('OK');
                done();
            });
        });
        it('should use IoC container to instantiate the services with injected params on constructor', (done) => {
            request('http://localhost:5674/ioctest3', (error, response, body) => {
                expect(body).toEqual('OK');
                done();
            });
        });
        it('should use IoC container to instantiate the services with superclasses', (done) => {
            request('http://localhost:5674/ioctest4', (error, response, body) => {
                expect(body).toEqual('OK');
                done();
            });
        });
    });
});

let server: any;

function startApi(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const app: express.Application = express();
        app.set('env', 'test');
        Server.buildServices(app, IoCService, IoCService2, IoCService3, IoCService4);
        server = app.listen(5674, (err?: any) => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
}

function stopApi() {
    if (server) {
        Server.registerServiceFactory(new DefaultServiceFactory());
        server.close();
    }
}
