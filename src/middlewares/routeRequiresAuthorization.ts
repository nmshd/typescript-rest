import * as debug from 'debug';
import { NextFunction, Request, Response } from 'express';
import * as Errors from '../server/model/errors';

const debuggerInstance = debug('typescript-rest:middlewares:routeRequiresAuthorization');

export function routeRequiresAuthorization(
    authenticator: { getRoles: (req: Request, res: Response) => Array<string> },
    ...permittedRoles: [string, ...Array<string>]
) {
    if (permittedRoles.length === 0) throw new Error('At least one permitted role must be specified.');

    const roleRegex = /^[a-zA-Z0-9_-]+(:[a-zA-Z0-9_-]+){0,}$/;
    const nonMatchingRoles = permittedRoles.filter((role) => !roleRegex.test(role));
    if (nonMatchingRoles.length > 0) {
        throw new Error(
            `Invalid permitted role(s) specified: ${nonMatchingRoles.join(', ')}. Roles must match the pattern: ${roleRegex}.`
        );
    }

    return (req: Request, res: Response, next: NextFunction) => {
        const requestRoles = authenticator.getRoles(req, res);
        if (debuggerInstance.enabled) debuggerInstance('Validating authentication roles: <%j>.', requestRoles);

        const transformedRoles = requestRoles.map(transformUserRole);
        const isAuthorized = permittedRoles.some((permittedRole) => isRoleMatched(permittedRole, transformedRoles));
        if (!isAuthorized) {
            next(new Errors.ForbiddenError('You are not allowed to access this endpoint.'));
            return;
        }

        next();
    };
}

function isRoleMatched(permittedRole: string, userRoles: Array<RegExp>): boolean {
    for (const userRole of userRoles) {
        const isMatch = userRole.test(permittedRole);
        if (isMatch) return true;
    }

    return false;
}

function transformUserRole(userRole: string): RegExp {
    if (!userRole.includes('*')) return new RegExp(`^${userRole}$`);

    const regexString = userRole
        .replaceAll('**', '[a-zA-Z0-9_-]+(:[a-zA-Z0-9_-]+){0,}')
        .replaceAll('*', '[a-zA-Z0-9_-]+');
    return new RegExp(`^${regexString}$`);
}
