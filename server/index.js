const { pgUser, pgHost, pgDatabase, pgPassword, redisHost, redisPort } = require('./keys');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const redis = require('redis');

// Express Server setup
const app = express();
app.use(cors());
app.use(bodyParser.json());

// PostgreSQL setup
const pgClient = new Pool({
  user: pgUser,
  host: pgHost,
  database: pgDatabase,
  password: pgPassword
});

pgClient.on('error', () => console.log('Lost PG Connection'));
pgClient.query('CREATE TABLE IF NOT EXISTS values (number INT)').catch(err => console.log(err));

// Redis client setup
const redisClient = redis.createClient({
  host: redisHost,
  port: redisPort,
  retry_strategy: () => 1000
});

const redisPublisher = redisClient.duplicate();

// Express route handlers
app.get('/', (req, res) => {
  res.send('Hi');
});

app.get('/values/all', async (req, res) => {
  const values = await pgClient.query('SELECT * FROM values');
  res.send(values.rows);
});

app.get('/values/current', async (req, res) => {
  redisClient.hgetall('values', (err, values) => {
    res.send(values);
  });
});

app.post('/values', async (req, res) => {
  const index = req.body.index;

  if (parseInt(index) > 40) {
    return res.status(422).send('Index too high');
  }

  redisClient.hset('values', index, 'Nothing yet!');
  redisPublisher.publish('insert', index);
  pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);

  res.send({ success: true });
});

app.listen(5000, err => {
  console.log('Listening on port 5000');
});