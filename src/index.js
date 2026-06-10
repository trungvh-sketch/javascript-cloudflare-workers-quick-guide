export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // GET /
    if (request.method === "GET" && url.pathname === "/") {
      return Response.json({
        message: "API is running",
      });
    }

    // GET /users
    if (request.method === "GET" && url.pathname === "/users") {
      return Response.json({
        users: [
          { id: 1, name: "Eduardo" },
          { id: 2, name: "Lucy" },
        ],
      });
    }

    // GET /status
    if (request.method === "GET" && url.pathname === "/status") {
      return Response.json({
        status: "ok",
        timestamp: new Date().toISOString(),
      });
    }

    // POST /users
    if (request.method === "POST" && url.pathname === "/users") {
      const body = await request.json();

      return Response.json(
        {
          message: "User created",
          user: body,
        },
        { status: 201 },
      );
    }

    // 404 fallback
    return Response.json(
      {
        error: "Not found",
      },
      { status: 404 },
    );
  },
};
