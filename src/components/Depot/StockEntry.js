import React, { useEffect, useState } from "react";
import "./StockEntry.css";
import { supabase } from "../../supabaseClient";

function StockEntry() {
    const [grn, setGrn] = useState("");
    const [truck, setTruck] = useState("");
    const [products, setProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [bagWeight, setBagWeight] = useState(50);
    const [bags, setBags] = useState(0);
    const [date, setDate] = useState("");
    const [depots, setDepots] = useState([]);
    const [selectedDepot, setSelectedDepot] = useState("");
    const [locations, setLocations] = useState([]);
    const [capacityMsg, setCapacityMsg] = useState("");
    const [isCapacityExceeded, setIsCapacityExceeded] = useState(false);

    // ✅ Calculate MT safely
    const stockMT = ((bagWeight * bags) / 1000).toFixed(2);
    const isFormInvalid =
        !grn ||
        !truck ||
        !selectedDepot ||
        !selectedProduct ||
        bags <= 0 ||
        !date;

    // ✅ Load products
    useEffect(() => {
        fetchProducts();
        fetchDepots();   // 👈 ADD THIS LINE
    }, []);
    const fetchProducts = async () => {
        const { data, error } = await supabase
            .from("product_master")
            .select("product_code, product_name");

        if (error) {
            console.error("Error loading products:", error);
            return;
        }

        setProducts(data || []);
    };
    const fetchDepots = async () => {
        const { data, error } = await supabase
            .from("depot_master")
            .select("depot_code");

        if (error) {
            console.error("Depot error:", error);
            return;
        }

        setDepots(data || []);

        
    };
    const calculateStorage = async (bagsValue) => {
        if (!selectedDepot || bagsValue <= 0) return;

        const bagsPerStack = 15;

        // 🔹 Get depot details
        const { data: depot } = await supabase
            .from("depot_master")
            .select("max_rows, max_columns, total_stacks, capacity_mt")
            .eq("depot_code", selectedDepot)
            .single();

        if (!depot) return;



        const rows = depot.max_rows;
        const cols = depot.max_columns;

        // 🔹 Get used positions
        const { data: used } = await supabase
            .from("depot_stock")
            .select("row_no, column_no, number_of_bags, bag_weight")
            .eq("depot_code", selectedDepot);

        const occupied = new Set(
            used.map((s) => `${s.row_no}-${s.column_no}`)
        );

        const numStacks = Math.ceil(bagsValue / bagsPerStack);

        let loc = [];

        for (let r = 1; r <= rows; r++) {
            for (let c = 1; c <= cols; c++) {
                if (!occupied.has(`${r}-${c}`)) {
                    loc.push(`R${r}-C${c}`);
                }
                if (loc.length === numStacks) break;
            }
            if (loc.length === numStacks) break;
        }

        setLocations(loc);

        // 🔹 Capacity calculation
        // 🔹 Capacity calculation (FIXED)
        const totalCapacityBags = depot.total_stacks * 15;

        const usedBags = used.reduce(
            (sum, item) => sum + item.number_of_bags,
            0
        );

        const futureUtil = ((usedBags + bagsValue) / totalCapacityBags) * 100;
        if (futureUtil >= 100) {
            setCapacityMsg(`🚫 Capacity exceeded: ${futureUtil.toFixed(1)}%`);
            setIsCapacityExceeded(true);   // 🔥 ADD THIS
        } else {
            setCapacityMsg(
                `✅ Available capacity after intake: ${(100 - futureUtil).toFixed(1)}%`
            );
            setIsCapacityExceeded(false);  // 🔥 ADD THIS
        }
    };

    // ✅ Save Function (basic safe version)
    const saveStock = async () => {
        try {
            // 🔴 1. Form validation
            if (!grn || !truck || !selectedDepot || !selectedProduct || bags <= 0 || !date) {
                alert("⚠️ Fill all required fields");
                return;
            }

            // 🔴 2. Capacity check
            if (isCapacityExceeded) {
                alert("🚫 Depot capacity exceeded. Cannot save.");
                return;
            }

            // 🔴 3. Duplicate GRN check
            const { data: duplicate, error: dupError } = await supabase
                .from("depot_stock")
                .select("id")
                .eq("sap_grn_number", grn)
                .limit(1);

            if (dupError) {
                console.error("Duplicate check error:", dupError);
                alert("❌ Error checking duplicate GRN");
                return;
            }

            if (duplicate.length > 0) {
                alert("🚫 This SAP GRN already exists. Duplicate not allowed.");
                return;
            }

            // 🔴 4. Stack logic (VERY IMPORTANT)
            let remaining = bags;
            const bagsPerStack = 15;

            const inserts = [];

            for (let loc of locations) {
                if (remaining <= 0) break;

                const fill = Math.min(bagsPerStack, remaining);
                remaining -= fill;

                // Extract row & column
                const [rowStr, colStr] = loc.split("-");
                const row = parseInt(rowStr.replace("R", ""));
                const col = parseInt(colStr.replace("C", ""));

                inserts.push({
                    depot_code: selectedDepot,
                    product_code: selectedProduct.product_code,
                    product_name: selectedProduct.product_name,

                    number_of_bags: fill,       // ✅ stack bags
                    available_stock: (fill * bagWeight) / 1000,     // ✅ used for grid

                    bag_weight: bagWeight,
                    row_no: row,
                    column_no: col,

                    sap_grn_number: grn,
                    truck_number: truck,
                    stock_received_date: date,
                });
            }

            // 🔴 5. Insert into DB
            const { error: insertError } = await supabase
                .from("depot_stock")
                .insert(inserts);

            if (insertError) {
                console.error("Insert Error:", insertError);
                alert("❌ Failed to save stock");
                return;
            }

            // 🔴 6. Remaining bags check
            if (remaining > 0) {
                alert(`⚠️ Only partially stored. ${remaining} bags not allocated.`);
            }

            alert("✅ Stock Saved Successfully");
            // 🔄 RESET FORM
            setGrn("");
            setTruck("");
            setSelectedProduct(null);
            setBags(0);
            setLocations([]);
            setCapacityMsg("");
            setDate("");

            // Optional: reset depot if needed
            // setSelectedDepot("");

            // 🔄 RELOAD DATA (important)
            fetchProducts();
            fetchDepots();

        } catch (err) {
            console.error("Unexpected error:", err);
            alert("❌ Something went wrong");
        }
    };
    return (
        <div className="stock-container">
            <h2 className="title">Stock Entry</h2>

            {/* GRN */}
            <label>SAP GRN / Material Document No</label>
            <input
                value={grn}
                onChange={(e) => setGrn(e.target.value)}
                placeholder="Enter GRN Number"
            />

            {/* Truck */}
            <label>Truck Number</label>
            <input
                value={truck}
                onChange={(e) => setTruck(e.target.value)}
                placeholder="Enter Truck Number"
            />

            {/* Depot */}
            <label>Depot Code</label>
            <select
                value={selectedDepot}
                onChange={(e) => setSelectedDepot(e.target.value)}
            >
                <option value="">Select Depot</option>   {/* 👈 important */}
                {depots.map((d) => (
                    <option key={d.depot_code} value={d.depot_code}>
                        {d.depot_code}
                    </option>
                ))}
            </select>
            {/* Product */}
            <label>Product Name</label>
            <select
                value={selectedProduct?.product_name || ""}
                onChange={(e) => {
                    const prod = products.find(
                        (p) => p.product_name === e.target.value
                    );
                    setSelectedProduct(prod || null);
                }}
            >
                <option value="">Select Product</option>
                {products.map((p) => (
                    <option key={p.product_code}>
                        {p.product_name}
                    </option>
                ))}
            </select>

            {/* Product Code */}
            <div className="info-box">
                <strong>Product Code:</strong>{" "}
                {selectedProduct?.product_code || "—"}
            </div>

            {/* Bag Weight */}
            <label>Bag Weight (kg)</label>
            <input
                type="number"
                value={bagWeight}
                onChange={(e) => setBagWeight(Number(e.target.value))}
            />

            {/* Bags */}
            <label>Number of Bags</label>
            <input
                type="number"
                value={bags === 0 ? "" : bags}
                onChange={(e) => {
                    const val = e.target.value;

                    if (val === "") {
                        setBags(0);
                        return;
                    }

                    const num = Number(val);
                    setBags(num);
                    calculateStorage(num);
                }}
            />
            {locations.length > 0 && (
                <div className="info-box">
                    📍 Load at Locations: {locations.join(", ")}
                </div>
            )}

            {capacityMsg && (
                <div className="info-box">
                    {capacityMsg}
                </div>
            )}

            {/* Stock MT */}
            <div className="info-box">
                <strong>Stock Received (MT):</strong> {stockMT}
            </div>

            {/* Date */}
            <label>Stock Received Date</label>
            <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
            />

          

            <button
                className="btn"
                onClick={saveStock}
                disabled={isFormInvalid || isCapacityExceeded}
                style={{
                    background: (isFormInvalid || isCapacityExceeded) ? "#999" : "#1d5fa7",
                    cursor: (isFormInvalid || isCapacityExceeded) ? "not-allowed" : "pointer"
                }}
            >
                SAVE GRN
            </button>
        </div>
    );
}

export default StockEntry;