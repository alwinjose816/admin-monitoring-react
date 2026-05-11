import React, { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";

import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ReferenceLine
} from "recharts";

function AnalyticsTab() {

    // ================= MODELS =================
    const modelOptions = [

        "arima",
        "sarima",
        "holt",
        "prophet",
        "neuralprophet",
        "xgboost",
        "lightgbm",
        "lstm",
        "gru",
        "nbeats",
        "tft",
        "ensemble",        
    ];

    const [overallModel, setOverallModel] =
        useState("arima");

    const [productModel, setProductModel] =
        useState("arima");

    const [depotModel, setDepotModel] =
        useState("arima");
    

    const [aiDepot, setAiDepot] =
        useState("");

    const [aiProduct, setAiProduct] =
        useState("");

    const [aiBestModel, setAiBestModel] =
        useState("");
    const [aiMetrics, setAiMetrics] =
        useState({});

    const [aiChartData, setAiChartData] =
        useState([]);
    const [aiUnit, setAiUnit] =
        useState("bags");

    // ================= FILTERS =================

    const [products, setProducts] =
        useState([]);
    const [aiProducts, setAiProducts] =
        useState([]);

    const [depots, setDepots] =
        useState([]);

    const [cities, setCities] =
        useState([]);

    const [selectedProduct, setSelectedProduct] =
        useState("");

    const [selectedDepot, setSelectedDepot] =
        useState("");

    const [overallCity, setOverallCity] =
        useState("");

    const [productCity, setProductCity] =
        useState("");

    const [depotCity, setDepotCity] =
        useState("");

    // ================= DATA =================

    const [overallData, setOverallData] =
        useState([]);

    const [productData, setProductData] =
        useState([]);

    const [depotData, setDepotData] =
        useState([]);

    // ================= AVERAGES =================

    const [overallAvg, setOverallAvg] =
        useState(0);

    const [productAvg, setProductAvg] =
        useState(0);

    const [depotAvg, setDepotAvg] =
        useState(0);

    // ================= METRICS =================

    const [metrics, setMetrics] =
        useState({
            overall: {},
            product: {},
            depot: {}
        });
    // ================= UNIT =================

    const [overallUnit, setOverallUnit] =
        useState("bags");

    const [productUnit, setProductUnit] =
        useState("bags");

    const [depotUnit, setDepotUnit] =
        useState("bags");

    // ================= LOAD =================

    useEffect(() => {

        loadAnalytics();

    }, [
        overallModel,
        productModel,
        depotModel,

        selectedProduct,
        selectedDepot,

        overallCity,

        aiDepot,
        aiProduct,
        aiUnit,

        overallUnit,
        productUnit,
        depotUnit
    ]);

    // ================= LOAD ANALYTICS =================

    const loadAnalytics = async () => {

        let { data } = await supabase
            .from("analytics_forecast")
            .select("*")
            .order(
                "forecast_date",
                {
                    ascending: true
                }
            );

        if (!data) return;

        // ================= ACTUAL ORDERS =================

        let orderQuery = supabase
            .from("dealer_orders")
            .select(`
                order_date,
                bags,
                total_weight_mt,
                dealer_id,
                product_name,
                assigned_depot
            `);

        const { data: dealers } = await supabase
            .from("dealer_master")
            .select(`
        dealer_id,
        city
    `);

        const dealerCityMap = {};

        (dealers || []).forEach(d => {

            dealerCityMap[d.dealer_id] = d.city;

        });

        let { data: orderData } =
            await orderQuery;

        if (!orderData)
            orderData = [];
        const filteredOrders = orderData || [];

        // ================= CITY LIST =================

        // ================= CITY LIST =================

        const { data: depotCities } = await supabase
            .from("depot_master")
            .select("city");

        const cityList = [

            ...new Set(

                (depotCities || [])
                    .map(x => x.city)
                    .filter(Boolean)
            )
        ].sort();

        setCities(cityList);

        // ================= PRODUCT LIST =================

        const productList = [

            ...new Set(

                orderData
                    .map(x => x.product_name)
                    .filter(Boolean)
            )
        ];
        setProducts(productList);
        

        // ================= DEPOT LIST =================

        const { data: depotMaster } = await supabase
            .from("depot_master")
            .select("depot_code");

        const depotList = [

            ...new Set(

                (depotMaster || [])

                    .filter(Boolean)

                    .map(x => x.depot_code)

                    .filter(Boolean)
            )
        ];

        setDepots(depotList);
        // ================= AI DEPENDENT PRODUCTS =================

        let aiProducts = [];

        if (aiDepot) {

            aiProducts = [

                ...new Set(

                    orderData
                        .filter(
                            x =>
                                x.assigned_depot === aiDepot
                        )
                        .map(
                            x => x.product_name
                        )
                        .filter(Boolean)
                )
            ];

        } else {

            aiProducts = [

                ...new Set(

                    orderData
                        .map(
                            x => x.product_name
                        )
                        .filter(Boolean)
                )
            ];
        }

        setAiProducts(aiProducts);

        // ================= FILTERS =================

        const actualRows = data.filter(
            x =>
                x.city !== null
                &&
                x.actual !== null
        );

        const forecastRows = data.filter(
            x =>
                x.city !== null
                &&
                x.model?.toLowerCase() === overallModel.toLowerCase()
                &&
                x.forecast !== null
        );
        // ================= PRODUCT FILTER =================

        const productFiltered = data.filter((x) => {

            // ================= ALL PRODUCTS =================

            if (
                !selectedProduct ||
                selectedProduct === "" ||
                selectedProduct === "All Products"
            ) {

                return (

                    x.model?.toLowerCase() ===
                    productModel.toLowerCase()

                    &&

                    x.forecast_level === "OVERALL"
                );
            }

            // ================= SINGLE PRODUCT =================

            return (

                x.model?.toLowerCase() ===
                productModel.toLowerCase()

                &&

                x.forecast_level === "DEPOT_PRODUCT"

                &&

                x.product_name === selectedProduct
            );
        });
        const productMetricFiltered = data.filter((x) => {

            // ================= ALL PRODUCTS =================

            if (
                !selectedProduct ||
                selectedProduct === "" ||
                selectedProduct === "All Products"
            ) {

                return (

                    x.model?.toLowerCase() ===
                    productModel.toLowerCase()

                    &&

                    x.forecast_level === "OVERALL"
                );
            }

            // ================= SINGLE PRODUCT =================

            return (

                x.model?.toLowerCase() ===
                productModel.toLowerCase()

                &&

                x.forecast_level === "PRODUCT"

                &&

                x.product_name === selectedProduct
            );
        });

        // ================= DEPOT FILTER =================

        const depotFiltered = data.filter((x) => {

            // ================= ALL DEPOTS =================

            if (
                !selectedDepot ||
                selectedDepot === "" ||
                selectedDepot === "All Depots"
            ) {

                return (

                    x.model?.toLowerCase() ===
                    depotModel.toLowerCase()

                    &&

                    x.forecast_level === "OVERALL"
                );
            }

            // ================= SINGLE DEPOT =================

            return (

                x.model?.toLowerCase() ===
                depotModel.toLowerCase()

                &&

                x.forecast_level === "DEPOT"

                &&

                x.depot === selectedDepot
            );
        });
        const overallFiltered = data.filter((x) => {

            // ================= ALL CITIES =================

            if (
                !overallCity ||
                overallCity === "" ||
                overallCity === "All Cities"
            ) {

                return (

                    x.model?.toLowerCase() ===
                    overallModel.toLowerCase()

                    &&

                    x.forecast_level === "OVERALL"
                );
            }

            // ================= SINGLE CITY =================

            return (

                x.model?.toLowerCase() ===
                overallModel.toLowerCase()

                &&

                x.forecast_level === "CITY"

                &&

                x.city === overallCity
            );
        });

        // ================= AI BEST MODEL =================

        const aiFiltered = data.filter((x) => {

            // MODEL REQUIRED
            if (!x.model) return false;

            // FORECAST REQUIRED
            if (x.forecast === null) return false;

            // DEPOT FILTER
            if (aiDepot && x.depot !== aiDepot)
                return false;

            // PRODUCT FILTER
            if (aiProduct && x.product_name !== aiProduct)
                return false;

            // OVERALL LEVEL
            if (!aiDepot && !aiProduct) {

                return x.forecast_level === "OVERALL";
            }

            // DEPOT LEVEL
            if (aiDepot && !aiProduct) {

                return x.forecast_level === "DEPOT";
            }

            // DEPOT PRODUCT LEVEL
            if (aiDepot && aiProduct) {

                return x.forecast_level === "DEPOT_PRODUCT";
            }

            return true;
        });
        const groupedModels = {};

        aiFiltered.forEach((x) => {

            if (
                !groupedModels[x.model]
            ) {

                groupedModels[x.model] = [];
            }

            groupedModels[x.model].push(x);
        });

        let bestModel = "";
        let bestMape = Infinity;

        Object.keys(groupedModels).forEach((model) => {

            const rows = groupedModels[model];

            const avgMape =

                rows.reduce(
                    (sum, r) => sum + Number(r.mape || 9999),
                    0
                )

                / rows.length;

            if (avgMape < bestMape) {

                bestMape = avgMape;

                bestModel = model;
            }
        });

        setAiBestModel(bestModel);
        const bestMetricRow =

            groupedModels[bestModel]

                ?.filter(
                    x =>

                        x.mape !== null &&

                        x.rmse !== null &&

                        x.mae !== null
                )

                ?.sort(
                    (a, b) =>
                        Number(a.mape || 9999)
                        -
                        Number(b.mape || 9999)
                )[0] || {};

        setAiMetrics({

            mape:
                Number(bestMetricRow?.mape || 0),

            rmse:
                Number(bestMetricRow?.rmse || 0),

            mae:
                Number(bestMetricRow?.mae || 0)
        });

        const bestData =

            groupedModels[bestModel]

                ?.filter(x => {

                    // OVERALL
                    if (!aiDepot && !aiProduct)
                        return x.forecast_level === "OVERALL";

                    // DEPOT
                    if (aiDepot && !aiProduct)
                        return x.forecast_level === "DEPOT";

                    // DEPOT PRODUCT
                    if (aiDepot && aiProduct)
                        return x.forecast_level === "DEPOT_PRODUCT";

                    return true;
                })

            || [];
        const formattedAiData = bestData.map(x => ({

            date:
                String(x.forecast_date)
                    .substring(0, 10),
            created_at: x.created_at,

            actual:
                Number(

                    aiUnit === "bags"

                        ? x.actual || 0

                        : x.actual_mt || 0
                ),

            forecast:
                Number(

                    aiUnit === "bags"

                        ? x.forecast || 0

                        : x.forecast_mt || 0
                ),

            is_future: x.is_future
        }));

        // ================= LAST 10 HISTORY + FUTURE =================

        const historicalAi = formattedAiData
            .filter(x => !x.is_future)
            .slice(-10);

        const futureAi = formattedAiData
            .filter(x => x.is_future);

        setAiChartData([
            ...historicalAi,
            ...futureAi
        ]);

          
        
        const overallActualMap = {};
        const productActualMap = {};
        const depotActualMap = {};

        filteredOrders.forEach((x) => {

            const date =
                String(x.order_date)
                    .substring(0, 10);

            // ================= OVERALL =================

            if (

                !overallCity
                ||

                overallCity === ""

                ||

                overallCity === "All Cities"

                ||

                dealerCityMap[x.dealer_id] === overallCity
            ) {

                if (!overallActualMap[date]) {

                    overallActualMap[date] = {
                        actual: 0,
                        actual_mt: 0
                    };
                }

                overallActualMap[date].actual +=
                    Number(x.bags || 0);

                overallActualMap[date].actual_mt +=
                    Number(x.total_weight_mt || 0);
            }

            // ================= PRODUCT =================

            if (
                !selectedProduct ||
                x.product_name === selectedProduct
            ) {

                if (!productActualMap[date]) {

                    productActualMap[date] = {
                        actual: 0,
                        actual_mt: 0
                    };
                }

                productActualMap[date].actual +=
                    Number(x.bags || 0);

                productActualMap[date].actual_mt +=
                    Number(x.total_weight_mt || 0);
            }

            // ================= DEPOT =================

            if (
                !selectedDepot ||
                x.assigned_depot === selectedDepot
            ) {

                if (!depotActualMap[date]) {

                    depotActualMap[date] = {
                        actual: 0,
                        actual_mt: 0
                    };
                }

                depotActualMap[date].actual +=
                    Number(x.bags || 0);

                depotActualMap[date].actual_mt +=
                    Number(x.total_weight_mt || 0);
            }
        });
        const uniqueDates = [

            ...new Set([

                ...overallFiltered.map(
                    x => String(x.forecast_date).substring(0, 10)
                ),

                ...Object.keys(overallActualMap)
            ])
        ].sort(
            (a, b) => new Date(a) - new Date(b)
        );

        const last20Dates =
            Object.keys(overallActualMap)
                .sort((a, b) => new Date(a) - new Date(b))
                .slice(-10);

        const lastActualDates =
            Object.keys(overallActualMap)
                .sort((a, b) => new Date(a) - new Date(b))
                .slice(-10);

        const futureDates =
            overallFiltered
                .filter(x => x.is_future === true)
                .map(x => String(x.forecast_date).substring(0, 10));

        const allowedDates = [

            ...new Set([
                ...last20Dates,
                ...futureDates
            ])
        ];

        const limitedOverallFiltered =
            overallFiltered.filter(x =>

                allowedDates.includes(
                    String(x.forecast_date).substring(0, 10)
                )
            );
        // ================= FORMAT =================

        // ================= FORMAT =================

        const formatData = (
            rows,
            currentModel,
            actualMap
        ) => {

            const grouped = {};

            // ================= FORECAST ROWS =================

            rows.forEach((x) => {

                const date =
                    String(x.forecast_date)
                        .substring(0, 10);

                if (!grouped[date]) {

                    grouped[date] = {

                        date,

                        actual: 0,
                        actual_mt: 0,

                        historical_forecast: 0,
                        historical_forecast_mt: 0,

                        future_forecast: 0,
                        future_forecast_mt: 0,
                    };
                }

                // HISTORICAL

                // ================= HISTORICAL FORECAST =================

                // FUTURE FORECAST
                // HISTORICAL FORECAST
                if (
                    x.is_future === false &&
                    x.model?.toLowerCase() === currentModel?.toLowerCase()
                ) {

                    grouped[date].historical_forecast +=
                        Number(x.forecast || 0);

                    grouped[date].historical_forecast_mt +=
                        Number(x.forecast_mt || 0);
                }

                // ================= FUTURE FORECAST =================

                // FUTURE FORECAST
                // FUTURE FORECAST
                if (
                    x.is_future === true &&
                    x.model?.toLowerCase() === currentModel?.toLowerCase()
                ) {

                    grouped[date].future_forecast +=
                        Number(x.forecast || 0);

                    grouped[date].future_forecast_mt +=
                        Number(x.forecast_mt || 0);
                }
            });

            // ================= ADD ACTUAL DATES =================

            Object.keys(actualMap).forEach((date) => {

                if (!grouped[date]) {

                    grouped[date] = {

                        date,

                        actual: 0,
                        actual_mt: 0,

                        historical_forecast: 0,
                        historical_forecast_mt: 0,

                        future_forecast: 0,
                        future_forecast_mt: 0,
                    };
                }

                grouped[date].actual =
                    actualMap[date].actual;

                grouped[date].actual_mt =
                    actualMap[date].actual_mt;
            });

            // ================= ARRAY =================

            let formatted = Object.values(grouped);

            formatted.sort(
                (a, b) =>
                    new Date(a.date) -
                    new Date(b.date)
            );

            // ================= LAST ACTUAL DATE =================

            const lastActualDate = formatted
                .filter(x => x.actual > 0)
                .slice(-1)[0]?.date;

            // ================= FINAL FORECAST =================

            // ================= LAST 10 ACTUALS =================

            const actualDates = formatted
                .filter(x => x.actual > 0)
                .map(x => x.date);

            const last10ActualDates =
                actualDates.slice(-10);

            // ================= FINAL FORECAST =================

            formatted = formatted.map((x) => {

                const is_last_10_days =
                    last10ActualDates.includes(x.date);

                let forecast_line =
                    null;

                let forecast_line_mt =
                    null;

                // ================= HISTORICAL =================

                if (

                    x.historical_forecast > 0

                    &&

                    is_last_10_days

                ) {

                    forecast_line =
                        x.historical_forecast;

                    forecast_line_mt =
                        x.historical_forecast_mt;
                }

                // ================= FUTURE =================

                if (x.future_forecast > 0) {

                    forecast_line =
                        x.future_forecast;

                    forecast_line_mt =
                        x.future_forecast_mt;
                }

                return {

                    ...x,

                    is_last_10_days,

                    forecast_line,
                    forecast_line_mt
                };
            });

            return formatted;
        };
        // ================= FINAL DATA =================

        const overallFormatted =
            formatData(
                limitedOverallFiltered,
                overallModel,
                overallActualMap
            ).filter(
                x =>

                    x.actual > 0 ||

                    x.forecast_line > 0
            );

        const productFormatted =
            formatData(
                productFiltered,
                productModel,
                productActualMap
            ).filter(
                x =>

                    x.actual > 0 ||

                    x.forecast_line > 0
            );
        const depotFormatted =
            formatData(
                depotFiltered,
                depotModel,
                depotActualMap
            ).filter(
                x =>

                    x.actual > 0 ||

                    x.forecast_line > 0
            );
        const calculateAverage = (arr, currentUnit) => {

            if (!arr.length) return 0;

            const vals = arr
                .map((x) => {

                    if (currentUnit === "bags") {

                        return (
                            Number(x.actual || 0) ||
                            Number(x.forecast_line || 0)
                        );
                    }

                    return (
                        Number(x.actual_mt || 0) ||
                        Number(x.forecast_line_mt || 0)
                    );
                })
                .filter(v => v > 0);

            if (!vals.length) return 0;

            return (
                vals.reduce((a, b) => a + b, 0)
                / vals.length
            );
        };

       
        const finalOverallAvg =
            calculateAverage(
                overallFormatted,
                overallUnit
            );
      
        const overallWithAverage =
            overallFormatted.map(x => ({

                ...x,

                average_line: finalOverallAvg
            }));

        setOverallAvg(finalOverallAvg);

        setOverallData(overallWithAverage);
       

        setProductData(productFormatted);

        setDepotData(depotFormatted);

        // ================= METRICS =================

        // ================= METRICS =================

        const overallMetricRow =

            data

                .filter((x) => {

                    if (
                        x.model?.toLowerCase() !==
                        overallModel?.toLowerCase()
                    ) return false;

                    if (
                        x.mape == null ||
                        x.rmse == null ||
                        x.mae == null
                    ) return false;

                    // OVERALL
                    if (
                        !overallCity ||
                        overallCity === "" ||
                        overallCity === "All Cities"
                    ) {

                        return x.forecast_level === "OVERALL";
                    }

                    // CITY
                    return (
                        x.forecast_level === "CITY"
                        &&
                        x.city === overallCity
                        &&
                        x.model?.toLowerCase() ===
                        overallModel?.toLowerCase()
                    );
                })

                .sort(
                    (a, b) =>
                        Number(a.mape || 9999)
                        -
                        Number(b.mape || 9999)
                )[0] || {};
        const productMetricRow =

            data

                .filter((x) => {

                    if (
                        x.model?.toLowerCase() !==
                        productModel?.toLowerCase()
                    ) return false;

                    if (
                        x.mape == null ||
                        x.rmse == null ||
                        x.mae == null
                    ) return false;

                    // ALL PRODUCTS
                    if (
                        !selectedProduct ||
                        selectedProduct === "" ||
                        selectedProduct === "All Products"
                    ) {

                        return x.forecast_level === "OVERALL";
                    }

                    // PRODUCT
                    return (
                        x.forecast_level === "PRODUCT"
                        &&
                        x.product_name === selectedProduct
                        &&
                        x.model?.toLowerCase() ===
                        productModel?.toLowerCase()
                    );
                })

                .sort(
                    (a, b) =>
                        Number(a.mape || 9999)
                        -
                        Number(b.mape || 9999)
                )[0] || {};
        const depotMetricRow =

            data

                .filter((x) => {

                    if (
                        x.model?.toLowerCase() !==
                        depotModel?.toLowerCase()
                    ) return false;

                    if (
                        x.mape == null ||
                        x.rmse == null ||
                        x.mae == null
                    ) return false;

                    // ALL DEPOTS
                    if (
                        !selectedDepot ||
                        selectedDepot === "" ||
                        selectedDepot === "All Depots"
                    ) {

                        return x.forecast_level === "OVERALL";
                    }

                    // DEPOT
                    return (
                        x.forecast_level === "DEPOT"
                        &&
                        x.depot === selectedDepot
                        &&
                        x.model?.toLowerCase() ===
                        depotModel?.toLowerCase()
                    );
                })

                .sort(
                    (a, b) =>
                        Number(a.mape || 9999)
                        -
                        Number(b.mape || 9999)
                )[0] || {};
        setMetrics({

            overall:
                overallMetricRow || {},

            product:
                productMetricRow || {},

            depot:
                depotMetricRow || {}
        });

        // ================= AVERAGE =================

        

        setOverallAvg(
            calculateAverage(
                overallFormatted,
                overallUnit
            )
        );

        setProductAvg(
            calculateAverage(
                productFormatted,
                productUnit
            )
        );

        setDepotAvg(
            calculateAverage(
                depotFormatted,
                depotUnit
            )
        );
    };

    // ================= CHART =================

    const renderChart = (
        title,
        data,
        avg,
        metric,
        model,
        setModel,
        filter,
        setFilter,
        options,
        label,
        unit,
        setUnit
    ) => {
        const actualKey =

            unit === "bags"

                ? "actual"

                : "actual_mt";

       
        
        return (

            <div className="forecast-section">

                {/* HEADER */}

                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "20px",
                        flexWrap: "wrap",
                        marginBottom: "30px"
                    }}
                >

                    {/* LEFT SIDE */}

                    {/* LEFT SIDE */}
                    <div>
                        <h1 className="section-title">
                            {title}
                        </h1>

                       
                    </div>

                    {/* CENTER METRICS */}
                    <div
                        style={{
                            display: "flex",
                            gap: "18px",
                            alignItems: "center",
                            flexWrap: "wrap"
                        }}
                    >
                     
                        
                        <div
                            style={{
                                display: "flex",
                                gap: "14px",
                                alignItems: "center",
                                flexWrap: "wrap"
                            }}
                        >

                            <div
                                style={{
                                    minWidth: "145px",
                                    padding: "16px 20px",
                                    borderRadius: "16px",
                                    background: "#ffffff",
                                    boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                                    border: "1px solid #dbeafe"
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: "28px",
                                        color: "#64748b",
                                        fontWeight: "600"
                                    }}
                                >
                                    MAPE
                                </div>

                                <div
                                    style={{
                                        fontSize: "28px",
                                        fontWeight: "800",
                                        color: "#1e3a8a"
                                    }}
                                >
                                    {Number(metric?.mape || 0).toFixed(2)}%
                                </div>
                            </div>

                            <div
                                style={{
                                    minWidth: "120px",
                                    padding: "12px 16px",
                                    borderRadius: "16px",
                                    background: "#ffffff",
                                    boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                                    border: "1px solid #dbeafe"
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: "12px",
                                        color: "#64748b",
                                        fontWeight: "600"
                                    }}
                                >
                                    RMSE
                                </div>

                                <div
                                    style={{
                                        fontSize: "22px",
                                        fontWeight: "800",
                                        color: "#1e3a8a"
                                    }}
                                >
                                    {Number(metric?.rmse || 0).toFixed(2)}
                                </div>
                            </div>

                            <div
                                style={{
                                    minWidth: "120px",
                                    padding: "12px 16px",
                                    borderRadius: "16px",
                                    background: "#ffffff",
                                    boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                                    border: "1px solid #dbeafe"
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: "12px",
                                        color: "#64748b",
                                        fontWeight: "600"
                                    }}
                                >
                                    MAE
                                </div>

                                <div
                                    style={{
                                        fontSize: "22px",
                                        fontWeight: "800",
                                        color: "#1e3a8a"
                                    }}
                                >
                                    {Number(metric?.mae || 0).toFixed(2)}
                                </div>
                            </div>

                        </div>

                        {/* UNIT SELECT */}

                        <select
                            value={unit}
                            onChange={(e) =>
                                setUnit(e.target.value)
                            }

                            style={{

                                width: "120px",

                                height: "46px",

                                borderRadius: "14px",

                                border:
                                    "1px solid rgba(59,130,246,0.18)",

                                background:
                                    "rgba(255,255,255,0.95)",

                                padding: "0 14px",

                                fontSize: "15px",

                                fontWeight: "600",

                                color: "#1e293b",

                                boxShadow:
                                    "0 4px 12px rgba(0,0,0,0.04)"
                            }}
                        >

                            <option value="bags">
                                Bags
                            </option>

                            <option value="mt">
                                MT
                            </option>

                        </select>

                        

                    </div>

                </div>

                {/* FILTERS */}

                <div className="forecast-controls">

                    {
                        options && (

                            <select
                                value={filter}
                                onChange={(e) =>
                                    setFilter(
                                        e.target.value
                                    )
                                }
                            >

                                <option value="">
                                    All {label}
                                </option>

                                {
                                    options.map(
                                        (x, i) => (

                                            <option
                                                key={i}
                                                value={x}
                                            >
                                                {x}
                                            </option>

                                        )
                                    )
                                }

                            </select>
                        )
                    }

                    {/* MODEL */}

                    <select
                        value={model}
                        onChange={(e) =>
                            setModel(
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
                            Holt
                        </option>

                        <option value="prophet">
                            Prophet
                        </option>

                        <option value="neuralprophet">
                            NeuralProphet
                        </option>

                        <option value="xgboost">
                            XGBoost
                        </option>

                        <option value="lightgbm">
                            LightGBM
                        </option>

                        <option value="lstm">
                            LSTM
                        </option>

                        <option value="gru">
                            GRU
                        </option>

                        <option value="nbeats">
                            NBEATS
                        </option>

                        <option value="tft">
                            TFT
                        </option>

                        <option value="ensemble">
                            Ensemble
                        </option>                    

                    </select>

                </div>

                {/* CHART */}

                <div
                    className="chart-box"
                    style={{

                        width: "97%",

                        margin: "0 auto",

                        height: "520px",

                        background:
                            "linear-gradient(135deg, rgba(255,255,255,0.92), rgba(248,250,252,0.96))",

                        borderRadius: "28px",

                        padding: "24px",

                        border:
                            "1px solid rgba(148,163,184,0.12)",

                        boxShadow:
                            "0 10px 30px rgba(15,23,42,0.08)",

                        backdropFilter: "blur(18px)"
                    }}
                >

                    <ResponsiveContainer
                        width="100%"
                        height="100%"
                    >

                        <LineChart
                            data={data}
                            margin={{
                                top: 20,
                                right: 30,
                                left: 10,
                                bottom: 10
                            }}
                        >

                            <CartesianGrid
                                strokeDasharray="4 4"
                                stroke="rgba(100,116,139,0.18)"
                            />
                            <XAxis
                                dataKey="date"
                                tick={{
                                    fill: "#475569",
                                    fontSize: 12,
                                    fontWeight: 500
                                }}
                                axisLine={false}
                                tickLine={false}
                            />

                            <YAxis
                                tick={{
                                    fill: "#475569",
                                    fontSize: 12
                                }}

                                axisLine={false}

                                tickLine={false}
                            />

                            <Tooltip
                                content={({ active, payload, label }) => {

                                    if (!active || !payload || !payload.length)
                                        return null;

                                    return (
                                        <div
                                            style={{
                                                background: "#fff",
                                                padding: "14px",
                                                borderRadius: "12px",
                                                border: "1px solid #dbeafe",
                                                boxShadow: "0 6px 20px rgba(0,0,0,0.08)"
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontWeight: "700",
                                                    marginBottom: "8px"
                                                }}
                                            >
                                                Date: {label}
                                            </div>

                                            {payload.map((entry, index) => (

                                                <div
                                                    key={index}
                                                    style={{
                                                        color: entry.color,
                                                        marginBottom: "4px"
                                                    }}
                                                >
                                                    {entry.name} :
                                                    {" "}
                                                    {Number(entry.value).toFixed(2)}
                                                    {" "}
                                                    {unit === "bags" ? "Bags" : "MT"}
                                                </div>

                                            ))}

                                            <div
                                                style={{
                                                    color: "red",
                                                    fontWeight: "700",
                                                    marginTop: "6px"
                                                }}
                                            >
                                                Average :
                                                {" "}
                                                {Number(
                                                    data?.[0]?.average_line || avg
                                                ).toFixed(2)}
                                                {" "}
                                                {unit === "bags" ? "Bags" : "MT"}
                                            </div>

                                        </div>
                                    );
                                }}
                            />

                            <Legend />

                            <ReferenceLine
                                y={data?.[0]?.average_line || avg}
                                stroke="red"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                label="Average"
                            />

                           

                            {/* ACTUAL */}

                            <Line
                                type="monotone"
                                dataKey={actualKey}
                                stroke="#111827"
                                strokeWidth={3}
                                dot={false}
                                connectNulls={true}
                                name="Actual"
                            />

                            {/* FORECAST */}
                            {/* HISTORICAL FORECAST */}

                            <Line
                                type="monotone"
                                dataKey={
                                    unit === "mt"
                                        ? "forecast_line_mt"
                                        : "forecast_line"
                                }
                                stroke="#2563eb"
                                strokeWidth={3}
                                dot={false}
                                strokeDasharray="6 6"
                                connectNulls={true}
                                name="Forecast"
                            />

                        </LineChart>

                    </ResponsiveContainer>

                </div>

            </div>
        );
    };

    // ================= UI =================

    return (

        <div className="overall-container">

            {/* HEADER */}

            <div className="page-top">

                <h1>
                    📊 Analytics Dashboard
                </h1>

               

            </div>

            {/* HERO */}

            <div className="analytics-banner">

                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "50px",
                        width: "100%"
                    }}
                >

                    {/* LEFT SIDE */}
                    <div
                        style={{
                            width: "38%"
                        }}
                    >

                        <h1>
                            🤖 AI Smart Forecasting
                        </h1>

                        <p
                            style={{
                                opacity: 0.9,
                                fontSize: "15px"
                            }}
                        >
                            Forecast Dataset Updated On:
                            {" "}
                            <strong>
                                {
                                    aiChartData?.length > 0
                                        ? new Date(
                                            aiChartData[0]?.created_at
                                        ).toLocaleString()
                                        : "Loading..."
                                }
                            </strong>
                        </p>

                        {/* CONTROLS */}

                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "16px",
                                marginTop: "28px"
                            }}
                        >
                        

                            {/* UNIT */}
                            <select
                                value={aiUnit}
                                onChange={(e) =>
                                    setAiUnit(e.target.value)
                                }
                                style={{
                                    padding: "14px",
                                    borderRadius: "14px",
                                    border: "none",
                                    fontSize: "16px"
                                }}
                            >
                                <option value="bags">
                                    Bags
                                </option>

                                <option value="mt">
                                    MT
                                </option>
                            </select>
                            

                            {/* DEPOT */}
                            <select
                                value={aiDepot}
                                onChange={(e) =>
                                    setAiDepot(e.target.value)
                                }
                                style={{
                                    padding: "14px",
                                    borderRadius: "14px",
                                    border: "none",
                                    fontSize: "16px"
                                }}
                            >
                                <option value="">
                                    Select Depot
                                </option>

                                {
                                    depots.map((x, i) => (

                                        <option
                                            key={i}
                                            value={x}
                                        >
                                            {x}
                                        </option>

                                    ))
                                }
                            </select>

                            {/* PRODUCT */}
                            <select
                                value={aiProduct}
                                onChange={(e) =>
                                    setAiProduct(e.target.value)
                                }
                                style={{
                                    padding: "14px",
                                    borderRadius: "14px",
                                    border: "none",
                                    fontSize: "16px"
                                }}
                            >
                                <option value="">
                                    Select Product
                                </option>

                                {
                                    aiProducts.map((x, i) => (

                                        <option
                                            key={i}
                                            value={x}
                                        >
                                            {x}
                                        </option>

                                    ))
                                }
                            </select>

                        </div>

                        {/* MODEL */}
                        <div
                            style={{
                                marginTop: "30px",
                                color: "white"
                            }}
                        >

                            <div
                                style={{
                                    fontSize: "28px",
                                    fontWeight: "700"
                                }}
                            >
                                BEST MODEL:
                                {" "}
                                {aiBestModel || "Loading..."}
                            </div>

                            {/* METRICS */}

                            <div
                                style={{
                                    display: "flex",
                                    gap: "14px",
                                    marginTop: "22px",
                                    flexWrap: "wrap"
                                }}
                            >

                                <div className="metric-box">
                                    MAPE:
                                    {" "}
                                    {Number(aiMetrics.mape || 0).toFixed(2)}%
                                </div>

                                <div className="metric-box">
                                    RMSE:
                                    {" "}
                                    {Number(aiMetrics.rmse || 0).toFixed(2)}
                                </div>

                                <div className="metric-box">
                                    MAE:
                                    {" "}
                                    {Number(aiMetrics.mae || 0).toFixed(2)}
                                </div>

                            </div>

                        </div>

                    </div>

                    {/* RIGHT SIDE */}
                    <div
                        style={{
                            width: "62%"
                        }}
                    >   
                        

                        <div
                            
                            style={{
                                width: "95%",
                                height: "420px",

                                background:
                                    "linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.05))",

                                border:
                                    "1px solid rgba(255,255,255,0.18)",

                                borderRadius: "28px",

                                padding: "26px",

                                backdropFilter: "blur(18px)",

                                boxShadow:
                                    "0 12px 40px rgba(0,0,0,0.22)",

                                position: "relative",

                                overflow: "hidden"
                            }}
                        >

                            <ResponsiveContainer
                                width="100%"
                                height="100%"
                            >

                                <LineChart
                                    data={aiChartData}
                                >
                                    <defs>
                                        <linearGradient
                                            id="chartGlow"
                                            x1="0"
                                            y1="0"
                                            x2="0"
                                            y2="1"
                                        >
                                            <stop
                                                offset="0%"
                                                stopColor="rgba(255,255,255,0.20)"
                                            />

                                            <stop
                                                offset="100%"
                                                stopColor="rgba(255,255,255,0.02)"
                                            />
                                        </linearGradient>
                                    </defs>

                                    <CartesianGrid
                                        stroke="rgba(255,255,255,0.08)"
                                        strokeDasharray="3 3"
                                    />

                                    <XAxis
                                        dataKey="date"
                                        tick={{
                                            fill: "white",
                                            fontSize: 12
                                        }}
                                        axisLine={false}
                                        tickLine={false}
                                    />

                                    <YAxis
                                        tick={{
                                            fill: "white",
                                            fontSize: 12
                                        }}
                                        axisLine={false}
                                        tickLine={false}
                                    />

                                    <Tooltip
                                        contentStyle={{
                                            background: "#ffffff",
                                            border: "none",
                                            borderRadius: "14px",
                                            color: "#111",
                                            boxShadow:
                                                "0 6px 24px rgba(0,0,0,0.18)"
                                        }}

                                        labelStyle={{
                                            color: "#111",
                                            fontWeight: "700"
                                        }}

                                        itemStyle={{
                                            color: "#111",
                                            fontWeight: "600"
                                        }}

                                        formatter={(value, name) => [

                                            `${Number(value).toFixed(2)} ${aiUnit === "bags"
                                                ? "Bags"
                                                : "MT"
                                            }`,

                                            name
                                        ]}
                                    />

                                    <Legend />

                                    {/* ACTUAL */}
                                    <Line
                                        type="monotone"
                                        dataKey="actual"
                                        stroke="#111827"
                                        strokeWidth={3}
                                        dot={false}
                                        name="Actual"
                                    />

                                    {/* FORECAST */}
                                    <Line
                                        type="monotone"
                                        dataKey="forecast"
                                        stroke="#f8fafc"
                                        strokeWidth={3}
                                        strokeDasharray="6 6"
                                        dot={false}
                                        name="Forecast"
                                    />

                                </LineChart>

                            </ResponsiveContainer>

                        </div>

                    </div>

                </div>
               

            </div>

            {/* OVERALL */}

            {
                renderChart(
                    "📊 Overall Forecast",
                    overallData,
                    overallAvg,
                    metrics.overall,
                    overallModel,
                    setOverallModel,
                    overallCity,
                    setOverallCity,
                    cities, 
                    "Cities",                  
                    overallUnit,
                    setOverallUnit
                )
            }

            {/* PRODUCT */}

            {
                renderChart(
                    "📦 Product Forecast",
                    productData,
                    productAvg,
                    metrics.product,
                    productModel,
                    setProductModel,
                    selectedProduct,
                    setSelectedProduct,
                    products,
                    "Products",
                    productUnit,
                    setProductUnit
                )
            }

            {/* DEPOT */}

            {
                renderChart(
                    "🏭 Depot Forecast",
                    depotData,
                    depotAvg,
                    metrics.depot,
                    depotModel,
                    setDepotModel,
                    selectedDepot,
                    setSelectedDepot,
                    depots,
                    "Depots",
                    depotUnit,
                    setDepotUnit
                )
            }

        </div>
    );
}

export default AnalyticsTab;