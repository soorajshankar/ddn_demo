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

type todoType = {
  id: number;
  user_id: number;
  todo: string;
};

export async function insert_todos(
  user_id: string,
  todo: string
): Promise<{ status: string; errorMessage?: string; data?: todoType }> {
  console.log(">> NEW TODO");
  const client = new Client(dbConfig);

  // Input validations : Check if the todo text is empty or contains bad words
  if (!todo) {
    return { status: "error", errorMessage: "Invalid todo text" };
  } else if (filter.isProfane(todo)) {
    console.error("Todo text contains bad words");
    return { status: "error", errorMessage: "Todo text contains bad words" };
  }

  // Input sanitization :  remove special characters from the todo text
  todo = todo.replace(/[^\w\s]/gi, "");

  try {
    await client.connect();

    // Check if the user exists in the users table

    const userExistsQuery = await client.queryObject({
      text: `SELECT id FROM users where id =${user_id}`,
    });

    if (userExistsQuery.rows.length === 0) {
      return { status: "error", errorMessage: "User not found. Insert Failed" };
    }
    const result = await client.queryObject({
      text: `INSERT INTO todos(user_id,todo) VALUES ('${user_id}','${todo}') RETURNING *`,
    });

    if (result && result.rows.length > 0 && result.rows[0]) {
      // Notify slack about the new todo
      const notifySlack = await fetch(
        "https://hooks.slack.com/services/XX",
        {
          method: "POST",
          headers: {
            "Content-type": "application/json",
          },
          body: JSON.stringify({
            text: "New Todo Added: \n" + todo,
          }),
        }
      );
      return { status: "SUCCESS", data: result.rows[0] as any };
    } else {
      return { status: "ERROR", errorMessage: "Insert Failed" };
    }
  } catch (error) {
    console.error("Error:", error);
    return { status: "ERROR", errorMessage: error.message };
  } finally {
    await client.end();
  }
}

export async function update_todo(todo_id: string, status: string) {
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
