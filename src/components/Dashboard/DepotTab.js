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
    Cell,
    PieChart,
    Pie,
    Legend
} from "recharts";


function DepotTab() {
    const [depots, setDepots] = useState([]);
    const [selectedDepot, setSelectedDepot] = useState("");

    const [depotInfo, setDepotInfo] = useState(null);
    const [stockData, setStockData] = useState([]);
    const [ordersData, setOrdersData] = useState([]);

    const [kpi, setKpi] = useState({});
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [activeDays, setActiveDays] = useState(1);
    const [utilization, setUtilization] = useState({});
    const [layoutData, setLayoutData] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState("All");
    const [searchGRN, setSearchGRN] = useState("");
    const [grid, setGrid] = useState([]);
    const [maxRow, setMaxRow] = useState(0);
    const [maxCol, setMaxCol] = useState(0);
    const [demandData, setDemandData] = useState([]);
    const [depotMaster, setDepotMaster] = useState([]);
    const [metric, setMetric] = useState("MT");
   

    // ---------------- FETCH DEPOTS ----------------
    useEffect(() => {
        const fetchDepots = async () => {
            const { data } = await supabase
                .from("depot_master")
                .select("*");

            setDepots(data || []);
        };

        fetchDepots();
    }, []);
    useEffect(() => {
        if (!selectedDepot) return;
        setGrid([]);
        setSelectedProduct("All");
        setSearchGRN("");
        

        const loadDepotData = async () => {

            // DEPOT INFO
            const { data: info } = await supabase
                .from("depot_master")
                .select("*")
                .eq("depot_code", selectedDepot)
                .single();

            setDepotInfo(info);

            // STOCK
            const { data: stock } = await supabase
                .from("depot_stock")
                .select("product_name, number_of_bags")
                .eq("depot_code", selectedDepot);

            const groupedStock = {};

            (stock || []).forEach(item => {
                if (!groupedStock[item.product_name]) {
                    groupedStock[item.product_name] = 0;
                }
                groupedStock[item.product_name] += item.number_of_bags;
            });

            const finalStock = Object.keys(groupedStock).map(key => ({
                product_name: key,
                total_bags: groupedStock[key]
            }));

            setStockData(finalStock);
            const totalUsedBags = (stock || []).reduce(
                (sum, item) => sum + (item.number_of_bags || 0),
                0
            );

            const capacityMT = info?.capacity_mt || 0;
            const totalUsedMT = totalUsedBags * 0.05; // 50kg bag
            const availableMT = capacityMT - totalUsedMT;

            const utilizationPercent =
                capacityMT > 0 ? (totalUsedMT / capacityMT) * 100 : 0;

            const utilizationLabel =
                utilizationPercent > 90
                    ? "High"
                    : utilizationPercent > 70
                        ? "Moderate"
                        : "Low";

            setUtilization({
                capacityMT,
                totalUsedMT,
                availableMT,
                totalUsedBags,
                utilization: utilizationPercent,
                utilizationLabel
            });

            // 🔥 LAYOUT (IMPORTANT - NO DATE FILTER)
            const { data: layout } = await supabase
                .from("depot_stock")
                .select("row_no, column_no, number_of_bags, product_name, sap_grn_number")
                .eq("depot_code", selectedDepot);

            setLayoutData(layout || []);

            const { data: depotGrid } = await supabase
                .from("depot_master")
                .select("max_rows, max_columns")
                .eq("depot_code", selectedDepot)
                .single();

            setMaxRow(depotGrid?.max_rows || 0);
            setMaxCol(depotGrid?.max_columns || 0);
        };

        loadDepotData();

    }, [selectedDepot]);   // ✅ ONLY DEPOT
    useEffect(() => {
        if (!selectedDepot) return;
       

        const loadOrders = async () => {

            let query = supabase
                .from("dealer_orders")
                .select("*")
                .eq("assigned_depot", selectedDepot);

            if (startDate) query = query.gte("order_date", startDate);
            if (endDate) query = query.lte("order_date", endDate);

            const { data: orders } = await query;

            setOrdersData(orders || []);         

          

            // ✅ PRODUCT-WISE DEMAND (FROM ORDERS)
            const demandMap = {};

            (orders || []).forEach((o) => {
                if (!o.product_name) return;

                if (!demandMap[o.product_name]) {
                    demandMap[o.product_name] = 0;
                }

                demandMap[o.product_name] += Number(o.bags || 0);
            });

            const demandData = Object.keys(demandMap).map((key) => ({
                product_name: key,
                demand_bags: demandMap[key],
            }));

            setDemandData(demandData);

            const safeOrders = orders || [];

            const totalOrders = safeOrders.length;

            const totalBags = safeOrders.reduce(
                (s, x) => s + (x.bags || 0),
                0
            );

            const totalWeight = safeOrders.reduce(
                (s, x) => s + (x.total_weight_mt || 0),
                0
            );

            // GLOBAL ACTIVE DAYS
            let allQuery = supabase.from("dealer_orders").select("order_date");

            if (startDate) allQuery = allQuery.gte("order_date", startDate);
            if (endDate) allQuery = allQuery.lte("order_date", endDate);

            const { data: allOrders } = await allQuery;

            const activeDates = new Set(
                (allOrders || []).map(o =>
                    new Date(o.order_date).toISOString().split("T")[0]
                )
            );

            const calculatedDays = activeDates.size || 1;
            setActiveDays(calculatedDays);

            const avgSelling = totalBags / calculatedDays;
            const avgOrderSize =
                totalOrders > 0 ? totalBags / totalOrders : 0;

            setKpi({
                avgSelling,
                avgOrderSize,
                totalOrders,
                totalWeight
            });

        };

        loadOrders();

    }, [selectedDepot, startDate, endDate]); // ✅ DATE ONLY HERE
    
    useEffect(() => {
        if (!maxRow || !maxCol) return;

        let filtered = layoutData;

        if (selectedProduct !== "All") {
            filtered = layoutData.filter(x => x.product_name === selectedProduct);
        }

        const tempGrid = Array.from({ length: maxRow }, () =>
            Array.from({ length: maxCol }, () => null)
        );

        filtered.forEach(r => {
            const row = r.row_no - 1;
            const col = r.column_no - 1;

            if (!tempGrid[row][col]) {
                tempGrid[row][col] = { stock: [] };
            }

            tempGrid[row][col].stock.push({
                bags: r.number_of_bags,
                product: r.product_name,
                grn: r.sap_grn_number
            });
        });

        setGrid(tempGrid);
    }, [layoutData, selectedProduct, maxRow, maxCol]);
    const getColor = (name) => {
        const clean = (name || "").toLowerCase().trim();

        let hash = 0;
        for (let i = 0; i < clean.length; i++) {
            hash = clean.charCodeAt(i) + ((hash << 5) - hash);
        }

        let hue = hash % 360;

        // ❌ Avoid red range (0–20 and 340–360)
        if (hue < 20 || hue > 340) {
            hue = (hue + 40) % 360; // shift away from red
        }

        return `hsl(${hue}, 60%, 55%)`;
    };

   
   
    const convertValue = (bags) => {
        const value =
            metric === "MT"
                ? bags / 20
                : bags;

        return Number(value);
    };
    const metricLabel = metric;
    
    const dealerMap = {};

    ordersData.forEach(o => {
        if (!o.dealer_id) return; // safety

        if (!dealerMap[o.dealer_id]) {
            dealerMap[o.dealer_id] = 0;
        }

        dealerMap[o.dealer_id] += o.bags || 0;
    });

    const dealerChartData = Object.keys(dealerMap).map(key => ({
        dealer_id: key,
        bags: dealerMap[key]
    }));
    const chartWidth = Math.max(dealerChartData.length * 80, 300);
    const depotDispatched = ordersData.filter(
        x =>
            String(x.status || "")
                .trim()
                .toLowerCase() === "dispatched"
    ).length;

    const depotPending = ordersData.filter(
        x =>
            String(x.status || "")
                .trim()
                .toLowerCase() === "created"
    ).length;

    const depotStatusData = [
        {
            name: "Dispatched",
            value: depotDispatched
        },
        {
            name: "Pending",
            value: depotPending
        }
    ];

    const STATUS_COLORS = [
        "#28a745",
        "#dc3545"
    ];
    
    
    const productSalesMap = {};

    ordersData.forEach(o => {
        if (!o.product_name) return;

        if (!productSalesMap[o.product_name]) {
            productSalesMap[o.product_name] = 0;
        }

        productSalesMap[o.product_name] += o.bags || 0;
    });
    const daysToEmptyData = stockData.map(item => {
        const sales = productSalesMap[item.product_name] || 0;

        const avgDaily = activeDays > 0 ? sales / activeDays : 0;

        const days =
            avgDaily > 0
                ? Number(item.total_bags / avgDaily).toFixed(1)
                : null;

        return {
            product: item.product_name,
            stock: item.total_bags,
            avgDaily: avgDaily > 0 ? avgDaily.toFixed(1) : "No Sales",
            daysToEmpty: days
        };
    });
    // 🔥 DEPOT LAYOUT DATA
    
    const selectedDepotData = depots.find(
        d => d.depot_code === selectedDepot
    );
    return (
        <div className="overall-container">
            {/* DATE FILTER */}
            <div className="section">
                <h3>📅 Filter by Date</h3>

                <div className="filter-row compact-filter-row">
                    <div className="modern-filter-card overall-filter-card">

                        {/* FROM DATE */}
                        <div className="filter-item">
                            <label>From Date</label>

                            <input
                                className="modern-input"
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                            />
                        </div>

                        {/* TO DATE */}
                        <div className="filter-item">
                            <label>To Date</label>

                            <input
                                className="modern-input"
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                            />
                        </div>

                     
                        {/* METRIC */}
                        <div className="filter-item metric-filter">
                            <label>Metric</label>

                            <select
                                className="modern-select"
                                value={metric}
                                onChange={(e) => setMetric(e.target.value)}
                            >
                                <option value="bags">Bags</option>
                                <option value="MT">MT</option>
                            </select>
                        </div>

                    </div>
                    
                </div>
            </div>

            {/* DEPOT SELECT */}
            <h3>🏭 Select Depot</h3>
            <select className="modern-select"
                value={selectedDepot}
                onChange={(e) => setSelectedDepot(e.target.value)}
            >
                <option value="">Select</option>
                {depots.map((d, i) => (
                    <option key={i} value={d.depot_code}>
                        {d.depot_code}
                    </option>
                ))}
            </select>

            {/* DEPOT INFO */}
            {/* HEADER */}
            <h1 className="dashboard-title">
                🏭 Depot Dashboard - {selectedDepot}
            </h1>

            <div className="welcome-bar">
                Welcome Admin
            </div>

            {/* DEPOT INFO CARD */}
            {/* DEPOT INFO + STATUS CHART */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 420px",
                    gap: "20px",
                    alignItems: "stretch",
                    marginBottom: "20px"
                }}
            >

                {/* LEFT - DEPOT INFO */}
                <div className="depot-card">

                    <h2>🏢 Depot Information</h2>

                    {depotInfo && (
                        <div className="depot-details">
                            <p>
                                <strong>🏢 Depot Name:</strong>
                                {" "}
                                {depotInfo.depot_name}
                            </p>

                            <p>
                                <strong>📍 Address:</strong>
                                {" "}
                                {depotInfo.address}
                            </p>

                            <p>
                                <strong>🏙 City:</strong>
                                {" "}
                                {depotInfo.city}
                            </p>

                            <p>
                                <strong>📦 Capacity:</strong>
                                {" "}
                                {depotInfo.capacity_mt} MT
                            </p>
                        </div>
                    )}

                </div>

                {/* RIGHT - PIE CHART */}
                <div className="depot-card">

                    <h2>📊 Order Status</h2>

                    <ResponsiveContainer width="100%" height={260}>

                        <PieChart>

                            <Pie
                                data={depotStatusData}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={5}
                                minAngle={5}
                                label={false}
                            >

                                {depotStatusData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={STATUS_COLORS[index]}
                                    />
                                ))}

                            </Pie>

                            <Tooltip
                                formatter={(value, name) => [
                                    `${value} Orders`,
                                    name
                                ]}
                            />

                            <Legend />

                        </PieChart>

                    </ResponsiveContainer>

                </div>

            </div>
            {/* KPI */}
            <div className="kpi-container">

                <div className="kpi-card">
                    <div className="kpi-title">📈 Avg Dispatch Quantity</div>

                    <div className="kpi-value">
                        {Number(convertValue(kpi.avgSelling || 0)).toLocaleString(undefined, {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1
                        })}
                    </div>

                    <div className="kpi-sub">
                        {metricLabel}/day
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-title">📦 Avg Order Size</div>
                    <div className="kpi-value">{Number(convertValue(kpi.avgOrderSize || 0)).toFixed(1)}</div>
                    <div className="kpi-sub">{metricLabel}/order</div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-title">📦 Total Orders</div>
                    <div className="kpi-value">{kpi.totalOrders}</div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-title">⚖️ Total Sold</div>
                    <div className="kpi-value">
                        {metric === "MT"
                            ? Number(kpi.totalWeight || 0).toFixed(1)
                            : Number((kpi.totalWeight || 0) * 20).toLocaleString()}
                    </div>
                    <div className="kpi-sub">{metricLabel}</div>
                </div>

            </div>
            {/* 🚀 DEPOT UTILIZATION */}
            <h3>🏭 Depot Utilization</h3>

            {/* Progress Bar */}
            <div style={{
                height: "8px",
                background: "#ddd",
                borderRadius: "10px",
                overflow: "hidden",
                marginBottom: "10px"
            }}>
                <div
                    style={{
                        width: `${utilization.utilization || 0}%`,
                        height: "100%",
                        background:
                            utilization.utilization > 90
                                ? "#e74c3c"
                                : utilization.utilization > 70
                                    ? "#f39c12"
                                    : "#27ae60"
                    }}
                />
            </div>

            {/* Status */}
            <div style={{
                background: "#f4e7a1",
                padding: "10px",
                borderRadius: "8px",
                marginBottom: "15px",
                fontWeight: "500"
            }}>
                {utilization.utilizationLabel || "Low"}:{" "}
                {utilization.utilization?.toFixed(1) || 0}%
            </div>

            {/* Cards */}
            <div className="metrics-grid overall-modern-kpi-grid">

                <div className="modern-kpi-card blue">
                    <div className="kpi-top">
                        <span>Depot Capacity</span>
                        <div className="kpi-icon">🏭</div>
                    </div>

                    <h2>
                        {metric === "MT"
                            ? (utilization.capacityMT?.toFixed(1) || 0)
                            : (((utilization.capacityMT || 0) * 1000) / 50).toFixed(0)
                        }
                    </h2>

                    <div className="kpi-bottom">
                        {metric} Capacity
                    </div>
                </div>

                <div className="modern-kpi-card green">
                    <div className="kpi-top">
                        <span>Used Storage</span>
                        <div className="kpi-icon">📦</div>
                    </div>

                    <h2>
                        {metric === "MT"
                            ? (utilization.totalUsedMT?.toFixed(1) || 0)
                            : (utilization.totalUsedBags || 0).toFixed(0)
                        }
                    </h2>

                    <div className="kpi-bottom">
                        {metric} Utilized
                    </div>
                </div>

                <div className="modern-kpi-card teal">
                    <div className="kpi-top">
                        <span>Available Space</span>
                        <div className="kpi-icon">🟩</div>
                    </div>

                    <h2>
                        {metric === "MT"
                            ? (utilization.availableMT?.toFixed(1) || 0)
                            : (((utilization.availableMT || 0) * 1000) / 50).toFixed(0)
                        }
                    </h2>

                    <div className="kpi-bottom">
                        {metric} Remaining
                    </div>
                </div>

                <div className="modern-kpi-card purple">
                    <div className="kpi-top">
                        <span>Depot Area</span>
                        <div className="kpi-icon">📐</div>
                    </div>

                    <h2>
                        {selectedDepotData?.area_sqft || 0}
                    </h2>

                    <div className="kpi-bottom">
                        sq.ft Storage Area
                    </div>
                </div>

            </div>

            {/* STOCK CHART */}
            <h3>📦 Product-wise Stock</h3>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stockData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                        dataKey="product_name"
                        angle={-30}
                        textAnchor="end"
                        interval={0}
                        height={80}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value) =>
                            value.length > 15 ? value.substring(0, 15) + "..." : value
                        }
                    />
                    <YAxis />
                    <Tooltip
                        formatter={(v) => `${convertValue(v)} ${metricLabel}`}
                    />
                    <Bar dataKey="total_bags">
                        {stockData.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={getColor(entry.product_name)}
                                stroke={entry.total_bags < 300 ? "#e74c3c" : "none"}
                                strokeWidth={entry.total_bags < 300 ? 3 : 0}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
            <h3>⏳ Days to Empty</h3>

            <div className="table-container">
                <table className="modern-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Product</th>
                            <th>Stock</th>
                            <th>Avg Daily Sales</th>
                            <th>Days to Empty</th>
                        </tr>
                    </thead>

                    <tbody>
                        {daysToEmptyData.map((row, i) => (
                            <tr key={i}>
                                <td>{i}</td>
                                <td>{row.product}</td>
                                <td>{convertValue(row.stock)} {metricLabel}</td>
                                <td>
                                    {row.avgDaily === "No Sales"
                                        ? "No Sales"
                                        : `${convertValue(Number(row.avgDaily))} ${metricLabel}`}
                                </td>
                                <td>
                                    <span
                                        style={{
                                            padding: "4px 10px",
                                            borderRadius: "10px",
                                            fontSize: "12px",
                                            fontWeight: "bold",
                                            color: "white",
                                            background:
                                                row.daysToEmpty === null || row.daysToEmpty === "-"
                                                    ? "#e74c3c" // 🔴 No Sales = Critical
                                                    : Number(row.daysToEmpty) < 5
                                                        ? "#e74c3c"
                                                        : Number(row.daysToEmpty) < 15
                                                            ? "#f39c12"
                                                            : "#27ae60"
                                        }}
                                    >
                                        {row.daysToEmpty === null || row.daysToEmpty === "-"
                                            ? "No Sales"
                                            : `${row.daysToEmpty} days`}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <h3>📦 Product-wise Demand</h3>

            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={demandData}>
                    <CartesianGrid strokeDasharray="3 3" />

                    <XAxis dataKey="product_name" />
                    <YAxis />
                    <Tooltip
                        formatter={(v) => `${convertValue(v)} ${metricLabel}`}
                    />

                    <Bar dataKey="demand_bags" fill="#e67e22" />
                </BarChart>
            </ResponsiveContainer>
            {/* DEALER ORDERS */}
            <h3>📊 Dealer Orders</h3>

            <div style={{ overflowX: "auto" }}>
                <div style={{ width: chartWidth }}>

                    <BarChart
                        width={chartWidth}
                        height={350}
                        data={dealerChartData}
                    >
                        <CartesianGrid strokeDasharray="3 3" />

                        <XAxis
                            dataKey="dealer_id"
                            angle={-45}
                            textAnchor="end"
                            interval={0}
                            height={100}
                            tick={{ fontSize: 10 }}
                        />

                        <YAxis />
                        <Tooltip
                            formatter={(v) => `${convertValue(v)} ${metricLabel}`}
                        />

                        <Bar dataKey="bags" fill="#3498db" />

                    </BarChart>

                </div>
            </div>
            {/* ================= DEPOT LAYOUT ================= */}
            <h3>📍 Depot Layout</h3>

            <div style={{ marginBottom: "10px" }}>
                <select className="modern-select"
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                >
                    <option>All</option>
                    {[...new Set(layoutData.map(x => x.product_name))].map((p, i) => (
                        <option key={i}>{p}</option>
                    ))}
                </select>

                <input
                    type="text"
                    placeholder="Search GRN"
                    value={searchGRN}
                    onChange={(e) => setSearchGRN(e.target.value)}
                    style={{ marginLeft: "10px" }}
                />
            </div>

            {grid.map((row, i) => (
                <div key={selectedDepot + "-" + i} style={{ marginBottom: "10px" }}>
                    <b>Row {i + 1}</b>

                    <div style={{ display: "flex", gap: "6px" }}>
                        {row.map((cell, j) => {

                            let totalBags = 0;
                            let grnBags = 0;

                            if (cell) {
                                totalBags = cell.stock.reduce((s, x) => s + x.bags, 0);

                                if (searchGRN) {
                                    grnBags = cell.stock
                                        .filter(x => x.grn === searchGRN)
                                        .reduce((s, x) => s + x.bags, 0);
                                } else {
                                    grnBags = totalBags;
                                }
                            }

                            const bags = searchGRN ? grnBags : totalBags;

                            let color = "#ecf0f1";

                            if (searchGRN) {
                                color = grnBags > 0 ? "#3498db" : "#ecf0f1";
                            } else {
                                if (totalBags === 0) color = "#e74c3c";
                                else if (totalBags < 10) color = "#f39c12";
                                else color = "#27ae60";
                            }

                            return (
                                <div
                                    key={selectedDepot + "-" + i + "-" + j}
                                    style={{
                                        width: "70px",
                                        height: "80px",
                                        background: color,
                                        borderRadius: "8px",
                                        color: "white",
                                        display: "flex",
                                        flexDirection: "column",
                                        justifyContent: "center",
                                        alignItems: "center",
                                        fontSize: "12px"
                                    }}
                                >
                                    <div>R{i + 1}-C{j + 1}</div>
                                    <div style={{ fontSize: "16px", fontWeight: "bold" }}>
                                        {convertValue(bags)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

        </div>
    );
}

export default DepotTab;