import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children, requiredPlan }) {
    const currentPlan = localStorage.getItem("autograph_plan");

    // Brak planu -> w ogóle brak dostępu
    if (!currentPlan || currentPlan === "none") {
        return <Navigate to="/user" replace />;
    }

    if (requiredPlan === "maximum" && currentPlan !== "maximum") {
        return <Navigate to="/user" replace />;
    }

    return children;
}
