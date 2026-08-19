import 'dotenv/config';
import express from 'express';
import { uploadToCloudinary } from './server/lib/cloudinary.ts';

const app = express();
app.use(express.json({ limit: '35mb' }));

app.post('/test', async (req, res) => {
  try {
    const { data } = req.body;
    const url = await uploadToCloudinary(data, 'test');
    res.json({ url });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

const server = app.listen(3002, () => {
  console.log('Listening on 3002');
  
  const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const data = 'data:image/png;base64,' + base64Data;
  
  fetch('http://localhost:3002/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data })
  })
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
  .finally(() => server.close());
});
