import { connectDB } from './ConnectToDB.ts';
import { ObjectId } from 'mongodb';

const AUCTION_COLLECTION = 'auctionItems';
const BID_COLLECTION = 'Bid';
const DEAL_COLLECTION = 'deal';

export async function settleAuction(itemId: string) {
    try {
        const db = await connectDB();
        const itemsCollection = db.collection(AUCTION_COLLECTION);
        const bidsCollection = db.collection(BID_COLLECTION);
        const dealsCollection = db.collection(DEAL_COLLECTION);

        const item = await itemsCollection.findOne({ _id: new ObjectId(itemId) });
        
        if (!item || item.dSale || item.status !== 'active' || new Date(item.endTime) > new Date()) {
            return; 
        }

        //Highest winning bid       
        const winningBid = await bidsCollection.find({ itemId: new ObjectId(itemId) })
            .sort({ price: -1, createdAt: 1 })//-1 highest bid, 1 oldest time for tie breaker
            .limit(1)
            .next();

        if (winningBid) {
            //Deal record
            await dealsCollection.insertOne({
                itemId: item._id,
                buyerId: winningBid.bidderId,
                quantity: 1, 
                individual_price: winningBid.price,
                total_price: winningBid.price,
                purchaseDate: new Date()
            });

            //Update status
            await itemsCollection.updateOne(
                { _id: item._id },
                { $set: { 
                    status: 'inactive', 
                    winnerId: winningBid.bidderId,
                    finalPrice: winningBid.price 
                }}
            );

        } else {
            //No bids placed
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