import express from 'express';
import * as path from 'path';
import bodyParser from 'body-parser';
import mainRouter from './Router';

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/api', mainRouter);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/homePage.html'));
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));