import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'

const router = Router()

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000'

router.get('/', (req, res) => {
    const redirectUri = `${BACKEND_URL}/auth/google/callback`
    const scope = encodeURIComponent('email profile')
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline`
    res.redirect(url)
})

router.get('/callback', async (req, res) => {
    const { code } = req.query

    if (!code) {
        return res.redirect(`${FRONTEND_URL}/login?error=no_code`)
    }

    try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code: code as string,
                client_id: GOOGLE_CLIENT_ID!,
                client_secret: GOOGLE_CLIENT_SECRET!,
                redirect_uri: `${BACKEND_URL}/auth/google/callback`,
                grant_type: 'authorization_code',
            }),
        })

        const tokens = await tokenRes.json() as { access_token?: string }

        if (!tokens.access_token) {
            return res.redirect(`${FRONTEND_URL}/login?error=token_failed`)
        }

        const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        })

        const googleUser = await userRes.json() as { email: string; name: string }

        let user = await prisma.user.findUnique({ where: { email: googleUser.email } })

        if (!user) {
            user = await prisma.user.create({
                data: {
                    email: googleUser.email,
                    name: googleUser.name,
                    passwordHash: '',
                },
            })
        }

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' })

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        await prisma.session.create({
            data: { userId: user.id, token, expiresAt },
        })

        res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify({ id: user.id, email: user.email, name: user.name }))}`)
    } catch (error) {
        console.error('Google auth error:', error)
        res.redirect(`${FRONTEND_URL}/login?error=auth_failed`)
    }
})

export default router
