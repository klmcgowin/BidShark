import { connectDB } from './ConnectToDB.js';
import { ObjectId } from 'mongodb';
import { establishChat } from './chat.js';

const CART_COLLECTION = 'cart';
const DEAL_COLLECTION = 'deal';
const AUCTION_COLLECTION = 'auctionItems';

// 定義收件資訊介面
interface ShippingInfo {
    name: string;
    phone: string;
    address: string;
    method: string;
}

// 1. 取得購物車內容
export async function getCartItems(userId: string) {
    const db = await connectDB();
    const cartCollection = db.collection(CART_COLLECTION);
    
    let userObjectId;
    try { userObjectId = new ObjectId(userId); } catch (e) { userObjectId = userId; }

    const cartItems = await cartCollection.aggregate([
        { $match: { $or: [{ userId: userObjectId }, { userId: userId }] } },
        { $lookup: { from: AUCTION_COLLECTION, localField: 'itemId', foreignField: '_id', as: 'itemDetails' } },
        { $unwind: { path: '$itemDetails', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                _id: 1, itemId: 1, title: 1, price: 1, quantity: 1,
                productImage: {
                    $ifNull: [
                        { $arrayElemAt: ["$itemDetails.thumbnails", 0] },
                        { $arrayElemAt: ["$itemDetails.images", 0] },
                        "$productImage", "/Image/default-item.jpg"
                    ]
                },
                endTime: '$itemDetails.endTime',
                isDirectBuy: '$itemDetails.dSale'
            }
        }
    ]).toArray();
    return cartItems;
}

// 2. 直購加入購物車
export async function addDirectBuyToCart(userId: string, itemId: string) {
    const db = await connectDB();
    const itemsCollection = db.collection(AUCTION_COLLECTION);
    const cartCollection = db.collection(CART_COLLECTION);
    
    // A. 檢查商品
    const item = await itemsCollection.findOne({ 
        _id: new ObjectId(itemId), 
        status: 'active' 
    });

    if (!item) throw new Error('商品不存在或已下架');
    if (!item.dSale && !item.buyNowPrice) throw new Error('此商品不支援直接購買');

    // B. 檢查庫存
    if (item.dSale && item.stock <= 0) {
        throw new Error('商品已售完');
    }

    // C. 避免重複加入
    const existingCartItem = await cartCollection.findOne({
        userId: new ObjectId(userId),
        itemId: new ObjectId(itemId)
    });

    if (existingCartItem) {
        return { message: 'Item already in cart' };
    }

    // D. 加入購物車
    await cartCollection.insertOne({
        userId: new ObjectId(userId),
        itemId: new ObjectId(itemId),
        title: item.title,
        price: item.buyNowPrice || item.price,
        quantity: 1,
        addedAt: new Date(),
        type: 'direct_buy',
        productImage: item.images?.[0] || '/Image/default-item.jpg'
    });

    return { success: true };
}

// 3. 結帳 (包含收件資訊與付款方式)
export async function checkout(
    userId: string, 
    cartItemIds: string[] | undefined, 
    shippingInfo: ShippingInfo, 
    paymentMethod: string
) {
    const db = await connectDB();
    const cartCollection = db.collection(CART_COLLECTION);
    const dealsCollection = db.collection(DEAL_COLLECTION);
    const itemsCollection = db.collection(AUCTION_COLLECTION);

    const userObjectId = new ObjectId(userId);
    
    // 查詢要結帳的購物車項目
    let query: any = { $or: [{ userId: userObjectId }, { userId: userId }] };
    if (cartItemIds && cartItemIds.length > 0) {
        const objectIds = cartItemIds.map(id => new ObjectId(id));
        query._id = { $in: objectIds };
    }

    const cartItems = await cartCollection.find(query).toArray();
    if (cartItems.length === 0) throw new Error("無效的結帳請求：購物車為空或未選擇商品");

    const successfulDeals = [];

    for (const cartItem of cartItems) {
        const product = await itemsCollection.findOne({ _id: cartItem.itemId });
        if (!product) continue; 

        // === 庫存扣除 ===
        if (product.dSale) {
            const buyQty = cartItem.quantity || 1;
            if (product.stock < buyQty) throw new Error(`商品 "${product.title}" 庫存不足`);
            
            await itemsCollection.updateOne({ _id: product._id }, { $inc: { stock: -buyQty } });
            
            if (product.stock - buyQty <= 0) {
                await itemsCollection.updateOne({ _id: product._id }, { $set: { status: 'inactive' } });
            }
        }

        // === 建立訂單 (包含收件人與付款資訊) ===
        const dealData = {
            itemId: cartItem.itemId,
            buyerId: userObjectId,
            sellerId: product.sellerId ? new ObjectId(product.sellerId) : null,
            quantity: cartItem.quantity || 1,
            price: cartItem.price,
            totalAmount: cartItem.price * (cartItem.quantity || 1),
            title: cartItem.title,
            image: cartItem.productImage,
            dealDate: new Date(),
            status: 'paid',
            
            // --- 新增的資訊 ---
            paymentMethod: paymentMethod, 
            shippingInfo: {
                name: shippingInfo.name,
                phone: shippingInfo.phone,
                address: shippingInfo.address,
                method: shippingInfo.method,
                shippingFee: shippingInfo.method === 'Express' ? 120 : 60
            },
            deliveryStatus: 'preparing'
        };

        const dealResult = await dealsCollection.insertOne(dealData);
        successfulDeals.push(cartItem._id);

        // === 建立聊天室 ===
        if (product.sellerId) {
            try {
                await establishChat(product.sellerId.toString(), userId, product._id.toString());
            } catch (err) { console.error('Chat creation failed:', err); }
        }
    }

    // 移除已結帳的購物車項目
    if (successfulDeals.length > 0) {
        await cartCollection.deleteMany({ _id: { $in: successfulDeals } });
    }

    return { success: true, count: successfulDeals.length };
}