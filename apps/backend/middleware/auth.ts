import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
import { config } from '@/config'

export interface AuthRequest extends Request {
    userId?: string
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' })
    }

    const token = authHeader.slice(7)

    try {
        const payload = jwt.verify(token, config.jwt.secret) as { userId: string };
        
        const session = await prisma.session.findFirst({
            where: { token, userId: payload.userId, expiresAt: { gt: new Date() } },
        })

        if (!session) {
            return res.status(401).json({ error: 'Session expired' })
        }

        req.userId = payload.userId
        next()
    } catch {
        return res.status(401).json({ error: 'Invalid token' })
    }
}
