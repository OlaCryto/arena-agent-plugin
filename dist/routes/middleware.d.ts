import { Request, Response, NextFunction } from "express";
export declare function requireApiKey(req: Request, res: Response, next: NextFunction): void;
export declare function requireAdmin(req: Request, res: Response, next: NextFunction): void;
export declare function parseSlippageBps(value?: string): number | undefined;
//# sourceMappingURL=middleware.d.ts.map