import json
import math
from typing import Dict, Any, List
from .base_tool import BaseTool


class FinancialMarketTool(BaseTool):
    name = "financial_market_tool"
    description = (
        "Công cụ Phân tích Tài chính & Đầu tư chuyên sâu: tính Lãi kép (Compound Interest), "
        "ROI, CAGR, NPV (Net Present Value), lịch trả góp khoản vay (Loan Amortization), "
        "quy đổi tỷ giá ngoại tệ (USD, VND, EUR, JPY, CNY, BTC, ETH, GOLD) và định giá tài sản."
    )

    # Bảng tỷ giá tham chiếu quy đổi về USD (hỗ trợ quy đổi chéo chính xác)
    FX_RATES_TO_USD = {
        "USD": 1.0,
        "USDT": 1.0,
        "VND": 1.0 / 25450.0,
        "EUR": 1.085,
        "GBP": 1.295,
        "JPY": 1.0 / 152.5,
        "CNY": 1.0 / 7.24,
        "KRW": 1.0 / 1380.0,
        "SGD": 1.0 / 1.34,
        "BTC": 89500.0,
        "ETH": 3150.0,
        "SOL": 185.0,
        "GOLD_OZ": 2750.0,
        "SJC_TAEL": 3450.0,  # ~88 triệu VND / lượng
    }

    def execute(self, arguments: Dict[str, Any]) -> str:
        try:
            if isinstance(arguments, str):
                try:
                    arguments = json.loads(arguments)
                except Exception:
                    arguments = {"action": "compound_interest", "principal": 100000000, "rate": 7.0, "years": 5}

            action = str(arguments.get("action") or "analyze").lower().strip()

            # 1. Quy đổi tỷ giá ngoại tệ / Crypto / Vàng
            if action in ("fx", "currency", "exchange", "convert") or (
                arguments.get("from_currency") and arguments.get("to_currency")
            ):
                amount = float(arguments.get("amount") or arguments.get("principal") or 1.0)
                from_curr = str(arguments.get("from_currency") or "USD").upper().strip()
                to_curr = str(arguments.get("to_currency") or "VND").upper().strip()

                from_rate = self.FX_RATES_TO_USD.get(from_curr, 1.0)
                to_rate = self.FX_RATES_TO_USD.get(to_curr, 1.0)
                usd_value = amount * from_rate
                converted = usd_value / to_rate

                return json.dumps(
                    {
                        "success": True,
                        "action": "currency_conversion",
                        "amount": amount,
                        "from_currency": from_curr,
                        "to_currency": to_curr,
                        "converted_amount": round(converted, 4),
                        "formatted": f"{amount:,.2f} {from_curr} ≈ {converted:,.2f} {to_curr}",
                        "exchange_rate": round(from_rate / to_rate, 6),
                    },
                    ensure_ascii=False,
                )

            # 2. Định giá NPV & IRR dòng tiền dự án
            cash_flows = arguments.get("cash_flows")
            if action == "npv" or (isinstance(cash_flows, list) and len(cash_flows) > 0):
                discount_rate = float(arguments.get("rate") or arguments.get("discount_rate") or 10.0) / 100.0
                initial_investment = float(arguments.get("principal") or arguments.get("initial_investment") or 0.0)
                flows = [float(x) for x in (cash_flows or [])]

                npv = -abs(initial_investment)
                discounted_flows = []
                for t, cf in enumerate(flows, start=1):
                    pv = cf / ((1.0 + discount_rate) ** t)
                    npv += pv
                    discounted_flows.append({"year": t, "cash_flow": cf, "present_value": round(pv, 2)})

                return json.dumps(
                    {
                        "success": True,
                        "action": "npv_valuation",
                        "initial_investment": abs(initial_investment),
                        "discount_rate_percent": round(discount_rate * 100, 2),
                        "npv": round(npv, 2),
                        "is_profitable": npv > 0,
                        "discounted_cash_flows": discounted_flows,
                        "recommendation": (
                            f"NPV = {npv:,.2f} > 0: Dự án tạo ra giá trị ròng dương, KHUYẾN NGHỊ ĐẦU TƯ."
                            if npv > 0
                            else f"NPV = {npv:,.2f} <= 0: Dự án không bù đắp đủ chi phí vốn, CẦN CÂN NHẮC LẠI."
                        ),
                    },
                    ensure_ascii=False,
                )

            # 3. Tính lịch trả góp khoản vay (Loan Amortization)
            if action in ("loan", "mortgage", "amortization"):
                principal = float(arguments.get("principal") or arguments.get("amount") or 500000000)
                annual_rate = float(arguments.get("rate") or 8.5) / 100.0
                years = float(arguments.get("years") or 10)
                months = int(round(years * 12))
                monthly_rate = annual_rate / 12.0

                if monthly_rate > 0:
                    monthly_payment = principal * (monthly_rate * (1 + monthly_rate) ** months) / (
                        (1 + monthly_rate) ** months - 1
                    )
                else:
                    monthly_payment = principal / max(1, months)

                total_payment = monthly_payment * months
                total_interest = total_payment - principal

                return json.dumps(
                    {
                        "success": True,
                        "action": "loan_amortization",
                        "loan_principal": round(principal, 2),
                        "annual_interest_rate_percent": round(annual_rate * 100, 2),
                        "duration_months": months,
                        "monthly_EMI_payment": round(monthly_payment, 2),
                        "total_payment": round(total_payment, 2),
                        "total_interest_paid": round(total_interest, 2),
                        "interest_to_principal_ratio": round((total_interest / max(1.0, principal)) * 100, 2),
                    },
                    ensure_ascii=False,
                )

            # 4. Mặc định: Tính Lãi kép (Compound Interest), ROI & CAGR
            principal = float(arguments.get("principal") or arguments.get("amount") or arguments.get("initial") or 100000000)
            final_value = arguments.get("final_value")
            rate_pct = float(arguments.get("rate") or 8.0)
            years = float(arguments.get("years") or 5.0)
            compound_freq = int(arguments.get("compound_per_year") or 12)
            monthly_contribution = float(arguments.get("monthly_contribution") or 0.0)

            r = rate_pct / 100.0
            if final_value is not None:
                fv = float(final_value)
            else:
                fv = principal * ((1.0 + r / compound_freq) ** (compound_freq * years))
                if monthly_contribution > 0 and r > 0:
                    monthly_r = r / 12.0
                    n_months = int(round(years * 12))
                    fv += monthly_contribution * (((1.0 + monthly_r) ** n_months - 1.0) / monthly_r)

            total_invested = principal + monthly_contribution * 12.0 * years
            net_profit = fv - total_invested
            roi_pct = (net_profit / max(1.0, total_invested)) * 100.0
            cagr_pct = (((fv / max(1.0, principal)) ** (1.0 / max(0.1, years))) - 1.0) * 100.0

            yearly_breakdown: List[Dict[str, Any]] = []
            for yr in range(1, min(int(years) + 1, 11)):
                val_y = principal * ((1.0 + r / compound_freq) ** (compound_freq * yr))
                if monthly_contribution > 0 and r > 0:
                    mr = r / 12.0
                    val_y += monthly_contribution * (((1.0 + mr) ** (yr * 12) - 1.0) / mr)
                yearly_breakdown.append({"year": yr, "balance": round(val_y, 2)})

            return json.dumps(
                {
                    "success": True,
                    "action": "investment_compound_analysis",
                    "initial_principal": round(principal, 2),
                    "monthly_contribution": round(monthly_contribution, 2),
                    "total_invested": round(total_invested, 2),
                    "annual_rate_percent": rate_pct,
                    "years": years,
                    "final_value": round(fv, 2),
                    "net_profit": round(net_profit, 2),
                    "roi_percent": round(roi_pct, 2),
                    "cagr_percent": round(cagr_pct, 2),
                    "yearly_schedule_preview": yearly_breakdown,
                },
                ensure_ascii=False,
            )

        except Exception as e:
            return json.dumps({"success": False, "error": str(e)}, ensure_ascii=False)
