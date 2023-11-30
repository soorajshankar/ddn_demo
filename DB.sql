-- Drop tables if they exist

DROP table IF EXISTS todos;

DROP table IF EXISTS users;

-- Create 'users' table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

-- Create 'todos' table with a foreign key reference to 'users'
CREATE TABLE IF NOT EXISTS todos (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    todo TEXT NOT NULL,
    description TEXT,
    status TEXT
);

insert into
    users(name)
values
('Sooraj') RETURNING *;