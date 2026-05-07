import React, { useEffect, useState } from "react";
import axios from "axios";
import { supabase } from "../../supabaseClient";

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    ResponsiveContainer,
    Legend,
    ReferenceLine
} from "recharts";

function AnalyticsTab() {

    // ===== MODELS =====
    const [overallModel, setOverallModel] = useState("arima");
    const [productModel, setProductModel] = useState("arima");
    const [depotModel, setDepotModel] = useState("arima");

    // ===== SPLITS =====
    const [overallSplit, setOverallSplit] = useState(0.8);
    const [productSplit, setProductSplit] = useState(0.8);
    const [depotSplit, setDepotSplit] = useState(0.8);

    // ===== FILTERS =====
    const [products, setProducts] = useState([]);
    const [depots, setDepots] = useState([]);
    const [cities, setCities] = useState([]);

    const [selectedProduct, setSelectedProduct] = useState("");
    const [selectedDepot, setSelectedDepot] = useState("");
    const [selectedCity, setSelectedCity] = useState("");

    // ===== UNIT =====
    const [unit, setUnit] = useState("bags");

    // ===== FORECAST DATA =====
    const [overallData, setOverallData] = useState([]);
    const [productData, setProductData] = useState([]);
    const [depotData, setDepotData] = useState([]);
    const [overallAvg, setOverallAvg] = useState(0);
    const [productAvg, setProductAvg] = useState(0);
    const [depotAvg, setDepotAvg] = useState(0);
    

    const [bestModel, setBestModel] = useState("");

    const [bestSplit, setBestSplit] = useState(0);

    const [customData, setCustomData] = useState([]);

    const [customMetrics, setCustomMetrics] = useState({});
    const [customAvg, setCustomAvg] = useState(0);
    const [smartCity, setSmartCity] = useState("");

    const [smartDepot, setSmartDepot] = useState("");

    const [smartProduct, setSmartProduct] = useState("");
    const [smartProductOptions,
        setSmartProductOptions] = useState([]);

    const [smartDepotOptions,
        setSmartDepotOptions] = useState([]);

    const [smartCityOptions,
        setSmartCityOptions] = useState([]);
    

  
    
    

    // ===== METRICS =====
    const [metrics, setMetrics] = useState({
        overall: {},
        product: {},
        depot: {}
    });

    useEffect(() => {

        loadAnalytics();

    }, [
        overallModel,
        productModel,
        depotModel,
        overallSplit,
        productSplit,
        depotSplit,
        selectedProduct,
        selectedDepot,
        selectedCity,
        smartCity,
        smartDepot,
        smartProduct,
        unit      
        
    ]);

    // ===== PYTHON API =====
    const runForecast = async (
        trend,
        model,
        splitRatio
    ) => {

        if (!trend || trend.length < 5) {
            return {
                data: [],
                metrics: {}
            };
        }

        try {

            const response = await axios.post("https://admin-fastapi-backend.onrender.com/forecast"
                ,
                {
                    values: trend.map(x => x.value),
                    dates: trend.map(x => x.date),
                    model: model,
                    future_days: 7,
                    split_ratio: splitRatio
                }
            );

            return response.data;

        } catch (err) {

            console.log(err);

            return {
                data: [],
                metrics: {}
            };
        }
    };
    const models = [
        "arima",
        "sarima",
        "holt",
        "prophet"
    ];

    const splits = [
        0.6,
        0.7,
        0.75,
        0.8,
        0.85,
        0.9
    ];
    const findBestForecast = async (trend) => {

        let best = null;

        for (const model of models) {

            for (const split of splits) {

                try {

                    const result =
                        await runForecast(
                            trend,
                            model,
                            split
                        );

                    const mape =
                        result?.metrics?.mape || 999999;

                    if (
                        !best ||
                        mape < best.metrics.mape
                    ) {

                        best = {
                            ...result,
                            bestModel: model,
                            bestSplit: split
                        };
                    }

                } catch (err) {

                    console.log(
                        "Forecast Failed",
                        model,
                        split
                    );
                }
            }
        }

        return best;
    };
    // ===== MAIN LOAD =====
    const loadAnalytics = async () => {

        // ===== DEALERS =====
        let { data: dealers } = await supabase
            .from("dealer_master")
            .select("dealer_id, city");

        const dealerCityMap = {};

        (dealers || []).forEach(d => {
            dealerCityMap[d.dealer_id] = d.city;
        });

        // ===== ORDERS =====
        let { data: orders } = await supabase
            .from("dealer_orders")
            .select("*")
            .order("order_date", {
                ascending: false
            });
        const ordersDf = (orders || []).map(x => ({

            ...x,

            depot: x.assigned_depot || "Unknown",

            city:
                dealerCityMap[x.dealer_id] || "Unknown",

            bags:
                Number(x.bags || 0),

            mt:
                Number(x.total_weight_mt || 0),

            date:
                x.order_date
                    ? new Date(x.order_date)
                    : null
        }));

        // ===== VALUE CONVERTER =====
        const getValue = (x) => {

            return unit === "mt"
                ? x.mt
                : x.bags;
        };

        // ===== CITY LIST =====
        const cityList = [

            ...new Set(

                ordersDf
                    .map(x => x.city)
                    .filter(
                        c => c && c !== "Unknown"
                    )
            )
        ];

        setCities(cityList);

        // ===== PRODUCT LIST =====
        const productList = [

            ...new Set(

                ordersDf
                    .map(x => x.product_name)
            )
        ];

        setProducts(productList);

        // ===== DEPOT LIST =====
        const depotList = [

            ...new Set(

                ordersDf
                    .map(x => x.depot)
                    .filter(
                        d => d && d !== "Unknown"
                    )
            )
        ];

        setDepots(depotList);

        // ===== FILTERS =====

        const filteredCityData =
            selectedCity
                ? ordersDf.filter(
                    x => x.city === selectedCity
                )
                : ordersDf;

        const filteredProductData =
            selectedProduct
                ? ordersDf.filter(
                    x =>
                        x.product_name ===
                        selectedProduct
                )
                : ordersDf;

        const filteredDepotData =
            selectedDepot
                ? ordersDf.filter(
                    x => x.depot === selectedDepot
                )
                : ordersDf;
        const customFilteredData =
            ordersDf.filter(x => {

                const cityOk =
                    !smartCity ||
                    x.city === smartCity;

                const productOk =
                    !smartProduct ||
                    x.product_name ===
                    smartProduct;

                const depotOk =
                    !smartDepot ||
                    x.depot === smartDepot;

                return (
                    cityOk &&
                    productOk &&
                    depotOk
                );
            });
        // ===== SMART CITY OPTIONS =====

        const smartCities = [

            ...new Set(

                ordersDf
                    .filter(x => {

                        const productOk =
                            !smartProduct ||
                            x.product_name === smartProduct;

                        const depotOk =
                            !smartDepot ||
                            x.depot === smartDepot;

                        return (
                            productOk &&
                            depotOk
                        );
                    })

                    .map(x => x.city)

                    .filter(Boolean)
            )
        ];

        // ===== SMART PRODUCT OPTIONS =====

        const smartProducts = [

            ...new Set(

                ordersDf
                    .filter(x => {

                        const cityOk =
                            !smartCity ||
                            x.city === smartCity;

                        const depotOk =
                            !smartDepot ||
                            x.depot === smartDepot;

                        return (
                            cityOk &&
                            depotOk
                        );
                    })

                    .map(x => x.product_name)

                    .filter(Boolean)
            )
        ];

        // ===== SMART DEPOT OPTIONS =====

        const smartDepots = [

            ...new Set(

                ordersDf
                    .filter(x => {

                        const cityOk =
                            !smartCity ||
                            x.city === smartCity;

                        const productOk =
                            !smartProduct ||
                            x.product_name === smartProduct;

                        return (
                            cityOk &&
                            productOk
                        );
                    })

                    .map(x => x.depot)

                    .filter(Boolean)
            )
        ];

        // ===== TREND BUILDER =====
        const buildTrend = (data) => {

            const map = {};

            data.forEach(x => {

                if (!x.date) return;

                const d =
                    x.date
                        .toISOString()
                        .split("T")[0];

                map[d] =
                    (map[d] || 0)
                    + getValue(x);
            });

            return Object.keys(map)

                .map(k => ({
                    date: k,
                    bags: map[k],
                    value: map[k]
                }))

                .sort(
                    (a, b) =>
                        new Date(a.date)
                        - new Date(b.date)
                );
        };

        // ===== BUILD TRENDS =====

        const overallTrend =
            buildTrend(filteredCityData);

        const productTrend =
            buildTrend(filteredProductData);

        const depotTrend =
            buildTrend(filteredDepotData);
        const customTrend =
            buildTrend(customFilteredData);

        // ===== PYTHON FORECASTS =====

        const [
            overall,
            product,
            depot
        ] = await Promise.all([

            runForecast(
                overallTrend,
                overallModel,
                overallSplit
            ),

            runForecast(
                productTrend,
                productModel,
                productSplit
            ),

            runForecast(
                depotTrend,
                depotModel,
                depotSplit
            )
        ]);
        const custom =
            await findBestForecast(
                customTrend
            );
        const overallAverage =
            overall.data.length > 0
                ? overall.data.reduce(
                    (s, x) =>
                        s + (x.actual || 0),
                    0
                ) / overall.data.length
                : 0;

        const productAverage =
            product.data.length > 0
                ? product.data.reduce(
                    (s, x) =>
                        s + (x.actual || 0),
                    0
                ) / product.data.length
                : 0;

        const depotAverage =
            depot.data.length > 0
                ? depot.data.reduce(
                    (s, x) =>
                        s + (x.actual || 0),
                    0
                ) / depot.data.length
                : 0;
        setOverallAvg(overallAverage);
        setProductAvg(productAverage);
        setDepotAvg(depotAverage);
        const overallWithAvg =
            (overall.data || []).map(x => ({
                ...x,
                average: overallAverage
            }));

        setOverallData(overallWithAvg);

        // ===== SET DATA =====

        
        const productWithAvg =
            (product.data || []).map(x => ({
                ...x,
                average: productAverage
            }));

        setProductData(productWithAvg);
      
        const depotWithAvg =
            (depot.data || []).map(x => ({
                ...x,
                average: depotAverage
            }));

        setDepotData(depotWithAvg);
        const customAverage =
            custom.data?.length > 0

                ? custom.data.reduce(
                    (s, x) =>
                        s + (x.actual || 0),
                    0
                ) / custom.data.length

                : 0;

        setCustomAvg(customAverage);

        const customWithAvg =
            (custom.data || []).map(x => ({
                ...x,
                average: customAverage
            }));

        setCustomData(customWithAvg);

        setCustomMetrics(
            custom.metrics || {}
        );

        setBestModel(
            custom.bestModel || ""
        );

        setBestSplit(
            custom.bestSplit || 0
        );
        setSmartProductOptions(
            smartProducts
        );

        setSmartDepotOptions(
            smartDepots
        );

        setSmartCityOptions(
            smartCities
        );
       

            // ===== METRICS =====

            setMetrics({

                overall:
                    overall.metrics || {},

                product:
                    product.metrics || {},

                depot:
                    depot.metrics || {}
            });

            };
   
    
    return (

        <div className="overall-container">

            <h2>📊 Analytics Dashboard</h2>

            {/* ===== GLOBAL ===== */}

            <div
                style={{
                    display: "flex",
                    gap: "20px",
                    marginBottom: "20px"
                }}
            >

                <select
                    value={unit}
                    onChange={(e) =>
                        setUnit(e.target.value)
                    }
                >
                    <option value="bags">
                        Bags
                    </option>

                    <option value="mt">
                        Metric Tons (MT)
                    </option>
                </select>

            </div>

            {/* ===== OVERALL ===== */}

            <h3>
                📊 Overall Forecast
                (
                MAPE:
                {metrics.overall?.mape}% |

                RMSE:
                {metrics.overall?.rmse} |

                MAE:
                {metrics.overall?.mae}
                )
            </h3>

            <div
                style={{
                    marginBottom: "10px"
                }}
            >

                <label>Select City: </label>

                <select
                    value={selectedCity}
                    onChange={(e) =>
                        setSelectedCity(
                            e.target.value
                        )
                    }
                >

                    <option value="">
                        All Cities
                    </option>

                    {cities.map(c => (

                        <option
                            key={c}
                            value={c}
                        >
                            {c}
                        </option>
                    ))}
                </select>

                <select
                    value={overallModel}
                    onChange={(e) =>
                        setOverallModel(
                            e.target.value
                        )
                    }
                >

                    <option value="arima">
                        ARIMA
                    </option>

                    <option value="sarima">
                        SARIMA
                    </option>

                    <option value="holt">
                        Holt-Winters
                    </option>
                    <option value="prophet">
                        Prophet Trend
                    </option>

                </select>

                <div
                    style={{
                        marginTop: "5px"
                    }}
                >

                    Train %:
                    {Math.round(
                        overallSplit * 100
                    )}

                    <input
                        type="range"
                        min="0.6"
                        max="0.9"
                        step="0.05"
                        value={overallSplit}
                        onChange={(e) =>
                            setOverallSplit(
                                Number(e.target.value)
                            )
                        }
                    />
                </div>
            </div>

            <ResponsiveContainer
                width="100%"
                height={250}
            >

                <LineChart data={overallData}>

                    <CartesianGrid
                        strokeDasharray="3 3"
                    />

                    <XAxis dataKey="date" />

                    <YAxis
                        label={{
                            value:
                                unit === "mt"
                                    ? "MT"
                                    : "Bags",
                            angle: -90,
                            position:
                                "insideLeft"
                        }}
                    />

                    <Tooltip
                        formatter={(value, name) => {

                            if (name === "actual")
                                return [
                                    `${Number(value).toFixed(2)}`,
                                    "Actual"
                                ];

                            if (name === "forecast")
                                return [
                                    `${Number(value).toFixed(2)}`,
                                    "Forecast"
                                ];

                            if (name === "average")
                                return [
                                    `${Number(value).toFixed(2)}`,
                                    "Average"
                                ];

                            return [value, name];
                        }}
                    />

                    <Legend />
                    <ReferenceLine
                        y={overallAvg}
                        stroke="red"
                        strokeDasharray="5 5"
                        label="Average"
                    />

                    <Line
                        dataKey="actual"
                        stroke="#000"
                    />
                    <Line
                        type="monotone"
                        dataKey="average"
                        stroke="red"
                        strokeDasharray="5 5"
                        dot={false}
                    />

                    <Line
                        dataKey="forecast"
                        stroke="#3498db"
                        strokeWidth={3}
                        connectNulls={true}
                        strokeDasharray="5 5"
                    />

                </LineChart>

            </ResponsiveContainer>

            {/* ===== PRODUCT ===== */}
            <h3>
                📦 Product Forecast
                (
                MAPE:
                {metrics.product?.mape}% |

                RMSE:
                {metrics.product?.rmse}|
                MAE:
                {metrics.product?.mae}
                )
                
            </h3>
            <div
                style={{
                    marginTop: "20px",
                    marginBottom: "10px"
                }}
            >

                <label>
                    Select Product:
                </label>

                <select
                    value={selectedProduct}
                    onChange={(e) =>
                        setSelectedProduct(
                            e.target.value
                        )
                    }
                >

                    <option value="">
                        All Products
                    </option>

                    {products.map((p, i) => (

                        <option
                            key={i}
                            value={p}
                        >
                            {p}
                        </option>
                    ))}
                </select>

                <select
                    value={productModel}
                    onChange={(e) =>
                        setProductModel(
                            e.target.value
                        )
                    }
                >

                    <option value="arima">
                        ARIMA
                    </option>

                    <option value="sarima">
                        SARIMA
                    </option>

                    <option value="holt">
                        Holt-Winters
                    </option>
                    <option value="prophet">
                        Prophet Trend
                    </option>

                </select>

                <div
                    style={{
                        marginTop: "5px"
                    }}
                >

                    Train %:
                    {Math.round(
                        productSplit * 100
                    )}

                    <input
                        type="range"
                        min="0.6"
                        max="0.9"
                        step="0.05"
                        value={productSplit}
                        onChange={(e) =>
                            setProductSplit(
                                Number(e.target.value)
                            )
                        }
                    />
                </div>
            </div>

            

            <ResponsiveContainer
                width="100%"
                height={250}
            >

                <LineChart data={productData}>

                    <CartesianGrid
                        strokeDasharray="3 3"
                    />

                    <XAxis dataKey="date" />

                    <YAxis
                        label={{
                            value:
                                unit === "mt"
                                    ? "MT"
                                    : "Bags",
                            angle: -90,
                            position:
                                "insideLeft"
                        }}
                    />

                    <Tooltip
                        formatter={(value, name) => {

                            if (name === "actual")
                                return [
                                    `${Number(value).toFixed(2)}`,
                                    "Actual"
                                ];

                            if (name === "forecast")
                                return [
                                    `${Number(value).toFixed(2)}`,
                                    "Forecast"
                                ];

                            if (name === "average")
                                return [
                                    `${Number(value).toFixed(2)}`,
                                    "Average"
                                ];

                            return [value, name];
                        }}
                    />

                    <Legend />
                    <ReferenceLine
                        y={productAvg}
                        stroke="red"
                        strokeDasharray="5 5"
                        label="Average"
                    />

                    <Line
                        dataKey="actual"
                        stroke="#000"
                    />
                    <Line
                        type="monotone"
                        dataKey="average"
                        stroke="red"
                        strokeDasharray="5 5"
                        dot={false}
                    />

                    <Line
                        dataKey="forecast"
                        stroke="#3498db"
                        strokeWidth={3}
                        connectNulls={true}
                        strokeDasharray="5 5"
                    />

                </LineChart>

            </ResponsiveContainer>

            {/* ===== DEPOT ===== */}
            
            <h3>
                🏭 Depot Forecast
                (
                MAPE:
                {metrics.depot?.mape}% |

                RMSE:
                {metrics.depot?.rmse}% |
                MAE:
                {metrics.depot?.mae}
                )
            </h3>
            <div
                style={{
                    marginTop: "20px",
                    marginBottom: "10px"
                }}
            >

                <label>
                    Select Depot:
                </label>

                <select
                    value={selectedDepot}
                    onChange={(e) =>
                        setSelectedDepot(
                            e.target.value
                        )
                    }
                >

                    <option value="">
                        All Depots
                    </option>

                    {depots.map((d, i) => (

                        <option
                            key={i}
                            value={d}
                        >
                            {d}
                        </option>
                    ))}
                </select>

                <select
                    value={depotModel}
                    onChange={(e) =>
                        setDepotModel(
                            e.target.value
                        )
                    }
                >

                    <option value="arima">
                        ARIMA
                    </option>

                    <option value="sarima">
                        SARIMA
                    </option>

                    <option value="holt">
                        Holt-Winters
                    </option>
                    <option value="prophet">
                        Prophet Trend
                    </option>

                </select>

                <div
                    style={{
                        marginTop: "5px"
                    }}
                >

                    Train %:
                    {Math.round(
                        depotSplit * 100
                    )}

                    <input
                        type="range"
                        min="0.6"
                        max="0.9"
                        step="0.05"
                        value={depotSplit}
                        onChange={(e) =>
                            setDepotSplit(
                                Number(e.target.value)
                            )
                        }
                    />
                </div>
            </div>

            

            <ResponsiveContainer
                width="100%"
                height={250}
            >

                <LineChart data={depotData}>

                    <CartesianGrid
                        strokeDasharray="3 3"
                    />

                    <XAxis dataKey="date" />

                    <YAxis
                        label={{
                            value:
                                unit === "mt"
                                    ? "MT"
                                    : "Bags",
                            angle: -90,
                            position:
                                "insideLeft"
                        }}
                    />

                    <Tooltip
                        formatter={(value, name) => {

                            if (name === "actual")
                                return [
                                    `${Number(value).toFixed(2)}`,
                                    "Actual"
                                ];

                            if (name === "forecast")
                                return [
                                    `${Number(value).toFixed(2)}`,
                                    "Forecast"
                                ];

                            if (name === "average")
                                return [
                                    `${Number(value).toFixed(2)}`,
                                    "Average"
                                ];

                            return [value, name];
                        }}
                    />

                    <Legend />
                    <ReferenceLine
                        y={depotAvg}
                        stroke="red"
                        strokeDasharray="5 5"
                        label="Average"
                    />

                    <Line
                        dataKey="actual"
                        stroke="#000"
                    />
                    <Line
                        type="monotone"
                        dataKey="average"
                        stroke="red"
                        strokeDasharray="5 5"
                        dot={false}
                    />

                    <Line
                        dataKey="forecast"
                        stroke="#3498db"
                        strokeWidth={3}
                        connectNulls={true}
                        strokeDasharray="5 5"
                    />

                </LineChart>

            </ResponsiveContainer>
            {/* ===== OVERALL ===== */}
            <h2>
                📈 Smart Forecast Explorer
            </h2>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns:
                        "1fr 1fr 1fr",
                    gap: "10px",
                    marginBottom: "15px"
                }}
            >

                {/* CITY */}

                <select
                    value={smartCity}
                    onChange={(e) =>
                        setSmartCity(
                            e.target.value
                        )
                    }
                >

                    <option value="">
                        All Cities
                    </option>

                    {smartCityOptions.map(c => (

                        <option
                            key={c}
                            value={c}
                        >
                            {c}
                        </option>
                    ))}

                </select>

                {/* PRODUCT */}

                <select
                    value={smartProduct}
                    onChange={(e) =>
                        setSmartProduct(
                            e.target.value
                        )
                    }
                >

                    <option value="">
                        All Products
                    </option>

                    {smartProductOptions.map((p, i) => (

                        <option
                            key={i}
                            value={p}
                        >
                            {p}
                        </option>
                    ))}

                </select>

                {/* DEPOT */}

                <select
                    value={smartDepot}
                    onChange={(e) =>
                        setSmartDepot(
                            e.target.value
                        )
                    }
                >

                    <option value="">
                        All Depots
                    </option>

                    {smartDepotOptions.map((d, i) => (

                        <option
                            key={i}
                            value={d}
                        >
                            {d}
                        </option>
                    ))}

                </select>

            </div>

            <h3>
                Best Model:
                {bestModel?.toUpperCase()}
            </h3>

            <h3>
                Best Train %:
                {Math.round(bestSplit * 100)}
            </h3>

            <h3>
                MAPE:
                {customMetrics?.mape}% |

                RMSE:
                {customMetrics?.rmse} |

                MAE:
                {customMetrics?.mae}
            </h3>

            <ResponsiveContainer
                width="100%"
                height={350}
            >

                <LineChart data={customData}>

                    <CartesianGrid
                        strokeDasharray="3 3"
                    />

                    <XAxis dataKey="date" />

                    <YAxis
                        label={{
                            value:
                                unit === "mt"
                                    ? "MT"
                                    : "Bags",
                            angle: -90,
                            position:
                                "insideLeft"
                        }}
                    />

                    <Tooltip
                        formatter={(value, name) => {

                            if (name === "actual")
                                return [
                                    `${Number(value).toFixed(2)}`,
                                    "Actual"
                                ];

                            if (name === "forecast")
                                return [
                                    `${Number(value).toFixed(2)}`,
                                    "Forecast"
                                ];

                            if (name === "average")
                                return [
                                    `${Number(value).toFixed(2)}`,
                                    "Average"
                                ];

                            return [value, name];
                        }}
                    />

                    <Legend />

                    <ReferenceLine
                        y={customAvg}
                        stroke="red"
                        strokeDasharray="5 5"
                        label="Average"
                    />

                    <Line
                        dataKey="actual"
                        stroke="#000"
                    />

                    <Line
                        type="monotone"
                        dataKey="average"
                        stroke="red"
                        strokeDasharray="5 5"
                        dot={false}
                    />

                    <Line
                        dataKey="forecast"
                        stroke="#3498db"
                        strokeWidth={3}
                        strokeDasharray="5 5"
                    />

                </LineChart>

            </ResponsiveContainer>
            
           

        </div>
    );
}

export default AnalyticsTab;
