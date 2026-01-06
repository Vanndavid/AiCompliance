import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db'; // <--- IMPORT THIS
import apiRoutes from './routes/api';

dotenv.config();

// --- CONNECT TO DATABASE ---
connectDB(); 

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.redirect('/api/health');
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});