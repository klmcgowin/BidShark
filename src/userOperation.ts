import { Router, Request, Response } from 'express';
import { connectDB } from './ConnectToDB';

const loginRouter = Router();
loginRouter.post('/SignUp',async (req: Request, res: Response) => {
    const { email } = req.body;
    const db = await connectDB();
    const users = db.collection('Users');
    await users.findOne({ email });
});
loginRouter.post('/login', async (req: Request, res: Response) => {
    const { email } = req.body;
    const db = await connectDB();
    const users = db.collection('Users');
    await users.insertOne({ email, password: 'default123' });
    const result = await users.find().toArray();
    res.json({ status: 'success', users: result });
});

export default loginRouter;