import { Router } from 'express';
import loginRouter from './userOperation.js';
import sessionInfo from './getSessionInfo.js';
import dataRouter from "./dataManipulation.js";
import DBreader from "./getDBdata.js";
import chatRouter from "./chat.js";
import notificationRouter from './notificationRouter.js'; 
import { getCartItems, checkout, addDirectBuyToCart } from './cartService.js'; 
import { runScheduledCleanup } from './auctionService.js';

const mainRouter = Router();


runScheduledCleanup();

mainRouter.use('/data', dataRouter);
mainRouter.use('/auth', loginRouter);
mainRouter.use('/info', sessionInfo);
mainRouter.use('/read', DBreader);
mainRouter.use('/chat', chatRouter);

// 1. 取得購物車內容
mainRouter.get('/cart', async (req, res) => {
    try {
        const userId = (req.session as any)?.user?.id || (req.session as any)?.user?._id;
        
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized: Please login first' });
            return;
        }

        const items = await getCartItems(userId);
        // 前端預期格式是 { items: [...] }
        res.json({ items }); 
    } catch (error) {
        console.error('Cart fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch cart' });
    }
});

// 2. 執行結帳 (升級：支援收件資訊與付款方式)
mainRouter.post('/checkout', async (req, res) => {
    try {
        const userId = (req.session as any)?.user?.id || (req.session as any)?.user?._id;
        // 接收前端傳來的：購物車ID、收件資訊、付款方式
        const { cartIds, shippingInfo, paymentMethod } = req.body; 

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        
        // 驗證收件資訊 (如果前端有傳的話)
        if (!shippingInfo || !shippingInfo.name || !shippingInfo.address) {
             res.status(400).json({ error: 'Missing shipping information' });
             return;
        }

        // 呼叫 Service
        const result = await checkout(userId, cartIds, shippingInfo, paymentMethod || 'COD');
        res.json({ message: 'Checkout successful', result });

    } catch (error: any) {
        console.error('Checkout error:', error);
        res.status(400).json({ error: error.message || 'Checkout failed' });
    }
});

// 直購路由
mainRouter.post('/auction/buy-now', async (req, res) => {
    try {
        // @ts-ignore
        const userId = req.session?.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { itemId, quantity } = req.body; // 前端傳來的資料
        const qty = quantity || 1;

        // 呼叫我們剛剛在 cartService.ts 加的函式
        await addDirectBuyToCart(userId, itemId, qty);

        res.json({ success: true, message: 'Added to cart' });
    } catch (error: any) {
        console.error(error);
        res.status(400).json({ error: error.message || 'Failed to add to cart' });
    }
});

mainRouter.get('/test-force-cleanup', async (req, res) => {
    try {
        await runScheduledCleanup();
        res.send('Cleanup executed manually. Check server logs.');
    } catch (error) {
        res.status(500).send('Error during cleanup');
    }
});

mainRouter.use('/notifications', notificationRouter);

export default mainRouter;