-- Create 'users' table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

-- Create 'todos' table with a foreign key reference to 'users'
CREATE TABLE todos (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    todo TEXT NOT NULL,
    status TEXT
);
