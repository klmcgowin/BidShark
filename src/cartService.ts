import { connectDB } from './ConnectToDB.js';
import { ObjectId } from 'mongodb';
import { establishChat } from './chat.js';

const CART_COLLECTION = 'cart';
const DEAL_COLLECTION = 'deal';
const AUCTION_COLLECTION = 'auctionItems';
const NOTIFICATION_COLLECTION = 'notifications'; // 確保有定義通知集合

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
    try { 
        userObjectId = new ObjectId(userId); 
    } catch (e) { 
        console.error("Invalid User ID:", userId);
        return []; 
    }

    const cartItems = await cartCollection.aggregate([
        { 
            $match: { 
                $or: [{ userId: userObjectId }, { userId: userId }] 
            } 
        },
        { 
            $lookup: { 
                from: AUCTION_COLLECTION, 
                localField: 'itemId', 
                foreignField: '_id', 
                as: 'itemDetails' 
            } 
        },
        { 
            $unwind: { 
                path: '$itemDetails', 
                preserveNullAndEmptyArrays: true 
            } 
        },
        {
            $project: {
                _id: 1, 
                itemId: 1, 
                title: 1, 
                price: 1, 
                quantity: 1, // 確保讀取數量欄位
                productImage: {
                    $ifNull: [
                        { $arrayElemAt: ["$itemDetails.thumbnails", 0] }, // 優先用縮圖
                        { $arrayElemAt: ["$itemDetails.images", 0] },     // 其次用大圖
                        "$productImage", 
                        "/Image/default-item.jpg"
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
// 更新：增加 quantity 參數以支援前端輸入的數量
export async function addDirectBuyToCart(userId: string, itemId: string, quantity: number = 1) {
    const db = await connectDB();
    const itemsCollection = db.collection(AUCTION_COLLECTION);
    const cartCollection = db.collection(CART_COLLECTION);
    
    if (!ObjectId.isValid(itemId)) throw new Error('Invalid item ID');

    // A. 檢查商品
    const item = await itemsCollection.findOne({ 
        _id: new ObjectId(itemId), 
        status: 'active' 
    });

    if (!item) throw new Error('商品不存在或已下架');
    // 如果是直購商品(dSale) 或 允許直購的拍賣品
    if (!item.dSale && !item.buyNowPrice) throw new Error('此商品不支援直接購買');

    // B. 檢查庫存
    if (item.dSale && (item.stock || 0) < quantity) {
        throw new Error('庫存不足');
    }

    // C. 避免重複加入 (或是你可以選擇更新數量)
    const existingCartItem = await cartCollection.findOne({
        userId: new ObjectId(userId),
        itemId: new ObjectId(itemId)
    });

    if (existingCartItem) {
        // 選擇策略：如果已存在，更新數量
        await cartCollection.updateOne(
            { _id: existingCartItem._id },
            { $inc: { quantity: quantity } }
        );
        return { success: true, message: 'Item quantity updated' };
    }

    // D. 圖片處理 (優先存縮圖)
    const cartImage = (item.thumbnails && item.thumbnails.length > 0) 
        ? item.thumbnails[0] 
        : (item.images && item.images.length > 0 ? item.images[0] : '/Image/default-item.jpg');

    // E. 加入購物車
    await cartCollection.insertOne({
        userId: new ObjectId(userId),
        itemId: new ObjectId(itemId),
        title: item.title,
        price: item.buyNowPrice || item.price,
        quantity: quantity,
        addedAt: new Date(),
        type: 'direct_buy',
        productImage: cartImage
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
    const notifyCollection = db.collection(NOTIFICATION_COLLECTION); // 取得通知集合

    const userObjectId = new ObjectId(userId);
    
    // 查詢要結帳的購物車項目
    let query: any = { $or: [{ userId: userObjectId }, { userId: userId }] };
    
    // 如果有指定 cartItemIds，只結帳這些；否則結帳購物車內所有商品
    if (cartItemIds && cartItemIds.length > 0) {
        const objectIds = cartItemIds.map(id => new ObjectId(id));
        query._id = { $in: objectIds };
    }

    const cartItems = await cartCollection.find(query).toArray();
    if (cartItems.length === 0) throw new Error("無效的結帳請求：購物車為空或未選擇商品");

    const successfulDeals = [];

    for (const cartItem of cartItems) {
        const product = await itemsCollection.findOne({ _id: cartItem.itemId });
        
        // 商品如果被刪除了，跳過不處理
        if (!product) continue; 

        const buyQty = cartItem.quantity || 1;

        // === 庫存扣除 (僅針對直購商品) ===
        if (product.dSale) {
            if (product.stock < buyQty) {
                throw new Error(`商品 "${product.title}" 庫存不足 (剩餘: ${product.stock})`);
            }
            
            await itemsCollection.updateOne(
                { _id: product._id }, 
                { $inc: { stock: -buyQty } }
            );
            
            // 如果庫存歸零，設為 inactive
            if (product.stock - buyQty <= 0) {
                await itemsCollection.updateOne({ _id: product._id }, { $set: { status: 'inactive' } });
            }
        } else {
            // 拍賣商品結帳後，設為 inactive
            await itemsCollection.updateOne({ _id: product._id }, { $set: { status: 'inactive' } });
        }

        // === 建立訂單 (包含收件人與付款資訊) ===
        // 計算運費
        const shippingFee = shippingInfo.method === 'Express' ? 120 : 60;
        
        const dealData = {
            itemId: cartItem.itemId,
            buyerId: userObjectId,
            sellerId: product.sellerId ? new ObjectId(product.sellerId) : null,
            quantity: buyQty,
            price: cartItem.price, // 單價
            totalAmount: (cartItem.price * buyQty), // 商品總額 (不含運費，或視需求包含)
            title: cartItem.title,
            image: cartItem.productImage,
            purchaseDate: new Date(), // 統一欄位名稱
            dealDate: new Date(),
            status: 'paid', // 狀態：已付款
            
            // --- 詳細資訊 ---
            paymentMethod: paymentMethod, 
            shippingInfo: {
                name: shippingInfo.name,
                phone: shippingInfo.phone,
                address: shippingInfo.address,
                method: shippingInfo.method,
                shippingFee: shippingFee
            },
            deliveryStatus: 'preparing' // 初始物流狀態
        };

        const dealResult = await dealsCollection.insertOne(dealData);
        successfulDeals.push(cartItem._id);

        // === 後續處理：聊天室與通知 ===
        if (product.sellerId) {
            // 1. 建立聊天室
            try {
                await establishChat(
                    product.sellerId.toString(), 
                    userId, 
                    product._id.toString()
                );
            } catch (err) { 
                console.error('Chat creation failed:', err); 
            }

            // 2. 發送通知給賣家 (避免通知自己)
            if (product.sellerId.toString() !== userId) {
                await notifyCollection.insertOne({
                    userId: new ObjectId(product.sellerId),
                    type: 'order_sold',
                    title: '🎉 商品已售出！',
                    message: `您的商品 "${product.title}" 已成功售出 (${buyQty}件)，買家已付款，請盡快安排出貨。`,
                    dealId: dealResult.insertedId,
                    isRead: false,
                    createdAt: new Date()
                });
                console.log(`Notification sent to seller ${product.sellerId}`);
            }
        }
    }

    // 移除已結帳的購物車項目
    if (successfulDeals.length > 0) {
        await cartCollection.deleteMany({ _id: { $in: successfulDeals } });
    }

    return { success: true, count: successfulDeals.length };
}