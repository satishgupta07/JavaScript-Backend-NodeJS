# JavaScript Backend NodeJS

[Model link](https://app.eraser.io/workspace/YtPqZ1VogxGy1jzIDkzj?origin=share)

### Importing Dependencies:
- express: This is the main module for building web applications with Node.js. It simplifies the process of defining routes, handling HTTP requests, and more.
- cors: Cross-Origin Resource Sharing middleware. It's used to enable CORS (Cross-Origin Resource Sharing) support, allowing the server to handle requests from different origins.
- cookie-parser: Middleware for parsing cookies in the incoming request headers.

### const app = express(): 
- This line creates an instance of the Express application, which is used to configure and define the behavior of your web server.

### Middleware Setup:
- app.use(cors(...)): Configures CORS settings. It enables cross-origin requests from the specified origin (in this case, it's loaded from the CORS_ORIGIN environment variable) and allows credentials to be sent with the request.

- app.use(express.json({limit: "16kb"})): This middleware parses incoming JSON payloads and limits their size to 16 kilobytes.

- app.use(express.urlencoded({extended: true, limit: "16kb"})): This middleware parses incoming URL-encoded data (usually from forms) and limits its size to 16 kilobytes.

- app.use(express.static("public")): Serves static files from the "public" directory. This could include CSS, images, or other client-side assets.

- app.use(cookieParser()): Parses cookies from the incoming request headers and makes them available in the req.cookies object.