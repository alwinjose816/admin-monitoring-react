import React, { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    ResponsiveContainer,
    LineChart,
    Line,
    Legend
} from "recharts";



function ProductTab() {

    

    const [selectedProduct, setSelectedProduct] = useState("");
    const [products, setProducts] = useState([]);

    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [selectedMetric, setSelectedMetric] = useState("MT");
    const [metric, setMetric] = useState("MT");

    const [kpi, setKpi] = useState({});
    const [depotStock, setDepotStock] = useState([]);
    const [trendData, setTrendData] = useState([]);
    const [citySales, setCitySales] = useState([]);
    const [depotSales, setDepotSales] = useState([]);
    const [refreshKey, setRefreshKey] = useState(0);
    const metricLabel = metric;
    const [allOrders, setAllOrders] = useState([]);
    const [allStock, setAllStock] = useState([]);
    const [dealerSales, setDealerSales] = useState([]);
    const [loading, setLoading] = useState(false);
    const convertValue = (bags) => {
        return metric === "MT"
            ? (bags / 20).toFixed(1)
            : bags;
    };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {

        const { data: stock } = await supabase
            .from("depot_stock")
            .select("*");

        const { data: orders } = await supabase
            .from("dealer_orders")
            .select(`
            dealer_id,
            product_name,
            bags,
            order_date,
            assigned_depot
        `);

        const productsList = [
            ...new Set(
                (orders || []).map(x => x.product_name)
            )
        ].filter(Boolean);

        setProducts(productsList);

        setAllOrders(orders || []);
        setAllStock(stock || []);

        console.log("Products:", productsList.length);
    };

    const loadData = async () => {
        setLoading(true);

        try {

        // ---------------- STOCK ----------------
        let { data: stock } = await supabase
            .from("depot_stock")
            .select("*");

        const safeStock = stock || [];       

     


        let df = safeStock.map(x => ({
            ...x,
            bags: Number(x.number_of_bags || 0),
            date: x.created_at ? new Date(x.created_at) : null
        }));

        // DATE FILTER
        if (fromDate && toDate) {
            const from = new Date(fromDate);
            const to = new Date(toDate);
            to.setHours(23, 59, 59, 999);

            df = df.filter(x =>
                x.date && x.date >= from && x.date <= to
            );
        }

        // PRODUCT FILTER
        const productDf = selectedProduct
            ? df.filter(x => x.product_name === selectedProduct)
            : df;

        if (!productDf.length) {
            console.log("No stock data for selected filters");
        }
        

        // ---------------- KPI ----------------
        const totalStock = productDf.reduce((s, x) => s + x.bags, 0);
        const depots = [...new Set(productDf.map(x => x.depot_code))];

        // ---------------- DEPOT STOCK ----------------
        const depotMap = {};
        productDf.forEach(x => {
            depotMap[x.depot_code] = (depotMap[x.depot_code] || 0) + x.bags;
        });

        const depotStockData = Object.keys(depotMap).map(k => ({
            depot: k,
            bags: depotMap[k]
        }));

        setDepotStock(depotStockData);

        // ---------------- ORDERS ----------------
        // ---------------- ORDERS ----------------
        let { data: dealers } = await supabase
            .from("dealer_master")
            .select("dealer_id, city");

        const dealerCityMap = {};
        (dealers || []).forEach(d => {
            dealerCityMap[d.dealer_id] = d.city;
        });

        let ordersDf = allOrders.map(x => ({
            ...x,
            bags: Number(x.bags || 0),
            date: x.order_date ? new Date(x.order_date) : null,
            city: dealerCityMap[x.dealer_id] || "Unknown"
        }));
        // 🔥 APPLY DATE FILTER (VERY IMPORTANT)
        if (fromDate && toDate) {
            const from = new Date(fromDate);
            const to = new Date(toDate);
            to.setHours(23, 59, 59, 999);

            ordersDf = ordersDf.filter(x =>
                x.date && x.date >= from && x.date <= to
            );
        }
       

        // APPLY PRODUCT FILTER
        const filteredOrders = selectedProduct
            ? ordersDf.filter(x => x.product_name === selectedProduct)
            : ordersDf;

        

        const cityMap = {};

        filteredOrders.forEach(x => {
            const city = x.city;

            
         // using depot as city

            if (!cityMap[city]) {
                cityMap[city] = 0;
            }

            cityMap[city] += x.bags;
        });

        const cityData = Object.keys(cityMap).map(city => ({
            city,
            bags: cityMap[city]
        }));

        // sort highest first
        cityData.sort((a, b) => b.bags - a.bags);

        // save
        setCitySales(cityData);
        // 🔥 DEPOT-WISE SALES (FOR CHART)
        const depotSalesMap = {};

        filteredOrders.forEach(x => {
            const depot = x.assigned_depot || "Unknown";

            if (!depotSalesMap[depot]) {
                depotSalesMap[depot] = 0;
            }

            depotSalesMap[depot] += x.bags;
        });

        const depotSalesData = Object.keys(depotSalesMap).map(depot => ({
            depot,
            bags: depotSalesMap[depot]
        }));

        // sort highest first
        depotSalesData.sort((a, b) => b.bags - a.bags);

        // save
        setDepotSales(depotSalesData);
        // ✅ FIX

        // 🔥 PRODUCT-WISE TOTAL
        // 🔥 TOTAL SALES (ALL PRODUCTS)
        // 🔥 TOTAL SALES (ALL PRODUCTS)
        // ---------------- ORDERS BASE ----------------
              
        

        // SALES BY DEPOT
        const salesMap = {};
        filteredOrders.forEach(x => {
            salesMap[x.assigned_depot] =
                (salesMap[x.assigned_depot] || 0) + x.bags;
        });

        const salesDepot = Object.keys(salesMap).map(k => ({
            depot: k,
            bags: salesMap[k]
        }));

        const highest = salesDepot.reduce((a, b) => a.bags > b.bags ? a : b, { bags: 0 });
        const lowest = salesDepot.length
            ? salesDepot.reduce((a, b) => a.bags < b.bags ? a : b)
            : { depot: "NA", bags: 0 };
        

        // ---------------- SALES ----------------
        const totalSales = filteredOrders.reduce((sum, x) => sum + x.bags, 0);
        const totalSalesMT = totalSales / 20;

        // ---------------- CONTRIBUTION ----------------
        const overallSales = allOrders.reduce((sum, x) => sum + x.bags, 0);

        const selectedSales = selectedProduct
            ? filteredOrders.reduce((sum, x) => sum + x.bags, 0)
            : overallSales;
        

        const selectedContribution = overallSales > 0
            ? ((selectedSales / overallSales) * 100).toFixed(1)
            : 0;
        // ---------------- KPI SET ----------------
        setKpi({
            totalStock,
            totalDepots: depots.length,
            avgStock: depots.length ? totalStock / depots.length : 0,
            topDepot: highest.depot || "NA",
            topBags: highest.bags || 0,
            lowDepot: lowest.depot || "NA",
            lowBags: lowest.bags || 0,

            // 🔥 ADD THIS
            productContribution: selectedContribution,
            totalSalesMT: totalSalesMT
            
        });
            const dealerMap = {};

            filteredOrders.forEach(x => {
                const dealer = x.dealer_id || "Unknown";

                dealerMap[dealer] = (dealerMap[dealer] || 0) + x.bags;
            });

            const dealerSalesData = Object.keys(dealerMap)
                .map(dealer => ({
                    dealer,
                    bags: dealerMap[dealer]
                }))
                .sort((a, b) => b.bags - a.bags)
                .slice(0, 15); // Top 15 dealers

            setDealerSales(dealerSalesData);

        // ---------------- TREND ----------------
            const trendMap = {};

            filteredOrders.forEach(x => {
                const d = x.order_date?.substring(0, 10);

                if (!d) return;

                trendMap[d] = (trendMap[d] || 0) + x.bags;
            });

            const trend = Object.keys(trendMap)
                .map(date => ({
                    date,
                    bags: trendMap[date]
                }))
                .sort(
                    (a, b) => new Date(a.date) - new Date(b.date)
                );

            setTrendData(trend);
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="overall-container">

            <h2>📦 Product Dashboard</h2>

            {/* FILTER */}
            <div className="modern-filter-card">

                {/* PRODUCT */}
                <div className="filter-item">
                    <label>Select Product</label>

                    <select
                        className="modern-select"
                        value={selectedProduct}
                        onChange={(e) => setSelectedProduct(e.target.value)}
                    >
                        <option value="">Select Product</option>

                        {products.map((p, i) => (
                            <option key={i} value={p}>
                                {p}
                            </option>
                        ))}
                    </select>
                </div>

                {/* METRIC */}
                <div className="filter-item metric-filter">
                    <label>Metric</label>

                    <select
                        className="modern-select"
                        value={selectedMetric}
                        onChange={(e) => setSelectedMetric(e.target.value)}
                    >
                        <option value="MT">MT</option>
                        <option value="bags">Bags</option>
                    </select>
                </div>

                {/* FROM DATE */}
                <div className="filter-item">
                    <label>From Date</label>

                    <input
                        className="modern-input"
                        type="date"
                        value={fromDate}
                        onChange={e => setFromDate(e.target.value)}
                    />
                </div>

                {/* TO DATE */}
                <div className="filter-item">
                    <label>To Date</label>

                    <input
                        className="modern-input"
                        type="date"
                        value={toDate}
                        onChange={e => setToDate(e.target.value)}
                    />
                </div>
                <div className="filter-item">
                    <label>&nbsp;</label>

                    <button
                        className="search-btn"
                        onClick={() => {
                            setMetric(selectedMetric);
                            loadData();
                        }}
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <span className="spinner"></span>
                                Loading...
                            </>
                        ) : (
                            <>🔍 Search</>
                        )}
                    </button>
                </div>

            </div>

            {/* KPI */}
            <div className="kpi-container">

                {/* AVG STOCK */}
                <div className="kpi-card">
                    <p className="kpi-title">📦 Total Sales</p>
                    <h2 className="kpi-value">
                        {kpi.topBags !== undefined
                            ? `${convertValue(kpi.totalSalesMT * 20)} ${metricLabel}`
                            : `0 ${metricLabel}`}
                    </h2>
                </div>

                {/* TOP SELLING */}
                <div className="kpi-card">
                    <p className="kpi-title">🏆 Top Selling Depot</p>
                    <h2 className="kpi-value">{kpi.topDepot}</h2>
                    <span className="kpi-badge green">
                        ↑ {convertValue(kpi.topBags)} {metricLabel}
                    </span>
                </div>

                {/* LOWEST SELLING */}
                <div className="kpi-card">
                    <p className="kpi-title">📉 Lowest Selling Depot</p>
                    <h2 className="kpi-value">{kpi.lowDepot}</h2>
                    <span className="kpi-badge red-badge">
                        ↓ {convertValue(kpi.lowBags)} {metricLabel}
                    </span>
                </div>

                <div className="kpi-card">
                    <p className="kpi-title">📊 Product Contribution</p>
                    <h2 className="kpi-value">
                        {kpi.productContribution}%
                    </h2>
                </div>
            
                
            </div>

            {/* STOCK CHART */}
            <h3>🏭 Stock by Depot</h3>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={depotStock}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="depot" />
                    <YAxis />
                    <Tooltip
                        formatter={(v) => [`${Number(v).toFixed(1)}`, metricLabel]}
                    />
                    <Bar
                        dataKey="bags"
                        fill="#3498db"
                        name={metricLabel}
                    />
                </BarChart>
            </ResponsiveContainer>

            {/* TREND */}
            <h3>📈 Sales Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip
                        formatter={(v) => [`${Number(v).toFixed(1)}`, metricLabel]}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="bags" stroke="#e74c3c" />
                </LineChart>
            </ResponsiveContainer>
            <h3>🏙️ City-wise Sales</h3>

            <div style={{ width: "100%", overflowX: "auto" }}>
                <div style={{ width: citySales.length * 90 }}>

                    <ResponsiveContainer width="100%" height={350}>
                        <BarChart
                            data={citySales}
                            margin={{ top: 10, right: 20, left: 10, bottom: 80 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />

                            <XAxis
                                dataKey="city"
                                angle={-45}
                                textAnchor="end"
                                interval={0}
                                height={100}
                                tick={{ fontSize: 12 }}
                            />

                            <YAxis />
                            <Tooltip
                                formatter={(v) => [`${Number(v).toFixed(1)}`, metricLabel]}
                            />
                            <Bar dataKey="bags" fill="#2ecc71" />
                        </BarChart>
                    </ResponsiveContainer>

                </div>
            </div>
            <h3>🏭 Depot-wise Sales</h3>

            <div style={{ width: "100%", overflowX: "auto" }}>
                <div style={{ width: depotSales.length * 90 }}>

                    <ResponsiveContainer width="100%" height={350}>
                        <BarChart
                            data={depotSales}
                            margin={{ top: 10, right: 20, left: 10, bottom: 80 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />

                            <XAxis
                                dataKey="depot"
                                angle={-45}
                                textAnchor="end"
                                interval={0}
                                height={100}
                                tick={{ fontSize: 12 }}
                            />

                            <YAxis />
                            <Tooltip
                                formatter={(v) => [`${Number(v).toFixed(1)}`, metricLabel]}
                            />

                            <Bar dataKey="bags" fill="#3498db" />
                        </BarChart>
                    </ResponsiveContainer>

                </div>
            </div>
            <h3>🏅 Top Dealers by Sales</h3>

            <div style={{ width: "100%", overflowX: "auto" }}>
                <div style={{ width: Math.max(dealerSales.length * 90, 1200) }}>

                    <ResponsiveContainer width="100%" height={350}>
                        <BarChart
                            data={dealerSales}
                            margin={{ top: 10, right: 20, left: 10, bottom: 80 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />

                            <XAxis
                                dataKey="dealer"
                                angle={-45}
                                textAnchor="end"
                                interval={0}
                                height={100}
                                tick={{ fontSize: 12 }}
                            />

                            <YAxis />

                            <Tooltip
                                formatter={(v) => [`${Number(v).toFixed(1)}`, metricLabel]}
                            />

                            <Bar
                                dataKey="bags"
                                fill="#8b5cf6"
                                radius={[8, 8, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>

                </div>
            </div>

        </div>
    );
}

export default ProductTab;