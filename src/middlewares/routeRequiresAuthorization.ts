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
        const rawUserRoles = authenticator.getRoles(req, res);
        if (debuggerInstance.enabled) debuggerInstance('Validating authentication roles: <%j>.', rawUserRoles);

        const userRoles = rawUserRoles.map(Role.from);
        const isAuthorized = permittedRoles.some((r) => isRoleMatched(r, userRoles));
        if (!isAuthorized) {
            next(new Errors.ForbiddenError('You are not allowed to access this endpoint.'));
            return;
        }

        next();
    };
}

function isRoleMatched(permittedRole: string, userRoles: Array<Role>): boolean {
    return userRoles.some((userRole) => userRole.matches(permittedRole));
}

class Role {
    private roleRegex: RegExp;

    private constructor(role: string) {
        this.roleRegex = this.transformUserRole(role);
    }

    public static from(role: string): Role {
        return new Role(role);
    }

    private transformUserRole(userRole: string): RegExp {
        if (!userRole.includes('*')) return new RegExp(`^${userRole}$`);

        const regexString = userRole
            .replaceAll('**', '[a-zA-Z0-9_-]+(:[a-zA-Z0-9_-]+){0,}')
            .replaceAll('*', '[a-zA-Z0-9_-]+');
        return new RegExp(`^${regexString}$`);
    }

    public matches(permittedRole: string): unknown {
        return this.roleRegex.test(permittedRole);
    }
}
