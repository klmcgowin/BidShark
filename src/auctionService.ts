import { connectDB } from './ConnectToDB.js';
import { ObjectId } from 'mongodb';
import { establishChat } from './chat.js'; // 1. 引入建立聊天的函數

const AUCTION_COLLECTION = 'auctionItems';
const BID_COLLECTION = 'Bid';
const CART_COLLECTION = 'cart';

export async function settleAuction(itemId: string) {
    try {
        const db = await connectDB();
        const itemsCollection = db.collection(AUCTION_COLLECTION);
        const bidsCollection = db.collection(BID_COLLECTION);
        const cartCollection = db.collection(CART_COLLECTION);

        const item = await itemsCollection.findOne({ _id: new ObjectId(itemId) });
        
        // 基本驗證：確保商品存在、狀態是 active、且時間真的過期了
        if (!item || item.dSale || item.status !== 'active' || new Date(item.endTime) > new Date()) {
            return; 
        }

        // 1. 找出最高出價者 (價高者得，同價先得)
        const winningBid = await bidsCollection.find({ itemId: new ObjectId(itemId) })
            .sort({ price: -1, createdAt: 1 })
            .limit(1)
            .next();

        // 2. 檢查是否達到保留價 (Reserve Price)
        // 如果有設定 reservePrice，且最高出價小於它 -> 流標
        if (winningBid && item.reservePrice && winningBid.price < item.reservePrice) {
            
            console.log(`Auction ${itemId} ended. Highest bid ${winningBid.price} did not meet reserve price ${item.reservePrice}.`);
            
            // 設定為流標 (未達底價)
            await itemsCollection.updateOne(
                { _id: item._id }, 
                { $set: { status: 'unsold_reserve_not_met' } }
            );
            return; // 結束函數，不執行後面的加入購物車
        }

        // 3. 處理得標
        if (winningBid) {
            
            const existingCartItem = await cartCollection.findOne({
                itemId: item._id,
                userId: new ObjectId(winningBid.bidderId),
                type: 'auction_win'
            });

            if (existingCartItem) {
                console.log(`Item ${itemId} already in winner's cart. Skipping insert.`);
                // 雖然已經在購物車，但可能狀態還沒改到，保險起見更新狀態
                await itemsCollection.updateOne(
                    { _id: item._id },
                    { $set: { status: 'inactive' } }
                );
                return; 
            }

            // 4. 將商品加入贏家的 "購物車 (Cart)"
            // 優先使用縮圖 (thumbnails)，如果沒有才用大圖 (images)
            const cartImage = (item.thumbnails && item.thumbnails.length > 0) 
                ? item.thumbnails[0] 
                : (item.images && item.images.length > 0 ? item.images[0] : '/Image/default-item.jpg');

            await cartCollection.insertOne({
                userId: new ObjectId(winningBid.bidderId), // 確保用 ObjectId
                itemId: item._id,
                title: item.title,
                price: winningBid.price,
                quantity: 1,
                addedAt: new Date(),
                type: 'auction_win',
                productImage: cartImage 
            });

            // 5. 更新拍賣商品狀態為 inactive
            await itemsCollection.updateOne(
                { _id: item._id },
                { $set: { 
                    status: 'inactive', 
                    winnerId: winningBid.bidderId,
                    finalPrice: winningBid.price 
                }}
            );

            // 6. 建立買賣雙方聊天室
            if (item.sellerId && winningBid.bidderId) {
                try {
                    await establishChat(
                        item.sellerId.toString(), 
                        winningBid.bidderId.toString(), 
                        item._id.toString()
                    );
                    console.log(`Chat established between Seller ${item.sellerId} and Winner ${winningBid.bidderId}`);
                } catch (chatError) {
                    console.error('Failed to establish chat:', chatError);
                }
            }

            console.log(`Auction ${itemId} settled. Winner ${winningBid.bidderId}.`);

        } else {
            // 完全沒人出價 -> 流標
            await itemsCollection.updateOne(
                { _id: item._id }, 
                { $set: { status: 'unsold' }}
            );
        }

    } catch (error) {
        console.error(`Error during auction settlement for item ${itemId}:`, error);
    }
}

export async function runScheduledCleanup() {
    console.log('Running scheduled auction cleanup...');
    try {
        const db = await connectDB();
        const itemsCollection = db.collection(AUCTION_COLLECTION);
        const currentTime = new Date();

        const expiredItems = await itemsCollection.find({
            dSale: false, 
            endTime: { $lte: currentTime }, 
            status: 'active'
        }).toArray();

        for (const item of expiredItems) {
            await settleAuction(item._id.toString()); 
        }
        console.log(`Cleanup complete. Settled ${expiredItems.length} auctions.`);

    } catch (error) {
        console.error('Scheduled cleanup failed:', error);
    }
}