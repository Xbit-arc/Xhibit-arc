import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();


const PORT = process.env.PORT || 3000;

const HOST = '0.0.0.0'; 


app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Start the server
app.listen(PORT, HOST, () => {
  console.log(`✅ Server successfully listening on ${HOST}:${PORT}`);
});

export default app;
