# WellTegra Forensic Harvester: User Manual

## 1. Introduction
The **WellTegra Forensic Harvester** is a high-fidelity audit platform designed for the oil & gas industry. It serves as the "Forensic Intelligence" layer for the WellTegra & WellArk ecosystem, providing physics-anchored interpretations of raw sensor and well data.

The platform bridges the gap between **Public Operator Data** (NSTA, NDR, OPRED) and **Forensic Truth**, identifying discrepancies through rigorous mass-energy balance and sensor drift validation.

---

## 2. Core Capabilities

### 2.1 Forensic Harvesting
The **Harvester** automatically pulls data from public sources (e.g., NSTA ArcGIS) and runs it through the **WellTegra Physics Engine (v1.2)**. 
- **Automated Ingestion:** Triggers data collection for specific assets (Stella, Gannet, Viking).
- **Physics Validation:** Applies forensic rules to calculate the "Forensic Truth" of production volumes.

### 2.2 Physics-Anchored Audits
Every audit is backed by detailed forensic calculations:
- **Mass-Balance Delta:** The physical discrepancy between reported and calculated volumes.
- **Sensor Drift Factor:** A forensic metric identifying degradation or miscalibration in field sensors.
- **Statistical Significance (P-Value):** Validation of the audit's accuracy through iterative simulations.

### 2.3 Visual Intelligence (WellArk)
Integrated with the **WellArk Visual Intelligence** layer, the platform visualizes the "Ground Truth":
- **Spatial Mapping:** Visualizes assets and their forensic status.
- **Timeline Evolution:** Tracks "Truth Levels" (Public vs. Forensic) over the life of a well.

---

## 3. User Guide

### 3.1 Navigation
The application is divided into four primary modules:
1.  **Dashboard:** High-level overview of asset status, system health, and recent forensic alerts.
2.  **WellArk Visuals:** The spatial and graph-based visualization layer.
3.  **Forensic Audits:** The core auditing workspace containing detailed logs and historical trends.
4.  **Knowledge Base:** Forensic interpretations, blog posts, and "X-Ray" interpretations of public files.

### 3.2 Performing a Forensic Audit
1.  Select an **Asset** from the sidebar (e.g., Stella).
2.  Navigate to the **Forensic Audits** tab.
3.  Click **Trigger Forensic Harvest** to pull the latest data and run the physics engine.
4.  Review the new audit log entry for **Discrepancy** and **Confidence** scores.

### 3.3 Audit Comparison Matrix
To compare multiple audits side-by-side:
1.  In the **Forensic Audits** tab, use the checkboxes to select two or more audits.
2.  Click **Compare Side-by-Side** in the floating comparison bar.
3.  Review the **Comparative Insights** panel for trends in discrepancy and sensor drift.

### 3.4 Historical Trend Analysis
Scroll to the bottom of the **Forensic Audits** tab to view the **Historical Production Analysis**:
- **Solid Line (Emerald):** Forensic Truth.
- **Dashed Line (Gray):** Publicly Reported Data.
- Hover over data points to see precise volumes for specific audit periods.

---

## 4. Admin & Data Management

### 4.1 Authentication
To manage assets or trigger harvests that persist in the database, you must **Sign In with Google**.
- **Admin Access:** Certain features (like Seeding Data or triggering Harvester writes) are restricted to authorized accounts.

### 4.2 Database Persistence
The application uses **Google Firestore** for real-time, persistent storage.
- **Real-Time Sync:** Changes made by the Harvester or admins are reflected instantly across all user dashboards.
- **Data Seeding:** If the database is empty, admins can use the **Seed Initial Asset Data** button in the sidebar to populate the environment with baseline forensic data for Stella, Gannet, and Viking.

---

## 5. Technical Architecture
- **Frontend:** React with TypeScript, Tailwind CSS, and Motion (for animations).
- **Charts:** Recharts (LineChart, AreaChart).
- **Backend:** Firebase (Firestore for data, Auth for security).
- **Icons:** Lucide-React.
- **Styling:** Technical "Dark Mode" aesthetic designed for high-density forensic data.

---

## 6. Support & Provenance
Every piece of data in the dashboard includes a **Provenance Tooltip** or **Audit Provenance** section, detailing the source (e.g., NSTA API) and the validation engine version used.

*For forensic support or interpretation requests, please refer to the Knowledge Base.*
