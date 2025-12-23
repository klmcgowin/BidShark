import expressPkg from "express";
import { ObjectId } from "mongodb";
import { connectDB } from './ConnectToDB.js';
import { settleAuction } from './auctionService.js';
import session from "express-session";
const { Router } = expressPkg;
const DBreader = Router();

DBreader.get('/getUserfromID/:id', async (req, res) => {
    const db = await connectDB();
    const users = db.collection('Users');
    const target = await users.findOne({ _id: new ObjectId(req.params.id) });
    if (!target) return res.status(404).json({ message: 'User not found' });
    return res.status(200).json({ email: target.email, name: target.name, image: target.image });
});
DBreader.get('/getAllDeals', async (req, res) => {
    try {
        // 1. 檢查使用者是否登入
        const userId = req.session?.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const db = await connectDB();
        const deals = db.collection('deal');

        const result = await deals.aggregate([
            {
                $match: {
                    buyerId: new ObjectId(userId)
                }
            },
            {
                $lookup: {
                    from: 'auctionItems',
                    localField: 'itemId',
                    foreignField: '_id',
                    as: 'auctionItem'
                }
            },
            {
                $sort: { purchaseDate: -1 }
            }
        ]).toArray();

        return res.status(200).json(result);

    } catch (err) {
        console.error("Get deals error:", err);
        return res.status(500).json({ error: 'Server Error' });
    }
});

DBreader.get('/getAllBid', async (req, res) => {
    try {
        const db = await connectDB();
        const bid = db.collection('Bid');

        // 2. 執行聚合查詢
        const result = await bid.aggregate([
            {
                $lookup: {
                    from: 'auctionItems',
                    localField: 'itemId',
                    foreignField: '_id',
                    as: 'auctionItem'
                }
            }
        ]).toArray();

        const now = new Date();
        const settlePromises = [];
        const processedItems = new Set<string>();


        for (const record of result) {
            const item = record.auctionItem?.[0];

            if (item) {
                const itemIdStr = item._id.toString();
                
                if (item.status === 'active' && new Date(item.endTime) <= now && !processedItems.has(itemIdStr)) {

                    console.log(`Triggering settlement for expired item: ${item.title}`);

                    // 標記為已處理
                    processedItems.add(itemIdStr);

                    settlePromises.push(settleAuction(itemIdStr));
                }
            }
        }

        if (settlePromises.length > 0) {
            await Promise.all(settlePromises);
        }

        return res.status(200).json(result);

    } catch (err) {
        console.error("Error in getAllBid:", err);
        return res.status(500).json({ error: 'Server error' });
    }
});

export default DBreader;