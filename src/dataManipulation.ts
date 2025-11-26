import type { Request, Response } from 'express';
import expressPkg from 'express';
import { connectDB } from './ConnectToDB.ts';
import fs from 'fs';
import bcrypt from 'bcrypt';
import {ObjectId} from "mongodb";

const { Router } = expressPkg;
const dataRouter = Router();

dataRouter.post('/updateUserInfo',async (req: Request, res: Response) => {
    try{
        if (!req.session || !req.session.user) {
            return res.status(400).json({ error: 'Not logged in' });
        }else{
            const {picture,name,email,number} = req.body;
            let id = req.session.id;
            const db = await connectDB();
            const users = await db.collection('Users');
            const target = await users.findOne({ _id: id });
            if (!target) {return res.status(404).json({ error: 'Target doesn\'t exist' });}
            await users.updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        picture : picture? picture : target.image,
                        name: name? name : target.name,
                        email: email? email : target.email,
                        number: number? number:target.phone
                    }
                }
            );
            req.session.user.name = name || req.session.user.name;
            req.session.user.email = email || req.session.user.email;
            req.session.user.image = picture || target.image;
            req.session.user.phoneNumber = number||target.phone;
            return res.status(201).json({ status: 'success', message: 'Info Updated' })
        }
    }catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Something is wrong' });
    }
})

export default dataRouter;