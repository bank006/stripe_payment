const express = require('express')
const { Pool } = require('pg')
require('dotenv').config();
const stripe = require('stripe')(process.env.SECRET_KEY_STRIPE);
const cors = require('cors')
const { v4: uuidv4 } = require('uuid')

const app = express()
app.use(express.static('public'));
app.use(cors());

// ใช้ express.json() เฉพาะกับ route ที่ไม่ใช่ webhook
app.use('/checkout', express.json());

const connectionString = process.env.DATABASE_KEY;
const endpointSecret = process.env.ENDPOINT_SECRET;

const conn = new Pool({
    connectionString: connectionString,
    connectionTimeoutMillis: 10000  // เพิ่มค่า timeout ให้มากขึ้น (เช่น 10 วินาที)
});

conn.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the database');
});

app.get('/api/orders/:id', async (req, res) => {
    try {
        const orderId = req.params.id;
        const result = await conn.query("SELECT * FROM orders WHERE order_id = $1", [orderId]);
        res.send(result.rows[0]); // ใช้ result.rows เพื่อดึงข้อมูลผลลัพธ์
    } catch (err) {
        res.status(500).send(err);
    }
});

app.post('/checkout', async (req, res) => {
    const { user, product } = req.body;

    try {
        const orders_id = uuidv4();

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'thb',
                        product_data: {
                            name: product.name,
                        },
                        unit_amount: product.price * 100,
                    },
                    quantity: product.quantity,
                },
            ],
            mode: 'payment',
            success_url: `https://media.licdn.com/dms/image/D4E12AQFQkhQUys7zQQ/article-cover_image-shrink_720_1280/0/1691959907767?e=2147483647&v=beta&t=DTP9VSEqXNGOiS9wpiE_ky3BBwlfS-Z1RQ_JhAVqVVk`,
            cancel_url: `https://t3.ftcdn.net/jpg/02/10/99/20/360_F_210992050_QE0grm6oE3JVWmJKKmCHtfz3cwHSLB2c.jpg`,
        });

        const data = {
            name: user.name,
            address: user.address,
            order_id: orders_id,
            session_id: session.id,
            status: session.status,
            price: product.price,
        };

        const result = await conn.query(
            'INSERT INTO orders (name, address, order_id, session_id, status, price) VALUES ($1, $2, $3, $4, $5, $6)',
            [data.name, data.address, data.order_id, data.session_id, data.status, data.price]
        );
        res.json({ session });

    } catch (error) {
        console.error('Error creating user:', error.message);
        res.status(400).json({ error: 'Error payment' });
    }
});



const port = process.env.PORT || 8000;
const server = app.listen(port, () => {
    console.log('connecting port ' + port);
});
