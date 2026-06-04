import React, {
    useEffect,
    useState,
    useMemo
} from "react";
import { supabase } from "../../supabaseClient";
import dayjs from "dayjs";
import Select from "react-select";

import {
    BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, LineChart, Line,
    PieChart, Pie, CartesianGrid, Legend, Cell
} from "recharts";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { useMap } from "react-leaflet";  


import L from "leaflet";
import "leaflet/dist/leaflet.css";
const isValidCoord = (lat, lng) =>
    lat !== null &&
    lng !== null &&
    !isNaN(lat) &&
    !isNaN(lng);
const dealerIcon = new L.Icon({
    iconUrl: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
    iconSize: [30, 30],
});

const depotIcon = new L.Icon({
    iconUrl: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
    iconSize: [35, 35],
});
const highlightedDepotIcon = new L.Icon({
    iconUrl: "https://maps.google.com/mapfiles/ms/icons/yellow-dot.png",
    iconSize: [45, 45],
});

function FixMap({ selectedDealer, selectedDepot, dealerLocations, depotLocations, viewMode }) {
    const map = useMap();

    useEffect(() => {
       

        if (viewMode === "dealer" && selectedDealer) {
            const d = dealerLocations.find(x => x.dealer_id === selectedDealer);

            if (!d) return;

            const lat = Number(d.latitude);
            const lng = Number(d.longitude);

            if (!isValidCoord(lat, lng)) return;

            map.setView([lat, lng], 12);
        }

        if (viewMode === "depot" && selectedDepot) {
            const d = depotLocations.find(x => x.depot_code === selectedDepot);

            if (!d) return;

            const lat = Number(d.latitude);
            const lng = Number(d.longitude);

            if (!isValidCoord(lat, lng)) return;

            map.setView([lat, lng], 12);
        }

    }, [selectedDealer, selectedDepot, viewMode, dealerLocations, depotLocations, map]);

    return null;
}
function ZoomOnClick({ position }) {
    const map = useMap();

    useEffect(() => {
        if (!map) return;

        if (
            position &&
            Array.isArray(position) &&
            !isNaN(position[0]) &&
            !isNaN(position[1])
        ) {
            try {
                map.setView(position, 12);
            } catch (e) {
                console.log("Safe error prevented");
            }
        }
    }, [position, map]);   // ✅ FIXED

    return null;
}
function OverallTab() {

    // ---------------- STATE ----------------
    const [orders, setOrders] = useState([]);
    const [filteredData, setFilteredData] = useState([]);

    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [cities, setCities] = useState([]);
    const [sortOrder, setSortOrder] = useState("desc");
    const [dealerMaster, setDealerMaster] = useState([]);
    const [depotMaster, setDepotMaster] = useState([]);
    const [selectedDealer, setSelectedDealer] = useState("");
    const [selectedDepot, setSelectedDepot] = useState("");
    const [unit, setUnit] = useState("bags");
    const [selectedUnit, setSelectedUnit] = useState("bags");
    const [showDateFilter, setShowDateFilter] = useState(false);
    const [showCityFilter, setShowCityFilter] = useState(false);
   
    const [clickedPosition, setClickedPosition] = useState(null);
  
    const [viewMode, setViewMode] = useState("dealer"); // 🔥 IMPORTANT
    const [showMap, setShowMap] = useState(false);
    const [loading, setLoading] = useState(false);
    const dealerLookup = useMemo(() => {
        const map = {};

        dealerMaster.forEach(d => {
            map[d.dealer_id] = d;
        });

        return map;
    }, [dealerMaster]);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        applyFilters();
    }, [refreshKey]);
   
  

    // ---------------- FETCH + MERGE ----------------
    const fetchData = async () => {

        const { data: ordersData } = await supabase
            .from("dealer_orders")
            .select(`
                dealer_id,
                assigned_depot,
                product_name,
                bags,
                total_weight_mt,
                order_date,
                status,
                sales_person_name,
                sales_person_emp_no
            `);

        const { data: dealerData } = await supabase
            .from("dealer_master")
            .select("*");
        const { data: depots } = await supabase
            .from("depot_master")
            .select("*");

        setDepotMaster(depots);

        // 🔥 MERGE (same as pandas merge)
        const dealerMap = {};

        (dealerData || []).forEach(d => {
            dealerMap[d.dealer_id] = d;
        });

        const merged = (ordersData || []).map(order => ({
            ...order,
            city: dealerMap[order.dealer_id]?.city || null
        }));
        

        setOrders(merged);
        setFilteredData(merged);
        setFilteredData([]);
        setDealerMaster(dealerData || []);       
    };

    useEffect(() => {
        fetchData();
    }, []);
    useEffect(() => {
        setClickedPosition(null); // 🔥 prevents crash on toggle/filter
    }, [viewMode, selectedDealer, selectedDepot]);

    // ---------------- FILTER ----------------
    const applyFilters = async () => {
        setLoading(true);

        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
        let df = [...orders];

        if (startDate && endDate) {
            df = df.filter(o => {
                if (!o.order_date) return false;

                const d = dayjs(o.order_date);

                return d.isAfter(dayjs(startDate).subtract(1, "day")) &&
                    d.isBefore(dayjs(endDate).add(1, "day"));
            });
        }

        if (cities.length > 0) {
            df = df.filter(o => cities.includes(o.city));
        }

        setUnit(selectedUnit);
        setFilteredData(df);
        } finally {
            setLoading(false);
        }
    };
    const activeData = filteredData;
 
    const convertValue = (bags, mt) => {
        return unit === "MT"
            ? Number(mt || 0)
            : Number(bags || 0);
    };

    // ---------------- METRICS ----------------
    const totalOrders = activeData.length;

    const dispatched = activeData.filter(
        x =>
            String(x.status || "")
                .trim()
                .toLowerCase() === "dispatched"
    ).length;

    const pending = activeData.filter(
        x =>
            String(x.status || "")
                .trim()
                .toLowerCase() === "created"
    ).length;

    const totalQuantity = activeData.reduce(
        (a, b) =>
            a + convertValue(b.bags, b.total_weight_mt),
        0
    );
    const totalStockMT = activeData.reduce(
        (sum, o) => sum + (Number(o.total_weight_mt) || 0),
        0
    );

    const efficiency = totalOrders
        ? (dispatched / totalOrders) * 100
        : 0;

    // ---------------- GROUP ----------------
    const groupDepot = {};
    const groupProduct = {};

    activeData.forEach(o => {
        const bags = convertValue(
            o.bags,
            o.total_weight_mt
        );

        const depot = o.assigned_depot || "Unknown";
        const product = o.product_name || "Unknown";

        groupDepot[depot] = (groupDepot[depot] || 0) + bags;
        groupProduct[product] = (groupProduct[product] || 0) + bags;
    });
   
    let depotData = Object.keys(groupDepot).map(k => ({
        depot: k,
        value: groupDepot[k]
    }));
    

    // 🔽 Sorting
    depotData.sort((a, b) => {
        return sortOrder === "asc"
            ? a.value - b.value
            : b.value - a.value;
    });

    const productData = Object.keys(groupProduct).map(k => ({
        product: k,
        bags: groupProduct[k]
    }));

    // ---------------- FIXES ----------------
    const allCities = [
        ...new Set(orders.map(x => x.city).filter(Boolean))
    ].sort();
    const sortedDepot = [...depotData].sort((a, b) => b.value - a.value);
    const sortedProduct = [...productData].sort((a, b) => b.bags - a.bags);
    // ================= TOP DEALER =================
    const dealerSalesMap = {};

    activeData.forEach(o => {
        const dealer = o.dealer_id || "Unknown";

        const qty = convertValue(
            o.bags,
            o.total_weight_mt
        );

        dealerSalesMap[dealer] =
            (dealerSalesMap[dealer] || 0) + qty;
    });

    const dealerSalesData = Object.keys(dealerSalesMap).map(k => ({
        dealer: k,
        value: dealerSalesMap[k]
    }));

    const sortedDealer = [...dealerSalesData]
        .sort((a, b) => b.value - a.value);


    // ================= TOP SALES PERSON =================
    const salesPersonMap = {};

    activeData.forEach(o => {

        const salesPerson =
            o.sales_person_name ||
            o.sales_person_emp_no ||
            "Unknown";

        const qty = convertValue(
            o.bags,
            o.total_weight_mt
        );

        salesPersonMap[salesPerson] =
            (salesPersonMap[salesPerson] || 0) + qty;
    });

    const salesPersonData = Object.keys(salesPersonMap).map(k => ({
        salesPerson: k,
        value: salesPersonMap[k]
    }));

    const sortedSalesPerson = [...salesPersonData]
        .sort((a, b) => b.value - a.value);
    const trendData = useMemo(() => {
        const trendMap = {};

        activeData.forEach(o => {
            if (!o.order_date) return;

            const day = dayjs(o.order_date).format("YYYY-MM-DD");

            const qty = convertValue(
                o.bags,
                o.total_weight_mt
            );

            trendMap[day] = (trendMap[day] || 0) + qty;
        });

        return Object.keys(trendMap)
            .sort()
            .map(d => ({
                date: d,
                bags: trendMap[d]
            }));
    }, [activeData, unit]);
    const activeDealerIds = new Set(
        activeData.map(o =>
            String(o.dealer_id || "")
                .replace(/\s/g, "")
                .toLowerCase()
        )
    );

    const activeDataDealerOptions = dealerMaster.filter(d => {

        const dealerId = String(d.dealer_id || "")
            .replace(/\s/g, "")
            .toLowerCase();

        // ✅ only active dealers
        if (!activeDealerIds.has(dealerId)) {
            return false;
        }

        // city filter
        if (cities.length && !cities.includes(d.city)) {
            return false;
        }

        return true;
    });
      
    const activeDataDepotOptions = [
        ...new Set(
            orders
                .filter(o => {
                    // 📅 Date filter
                    if (startDate && new Date(o.order_date) < new Date(startDate)) return false;
                    if (endDate && new Date(o.order_date) > new Date(endDate)) return false;

                    // 🌆 City filter (via dealer)
                    if (cities.length > 0) {
                        const dealer = dealerLookup[o.dealer_id]
                        if (!dealer || !cities.includes(dealer.city)) return false;
                    }

                    return true;
                })
                .map(o => o.assigned_depot)
                .filter(Boolean)
        )
    ];

 
    
    const statusData = [
        { name: "Dispatched", value: dispatched },
        { name: "Pending", value: pending }
    ];

    
    // ✅ UNIQUE LOCATION MAP (FIXED)
    const locationMap = {};

    activeData.forEach(o => {
        const dealer = dealerLookup[o.dealer_id]

        if (!dealer || !dealer.latitude || !dealer.longitude) return;

        const key = dealer.dealer_id;

        if (!locationMap[key]) {
            locationMap[key] = {
                name: dealer.dealer_id,
                city: dealer.city || "Unknown",
                latitude: Number(dealer.latitude),
                longitude: Number(dealer.longitude),
                orders: 0
            };
        }

        locationMap[key].orders += 1;
    });

    const locationData = [];

    // 🔵 Dealers
    dealerMaster.forEach(d => {
        if (d.latitude && d.longitude) {
            locationData.push({
                lat: Number(d.latitude),
                lng: Number(d.longitude),
                type: "dealer",
                name: d.dealer_id,
                city: d.city
            });
        }
    });

    // 🔴 Depots
    depotMaster.forEach(d => {
        if (d.latitude && d.longitude) {
            locationData.push({
                lat: Number(d.latitude),
                lng: Number(d.longitude),
                type: "depot",
                name: d.depot_code
            });
        }
    });
    
    // 📍 City-wise grouping
    const cityData = useMemo(() => {
        const cityMap = {};

        activeData.forEach(o => {
            const city = o.city || "Unknown";

            const qty = convertValue(
                o.bags,
                o.total_weight_mt
            );

            cityMap[city] = (cityMap[city] || 0) + qty;
        });

        return Object.entries(cityMap).map(([name, value]) => ({
            name,
            value
        }));
    }, [activeData, unit]);

 
    
   
    const topCities = useMemo(() => {
        return [...cityData]
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [cityData]);
    const COLORS = ["#28a745", "#dc3545"]; // green = dispatched, red = pending
    
    
    const dealerLocations = useMemo(() => {
        if (!showMap) return [];

        return dealerMaster.filter(
            d => d.latitude && d.longitude
        );
    }, [showMap, dealerMaster]);
    const depotLocations = useMemo(() => {
        if (!showMap) return [];

        return depotMaster
            .filter(d =>
                d.latitude &&
                d.longitude &&
                !isNaN(Number(d.latitude)) &&
                !isNaN(Number(d.longitude))
            )
            .map(d => ({
                ...d,
                latitude: Number(d.latitude),
                longitude: Number(d.longitude),
                depot_code: d.depot_code?.trim()
            }));
    }, [showMap, depotMaster]);
    
    
    const activeDataDealers = dealerLocations.filter(loc => {

        if (!selectedDealer && !selectedDepot) return true;

        if (selectedDealer &&
            loc.dealer_id?.trim().toLowerCase() !== selectedDealer.trim().toLowerCase()
        ) return false;

        if (selectedDepot) {
            const dealer = dealerLookup[loc.dealer_id];

            // ✅ DON'T REMOVE if missing
            if (!dealer || !dealer.nearest_depot_id) return true;

            return dealer.nearest_depot_id.trim().toLowerCase() ===
                selectedDepot.trim().toLowerCase();
        }

        return true;
    });
    const activeDataDepots = depotLocations.filter(loc => {
        if (!selectedDepot) return true;

        return String(loc.depot_code).trim().toLowerCase() ===
            String(selectedDepot).trim().toLowerCase();
    });
 
        
  
    const depotMetrics = useMemo(() => {
        const metrics = {};

        activeData.forEach(o => {
            const depot = o.assigned_depot?.trim();

            if (!depot) return;

            if (!metrics[depot]) {
                metrics[depot] = {
                    orders: 0,
                    weight: 0,
                    bags: 0
                };
            }

            metrics[depot].orders += 1;
            metrics[depot].weight += Number(o.total_weight_mt || 0);
            metrics[depot].bags += Number(o.bags || 0);
        });

        return metrics;
    }, [activeData]);
    const dealerMetrics = useMemo(() => {
        const metrics = {};

        activeData.forEach(o => {
            const dealer = String(o.dealer_id || "")
                .replace(/\s/g, "")
                .toLowerCase();

            if (!dealer) return;

            if (!metrics[dealer]) {
                metrics[dealer] = {
                    orders: 0,
                    weight: 0,
                    bags: 0
                };
            }

            metrics[dealer].orders += 1;
            metrics[dealer].weight += Number(o.total_weight_mt || 0);
            metrics[dealer].bags += Number(o.bags || 0);
        });

        return metrics;
    }, [activeData]);
    const getProductBreakdown = (depotCode, dealerId) => {

        // ✅ use activeData instead of activeDataOrders
        const data = activeData.filter(o => {

            // depot popup
            if (depotCode) {
                return (
                    String(o.assigned_depot).trim().toLowerCase() ===
                    String(depotCode).trim().toLowerCase()
                );
            }

            // dealer popup
            if (dealerId) {
                return (
                    String(o.dealer_id || "")
                        .replace(/\s/g, "")
                        .toLowerCase() ===
                    String(dealerId || "")
                        .replace(/\s/g, "")
                        .toLowerCase()
                );
            }

            return false;
        });

        const result = {};

        data.forEach(o => {

            const product = o.product_name || "Unknown";

            if (!result[product]) {
                result[product] = {
                    value: 0
                };
            }

            result[product].value += convertValue(
                o.bags,
                o.total_weight_mt
            );
        });

        const finalData = Object.entries(result).map(([name, item]) => ({
            name,
            value: item.value
        }));

        // ✅ avoid fake "No Orders"
        return finalData.length > 0
            ? finalData
            : [{ name: "No Orders", value: 0 }];
    };
    const safeDealers = useMemo(() => {
        if (!showMap) return [];

        return activeDataDealers;
    }, [showMap, activeDataDealers]);

    const safeDepots = useMemo(() => {
        if (!showMap) return [];

        return activeDataDepots;
    }, [showMap, activeDataDepots]);
    const uniqueCities = new Set(
        activeData.map(x => x.city).filter(Boolean)
    ).size;

    const avgOrderSize =
        totalOrders > 0
            ? (totalQuantity / totalOrders).toFixed(2)
            : 0;
   
    
    const topDealerInfo =
        dealerLookup[sortedDealer[0]?.dealer];
    const topDepotInfo = depotMaster.find(
        d =>
            String(d.depot_code).trim().toLowerCase() ===
            String(sortedDepot[0]?.depot).trim().toLowerCase()
    );
    const dealerNameMap = useMemo(() => {
        const map = {};

        dealerMaster.forEach(d => {
            map[d.dealer_id] = d.dealer_name;
        });

        return map;
    }, [dealerMaster]);
    const dealerChartData = [...sortedDealer]
        .map(d => ({
            dealer: dealerNameMap[d.dealer] || d.dealer,
            value: d.value
        }))
        .sort((a, b) =>
            sortOrder === "asc"
                ? a.value - b.value
                : b.value - a.value
        )
        .slice(0, 20);
    const salesChartData = [...sortedSalesPerson]
        .sort((a, b) =>
            sortOrder === "asc"
                ? a.value - b.value
                : b.value - a.value
        )
        .slice(0, 20);

    const trendChartData = trendData.slice(-365);
    // ---------------- UI ----------------
    return (
        <div className="overall-container">

            <div className="modern-filter-card">

                {/* CITY */}
                <div className="filter-item">
                    <label style={{ color: "#7c3aed" }}>
                        Select City
                    </label>

                    <Select
                        options={allCities.map(c => ({
                            label: c,
                            value: c
                        }))}
                        isMulti
                        menuPortalTarget={document.body}
                        className="modern-react-select"
                        styles={{
                            menuPortal: base => ({
                                ...base,
                                zIndex: 9999
                            })
                        }}
                        placeholder="Select City"
                        onChange={(selected) =>
                            setCities(
                                selected
                                    ? selected.map(x => x.value)
                                    : []
                            )
                        }
                    />
                </div>

                {/* METRIC */}
                <div className="filter-item">
                    <label style={{ color: "#2563eb" }}>
                        Metric
                    </label>

                    <select
                        className="modern-select"
                        value={selectedUnit}
                        onChange={(e) => setSelectedUnit(e.target.value)}
                    >
                        <option value="bags">Bags</option>
                        <option value="MT">MT</option>
                    </select>
                </div>

                {/* FROM DATE */}
                <div className="filter-item">
                    <label style={{ color: "#16a34a" }}>
                        From Date
                    </label>

                    <input
                        type="date"
                        className="modern-input"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                    />
                </div>

                {/* TO DATE */}
                <div className="filter-item">
                    <label style={{ color: "#ea580c" }}>
                        To Date
                    </label>

                    <input
                        type="date"
                        className="modern-input"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                    />
                </div>

                {/* SEARCH */}
                <div className="filter-item">
                    <label>&nbsp;</label>

                    <button
                        className="search-btn"
                        onClick={() => setRefreshKey(prev => prev + 1)}
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

            {/* -------- METRICS -------- */}
            <div className="section">
                <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "20px"
                }}>
                    <h3>📊 Overall Metrics</h3>

                   
                </div>

                <div className="metrics-grid modern-kpi-grid">

                    <div className="modern-kpi-card blue">
                        <div className="kpi-top">
                            <span>Total Orders</span>
                            <div className="kpi-icon">📦</div>
                        </div>

                        <h2>{totalOrders}</h2>

                        <div className="kpi-bottom">
                            Orders Processed
                        </div>
                    </div>

                    <div className="modern-kpi-card green">
                        <div className="kpi-top">
                            <span>
                                {unit === "MT"
                                    ? "Total Weight (MT)"
                                    : "Total Bags"}
                            </span>

                            <div className="kpi-icon">⚖️</div>
                        </div>

                        <h2>
                            {unit === "MT"
                                ? totalStockMT.toFixed(2)
                                : totalQuantity.toFixed(0)}
                        </h2>

                        <div className="kpi-bottom">
                            Total Quantity
                        </div>
                    </div>

                    <div className="modern-kpi-card orange">
                        <div className="kpi-top">
                            <span>Active Dealers</span>
                            <div className="kpi-icon">🧑‍💼</div>
                        </div>

                        <h2>{new Set(activeData.map(x => x.dealer_id)).size}</h2>

                        <div className="kpi-bottom">
                            Currently Ordering
                        </div>
                    </div>

                    <div className="modern-kpi-card purple">
                        <div className="kpi-top">
                            <span>Active Depots</span>
                            <div className="kpi-icon">🏭</div>
                        </div>

                        <h2>{new Set(activeData.map(x => x.assigned_depot)).size}</h2>

                        <div className="kpi-bottom">
                            Operational Depots
                        </div>
                    </div>

                    <div className="modern-kpi-card red">
                        <div className="kpi-top">
                            <span>Pending</span>
                            <div className="kpi-icon">⏳</div>
                        </div>

                        <h2>{pending}</h2>

                        <div className="kpi-bottom">
                            Awaiting Dispatch
                        </div>
                    </div>

                    <div className="modern-kpi-card teal">
                        <div className="kpi-top">
                            <span>Dispatch Rate</span>
                            <div className="kpi-icon">🚚</div>
                        </div>

                        <h2>{efficiency.toFixed(2)}%</h2>

                        <div className="kpi-bottom">
                            Delivery Efficiency
                        </div>
                    </div>

                    <div className="modern-kpi-card dark">
                        <div className="kpi-top">
                            <span>Avg Order Size</span>
                            <div className="kpi-icon">📊</div>
                        </div>

                        <h2>{avgOrderSize} {unit}</h2>

                        <div className="kpi-bottom">
                            Per Order
                        </div>
                    </div>

                    <div className="modern-kpi-card gold">
                        <div className="kpi-top">
                            <span>Unique Cities</span>
                            <div className="kpi-icon">🌍</div>
                        </div>

                        <h2>{uniqueCities}</h2>

                        <div className="kpi-bottom">
                            Coverage Area
                        </div>
                    </div>

                </div>
            </div>

            {/* -------- TOP PERFORMERS -------- */}
            <div className="section">
                <h3>🏆 Top Performers</h3>

                <div className="top-grid">

                    <div className="top-card">
                        <span>🏭 Top Selling Depot</span>

                        <h2>
                            {sortedDepot[0]?.depot || "N/A"}
                        </h2>

                        <p className="top-name">
                            🏢 {topDepotInfo?.depot_name || "Depot Name"}
                        </p>

                        <p className="top-detail">
                            📍 {topDepotInfo?.city || "Unknown City"}
                        </p>

                        <p className="top-detail">
                            🚚 Orders: {
                                activeData.filter(
                                    o => o.assigned_depot === sortedDepot[0]?.depot
                                ).length
                            }
                        </p>

                        <div className="top-badge">
                            ↑ {(sortedDepot[0]?.value || 0).toFixed(2)} {unit}
                        </div>
                    </div>

                    <div className="top-card">
                        <span>📦 Top Selling Product</span>

                        <h2>
                            {sortedProduct[0]?.product || "N/A"}
                        </h2>

                        <div className="top-badge">
                            ↑ {(sortedProduct[0]?.bags || 0).toFixed(2)} {unit}
                        </div>
                    </div>

                    <div className="top-card">
                        <span>🤝 Top Selling Dealer</span>

                        <h2>{sortedDealer[0]?.dealer || "N/A"}</h2>

                        <p className="top-detail">
                            🏢 {topDealerInfo?.dealer_name || "Dealer Name Not Available"}
                        </p>

                        <p className="top-detail">
                            📍 {topDealerInfo?.city || "City Not Available"}
                        </p>

                        <p className="top-detail">
                            🚚 Orders: {
                                activeData.filter(
                                    o => o.dealer_id === sortedDealer[0]?.dealer
                                ).length
                            }
                        </p>

                        <div className="top-badge">
                            ↑ {(sortedDealer[0]?.value || 0).toFixed(2)} {unit}
                        </div>
                    </div>

                    <div className="top-card">
                        <span>👨‍💼 Top Sales Person</span>

                        <h2>
                            {sortedSalesPerson[0]?.salesPerson || "N/A"}
                        </h2>

                        <div className="top-badge">
                            ↑ {(sortedSalesPerson[0]?.value || 0).toFixed(2)} {unit}
                        </div>
                    </div>

                </div>

            </div>
            {/* -------- CHARTS -------- */}

            <div className="section">
                <h3>📊 Orders by Depot</h3>

                <div style={{ marginBottom: "10px" }}>
                    <label>Sort: </label>
                    <select
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value)}
                    >
                        <option value="desc">Descending</option>
                        <option value="asc">Ascending</option>
                    </select>
                </div>

                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={depotData}>
                        <XAxis dataKey="depot" />
                        <YAxis
                            label={{
                                value: unit,
                                angle: -90,
                                position: "insideLeft"
                            }}
                        />
                        <Tooltip
                            formatter={(value) => [
                                Number(value).toFixed(2),
                                unit
                            ]}
                        />
                        <Bar dataKey="value" fill="#1e6bb8" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="section">
                <h3>📊 Dealer vs Sales Person Performance</h3>
             

                <div
                    style={{
                        display: "flex",
                        gap: "20px",
                        alignItems: "flex-start"
                    }}
                >

                    {/* DEALER CHART */}
                    <div style={{ flex: 1 }}>
                        <h4>🤝 Orders by Dealer</h4>

                        <ResponsiveContainer width="100%" height={500}>
                            <BarChart
                                data={dealerChartData}
                                layout="vertical"
                                margin={{ top: 20, right: 20, left: 120, bottom: 20 }}
                            >
                                <XAxis type="number" />
                                <YAxis
                                    dataKey="dealer"
                                    type="category"
                                    width={120}
                                />
                                <Tooltip
                                    formatter={(value) => [
                                        Number(value).toFixed(0),
                                        unit
                                    ]}
                                />
                                <Bar dataKey="value" fill="#28a745" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* SALES PERSON CHART */}
                    <div style={{ flex: 1 }}>
                        <h4>👨‍💼 Orders by Sales Person</h4>

                        <ResponsiveContainer width="100%" height={500}>
                            <BarChart
                                data={salesChartData}
                                layout="vertical"
                                margin={{ top: 20, right: 20, left: 120, bottom: 20 }}
                            >
                                <XAxis type="number" />
                                <YAxis
                                    dataKey="salesPerson"
                                    type="category"
                                    width={120}
                                />
                                <Tooltip
                                    formatter={(value) => [
                                        Number(value).toFixed(0),
                                        unit
                                    ]}
                                />
                                <Bar dataKey="value" fill="#ff9800" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                </div>
            </div>

            <div className="section">
                <h3>📦 Product Demand</h3>

                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={productData}>
                        <defs>
                            <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#1e6bb8" stopOpacity={1} />
                                <stop offset="100%" stopColor="#1e6bb8" stopOpacity={0.4} />
                            </linearGradient>
                        </defs>

                        <XAxis dataKey="product" />
                        <YAxis
                            label={{
                                value: unit,
                                angle: -90,
                                position: "insideLeft"
                            }}
                        />
                        <Tooltip
                            formatter={(value) => [
                                Number(value).toFixed(2),
                                unit
                            ]}
                        />

                        <Bar
                            dataKey="bags"
                            name={unit}
                            fill="url(#blueGradient)"
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="section">
                <h3>📈 Orders Trend</h3>

                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis
                            label={{
                                value: unit,
                                angle: -90,
                                position: "insideLeft"
                            }}
                        />
                        <Tooltip
                            formatter={(value) => [
                                Number(value).toFixed(2),
                                unit
                            ]}
                        />
                        <Line
                            type="monotone"
                            dataKey="bags"
                            name={unit} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            <div className="section">
                <h3>📊 Order Insights</h3>

                <div style={{ display: "flex", gap: "40px" }}>

                    {/* LEFT - Status Pie */}
                    <div style={{ flex: 1 }}>
                        <h4 style={{ textAlign: "center", marginBottom: "10px" }}>
                            Order Status Distribution
                        </h4>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>                               
                                <Pie
                                    data={statusData}
                                    dataKey="value"
                                    nameKey="name"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={3}
                                    label={({ name, value }) => `${name}: ${value}`}
                                >
                                    {statusData.map((entry, index) => (
                                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>

                                <Tooltip
                                    formatter={(value, name) => [
                                        `${Number(value).toFixed(0)} Orders`,
                                        name
                                    ]}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* RIGHT - City Bar Chart */}
                    <div style={{ flex: 1 }}>
                        <h4 style={{ textAlign: "center" }}>Top Cities Orders</h4>

                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart
                                data={topCities}
                                layout="vertical"
                                margin={{ top: 20, right: 30, left: 60, bottom: 10 }}
                            >
                                <XAxis
                                    type="number"
                                    label={{
                                        value: unit,
                                        position: "insideBottom",
                                        offset: -5
                                    }}
                                />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    interval={0}
                                    width={250}
                                    // 🔥 give space for long names
                                />
                                <Tooltip
                                    formatter={(value) => [
                                        Number(value).toFixed(2),
                                        unit
                                    ]}
                                />
                                <Legend />

                                <Bar
                                    dataKey="value"
                                    fill="#1e6bb8"
                                    barSize={20}   // makes bars thinner → more space
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                </div>
            </div>
            <div className="section">
                <h3>🗺 Dealer & Depot Locations</h3>
                <button
                    className="btn"
                    onClick={() => setShowMap(prev => !prev)}
                    style={{ marginBottom: "15px" }}
                >
                    {showMap ? "Hide Map" : "Load Map"}
                </button>
                {showMap && (
                    <>
                        <div className="toggle-wrapper">
                            <div className="toggle-switch">
                                <div
                                    className={`toggle-slider ${viewMode === "depot" ? "right" : "left"}`}
                                />

                                <button
                                    className={`toggle-btn ${viewMode === "dealer" ? "active" : ""}`}
                                    onClick={() => setViewMode("dealer")}
                                >
                                    Dealers
                                </button>

                                <button
                                    className={`toggle-btn ${viewMode === "depot" ? "active" : ""}`}
                                    onClick={() => setViewMode("depot")}
                                >
                                    Depots
                                </button>
                            </div>
                        </div>
                

                {/* 🔥 SINGLE DYNAMIC DROPDOWN */}
                        <div style={{ marginBottom: "15px" }}>
                            <label>
                                {viewMode === "dealer" ? "Dealer:" : "Depot:"}
                            </label>
                            <br />

                            <select
                                value={viewMode === "dealer" ? selectedDealer : selectedDepot}
                                onChange={(e) => {
                                    if (viewMode === "dealer") {
                                        setSelectedDealer(e.target.value);
                                    } else {
                                        setSelectedDepot(e.target.value);
                                    }
                                }}
                            >
                                <option value="">
                                    {viewMode === "dealer" ? "All Dealers" : "All Depots"}
                                </option>

                                {viewMode === "dealer"
                                    ? activeDataDealerOptions.map(d => (
                                        <option key={d.dealer_id} value={d.dealer_id}>
                                            {d.dealer_id}
                                        </option>
                                    ))
                                    : activeDataDepotOptions.map(d => (
                                        <option key={d} value={d}>
                                            {d}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        <MapContainer
                            // ✅ ADD THIS
                            center={[13.0, 80.0]}
                            zoom={6}
                            style={{ height: "450px", width: "100%" }}
                        >
                            <ZoomOnClick position={clickedPosition} />

                            <FixMap
                                viewMode={viewMode}
                                selectedDealer={selectedDealer}
                                selectedDepot={selectedDepot}
                                dealerLocations={dealerLocations}
                                depotLocations={depotLocations}
                            />

                            <TileLayer
                                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                            />
                            {(safeDealers.length > 0 || safeDepots.length > 0) && (

                            <MarkerClusterGroup>

                                {/* 🔵 DEALERS */}
                                {viewMode === "dealer" &&
                                    safeDealers.map((loc, index) => {
                                        const lat = Number(loc.latitude);
                                        const lng = Number(loc.longitude);

                                        if (
                                            lat === null ||
                                            lng === null ||
                                            isNaN(lat) ||
                                            isNaN(lng)
                                        ) return null;

                                        return (
                                            <Marker
                                                key={`dealer-${index}`}
                                                position={[lat, lng]}
                                                icon={dealerIcon}
                                                eventHandlers={{
                                                    click: () => {
                                                        if (!isNaN(lat) && !isNaN(lng)) {
                                                            if (
                                                                !clickedPosition ||
                                                                clickedPosition[0] !== lat ||
                                                                clickedPosition[1] !== lng
                                                            ) {
                                                                setClickedPosition([lat, lng]);
                                                            }
                                                        }
                                                    }
                                                }}
                                            >
                                                <Popup>
                                                    <b>Dealer</b><br />
                                                    {loc.dealer_id}<br />
                                                    {loc.city}<br />

                                                    Orders: {
                                                        dealerMetrics[
                                                            String(loc.dealer_id || "")
                                                                .replace(/\s/g, "")
                                                                .toLowerCase()
                                                        ]?.orders || 0
                                                    }
                                                    <br />

                                                    {unit}: {
                                                        unit === "MT"
                                                            ? (
                                                                dealerMetrics[
                                                                    String(loc.dealer_id || "")
                                                                        .replace(/\s/g, "")
                                                                        .toLowerCase()
                                                                ]?.weight || 0
                                                            ).toFixed(2)
                                                            : (
                                                                dealerMetrics[
                                                                    String(loc.dealer_id || "")
                                                                        .replace(/\s/g, "")
                                                                        .toLowerCase()
                                                                ]?.bags || 0
                                                            ).toFixed(0)
                                                    }

                                                    {(() => {
                                                        const data = getProductBreakdown(null, loc.dealer_id);

                                                        return (
                                                            <PieChart width={250} height={200}>
                                                                <Pie
                                                                    data={data}
                                                                    dataKey="value"
                                                                    nameKey="name"
                                                                    outerRadius={70}
                                                                >
                                                                    {data.map((entry, i) => (
                                                                        <Cell key={i} fill={`hsl(${i * 60}, 70%, 50%)`} />
                                                                    ))}
                                                                </Pie>
                                                                <Tooltip
                                                                    formatter={(value, name) => [
                                                                        `${Number(value).toFixed(2)} ${unit}`,
                                                                        name
                                                                    ]}
                                                                />
                                                               
                                                            </PieChart>
                                                        );
                                                    })()}
                                                </Popup>
                                            </Marker>
                                        );
                                    })
                                }

                                {/* 🔴 DEPOTS */}
                                {viewMode === "depot" &&
                                    safeDepots.map((loc, index) => {
                                        const lat = Number(loc.latitude);
                                        const lng = Number(loc.longitude);

                                        if (
                                            lat === null ||
                                            lng === null ||
                                            isNaN(lat) ||
                                            isNaN(lng)
                                        ) return null;

                                        return (
                                            <Marker
                                                key={`depot-${index}`}
                                                position={[lat, lng]}
                                                icon={
                                                    selectedDepot?.trim().toLowerCase() ===
                                                        loc.depot_code?.trim().toLowerCase()
                                                        ? highlightedDepotIcon
                                                        : depotIcon
                                                }
                                                eventHandlers={{
                                                    click: () => {
                                                        if (!isNaN(lat) && !isNaN(lng)) {
                                                            if (
                                                                !clickedPosition ||
                                                                clickedPosition[0] !== lat ||
                                                                clickedPosition[1] !== lng
                                                            ) {
                                                                setClickedPosition([lat, lng]);
                                                            }
                                                        }
                                                    }
                                                }}
                                            >
                                                <Popup>
                                                    <b>Depot</b><br />
                                                    {loc.depot_code}<br />
                                                    Orders: {depotMetrics[loc.depot_code]?.orders || 0}<br />
                                                    {unit}: {
                                                        unit === "MT"
                                                            ? (depotMetrics[loc.depot_code]?.weight || 0).toFixed(2)
                                                            : (depotMetrics[loc.depot_code]?.bags || 0).toFixed(0)
                                                    }
                                                    

                                                    {(() => {
                                                        const data = getProductBreakdown(loc.depot_code, null);

                                                        return (
                                                            <PieChart width={250} height={200}>
                                                                <Pie
                                                                    data={data}
                                                                    dataKey="value"
                                                                    nameKey="name"
                                                                    outerRadius={70}
                                                                >
                                                                    {data.map((entry, i) => (
                                                                        <Cell key={i} fill={`hsl(${i * 60}, 70%, 50%)`} />
                                                                    ))}
                                                                </Pie>
                                                                <Tooltip
                                                                    formatter={(value, name) => [
                                                                        `${Number(value).toFixed(2)} ${unit}`,
                                                                        name
                                                                    ]}
                                                                />
                                                               
                                                            </PieChart>
                                                        );
                                                    })()}
                                                </Popup>
                                            </Marker>
                                        );
                                    })
                                }

                            </MarkerClusterGroup>
                            )}
                        </MapContainer>
                        
                    </>
                )}

            </div>

        </div>
    );
}

export default OverallTab;