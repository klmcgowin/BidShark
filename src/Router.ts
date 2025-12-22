import { Router } from 'express';
import loginRouter from './userOperation.js';
import sessionInfo from './getSessionInfo.js';
import dataRouter from "./dataManipulation.js";
import DBreader from "./getDBdata.js";
import chatRouter from "./chat.js";
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

// 3. 直購 (Buy Now) 
mainRouter.post('/auction/buy-now', async (req, res) => {
    try {
        const userId = (req.session as any)?.user?.id || (req.session as any)?.user?._id;
        const { itemId } = req.body;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        
        await addDirectBuyToCart(userId, itemId);
        res.json({ success: true });
    } catch (error: any) {
        console.error('Buy Now error:', error);
        res.status(400).json({ error: error.message || 'Failed to buy item' });
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

export default mainRouter;