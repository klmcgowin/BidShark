import type { Request, Response } from 'express';
import expressPkg from 'express';
import { connectDB } from './ConnectToDB.js';
import { ObjectId } from "mongodb";

const { Router } = expressPkg;
const chatRouter = Router();

// 建立聊天室 (保持不變)
export async function establishChat(userAId:string, userBId:string, subject:string) {
    const db = await connectDB();
    const chatsCollection = db.collection('chat');
    const userCollection = db.collection('Users');
    
    const existingChat = await chatsCollection.findOne({
        $or: [
            { Aside_id: new ObjectId(userAId), Bside_id: new ObjectId(userBId), subject: new ObjectId(subject) },
            { Aside_id: new ObjectId(userBId), Bside_id: new ObjectId(userAId), subject: new ObjectId(subject) }
        ]
    });

    if (existingChat) {
        console.log('Chat already exists');
        return;
    }

    const result = await chatsCollection.insertOne({
        Aside_id: new ObjectId(userAId),
        Bside_id: new ObjectId(userBId),
        subject: new ObjectId(subject), 
        chat: [],
        updatedAt: new Date() // 用於排序
    });
    
    await userCollection.updateOne({ _id: new ObjectId(userAId) }, { $push: { chat: result.insertedId } });
    await userCollection.updateOne({ _id: new ObjectId(userBId) }, { $push: { chat: result.insertedId } });
}

// 取得單一聊天室訊息
chatRouter.get('/getChat/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const db = await connectDB();
    const chatsCollection = db.collection('chat');
    
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid chat ID' });

    const chatData = await chatsCollection.findOne({
        _id: new ObjectId(id)
    });

    if (!chatData) {
        return res.status(404).json({ error: 'Chat not found' });
    } else {
        // 回傳訊息給前端
        const msg = chatData.chat.map((m: any) => ({
            speaker: m.speaker === req.session.user.id ? 'You' : 'Them',
            message: m.message,
            timestamp: m.timestamp // 回傳時間戳記，前端可能需要顯示時間
        }));
        return res.status(200).json(msg);
    }
});

// 取得聊天列表 (包含未讀數量)
chatRouter.get('/getYourChats', async (req: Request, res: Response) => {
    const userId = req.session.user.id;
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const db = await connectDB();
    const userCollection = db.collection('Users');
    const chatsCollection = db.collection('chat');
    
    const userData = await userCollection.findOne({ _id: new ObjectId(userId) });
    if (!userData) return res.status(404).json({ error: 'User not found' });
    
    const chatIds = userData.chat || [];
    
    // 找出所有聊天記錄，並依照 updatedAt 排序 (新的在上面)
    const chatDetails = await chatsCollection.find({
        _id: { $in: chatIds }
    }).sort({ updatedAt: -1 }).toArray();
    
    let output = [];
    
    for (const chatDetail of chatDetails) {
        const otherUserId = chatDetail.Aside_id.toString() === userId ? chatDetail.Bside_id : chatDetail.Aside_id;
        const otherUserData = await userCollection.findOne({ _id: new ObjectId(otherUserId.toString()) });

        // === 判斷 Subject 來源 ===
        let itemTitle = 'Unknown Subject';
        const subjectId = chatDetail.subject; 

        // 1. 找 Item
        let item = await db.collection('auctionItems').findOne({ _id: subjectId });
        // 2. 沒找到則找 Deal 並關聯 Item
        if (!item) {
            const deal = await db.collection('deal').findOne({ _id: subjectId });
            if (deal) {
                item = await db.collection('auctionItems').findOne({ _id: deal.itemId });
            }
        }
        if (item) itemTitle = item.title;

        // 🔥 計算未讀數量 (新增功能)
        // 條件：發言者不是我 (speaker !== userId) 且 isRead !== true
        const unreadCount = chatDetail.chat.filter((msg: any) => 
            msg.speaker !== userId && !msg.isRead
        ).length;

        output.push({
            chatId: chatDetail._id,
            withUser: otherUserData ? otherUserData.name : 'Unknown User',
            OnSubject: itemTitle,
            unreadCount: unreadCount // 回傳未讀數
        });
    }
    return res.status(200).json(output);
});

// 🔥 [新路由] 給 Sidebar 用：檢查是否有任何未讀訊息
chatRouter.get('/checkUnread', async (req: Request, res: Response) => {
    const userId = req.session?.user?.id;
    if (!userId) return res.status(200).json({ hasUnread: false });

    const db = await connectDB();
    const userCollection = db.collection('Users');
    const chatsCollection = db.collection('chat');

    const userData = await userCollection.findOne({ _id: new ObjectId(userId) });
    const chatIds = userData?.chat || [];

    if (chatIds.length === 0) return res.status(200).json({ hasUnread: false });

    // 搜尋所有聊天室，只要發現一條 "別人發給我的未讀訊息"，就回傳 true
    const chatDetails = await chatsCollection.find({ _id: { $in: chatIds } }).toArray();
    
    let hasUnread = false;
    for (const chat of chatDetails) {
        const unread = chat.chat.some((msg: any) => msg.speaker !== userId && !msg.isRead);
        if (unread) {
            hasUnread = true;
            break;
        }
    }

    res.json({ hasUnread });
});

// 🔥 [新路由] 標記聊天室為已讀
chatRouter.post('/markAsRead', async (req: Request, res: Response) => {
    const { chatId } = req.body;
    const userId = req.session?.user?.id;
    
    if (!userId || !chatId) return res.status(400).json({ error: 'Missing params' });

    const db = await connectDB();
    const chatsCollection = db.collection('chat');

    // 將該聊天室中，所有 "發言者不是我" 的訊息，更新為 isRead: true
    await chatsCollection.updateOne(
        { _id: new ObjectId(chatId) },
        { 
            $set: { "chat.$[elem].isRead": true } 
        },
        { 
            arrayFilters: [{ "elem.speaker": { $ne: userId } }] 
        }
    );

    res.json({ success: true });
});

// 發送訊息 (已加入 isRead 和 updatedAt)
chatRouter.post('/sendMessage', async (req: Request, res: Response) => {
    const { message, chatId } = req.body;
    const senderId = req.session.user.id;
    
    if (!senderId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await connectDB();
    const chatsCollection = db.collection('chat');
    
    try {
        await chatsCollection.updateOne(
            { _id: new ObjectId(chatId.trim()) },
            {
                $push: {
                    chat: {
                        speaker: senderId.toString(),
                        message,
                        timestamp: new Date(),
                        isRead: false // 🔥 預設為未讀
                    }
                },
                $set: { updatedAt: new Date() } // 🔥 更新聊天室時間，讓它浮到最上面
            }
        );
        res.status(200).json({ status: 'Message sent' });
    } catch (err) {
        console.error("MongoDB error:", err);
        res.status(500).json({ error: 'DB error' });
    }
});

export default chatRouter;