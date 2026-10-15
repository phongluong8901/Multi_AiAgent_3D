import express from 'express'
import cors from 'cors'

const app = express()
const PORT = 4000

app.use(cors())
app.use(express.json())

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend đang chạy' })
})

app.listen(PORT, () => {
    console.log(`Backend chạy tại http://localhost:${PORT}`)
})