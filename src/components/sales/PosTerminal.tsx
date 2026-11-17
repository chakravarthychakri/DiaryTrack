import React, { useState } from 'react';
import { Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, QrCode } from 'lucide-react';
import { Product, SaleItem } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { Button } from '../shared/Button';
import { SearchBar } from '../shared/SearchBar';

export interface PosTerminalProps {
  products: Product[];
  onCompleteSale: (saleData: {
    items: { product_id: number | string; quantity: number; unit_price: number }[];
    payment_method: string;
    discount: number;
    notes?: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

export const PosTerminal: React.FC<PosTerminalProps> = ({
  products,
  onCompleteSale,
  isLoading = false,
}) => {
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [discount, setDiscount] = useState<number>(0);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const filteredProducts = products.filter(
    (p) =>
      p.status === 'Active' &&
      (p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku?.toLowerCase().includes(search.toLowerCase()))
  );

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product_id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                total_price: Number(((item.quantity + 1) * item.unit_price).toFixed(2)),
              }
            : item
        );
      }
      return [
        ...prev,
        {
          product_id: Number(product.id),
          product_name: product.name,
          product_unit: product.unit,
          quantity: 1,
          unit_price: product.selling_price,
          total_price: product.selling_price,
        },
      ];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product_id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0
              ? {
                  ...item,
                  quantity: newQty,
                  total_price: Number((newQty * item.unit_price).toFixed(2)),
                }
              : null;
          }
          return item;
        })
        .filter(Boolean) as SaleItem[]
    );
  };

  const removeItem = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product_id !== productId));
  };

  const subtotal = cart.reduce((acc, item) => acc + item.total_price, 0);
  const netTotal = Math.max(0, subtotal - discount);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsCheckingOut(true);
    try {
      await onCompleteSale({
        items: cart.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
        payment_method: paymentMethod,
        discount,
      });
      setCart([]);
      setDiscount(0);
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)]">
      {/* Product Selection Catalog */}
      <div className="lg:col-span-7 flex flex-col bg-white border border-slate-200 rounded-xl shadow-xs p-4 overflow-hidden">
        <div className="mb-4">
          <SearchBar
            placeholder="Search milk, paneer, curd, ghee..."
            value={search}
            onSearch={setSearch}
            className="w-full max-w-full"
          />
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-3 pr-1">
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              onClick={() => addToCart(p)}
              className="p-3 bg-slate-50 hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-300 rounded-lg cursor-pointer transition-all flex flex-col justify-between group"
            >
              <div>
                <p className="font-bold text-xs text-slate-800 line-clamp-2 group-hover:text-emerald-950">
                  {p.name}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">{p.unit}</p>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-extrabold text-emerald-700">
                  {formatCurrency(p.selling_price)}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200">
                  Stock: {p.current_stock}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* POS Cart & Checkout */}
      <div className="lg:col-span-5 flex flex-col bg-white border border-slate-200 rounded-xl shadow-xs p-5 overflow-hidden">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900">Current Order Cart</h3>
          </div>
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="text-xs text-rose-600 hover:underline"
            >
              Clear Cart
            </button>
          )}
        </div>

        {/* Cart Item Rows */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 pr-1">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
              <ShoppingCart className="w-12 h-12 stroke-1 text-slate-300 mb-2" />
              <p className="text-xs font-semibold">Cart is currently empty</p>
              <p className="text-[11px] text-slate-400">Click products on the left to add items</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product_id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate">{item.product_name}</p>
                  <p className="text-[10px] text-slate-400">
                    {formatCurrency(item.unit_price)} × {item.quantity} {item.product_unit}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => updateQuantity(item.product_id, -1)}
                    className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center text-xs font-bold text-slate-800">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.product_id, 1)}
                    className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <div className="text-right w-20 shrink-0">
                  <p className="text-xs font-bold text-slate-900">{formatCurrency(item.total_price)}</p>
                </div>

                <button
                  onClick={() => removeItem(item.product_id)}
                  className="p-1 text-slate-300 hover:text-rose-600 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Bill Calculations & Payment Options */}
        <div className="pt-4 border-t border-slate-100 space-y-3 shrink-0">
          <div className="space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-semibold">{formatCurrency(subtotal)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span>Discount (₹):</span>
              <input
                type="number"
                min="0"
                value={discount || ''}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                className="w-24 text-right px-2 py-0.5 text-xs bg-slate-50 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-200">
              <span>Net Payable:</span>
              <span className="text-emerald-700">{formatCurrency(netTotal)}</span>
            </div>
          </div>

          {/* Payment Method Badges */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'Cash', icon: <Banknote className="w-3.5 h-3.5" /> },
                { id: 'UPI', icon: <QrCode className="w-3.5 h-3.5" /> },
                { id: 'Card', icon: <CreditCard className="w-3.5 h-3.5" /> },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMethod(m.id)}
                  className={`py-2 px-2 flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold border transition-all ${
                    paymentMethod === m.id
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {m.icon}
                  <span>{m.id}</span>
                </button>
              ))}
            </div>
          </div>

          <Button
            size="lg"
            variant="primary"
            className="w-full font-bold shadow-md text-base"
            disabled={cart.length === 0 || isLoading || isCheckingOut}
            isLoading={isCheckingOut}
            onClick={handleCheckout}
          >
            Complete Sale ({formatCurrency(netTotal)})
          </Button>
        </div>
      </div>
    </div>
  );
};
