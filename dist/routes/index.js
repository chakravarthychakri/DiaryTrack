"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routes_js_1 = __importDefault(require("./auth.routes.js"));
const product_routes_js_1 = __importDefault(require("./product.routes.js"));
const inventory_routes_js_1 = __importDefault(require("./inventory.routes.js"));
const sale_routes_js_1 = __importDefault(require("./sale.routes.js"));
const purchase_routes_js_1 = __importDefault(require("./purchase.routes.js"));
const analytics_routes_js_1 = __importDefault(require("./analytics.routes.js"));
const report_routes_js_1 = __importDefault(require("./report.routes.js"));
const supplier_routes_js_1 = __importDefault(require("./supplier.routes.js"));
const apiRouter = (0, express_1.Router)();
apiRouter.use('/auth', auth_routes_js_1.default);
apiRouter.use('/products', product_routes_js_1.default);
apiRouter.use('/inventory', inventory_routes_js_1.default);
apiRouter.use('/sales', sale_routes_js_1.default);
apiRouter.use('/purchases', purchase_routes_js_1.default);
apiRouter.use('/analytics', analytics_routes_js_1.default);
apiRouter.use('/reports', report_routes_js_1.default);
apiRouter.use('/suppliers', supplier_routes_js_1.default);
exports.default = apiRouter;
//# sourceMappingURL=index.js.map