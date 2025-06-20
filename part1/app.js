const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
const PORT = 8080;

let db;

async function initDB() {
    try {
        db = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'DogWalkService'
        });

        // Insert test data
        await db.execute(`INSERT IGNORE INTO Users (user_id, username, email, password_hash, role) VALUES
      (1, 'alice123', 'alice@example.com', 'hashed123', 'owner'),
      (2, 'bobwalker', 'bob@example.com', 'hashed456', 'walker'),
      (3, 'carol123', 'carol@example.com', 'hashed789', 'owner')`);

        await db.execute(`INSERT IGNORE INTO Dogs (dog_id, owner_id, name, size) VALUES
      (1, 1, 'Max', 'medium'),
      (2, 3, 'Bella', 'small')`);

        await db.execute(`INSERT IGNORE INTO WalkRequests (request_id, dog_id, requested_time, duration_minutes, location, status) VALUES
      (1, 1, '2025-06-10 08:00:00', 30, 'Parklands', 'open'),
      (2, 2, '2025-06-10 09:30:00', 45, 'Beachside Ave', 'accepted')`);

        await db.execute(`INSERT IGNORE INTO WalkRatings (rating_id, request_id, walker_id, owner_id, rating) VALUES
      (1, 1, 2, 1, 5)`);

    } catch (err) {
        console.error('Database initialization failed:', err);
    }
}

app.get('/api/dogs', async (req, res) => {
    try {
        const [rows] = await db.execute(`
      SELECT d.name AS dog_name, d.size, u.username AS owner_username
      FROM Dogs d
      JOIN Users u ON d.owner_id = u.user_id
    `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to get dogs' });
    }
});

app.get('/api/walkrequests/open', async (req, res) => {
    try {
        const [rows] = await db.execute(`
      SELECT wr.request_id, d.name AS dog_name, wr.requested_time, wr.duration_minutes, wr.location, u.username AS owner_username
      FROM WalkRequests wr
      JOIN Dogs d ON wr.dog_id = d.dog_id
      JOIN Users u ON d.owner_id = u.user_id
      WHERE wr.status = 'open'
    `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to get open walk requests' });
    }
});

app.get('/api/walkers/summary', async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT
                u.username AS walker_username,
                COUNT(DISTINCT wrt.rating_id) AS total_ratings,
                AVG(wrt.rating) AS average_rating,
                COUNT(DISTINCT CASE WHEN wrq.status = 'completed' THEN wa.request_id END) AS completed_walks
            FROM
                Users u
            LEFT JOIN WalkApplications wa ON u.user_id = wa.walker_id AND wa.status = 'accepted'
            LEFT JOIN WalkRequests wrq ON wa.request_id = wrq.request_id
            LEFT JOIN WalkRatings wrt ON u.user_id = wrt.walker_id
            WHERE
                u.role = 'walker'
            GROUP BY
                u.user_id, u.username
        `);

        const summary = rows.map(row => ({
            walker_username: row.walker_username,
            total_ratings: parseInt(row.total_ratings, 10),
            average_rating: row.average_rating ? parseFloat(row.average_rating) : null,
            completed_walks: parseInt(row.completed_walks, 10)
        }));

        res.json(summary);
    } catch (err) {
        console.error('Error fetching walker summary:', err);
        res.status(500).json({ error: 'Failed to retrieve walker summary.' });
    }
});

initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
});
