import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

import Filter from "npm:bad-words@3.0.4";

const dbConfig = {
  user: "user_sooraj",
  hostname: "127.0.0.1",
  port: 35432,
  password: "pass",
  database: "db",
  ssl: true,
  sslmode: "require",
};
const filter = new Filter();

export async function insert_user(user_name: string): Promise<
  | { id: string; name: string; created_at: string }
  | { message: string }
  | {
      error: string;
    }
  | {}
> {
  const client = new Client(dbConfig);

  try {
    await client.connect();

    const result = await client.queryObject({
      text: `INSERT INTO users(name) VALUES ('${user_name}') RETURNING *`,
    });

    if (result && result.rows.length > 0 && result.rows[0]) {
      return result.rows[0];
    } else {
      return { message: "Insert Failed" };
    }
  } catch (error) {
    console.error("Error:", error);
    return { error: "Error: " + error.message };
  } finally {
    await client.end();
  }
}

export async function insert_todos(
  user_id: string,
  todo: string
): Promise<
  | { id: string; user_id: string; todo: string; created_at: string }
  | { message: string }
  | {
      error: string;
    }
  | {}
> {
  console.log(">> NEW TODO");
  const client = new Client(dbConfig); 
  if(filter.isProfane(todo)){
    console.error("Todo text contains bad words")
    throw new Error("Todo text contains bad words")
  }

  try {
    await client.connect();

    // Check if the user exists in the users table

    const userExistsQuery = await client.queryObject({
      text: `SELECT id FROM users where id =${user_id}`,
    });

    if (userExistsQuery.rows.length === 0) {
      return { message: "User not found. Insert Failed" };
    }
    const result = await client.queryObject({
      text: `INSERT INTO todos(user_id,todo) VALUES ('${user_id}','${todo}') RETURNING *`,
    });

    if (result && result.rows.length > 0 && result.rows[0]) {
      return result.rows[0];
    } else {
      return { message: "Insert Failed" };
    }
  } catch (error) {
    console.error("Error:", error);
    return { error: "Error: " + error.message };
  } finally {
    await client.end();
  }
}

/**
 * Returns the github bio for the userid provided
 *
 * @param username - Username of the user who's bio will be fetched.
 * @returns The github bio for the requested user.
 * @pure This function should only query data without making modifications
 */
export async function get_github_profile_description(username: string): Promise<string> {
  const foo = await fetch(`https://api.github.com/users/${username}`);
  const response = await foo.json();
  return response.bio;
}

/**
 * @pure
 */

export async function update_todo(todo_id: string, status: string){
  console.log(">>>")
  const client = new Client(dbConfig);
  try {
    await client.connect();
    const text = `UPDATE todos SET status = '${status}' WHERE id =${todo_id} RETURNING *`;

    const result = await client.queryObject({ text });
    if (result && result.rows.length > 0 && result.rows[0]) {
      return { returning: result.rows[0], status: "SUCCESS" };
    } else {
      throw new Error("Delete Failed: Todo not found");
    }
  } catch (error) {
    throw new Error("Error : " + error.message);
  } finally {
    client.end();
  }
}
