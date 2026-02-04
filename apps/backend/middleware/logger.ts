import type { Request, Response, NextFunction } from "express";

export function loggerMiddleware(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const { method, url, ip } = req;

    res.on("finish", () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${method} ${url} ${res.statusCode} - ${duration}ms - ${ip}`);
    });

    next();
}
