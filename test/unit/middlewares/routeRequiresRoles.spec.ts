import * as express from 'express';
import { Errors, routeRequiresAuthorization } from '../../../src/typescript-rest';

describe('routeRequiresRoles middleware', () => {
    const res = {} as any as express.Response;

    test.each([
        [['admin'], ['admin']],
        [['admin', 'core:messages'], ['core:messages']],
        [['admin', 'core:*'], ['core:messages']],
        [
            ['admin', 'core:*'],
            ['core:messages', 'admin']
        ],
        [
            ['admin', 'core:*'],
            ['core:messages', 'aRandomRole']
        ],
        [
            ['admin', 'core:*'],
            ['core:messages', 'admin', 'aRandomRole']
        ],
        [
            ['admin', 'core:*'],
            ['core:messages', 'admin', 'aRandomRole', 'anotherRole']
        ],
        [
            ['admin', 'core:*'],
            ['core:messages', 'admin', 'anotherRole']
        ],
        [
            ['admin', 'core:*'],
            ['core:messages', 'admin', 'anotherRole', 'aRandomRole']
        ],
        [['*:*'], ['core:messages']],
        [['**'], ['core:messages']],
        [['core:*'], ['core:messages']],
        [['core:**'], ['core:messages']],
        [['core:**'], ['core:messages:whatever']],
        [['core:*:*:*'], ['core:messages:whatever:whatever']],
        [['core:*:*:whatever'], ['core:messages:whatever:whatever']],
        [['core:**:whatever'], ['core:messages:whatever']],
        [['core:**:whatever'], ['core:messages:whatever:whatever']],
        [['**:whatever'], ['core:messages:whatever']],
        [['**:whatever'], ['core:messages:whatever:whatever']]
    ])('should accept the given (%s) and required (%s) roles', (userRoles, requiredRoles) => {
        const next = jest.fn();

        const authenticator = { getRoles: () => userRoles };
        const fn = routeRequiresAuthorization(authenticator, requiredRoles[0], ...requiredRoles.slice(1));
        fn({ userRoles: userRoles } as any as express.Request, res, next);

        expect(next).toHaveBeenCalledTimes(1);

        expect(next).toHaveBeenCalledWith();
    });

    test.each([
        [[], ['admin']],
        [['admin'], ['aRandomRole']],
        [['admin', 'core:*'], ['aRandomRole']],
        [
            ['admin', 'core:*'],
            ['aRandomRole', 'anotherRole']
        ],
        [['core:*'], ['core:messages:whatever']],
        [['core:*:*:*'], ['core:messages:whatever']],
        [['core:*:*:whatever'], ['core:messages:whatever']],
        [['core:*'], ['core:messages:whatever']]
    ])('should reject the given (%s) and required (%s) roles', (userRoles, requiredRoles) => {
        const next = jest.fn();

        const authenticator = { getRoles: () => userRoles };
        const fn = routeRequiresAuthorization(authenticator, requiredRoles[0], ...requiredRoles.slice(1));
        fn({ userRoles: userRoles } as any as express.Request, res, next);

        expect(next).toHaveBeenCalledTimes(1);

        expect(next).toHaveBeenCalledWith(new Errors.ForbiddenError('You are not allowed to access this endpoint.'));
    });

    test('should throw an error if no roles are specified', () => {
        expect(
            // @ts-expect-error: Testing error throwing
            () => routeRequiresAuthorization({ getRoles: () => [] })
        ).toThrow('At least one role must be specified.');
    });

    test.each(['admin:', 'admin::core', 'admin::', '*'])(
        'should throw an error because the required role (%s) does not match the pattern',
        (role) => {
            expect(() => routeRequiresAuthorization({ getRoles: () => [] }, role)).toThrow(
                'Invalid required role(s) specified'
            );
        }
    );
});
