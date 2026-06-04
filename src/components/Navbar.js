import React from "react";

function Navbar({ selected, setSelected, onLogout }) {
    return (
        <div style={styles.wrapper}>

            {/* TITLE */}
            <h1 style={styles.title}>🏢 Admin Application</h1>

            {/* MENU */}
            <div style={styles.menu}>
                <button
                    style={selected === "DEPO" ? styles.activeBtn : styles.btn}
                    onClick={() => setSelected("DEPO")}
                >
                    NEW DEPO
                </button>

                <button
                    style={selected === "DEALER" ? styles.activeBtn : styles.btn}
                    onClick={() => setSelected("DEALER")}
                >
                    NEW DEALER
                </button>

                <button
                    style={selected === "MONITOR" ? styles.activeBtn : styles.btn}
                    onClick={() => setSelected("MONITOR")}
                >
                    MONITOR
                </button>

                <button
                    style={selected === "DASHBOARD" ? styles.activeBtn : styles.btn}
                    onClick={() => setSelected("DASHBOARD")}
                >
                    DASHBOARD
                </button>
            </div>

            {/* LOGOUT BUTTON */}
            <button onClick={onLogout} style={styles.logout}>
                🚪 Logout
            </button>

        </div>
    );
}

const styles = {
    wrapper: {
        textAlign: "center",
        padding: "20px",
        background: "#f5f5f5",
        position: "relative",
    },

    title: {
        fontSize: "52px",
        fontWeight: "800",
        textAlign: "center",
        marginBottom: "20px",
        color: "#1e5aa8",
        letterSpacing: "1px",
        fontFamily: "'Poppins', sans-serif",
        textShadow: "0 2px 4px rgba(0,0,0,0.12)"
    },

    menu: {
        display: "flex",
        justifyContent: "flex-start",  // 👈 LEFT ALIGN
        gap: "20px",
        paddingLeft: "40px",
    },
    btn: {
        background: "#1e6bb8",   // blue
        color: "white",
        padding: "12px 30px",
        border: "none",
        borderRadius: "8px",
        fontSize: "16px",
        cursor: "pointer",
        transition: "0.3s",
    },

    activeBtn: {
        background: "red",       // 🔴 FULL ACTIVE BUTTON
        color: "white",
        padding: "12px 30px",
        border: "none",
        borderRadius: "8px",
        fontSize: "16px",
        cursor: "pointer",
        boxShadow: "0 0 12px rgba(255,0,0,0.6)",
    },

    logout: {
        position: "absolute",
        top: "20px",
        right: "20px",
        background: "#333",
        color: "white",
        padding: "8px 15px",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
    },
};

export default Navbar;