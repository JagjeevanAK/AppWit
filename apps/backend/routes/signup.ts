import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'

const router = Router()

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

router.post('/', async (req, res) => {
    const { email, password, name } = req.body

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
        return res.status(400).json({ error: 'Email already registered' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
        data: { email, passwordHash, name },
    })

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' })

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await prisma.session.create({
        data: { userId: user.id, token, expiresAt },
    })

    res.json({ token, user: { id: user.id, email: user.email, name: user.name } })
})

export default router
