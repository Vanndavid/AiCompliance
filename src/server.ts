import express from 'express';

console.log('--- STARTING SERVER ---'); // This forces a log at the very top

const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('HELLO WORLD - SITE SAFE IS ALIVE');
});

app.listen(port, () => {
  console.log(`✅ SUCCESS: Server is running on http://localhost:${port}`);
});