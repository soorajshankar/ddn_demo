# Hasura DDN Project from scratch (CLI + VS CODE)

## Prerequisites

1. Hasura CLI v3 and Login to Hasura cloud with CLI
2. [VS Code](https://code.visualstudio.com/)
3. [Hasura VS Code extension](https://marketplace.visualstudio.com/items?itemName=HasuraHQ.hasura&ssr=false#overview)
4. Postgres DB instance
5. Deno

## Getting Started

### Step 1 : Create a Hasura DDN Project with local files

Open terminal on a new working directory and execute the following command to start a new DDN project

```sh
hasura init
```

choose `Create New Project`
![Alt text](image.png)

This will create a DDN project on Hasura cloud, and scaffold a local project on your working directory.

### Step 2 : Setup the Database

If you have a PostgresDB running locally, execute the SQL to initialise the tables needed for this demo.

```SQL
-- Create 'users' table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL
);

-- Create 'todos' table with a foreign key reference to 'users'
CREATE TABLE todos (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    todo TEXT NOT NULL,
    status TEXT
);
```

### Step 3 : Local Tunnel Setup: Get your local database accessible from Hasura Cloud

If you have your local postgres database running on `localhost:5432`, run the following commands to start a tunnel deamon that helps Hasura to connect to your locally running database- Idea is to make local dev experience seamless.

```sh
hasura deamon start
# and on a different terminal execute the follwing
hasura tunnel create localhost:5432
# if everything goes right, you will see an output similar to the following
#  Creating tunnel... ok
#   Tunnel active on URL asia-south1-x-xxx.secure-connect.cloud.internal:2000
```

You will now get an endpoint which can be used on Hasura to resolve your database queries.

### Step 4: Add Postgres Datasource, Models to the metadata.

Open the directory using VS Code and open the `metadata.hml`` file.

We can start writing something similar to the following, the VS Code extension will help you to auto-complete the structure so that you don't have to remember or refer docs during the metadata authoring.

Add the following lines to it,

```yaml
kind: HasuraHubDataConnector
version: v1
definition:
  name: dbb
  connectorId: hasura/postgres
  connectorConfiguration:
    - region: gcp-asia-south1
      mode: ReadOnly
      configuration:
        version: 1
        connectionUri:
          uri:
            value: postgres://user_sooraj:pass@asia-south1-a-001.secure-connect.cloud.internal:2028/db
```

The above is a partial definition of a HasuraHub Data Connector, we will now load the DB schema to this definition by using `CTRL/CMD + Shift + P` and then start typing `Hasura: Refresh Data Connecor` then choose `dbb` as we have named this datasource dbb.

🎉 we now have the schema introspected and ready to use in Hasura metadata without any manual authoring.

Now lets Track all collections and relationships by again simply using the extension command. Press `CTRL/CMD + Shift + P` and then start typing `Hasura: Track all collections / functions / procedures / foreign keys from data connector` This will add all the metadata objects that you need to get your GraphQL api from all the tables on posgres.

You can also selectively track a few tables based on your requirements.

### Step 5: Creating first build

Now execute the command to create your first build.

```sh
hasura build create --description "Added database tables"
```

we can now go to https://console.hasura.io/ and get to the project that we created and try out the new UPI.

### Step 6 : Creating and Starting the TS connector.

You can now write business logic on your Hasura project with typescript, we will have mutations on postgres connector soon, but for this demo we will write to postgres using a custom ts function.

This will also power up developers to write custom checks, or logic in a much customised fashion easily.

Create a file `functions/index.ts` and use the folllowing to define the functions.

<details>
<summary>functions/index.ts</summary>
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

</details>

Lets also create a file called `config.json` with the following contents 

<details>
<summary>config.json</summary>
{
    "functions": "./functions/index.ts",
    "vendor": "./vendor",
    "preVendor": true,
    "schemaMode": "INFER"
}
</details>

Now lets try to start the TS connector by running the followng command 

```sh
deno run -A --watch --check https://deno.land/x/hasura_typescript_conn│
ector/mod.ts serve --configuration ./config.json
```

This will start a TS connector locally on `localhost:8100` that can be connected to Hasura now. 

Now you can add/ modify the functions and the deno will restart the server in realtime to give you a searmless development experience for your business logic.

### Step 7: Add TS Connector, functions & Procedures to DDN. 

Lets use add the following lines to the metadata to add the TS connector. 

```yaml
---
kind: DataConnector
version: v1
definition:
  name: functions
  url:
    singleUrl: http://127.0.0.1:8101
```

The above is a partial definition of a DataConnector, we will now load the DB schema to this definition by using `CTRL/CMD + Shift + P` and then start typing `Hasura: Refresh Data Connecor` then choose `functions` as we have named this datasource functions.

🎉 we now have the schema introspected and ready to use in Hasura metadata without any manual authoring.

Now lets Track all functions and procedures by again simply using the extension command. Press `CTRL/CMD + Shift + P` and then start typing `Hasura: Track all collections / functions / procedures / foreign keys from data connector` This will add all the metadata objects that you need to get your GraphQL api from all the tables on posgres.

> Note: Just like database we can use local tunnel to bring this data connector accessible to Hsaura, for that let's run `hasura tunnel create localhost:8100` and replace the singelUrl with the tunnel URL (add http:// to the hostname)

We can now save the metadata file and create another build to test the functions 

```sh
hasura build create --description "Added database tables"
```


🎉 Whoola, we have a TODO app backend up and running across the globe on Hasura DDN. 


### Other code snippets 

1. Input validations: Add bad words check

```js
if (!todo) {
  return { status: "error", errorMessage: "Invalid todo text" };
} else if (filter.isProfane(todo)) {
  console.error("Todo text contains bad words");
  return { status: "error", errorMessage: "Todo text contains bad words" };
}
```

2. Input sanitization :  remove special characters from the todo text
  todo = todo.replace(/[^\w\s]/gi, "");

```js
// remove special characters from the todo text
todo = todo.replace(/[^\w\s]/gi, "");
```
3. API Integrations

```js
const notifySlack = await fetch(
  "https://hooks.slack.com/services/XXXXX",
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
```