import { Router } from 'express';
import loginRouter from './userOperation.ts';
import sessionInfo from './getSessionInfo.ts';
import dataRouter from "./dataManipulation.ts";
import DBreader from "./getDBdata.ts";
const mainRouter = Router();

mainRouter.use('/data', dataRouter);
mainRouter.use('/auth', loginRouter);
mainRouter.use('/info', sessionInfo);
mainRouter.use('/read', DBreader);


export default mainRouter;