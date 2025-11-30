import expressPkg from "express";
import { ObjectId } from "mongodb";
import { connectDB } from './ConnectToDB.ts';
const { Router } = expressPkg;
const DBreader = Router();

DBreader.get('/getUserfromID/:id', async(req, res) => {
    const db = await connectDB();
    const users = db.collection('Users');
    const target = await users.findOne({ _id: new ObjectId(req.params.id) });
    if (!target) return res.status(404).json({ message: 'User not found' });
    return res.status(200).json({email: target.email, name: target.name, image: target.image});
});


export default DBreader;