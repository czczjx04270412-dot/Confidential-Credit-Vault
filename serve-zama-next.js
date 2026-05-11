const http = require("http");
const next = require("next");

const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();
const port = Number(process.env.PORT || 3027);

process.on("exit", (code) => {
  console.log(`Zama Next server exiting with code ${code}`);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection:", error);
});

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    handle(req, res).catch((error) => {
      console.error("Request failed:", error);
      res.statusCode = 500;
      res.end("Internal server error");
    });
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`Zama Next server ready on http://localhost:${port}`);
  });
});
