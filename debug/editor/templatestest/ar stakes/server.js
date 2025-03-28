const express = require('express');
const app = express();
const port = 8082;  // Different port for AR Stakes project

// Enable CORS for AR.js
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// Serve static files from current directory
app.use(express.static('./'));

app.listen(port, () => {
    console.log(`AR Stakes Server running at http://localhost:${port}`);
}); 