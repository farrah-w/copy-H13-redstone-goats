"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeFmtToken = makeFmtToken;
const express_1 = __importDefault(require("express"));
const app_1 = require("./app");
const config_json_1 = __importDefault(require("./config.json"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const types_1 = require("./types");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_1 = require("./user");
const dataStore_1 = require("./dataStore");
const app = (0, express_1.default)();
// Middleware to parse JSON body
app.use(express_1.default.json());
// Middleware to allow access from other domains
app.use((0, cors_1.default)());
// Middleware for logging HTTP requests
app.use((0, morgan_1.default)("dev"));
const PORT = parseInt(process.env.PORT || config_json_1.default.port);
const HOST = process.env.IP || "127.0.0.1";
const JWT_SECRET = process.env.JWT_SECRET || "r3dSt0nE@Secr3tD00r!";
// ===========================================================================
// ============================= ROUTES BELOW ================================
// ===========================================================================
// Custom middleware
app.use((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const token = (_b = (_a = req.query.token) !== null && _a !== void 0 ? _a : req.body.token) !== null && _b !== void 0 ? _b : req.headers.token;
    if (token === undefined) {
        return next();
    }
    try {
        const isValid = yield (0, dataStore_1.validToken)(Number(token));
        if (!isValid) {
            res.status(401).json({ error: 'Token does not refer to a valid, logged-in session' });
            return;
        }
        req.body.token = Number(token);
        return next();
    }
    catch (err) {
        res.status(500).json({ error: 'Server error while validating session' });
        return;
    }
}));
function makeFmtToken(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const sessionId = Math.floor(Math.random() * 1000000); // Generate a numeric session ID
        const success = yield (0, dataStore_1.addToken)(sessionId, userId);
        if (!success) {
            throw new Error('Failed to create session');
        }
        return { token: sessionId };
    });
}
// END Custom middleware
//Custom middleware for JWT
app.use((req, res, next) => {
    var _a;
    // Extract the token from the Authorization header
    const token = (_a = req.header('Authorization')) === null || _a === void 0 ? void 0 : _a.split(' ')[1];
    if (!token) {
        return next(); // No token provided, continue without interception
    }
    try {
        // Verify and decode the token
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.body.token = decoded.userId; // Attach the userId from JWT payload to the request body
        next(); // Continue to the next middleware/route
    }
    catch (error) {
        // Handle error (invalid or expired token)
        res.status(types_1.ErrKind.ENOTOKEN).json({ error: 'Token is not valid or expired' });
    }
});
// Function for generating JWT 
function makeJwtToken(userId) {
    const token = jsonwebtoken_1.default.sign({ userId }, JWT_SECRET, { expiresIn: '1h' }); // Token expires in 1 hour
    return { token: token };
}
//End of Custome middleware for JWT
app.post('/v1/user/logout', (req, res) => {
    var _a;
    const token = (_a = req.body.token) !== null && _a !== void 0 ? _a : req.headers.token;
    const result = userLogout(token);
    res.json(result);
});
app.post('/v1/user/register', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password, nameFirst, nameLast } = req.body;
        const result = yield (0, user_1.userRegister)(email, password, nameFirst, nameLast);
        const sessionToken = yield makeJwtToken(result.userId);
        res.json(sessionToken);
    }
    catch (err) {
        if (err instanceof Error) {
            res.status(400).json({ error: err.message });
        }
        else {
            res.status(400).json({ error: 'An unknown error occurred' });
        }
    }
}));
app.post('/v1/user/login', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        const result = yield (0, user_1.userLogin)(email, password);
        const sessionToken = yield makeJwtToken(result.userId);
        res.json(sessionToken);
    }
    catch (err) {
        if (err instanceof Error) {
            res.status(400).json({ error: err.message });
        }
        else {
            res.status(400).json({ error: 'An unknown error occurred' });
        }
    }
}));
app.get('/v1/user/details', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.body.token; // INTERCEPTED!!
        const result = yield (0, user_1.userDetails)(userId);
        res.json(result);
    }
    catch (err) {
        if (err instanceof Error) {
            res.status(400).json({ error: err.message });
        }
        else {
            res.status(400).json({ error: 'An unknown error occurred' });
        }
    }
}));
app.put('/v1/user/details/update', (req, res) => {
    const { token, email, nameFirst, nameLast } = req.body; // INTERCEPTED!
    const result = userDetailsUpdate(token, email, nameFirst, nameLast);
    res.json(result);
});
app.get("/", (req, res) => {
    res.send("Hello, Express with TypeScript!");
});
// Route that creates an order.
app.post("/v1/order/create", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const order = req.body;
    try {
        const result = yield (0, app_1.orderCreate)(order);
        res.status(201).json(result);
    }
    catch (error) {
        const e = error;
        if (e.message === 'Invalid userId or a different name is registered to userId' ||
            e.message === 'No userId provided') {
            res.status(401).json({ error: e.message });
        }
        else {
            res.status(400).json({ error: e.message });
        }
    }
}));
app.put("/v1/:userId/order/:orderId/cancel", (req, res) => {
    try {
        const { userId, orderId } = req.params;
        const { reason } = req.body;
        const result = (0, app_1.orderCancel)(Number(userId), Number(orderId), reason);
        res.json(result);
    }
    catch (error) {
        let statusCode;
        const e = error;
        if (e.message === "invalid orderId" || e.message === "invalid userId") {
            statusCode = 401;
        }
        else if (e.message === "order already cancelled") {
            statusCode = 400;
        }
        else {
            statusCode = 404;
        }
        res.status(statusCode).json({ error: e.message });
    }
});
app.post("/v1/:userId/order/:orderId/confirm", (req, res) => {
    try {
        const { userId, orderId } = req.params;
        const result = (0, app_1.orderConfirm)(Number(userId), Number(orderId));
        res.json(result);
    }
    catch (error) {
        let statusCode;
        const e = error;
        if (e.message === "invalid orderId" || e.message === "invalid userId") {
            statusCode = 401;
        }
        else if (e.message === "order not found") {
            statusCode = 400;
        }
        else {
            statusCode = 404;
        }
        res.status(statusCode).json({ error: e.message });
    }
});
app.delete('/v1/clear', (_, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.json(yield (0, dataStore_1.clearAll)());
}));
// Custom **error handling** middleware
app.use((err, req, res, next) => {
    err instanceof types_1.Err ? res.status(err.kind.valueOf()).json({ error: err.message }) : next();
});
app.post('/v1/:userId/order/:orderId/items/change', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId, orderId } = req.params;
        // IF TOKEN ????
        // const userId = req.body.token;
        const { items } = req.body;
        // Call function, return updated order
        const updatedOrder = yield (0, app_1.orderChange)(userId, orderId, { items });
        res.status(200).json(updatedOrder);
        // Error Checking
    }
    catch (err) {
        const e = err;
        let statusCode = 500; // default error code
        if (e.message === "Invalid orderId" || e.message === "Invalid userId") {
            statusCode = 401;
        }
        else if (e.message == "order not found") {
            statusCode = 400;
        }
        else if (e.message.includes("Item with id") || e.message.includes("Invalid quantity")) {
            statusCode = 422; // note to self, add changes to swagger + documentation
        }
        res.status(statusCode).json({ error: e.message });
    }
    ;
}));
app.post("/v1/:userId/order/:orderId/confirm", (req, res) => {
    try {
        const { userId, orderId } = req.params;
        const result = (0, app_1.orderConfirm)(Number(userId), Number(orderId));
        res.json(result);
    }
    catch (error) {
        let statusCode;
        const e = error;
        if (e.message === "invalid orderId" || e.message === "invalid userId") {
            statusCode = 401;
        }
        else if (e.message === "order not found") {
            statusCode = 400;
        }
        else {
            statusCode = 404;
        }
        res.status(statusCode).json({ error: e.message });
    }
});
// ===========================================================================
// ============================= ROUTES ABOVE ================================
// ===========================================================================
const server = app.listen(PORT, HOST, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
});
// Graceful shutdown handling
process.on("SIGINT", () => {
    server.close(() => {
        console.log("Shutting down server gracefully.");
        process.exit();
    });
});
