import expressPkg from 'express';
import { connectDB } from './ConnectToDB.js';
import { ObjectId } from 'mongodb';

const { Router } = expressPkg;
const notificationRouter = Router();

// 1. 取得我的通知
notificationRouter.get('/', async (req, res) => {
    try {
        // @ts-ignore
        const userId = req.session?.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const db = await connectDB();
        
        // 撈取通知，按時間新到舊排序
        const notifications = await db.collection('notifications')
            .find({ userId: new ObjectId(userId) })
            .sort({ createdAt: -1 })
            .limit(20) // 只抓最近 20 筆
            .toArray();

        // 計算未讀數量
        const unreadCount = await db.collection('notifications').countDocuments({
            userId: new ObjectId(userId),
            isRead: false
        });

        res.json({ notifications, unreadCount });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// 2. 標記全部已讀 (當使用者點開鈴鐺時呼叫)
notificationRouter.post('/mark-read', async (req, res) => {
    try {
        // @ts-ignore
        const userId = req.session?.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const db = await connectDB();
        await db.collection('notifications').updateMany(
            { userId: new ObjectId(userId), isRead: false },
            { $set: { isRead: true } }
        );

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default notificationRouter;