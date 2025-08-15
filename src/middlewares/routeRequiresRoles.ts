import * as debug from 'debug';
import { NextFunction, Request, Response } from 'express';
import * as Errors from '../server/model/errors';

const debuggerInstance = debug('typescript-rest:middlewares:routeRequiresRoles');

export function routeRequiresRoles(
    authenticator: { getRoles: (req: Request, res: Response) => Array<string> },
    requiredRoles: Array<string>
) {
    if (requiredRoles.length === 0) throw new Error('At least one role must be specified.');

    const roleRegex = /^[a-zA-Z0-9_-]+(:[a-zA-Z0-9_-]+){0,}$/;
    const nonMatchingRoles = requiredRoles.filter((role) => !roleRegex.test(role));
    if (nonMatchingRoles.length > 0) {
        throw new Error(
            `Invalid required role(s) specified: ${nonMatchingRoles.join(', ')}. Roles must match the pattern: ${roleRegex}.`
        );
    }

    return (req: Request, res: Response, next: NextFunction) => {
        const requestRoles = authenticator.getRoles(req, res);
        if (debuggerInstance.enabled) debuggerInstance('Validating authentication roles: <%j>.', requestRoles);

        const transformedRoles = requestRoles.map(transformRole);
        const isAuthorized = requiredRoles.some((requiredRole: string) =>
            isRoleMatched(requiredRole, transformedRoles)
        );
        if (!isAuthorized) {
            next(new Errors.ForbiddenError('You are not allowed to access this endpoint.'));
            return;
        }

        next();
    };
}

function isRoleMatched(requiredRole: string, userRoles: Array<RegExp>): boolean {
    for (const userRole of userRoles) {
        const isMatch = userRole.test(requiredRole);
        if (isMatch) return true;
    }

    return false;
}

function transformRole(role: string): RegExp {
    if (!role.includes('*')) return new RegExp(`^${role}$`);

    const regexString = role.replaceAll('**', '[a-zA-Z0-9_-]+(:[a-zA-Z0-9_-]+){0,}').replaceAll('*', '[a-zA-Z0-9_-]+');
    return new RegExp(`^${regexString}$`);
}
