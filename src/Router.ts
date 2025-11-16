import { Router } from 'express';
import loginRouter from './userOperation';

const mainRouter = Router();


mainRouter.use('/auth', loginRouter);
// Now endpoints are:
// POST /auth/login
// POST /auth/signup

export default mainRouter;